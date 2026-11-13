import { fetchPlanDetail } from '@/api/plan'
import { ApiError } from '@/api/request'
import { submitVote } from '@/api/vote'
import { ErrorCode } from '@/constants/error-code'
import { VoteType, type VoteTypeValue } from '@/constants/plan'
import { showToastMsg } from '@/composables/useToast'
import { usePlanStore } from '@/stores/plan'
import type { PlanOption, VoteCounts } from '@/types/models'
import { logger } from '@/utils/logger'
import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'

/**
 * 投票（技术方案 §8.3）：乐观更新 → submitVote → 失败回滚，结果统一写 planStore，
 * 于是详情页投票后返回首页，卡片比例/我的投票态不用重查列表就是一致的。
 *
 * 两种模式：简单表决（赞同/反对，cast）与选项表决（投一个选项，castOption）。
 * **投过即锁定**（#60）：任一模式投成功后 locked 为真，再投本地直接忽略、服务端回 3003；
 * 不存在取消投票，也不存在 `type: 0` 的调用分支。
 */

/** 未投票的本地表示：VoteType 只有 1/2，用 0 作「无」，不与契约里的取消语义混淆 */
export const NO_VOTE = 0
export type MyVote = VoteTypeValue | typeof NO_VOTE

/**
 * 契约里的 `PlanDetail.myVote` 是裸 number（冻结契约，云端 0 表示未投），而 store 的 `myVotes`
 * 值域只有 1|2。拉详情后写回 store 必须先过这一道：null 走 applyVoteResult 的删键分支，
 * 不把 NO_VOTE 哨兵塞进 store。收窄只该有这一处，页面与 composable 各写一份就会分叉。
 */
export function toStoreVote(value: number): VoteTypeValue | null {
  return value === VoteType.Agree || value === VoteType.Disagree ? value : null
}

interface VoteSnapshot {
  counts: VoteCounts | null
  myVote: MyVote
  options: PlanOption[] | null
  myOption: string
}

export interface UseVoteOptions {
  /** 简单表决成功回调（页面可用来刷新「我参与的」统计 / 跨页失效） */
  onVoted?: (myVote: VoteTypeValue) => void
  /** 选项表决成功回调 */
  onOptionVoted?: (optionId: string) => void
  /** 被服务端判定已截止/已删除：页面应重新拉详情置灰 */
  onClosed?: () => void
}

export interface VoteController {
  myVote: ComputedRef<MyVote>
  counts: ComputedRef<VoteCounts>
  total: ComputedRef<number>
  /** 选项表决：我投的选项 id（'' = 未投） */
  myOption: ComputedRef<string>
  /** 选项表决：逐选项票数 */
  optionCounts: ComputedRef<PlanOption[]>
  /** 投过即锁定（任一模式）：UI 据此置灰其余入口 */
  locked: ComputedRef<boolean>
  /** 在途锁：连点期间按钮置 loading，防重复提交 */
  voting: Ref<boolean>
  agree: () => Promise<void>
  disagree: () => Promise<void>
  cast: (type: VoteTypeValue) => Promise<void>
  castOption: (optionId: string) => Promise<void>
}

const EMPTY_COUNTS: VoteCounts = { agree: 0, disagree: 0 }
const EMPTY_OPTIONS: PlanOption[] = []

/** 乐观计数：在原有基础上加新票、减旧票，负数钳到 0（本地快照可能已落后一步） */
function shiftCounts(base: VoteCounts, from: MyVote, to: VoteTypeValue): VoteCounts {
  const next: VoteCounts = { agree: base.agree, disagree: base.disagree }
  const dec: VoteTypeValue | typeof NO_VOTE = from === NO_VOTE ? NO_VOTE : from
  if (dec !== NO_VOTE) {
    if (dec === VoteType.Agree) next.agree = Math.max(0, next.agree - 1)
    else next.disagree = Math.max(0, next.disagree - 1)
  }
  if (to === VoteType.Agree) next.agree += 1
  else next.disagree += 1
  return next
}

/** 乐观选项计数：只给被投选项 +1（锁定后不会改票，故无需 -1 分支） */
function shiftOptions(base: PlanOption[], optionId: string): PlanOption[] {
  return base.map((option) =>
    option.id === optionId ? { ...option, count: option.count + 1 } : option,
  )
}

export function useVote(planId: MaybeRefOrGetter<string>, options: UseVoteOptions = {}): VoteController {
  const planStore = usePlanStore()
  const voting = ref(false)

  const id = () => toValue(planId)

  const myVote = computed<MyVote>(() => planStore.myVotes[id()] ?? NO_VOTE)
  const counts = computed<VoteCounts>(() => planStore.voteCounts[id()] ?? EMPTY_COUNTS)
  const total = computed(() => counts.value.agree + counts.value.disagree)
  const myOption = computed<string>(() => planStore.myOptions[id()] ?? '')
  const optionCounts = computed<PlanOption[]>(() => planStore.optionVotes[id()] ?? EMPTY_OPTIONS)
  const locked = computed(() => myVote.value !== NO_VOTE || myOption.value !== '')

  function snapshot(currentId: string): VoteSnapshot {
    const raw = planStore.voteCounts[currentId]
    const rawOptions = planStore.optionVotes[currentId]
    return {
      counts: raw ? { ...raw } : null,
      myVote: planStore.myVotes[currentId] ?? NO_VOTE,
      options: rawOptions ? rawOptions.map((option) => ({ ...option })) : null,
      myOption: planStore.myOptions[currentId] ?? '',
    }
  }

  function restore(currentId: string, snap: VoteSnapshot): void {
    if (snap.counts) planStore.voteCounts[currentId] = snap.counts
    else delete planStore.voteCounts[currentId]
    // 回滚到「没投过」时必须删键：myVotes 的值域是 VoteTypeValue(1|2)，不能塞哨兵 0
    if (snap.myVote === NO_VOTE) delete planStore.myVotes[currentId]
    else planStore.myVotes[currentId] = snap.myVote
    if (snap.options) planStore.optionVotes[currentId] = snap.options
    else delete planStore.optionVotes[currentId]
    if (snap.myOption === '') delete planStore.myOptions[currentId]
    else planStore.myOptions[currentId] = snap.myOption
  }

  /**
   * 本地态与服务端不一致时用详情接口纠偏。
   * 3003 重复投票就靠它静默纠正：服务端已有我的票，只是本地快照旧了，不该打扰用户。
   */
  async function correctFromServer(currentId: string): Promise<void> {
    try {
      const detail = await fetchPlanDetail(currentId, { silent: true })
      planStore.applyVoteResult(
        currentId,
        detail.votes,
        toStoreVote(detail.myVote),
        detail.options,
        detail.myOption,
      )
    } catch (err) {
      logger.warn('useVote', 'correct failed', err)
    }
  }

  /** 提交失败统一处理：先回滚乐观值，再按错误码纠偏/提示（两种模式共用） */
  async function handleSubmitError(
    currentId: string,
    snap: VoteSnapshot,
    err: unknown,
  ): Promise<void> {
    restore(currentId, snap)
    if (err instanceof ApiError) {
      if (err.code === ErrorCode.DUPLICATED) {
        await correctFromServer(currentId)
      } else if (err.code === ErrorCode.PLAN_CLOSED) {
        showToastMsg('该计划已截止')
        await correctFromServer(currentId)
        options.onClosed?.()
      } else if (err.code === ErrorCode.FORBIDDEN) {
        showToastMsg('暂无权限投票')
      } else {
        showToastMsg(err.message || '投票失败，请稍后重试')
      }
    } else {
      logger.warn('useVote', 'submit failed', err)
      showToastMsg('网络异常，请重试')
    }
  }

  async function cast(type: VoteTypeValue): Promise<void> {
    const currentId = id()
    if (!currentId || voting.value || locked.value) return
    // 同票重复点击不重复提交（服务端会回 3003，本地直接忽略更省一次往返）
    if (myVote.value === type) return

    const snap = snapshot(currentId)
    planStore.voteCounts[currentId] = shiftCounts(snap.counts ?? EMPTY_COUNTS, snap.myVote, type)
    planStore.myVotes[currentId] = type
    voting.value = true

    try {
      const res = await submitVote(currentId, { type }, { silent: true })
      const resolved = toStoreVote(res.myVote)
      planStore.applyVoteResult(currentId, res.votes, resolved, res.options, res.myOption)
      if (resolved) options.onVoted?.(resolved)
    } catch (err) {
      await handleSubmitError(currentId, snap, err)
    } finally {
      voting.value = false
    }
  }

  async function castOption(optionId: string): Promise<void> {
    const currentId = id()
    if (!currentId || voting.value || locked.value || !optionId) return
    // 已投同一选项：本地直接忽略（锁定后本就不该再进来，双保险）
    if (myOption.value === optionId) return

    const snap = snapshot(currentId)
    planStore.optionVotes[currentId] = shiftOptions(snap.options ?? EMPTY_OPTIONS, optionId)
    planStore.myOptions[currentId] = optionId
    voting.value = true

    try {
      const res = await submitVote(currentId, { optionId }, { silent: true })
      planStore.applyVoteResult(
        currentId,
        res.votes,
        toStoreVote(res.myVote),
        res.options,
        res.myOption,
      )
      if (res.myOption) options.onOptionVoted?.(res.myOption)
    } catch (err) {
      await handleSubmitError(currentId, snap, err)
    } finally {
      voting.value = false
    }
  }

  return {
    myVote,
    counts,
    total,
    myOption,
    optionCounts,
    locked,
    voting,
    cast,
    castOption,
    agree: () => cast(VoteType.Agree),
    disagree: () => cast(VoteType.Disagree),
  }
}
