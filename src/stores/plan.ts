import { MY_FILTERS, type MyFilter, type VoteTypeValue } from '@/constants/plan'
import type { PageResult } from '@/types/api'
import type { PlanOption, PlanSummary, VoteCounts } from '@/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PageBucket {
  list: PlanSummary[]
  nextCursor: string
  hasMore: boolean
}

function emptyBucket(): PageBucket {
  return { list: [], nextCursor: '', hasMore: true }
}

function emptyMyLists(): Record<MyFilter, PageBucket> {
  return {
    created: emptyBucket(),
    joined: emptyBucket(),
    ongoing: emptyBucket(),
    ended: emptyBucket(),
  }
}

/**
 * 计划列表缓存 + 投票态（不持久化，冷启动重建）。
 * 跨页一致性的关键（技术方案 §7.2/§8.3）：详情页投票后 applyVoteResult 写入本 store，
 * 首页/我的页卡片直接绑定 voteCounts/myVotes，返回时无需重新请求列表。
 */
export const usePlanStore = defineStore('plan', () => {
  const home = ref<PageBucket>(emptyBucket())
  const myLists = ref<Record<MyFilter, PageBucket>>(emptyMyLists())
  const myVotes = ref<Record<string, VoteTypeValue>>({})
  const voteCounts = ref<Record<string, VoteCounts>>({})
  /** 选项表决：我投的选项 id（缺键 = 未投），锁定与高亮依据 */
  const myOptions = ref<Record<string, string>>({})
  /** 选项表决：逐选项票数（比例条来源），与 voteCounts 平行的权威表 */
  const optionVotes = ref<Record<string, PlanOption[]>>({})

  // 覆盖规则：vote.submit 返回的计数是「投票提交后」的服务端权威值，必然不早于任何列表快照；
  // 而飞行中的列表请求可能带着投票前的旧计数晚到，故列表只回填尚不存在的 planId，绝不覆盖已有条目。
  function absorbSummaries(list: PlanSummary[]): void {
    for (const item of list) {
      if (voteCounts.value[item.planId] === undefined) {
        voteCounts.value[item.planId] = item.votes
      }
      if (optionVotes.value[item.planId] === undefined) {
        optionVotes.value[item.planId] = item.options
      }
      if (myOptions.value[item.planId] === undefined) {
        myOptions.value[item.planId] = item.myOption
      }
    }
  }

  function writeBucket(bucket: PageBucket, page: PageResult<PlanSummary>, append: boolean): void {
    bucket.list = append ? [...bucket.list, ...page.list] : [...page.list]
    bucket.nextCursor = page.nextCursor
    bucket.hasMore = page.hasMore
    absorbSummaries(page.list)
  }

  function setHomePage(page: PageResult<PlanSummary>, append = false): void {
    writeBucket(home.value, page, append)
  }

  function setMyPage(filter: MyFilter, page: PageResult<PlanSummary>, append = false): void {
    writeBucket(myLists.value[filter], page, append)
  }

  /**
   * 列表组件 seed 的唯一口径（§8.7「切 tab 不重查」）：PageBucket 与 PageResult 同形，直接给；
   * 但**空桶返回 null**，返回空对象会被 reload 当成「加载过且为空」，首屏就此停在空态不再发请求。
   */
  function pageOf(bucket: PageBucket): PageResult<PlanSummary> | null {
    return bucket.list.length > 0 ? bucket : null
  }

  /** 首页首屏缓存（null = 还没加载过，让 reload 走正常请求） */
  function homePage(): PageResult<PlanSummary> | null {
    return pageOf(home.value)
  }

  /** 我的页某个 filter 的首屏缓存 */
  function myPage(filter: MyFilter): PageResult<PlanSummary> | null {
    return pageOf(myLists.value[filter])
  }

  /**
   * **两个数组（所有列表页的必读口径）**：本 store 的桶数组与列表组件渲染的那份
   * （`usePagingList.applyPage` 每次 `list.value = [...incoming]` 新建容器）元素同批、容器不同，
   * 所以 `patchLists`/`removePlan` 只换桶里的格子，**屏幕上那张卡不会自己变**。
   * 页面必须成对调用：`patchPlan`/`removePlan` 管跨页与下次的缓存，
   * `planListRef.patchItem`/`removeItem` 管此刻眼前的这一屏。
   */
  function patchLists(planId: string, partial: Partial<PlanSummary>): void {
    const buckets: PageBucket[] = [home.value, ...MY_FILTERS.map((f) => myLists.value[f])]
    for (const bucket of buckets) {
      const idx = bucket.list.findIndex((p) => p.planId === planId)
      if (idx >= 0) bucket.list[idx] = { ...bucket.list[idx], ...partial }
    }
  }

  /**
   * 投票成功后调用；myVote 传 null 表示未投（删除记录）。
   * 选项表决再带 options（逐选项权威票数）与 myOption（我投的选项 id）；简单表决这两项省略。
   */
  function applyVoteResult(
    planId: string,
    votes: VoteCounts,
    myVote: VoteTypeValue | null,
    options?: PlanOption[],
    myOption?: string,
  ): void {
    voteCounts.value[planId] = votes
    if (myVote === null) delete myVotes.value[planId]
    else myVotes.value[planId] = myVote
    const partial: Partial<PlanSummary> = { votes }
    if (options !== undefined) {
      optionVotes.value[planId] = options
      partial.options = options
    }
    if (myOption !== undefined) {
      if (myOption === '') delete myOptions.value[planId]
      else myOptions.value[planId] = myOption
      partial.myOption = myOption
    }
    // 同步已缓存的 summary，兼容直接绑定列表项字段（而非 voteCounts/optionVotes）的卡片
    patchLists(planId, partial)
  }

  /** 局部更新缓存中的计划（如 commentCount +1、status 变更），votes/options 变更同步进权威表 */
  function patchPlan(planId: string, partial: Partial<PlanSummary>): void {
    patchLists(planId, partial)
    if (partial.votes !== undefined) voteCounts.value[planId] = partial.votes
    if (partial.options !== undefined) optionVotes.value[planId] = partial.options
    if (partial.myOption !== undefined) {
      if (partial.myOption === '') delete myOptions.value[planId]
      else myOptions.value[planId] = partial.myOption
    }
  }

  /**
   * 删除/失效后从**五个桶**（首页 + 我的四个 filter）里摘掉同一条，并清掉它的投票态。
   * 为什么计数也清：本 store 不持久化，留着只会是一条永远刷不新的僵尸条目 ——
   * `absorbSummaries` 只填「尚不存在」的 key，而这条计划再也不会被任何列表返回。
   * **不传导到屏幕**：列表组件自己那份 `list.value` 是另一个数组（见 `patchLists` 的同款说明），
   * 调用方必须同时对它调 `removeItem`，否则卡片不会消失。
   */
  function removePlan(planId: string): void {
    const buckets: PageBucket[] = [home.value, ...MY_FILTERS.map((f) => myLists.value[f])]
    for (const bucket of buckets) {
      bucket.list = bucket.list.filter((item) => item.planId !== planId)
    }
    delete voteCounts.value[planId]
    delete myVotes.value[planId]
    delete optionVotes.value[planId]
    delete myOptions.value[planId]
  }

  function clear(): void {
    home.value = emptyBucket()
    myLists.value = emptyMyLists()
    myVotes.value = {}
    voteCounts.value = {}
    myOptions.value = {}
    optionVotes.value = {}
  }

  return {
    home,
    myLists,
    myVotes,
    voteCounts,
    myOptions,
    optionVotes,
    setHomePage,
    setMyPage,
    homePage,
    myPage,
    applyVoteResult,
    patchPlan,
    removePlan,
    clear,
  }
})
