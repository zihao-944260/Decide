<script setup lang="ts">
/**
 * 我的页（技术方案 §8.7 / WBS **T5.5 页面编排** + **T5.6 我发起的计划长按管理**）。
 * 只做编排，不做实现：三态 / 下拉刷新 / 触底加载全在 PlanList 内部，
 * 生命周期与心跳在 usePageRefresh 内部，资料弹层在 UserHeader 内部 —— 页面一行都不重复写。
 *
 * ── 结构上的一个必要偏离（README §1 有完整理由）────────────────────────
 * §8.7 的结构图把 UserHeader / StatCards / PlanList 画在同一个 scroll-view 里，
 * 但 **PlanList 的根节点自己就是一个 `scroll-view type="list"`**（组件源码 index.vue 的模板第一行），
 * 而 §12-5 要求「整页唯一的滚动流是一个 scroll-view」。两者不能同时要：
 * 所以头部两块是**滚动流之外的静态兄弟节点**，列表吃掉剩余高度 —— 与首页
 * （BaseNavbar 静态 + PlanList 滚动）同一条接法。
 *
 * ── 本页面遵守的六条硬口径 ─────────────────────────────────────────
 * 1. `activeFilter` 是全页唯一的 filter 真相：**切换器只剩上方那一排 StatCards**（用户 2026-11-18 口径，
 *    原来下面还有一条 FilterTabs 四个 chip，两处高亮同一个 ref 是重复入口），四张卡的点击全部落回
 *    setActiveFilter 这一个写入点。第四张「已截止」没有独立计数，由 `created − ongoing` 推出，
 *    口径推导写在 StatCards/types.ts 的 STAT_CARDS 上。
 * 2. stats 只有一个来源：`useUserStore().stats`，页面不直接 import `api/user`。
 *    数字由 `userStore.refreshStats()`（= `user.stats`）在每次差异化刷新时更新；
 *    「登录路径不重算 stats」的原因和这条链路为什么必须单独发一次请求见 stores/user.ts 的 refreshStats 注释。
 * 3. 未登录不发列表请求：登录入口只有 `userStore.login(..., { silent: true })` 这一条，
 *    与 App.vue 冷启动用的是同一个 store 方法。
 * 4. 改完资料 → `invalidatePage('mine')`：让下次 onShow 必然重拉，卡片上的作者名才能追上新的昵称
 *    （作者是在**读取时**关联的，见 mapper.joinAuthor，不是写进 plans 表的冗余字段）。
 * 5. 管理动作写穿 store：提前截止 patchPlan(deadline)、删除把五个桶一起摘掉，
 *    再 invalidatePage('plan-detail') 让留在页面栈里的详情页收敛。
 *    桶和组件渲染列表是**两个数组**，所以每次写穿都改两处（store + planListRef 的 patchItem/removeItem），
 *    理由见 closeEarly / dropPlanEverywhere 的注释与 README §6。
 * 6. 列表滚动位置只在两种时刻归零：**切 tab 进本页**（useTabScrollReset，从详情页返回那一次不动位置）
 *    和**切 filter**（setActiveFilter）。换了一桶数据还停在旧滚动深度，看到的第一张卡是新桶的中间某条，
 *    读起来像列表坏了。
 */
import { computed, nextTick, ref, watch } from 'vue'
import BaseEmpty from '@/components/base/BaseEmpty/index.vue'
import BaseNavbar from '@/components/base/BaseNavbar/index.vue'
import BaseTabBar from '@/components/base/BaseTabBar/index.vue'
import PlanList from '@/components/business/PlanList/index.vue'
import StatCards from '@/components/business/StatCards/index.vue'
import UserHeader from '@/components/business/UserHeader/index.vue'
import { fetchMyPlans, fetchPlanDetail, removePlan as removePlanApi, updatePlan } from '@/api/plan'
import {
  invalidatePage,
  peekNow,
  showToastMsg,
  useActionSheet,
  useModal,
  usePageRefresh,
  useTabScrollReset,
  useToast,
  type PageFetcher,
  type PageRefreshContext,
} from '@/composables'
import { PlanStatus, type MyFilter } from '@/constants/plan'
import { PAGE_KEYS } from '@/constants/pages'
import { usePlanStore } from '@/stores/plan'
import { useUserStore } from '@/stores/user'
import type { PageResult } from '@/types/api'
import type { PlanSummary } from '@/types/models'
import { logger } from '@/utils/logger'
import { truncate } from '@/utils/format'
import {
  CONFIRM_LABELS,
  DETAIL_PAGE_URL,
  EARLY_CLOSE_GRACE_MS,
  EDIT_PAGE_URL,
  EMPTY_ACTION_TEXTS,
  EMPTY_TEXTS,
  MANAGE_LABELS,
  TITLE_PREVIEW_WIDTH,
  type ManageAction,
} from './types'

const userStore = useUserStore()
const planStore = usePlanStore()
const sheet = useActionSheet()
const modal = useModal()
const toast = useToast()

const planListRef = ref<InstanceType<typeof PlanList> | null>(null)

/**
 * ★ 全页唯一的 filter 真相（§12 J2-1）。
 * 两个受控组件都从它读高亮，谁都不许自己存一份 —— 分成两份就必然出现
 * 「卡片亮 A、tab 亮 B、列表是 C」。默认 'created'；**没有「全部」**：MyFilter 只有四个值。
 */
const activeFilter = ref<MyFilter>('created')

const isLoggedIn = computed(() => userStore.isLoggedIn)
/** 四个数字的唯一来源：页面不发第二次取数，更新由 loadPage 里的 refreshStats 负责 */
const stats = computed(() => userStore.stats)
const emptyText = computed(() => EMPTY_TEXTS[activeFilter.value])
const emptyActionText = computed(() => EMPTY_ACTION_TEXTS[activeFilter.value])
/** 只有 created 的空态按钮归页面（去发布），其余三个 filter 根本没有按钮 */
const emptyActionOwned = computed(() => activeFilter.value === 'created')

/**
 * api 的入参是 PageQuery & { filter }，PageFetcher 要的是 (cursor, pageSize) → 包一层。
 * filter 在**调用时**读 ref 而不是快照：usePagingList 握的是这个函数引用，
 * 切 filter 后同一个列表实例直接换口径，不必重建实例（组件源码里的 options 包装注释同口径）。
 */
const fetcher: PageFetcher<PlanSummary> = (cursor, pageSize) =>
  fetchMyPlans({ cursor, pageSize, filter: activeFilter.value })

/** 首屏缓存回填：口径在 store 里（myPage 决定「空桶算不算没加载过」），页面不自己判 length */
function seed(): PageResult<PlanSummary> | null {
  return planStore.myPage(activeFilter.value)
}

/** 每页成功回吐给 store：列表态在组件里，跨页一致的缓存在这里（§7.2） */
function onPage(page: PageResult<PlanSummary>, append: boolean): void {
  planStore.setMyPage(activeFilter.value, page, append)
}

/** 失败文案已由 api/request.ts 统一 toast（§7.1），这里只留日志，绝不弹第二条 */
function onError(error: unknown): void {
  logger.warn('mine', 'plan.myList failed', error)
}

/**
 * ★ 唯一写入点：四张 StatCards 的 @select 都落在这一个函数上。
 * 去重放在这里（而不是依赖组件）：StatCards 点已选中项**会**照发事件，
 * 少了这层，多点一次同一张卡就是一次多余的 reload + 一次云函数往返。
 */
function setActiveFilter(filter: MyFilter): void {
  if (filter === activeFilter.value) return
  activeFilter.value = filter
}

/**
 * 切 filter = 重新走一遍首屏（不 force）：seed 命中该桶就秒出、不发请求（§8.7「切回不重新请求」）。
 * nextTick 兜住「watch 早于组件因 v-if 重新挂载」这一帧。
 *
 * 滚动先归零再 reload，不等数据：归零是对**用户这一次点击**的反馈，把它挂在请求回来之后，
 * 慢的时候就是「点了没反应、列表还停在旧桶的第 8 张」。
 */
watch(activeFilter, async () => {
  const list = await resolveList()
  if (!list) return
  list.scrollToTop()
  await list.reload()
})

/**
 * `PlanList` 在 v-if 里，登录成功那一刻才创建；mp 端「Vue patch 完」与「宿主节点就位」
 * 是两个节奏，所以拿实例给两跳机会（都拿不到才交给 onShow 重试）。
 * 不这么做的话冷启动登录后会稳定抛一次「instance not mounted」，用户看到的是列表不出来。
 */
async function resolveList(): Promise<InstanceType<typeof PlanList> | null> {
  if (planListRef.value) return planListRef.value
  await nextTick()
  if (planListRef.value) return planListRef.value
  await nextTick()
  return planListRef.value
}

/**
 * 首屏加载 / onShow 差异化重拉共用这一段（§7.3）。
 * force 用 usePageRefresh 递过来的 first：首次允许吃 seed，
 * 非首次进到这里只可能是过期或被 invalidate，必须绕过缓存真请求。
 */
async function loadPage({ first }: PageRefreshContext): Promise<void> {
  await nextTick()
  // 未登录不发列表请求（plan.myList 要 openId，发了也是吃一次 1002 + 一次 3s 预算）
  if (!isLoggedIn.value) return
  // 四个数字的权威值只有 user.stats 会算：登录路径明确不重算，users.stats 停在建档值。
  // 挂在这里而不是 onShow 必刷：进入本函数的前提是 usePageRefresh 判定过期/被失效，最多约 60s 一次。
  // 不 await、也不让它把整页标脏 —— 数字旧着只是不好看，列表拉不到才是真问题。
  void userStore
    .refreshStats()
    .catch((err: unknown) => logger.warn('mine', 'user.stats failed', err))
  const list = await resolveList()
  // 组件实例还没挂上 → 抛给调用方：usePageRefresh 的 catch 不盖新鲜度戳，下次 onShow 自动重试
  if (!list) throw new Error('planList instance not mounted')
  await list.reload({ force: !first })
}

const { markStale, runNow } = usePageRefresh({ key: PAGE_KEYS.mine, onRefresh: loadPage })

// 切 tab 回到本页 → 列表回到顶部；从详情页返回那一次不动位置（口径见 useTabScrollReset）。
// 未登录时列表根本没挂，planListRef 为空，?. 让这一下自然落空。
useTabScrollReset(() => {
  planListRef.value?.scrollToTop()
})

// ── 登录（T5.5：唯一登录链路）───────────────────────────────────────────

/** 只拦重复点击，模板不读 → 普通 let（做成 ref 是假装它参与渲染） */
let loggingIn = false

/**
 * UserHeader 未登录态整行点击 / 游客空态按钮都走这里。
 * `silent: true` 必须有：不传的话 request.ts 会给失败补一条 toast，
 * 而冷启动（App.vue 同一条 login）静默是设计要求。这里因为用户**主动**点了登录，
 * 失败必须由页面自己给一条反馈 —— silent 已经掐掉了 api 层那条，所以不会双弹。
 */
async function onLogin(): Promise<void> {
  if (loggingIn || isLoggedIn.value) return
  loggingIn = true
  try {
    await userStore.login(undefined, { silent: true })
  } catch (err) {
    logger.warn('mine', 'login failed', err)
    showToastMsg('登录失败，请检查网络后重试')
    return
  } finally {
    loggingIn = false
  }
  // 登录成功之后的加载失败**不该被说成「登录失败」**：别把两件事混在一个 try 里。
  // runNow() 不 reject —— 失败时它只记日志，且新鲜度戳不盖，下次 onShow 必然重试（不需要这里补 markStale）。
  await runNow()
}

/**
 * 登出：云开发身份是 openId、无服务端会话可销毁，`userStore.logout()` 只清本地
 * （userInfo/stats/storage + 列表桶）。本 App 生命周期内保持未登录（onLaunch 不重跑），
 * 下次冷启动的静默登录会以同一 openId 自动回来 —— 这是微信静默授权的既定产品语义。
 */
async function onLogout(): Promise<void> {
  const confirmed = await modal.confirm({
    title: '退出登录',
    content: '退出会清空本机的登录状态与列表缓存，确定退出？',
    confirmText: CONFIRM_LABELS.logout,
  })
  if (!confirmed) return
  userStore.logout()
  showToastMsg('已退出登录')
}

/**
 * UserHeader 的资料保存成功（§12 J2-4）。
 * `plan.author` 是读时 join users 文档拼出来的（cloudfunctions/common/src/mapper.ts:54），
 * 不是写在计划里的快照 —— 所以昵称改了之后**必须重拉列表**，否则本页与首页那些卡片还挂着旧名字。
 * 走 `runNow()` 而不是自己调 `loadPage()`：后者绕开 `usePageRefresh` 的 `refreshing` 锁，
 * 会与正在途中的下拉刷新并发两趟列表请求；`runNow()` 内部保证「等掉那一次用旧昵称发起的在途刷新，
 * 再自己跑一趟」，所以页面既不用管并发，也不用兜底标脏。
 */
function onProfileUpdated(): void {
  invalidatePage(PAGE_KEYS.home)
  void runNow()
}

// ── 列表事件 ──────────────────────────────────────────────────────────

function onCardClick(planId: string): void {
  uni.navigateTo({ url: `${DETAIL_PAGE_URL}?planId=${planId}` })
}

/**
 * 倒计时归零沿：只把状态写进 store，不整表刷新、不重新请求（§8.5「视觉归前端、真状态归云端」）。
 * 与首页 onExpire 同一条口径。屏幕上的置灰由 `PlanCard` 内部的 `expired` 负责（组件自己的数组不用碰），
 * 这里改的是**桶**：长按菜单的 `isClosed` 判定、首页、下次 `seed` 出来的初值都从桶里读，
 * 不写就会让「视觉上已截止、菜单里仍然给提前截止」这两件事同时成立。
 */
function onExpire(planId: string): void {
  planStore.patchPlan(planId, { status: PlanStatus.Ended })
}

// ── T5.6：我发起的计划长按管理 ─────────────────────────────────────────

/**
 * 同一个时刻只允许一个写操作在途（提前截止是「一次读 + 一次写」，两个 8s 超时的往返）。
 * 不是响应式状态：只用来拦事件，模板不读它，所以是普通 let 而不是 ref。
 */
let mutationInFlight = false

function beginMutation(): boolean {
  if (mutationInFlight) return false
  mutationInFlight = true
  return true
}

function endMutation(): void {
  mutationInFlight = false
}

function isClosed(summary: PlanSummary): boolean {
  if (summary.status !== PlanStatus.Ongoing) return true
  // 截止判定走校准时间：本地钟被改过就会把还在进行的计划判成已截止（§8.5）
  return summary.deadline > 0 && summary.deadline <= peekNow()
}

/** 长按菜单挂在哪个桶上（§12 J2-5：只在「我发起的」里给） */
function onLongPress(planId: string): void {
  if (activeFilter.value !== 'created') return
  if (mutationInFlight) return
  const summary = planStore.myLists[activeFilter.value].list.find((item) => item.planId === planId)
  if (!summary) {
    // 静默吞掉会长成「长按没反应」且零报错，这里给一句话把用户引回下拉刷新
    showToastMsg('这条计划已不在当前列表，请下拉刷新')
    return
  }
  void openManageSheet(summary)
}

/**
 * 菜单只走 `sheet.openNative()`（uni.showActionSheet），**不渲染 <BaseActionSheet> 宿主**。
 * 两条路的取舍与理由见 README §5；与详情页同一条路，两页不会长出两套菜单口径。
 */
async function openManageSheet(summary: PlanSummary): Promise<void> {
  const actions = manageActionsFor(summary)
  const index = await sheet.openNative(actions.map((action) => action.label))
  if (index < 0 || index >= actions.length) return
  actions[index]?.run()
}

/**
 * 已截止的计划只给「删除」：编辑与改期都会被云端 `assertPlanUpdatable` 回 3002，
 * 把做不了的动作摆进菜单等于用一次报错当交互。
 */
function manageActionsFor(summary: PlanSummary): ManageAction[] {
  const actions: ManageAction[] = []
  if (!isClosed(summary)) {
    actions.push({ label: MANAGE_LABELS.edit, run: () => goEdit(summary.planId) })
    actions.push({ label: MANAGE_LABELS.closeEarly, run: () => void closeEarly(summary.planId) })
  }
  actions.push({ label: MANAGE_LABELS.remove, run: () => void removeFlow(summary) })
  return actions
}

/** 编辑：与新建同一个页面，靠 query 里的 planId 区分（路由已在 pages.json 注册） */
function goEdit(planId: string): void {
  // 不依赖编辑页有没有 invalidatePage('mine')：出页面之前自己标脏，回来必重拉
  markStale()
  uni.navigateTo({ url: `${EDIT_PAGE_URL}?planId=${planId}` })
}

/**
 * 空态按钮（只在 created 出现）：「去发布」进新建形态，不带 planId。
 * 与 goEdit 同一条口径 —— 出页面之前自己 `markStale()`，不依赖编辑页写完有没有失效本页。
 */
function goCreate(): void {
  markStale()
  uni.navigateTo({ url: EDIT_PAGE_URL })
}

/**
 * 提前截止 = **一次读 + 一次写**，不是单次调用。
 * 为什么必须读：`plan.update` 的 req 是 `PlanWritePayload & { planId }`（types/cloud.ts:47），
 * 云端 `validatePlanWrite`（writeShared.ts:67 → planPayload.ts:113 的 normalizePlanWrite）是整单校验
 * （title/blocks/images/deadline/options 一项不缺，还叠了选项配额与本环境 fileID 两条），
 * 没有「只改 deadline」的补丁口子。所以先 plan.detail 拿当前内容，换掉 deadline 原样提交。
 * 副作用：这次写会把文本与配图重新送审一次（writeShared.reviewImages），是云端既定行为。
 */
async function closeEarly(planId: string): Promise<void> {
  const confirmed = await modal.confirm({
    title: MANAGE_LABELS.closeEarly,
    content: '确定后该计划将在约 1 分钟后截止，不再接收投票与评论，且无法恢复。',
    confirmText: CONFIRM_LABELS.closeEarly,
  })
  if (!confirmed || !beginMutation()) return

  toast.loading('处理中…')
  let notice = ''
  try {
    // silent：读失败是本动作的前置失败，页面自己说一句话，不要让 api 层那条与它串成两条
    const current = await fetchPlanDetail(planId, { silent: true }).catch(() => null)
    if (!current) {
      notice = '没读到计划内容，未做改动'
    } else {
      const deadline = peekNow() + EARLY_CLOSE_GRACE_MS
      await updatePlan({
        planId,
        title: current.title,
        blocks: current.blocks,
        images: current.images,
        deadline,
        optionsEnabled: current.optionsEnabled,
        options: current.options,
      })
      // 只写 deadline，**不写 status**：云端 update 刻意不翻状态（1→2 只归 scheduler，§6.7），
      // 卡片上的「已截止」由 60s 后 CountDown 的归零沿 → @expire → onExpire 落地，不抢跑云端裁决。
      // 两处都要改，因为它们是**两个数组**：`usePagingList.applyPage` 每次新建组件自己的容器
      // （`list.value = [...incoming]`，src/composables/usePagingList.ts:83），
      // `planStore.writeBucket` 另建一份桶（`bucket.list = [...page.list]`，src/stores/plan.ts:48）
      // —— 元素是同一批对象、容器不是同一个；`patchLists` 的 `bucket.list[idx] = {...}`（src/stores/plan.ts:91）
      // 只换桶里那一格，组件列表看不到。
      // patchPlan 管跨页与下次的桶（isClosed 读它），patchItem 管此刻屏幕上这张卡的倒计时。
      planStore.patchPlan(planId, { deadline })
      planListRef.value?.patchItem(planId, { deadline })
      invalidatePage(PAGE_KEYS.planDetail)
      notice = '已设置提前截止'
    }
  } catch (err) {
    // 写失败的文案已由 request.ts 统一 toast（§7.1），这里不再补第二条，只留日志
    logger.warn('mine', 'close early failed', err)
  } finally {
    // 先收 loading 再弹结果：小程序的 toast 与 loading 共用同一个原生实例，
    // 顺序反过来（结果先弹、hideLoading 后跑）会把刚弹出来的那句结果一起关掉。
    toast.hide()
    endMutation()
  }
  if (notice) showToastMsg(notice)
}

/**
 * 删除（危险操作：先二次确认，再 plan.remove，最后写穿 store）。
 * 只有一个往返，所以不给 loading —— 确认弹窗收起后到 toast 之间的空档短于一次下拉刷新的感知阈值。
 */
async function removeFlow(summary: PlanSummary): Promise<void> {
  const confirmed = await modal.confirm({
    title: MANAGE_LABELS.remove,
    content: `「${truncate(summary.title, TITLE_PREVIEW_WIDTH)}」删除后不可恢复，已投的票与评论都会一并失效。确定删除？`,
    confirmText: CONFIRM_LABELS.remove,
  })
  if (!confirmed || !beginMutation()) return

  try {
    await removePlanApi(summary.planId)
    dropPlanEverywhere(summary.planId)
    invalidatePage(PAGE_KEYS.planDetail)
    showToastMsg('已删除')
  } catch (err) {
    logger.warn('mine', 'remove failed', err)
  } finally {
    endMutation()
  }
}

/**
 * 删除后的收敛 = **store 一次 + 本页一次**，两条都不能省。
 * 为什么不能只刷本页：planStore.home / myLists 是首页与下次进「我的」的缓存源，
 * 留一条已删的计划在桶里，返回首页就会看到一条点进去 3001 的死卡片（§7.2 跨页一致）。
 * 为什么桶之外还要再调一次 removeItem：桶数组和组件渲染数组是**两个数组**
 * （`src/stores/plan.ts` 的 `patchLists` 上方那段必读口径），
 * `removePlan` 只 filter 掉桶里那一份，屏幕上那张卡不会自己消失。
 * 投票态（voteCounts/myVotes）由 `removePlan` 一起清 —— 口径在 store 里定，不在页面猜。
 */
function dropPlanEverywhere(planId: string): void {
  planStore.removePlan(planId)
  planListRef.value?.removeItem(planId)
}
</script>

<template>
  <view class="mine">
    <BaseNavbar class="mine__nav" title="我的" :backable="false" />

    <!--
      头部两块是滚动流**之外**的静态节点（理由见文件头 + README §1）。
      顺带一个好处：UserHeader 的编辑弹层（BasePopup，#78 起为 fixed 遮罩+面板，弃 page-container）
      不再嵌套在 scroll-view type="list" 里 —— 那个组合在兼容清单 §2.3 只做过首屏隔离测试。
    -->
    <view class="mine__head">
      <UserHeader @login="onLogin" @updated="onProfileUpdated" />
      <!-- 未登录：disabled 拦点击 + loading 画占位条（0 在未登录时是一句假话，见 StatCards README 口径 2） -->
      <!-- 唯一切换器：四张卡就是四个 filter，下面不再有一条 chip 重复表达同一件事 -->
      <StatCards
        class="mine__stats"
        :stats="stats"
        :active="activeFilter"
        :disabled="!isLoggedIn"
        :loading="!isLoggedIn"
        @select="setActiveFilter"
      />
    </view>

    <!-- 已登录才挂列表：PlanList 内部就是本页唯一的 scroll-view type="list" -->
    <PlanList
      v-if="isLoggedIn"
      ref="planListRef"
      class="mine__list"
      :fetcher="fetcher"
      :seed="seed"
      :on-page="onPage"
      :on-error="onError"
      :auto-load="false"
      :empty-text="emptyText"
      :empty-action-text="emptyActionText"
      :empty-action-owned="emptyActionOwned"
      :float-clearance="true"
      @click="onCardClick"
      @long-press="onLongPress"
      @expire="onExpire"
      @empty-action="goCreate"
    />

    <!-- 未登录：不挂 PlanList（否则它永远停在骨架屏），给一个明确的登录出口 -->
    <view v-else class="mine__guest">
      <BaseEmpty text="登录后查看你发起与参与的计划" action-text="点击登录" @action="onLogin" />
    </view>

    <!-- 登出入口只挂在登录态：guest 态整页都是登录引导，无需登出 -->
    <view v-if="isLoggedIn" class="mine__logout">
      <view class="mine__logout-btn" hover-class="mine__logout-btn--hover" @tap="onLogout">
        <text class="mine__logout-text">退出登录</text>
      </view>
    </view>

    <!-- 底部导航：fixed 悬浮，不占这一列的空间；滚动到底的让位由 PlanList 在内容尾部垫（float-clearance） -->
    <BaseTabBar active="mine" />
  </view>
</template>

<style lang="scss" scoped>
// 根节点必须 flex 纵向 + overflow hidden（Skyline 下页面本身不滚动），否则 PlanList 的 flex:1 拿不到高度
.mine {
  @include page-root;
  // 退出登录浮层的定位上下文：absolute 相对本页根而非视口，列表得以延伸到页底被按钮遮住
  position: relative;
  background-color: $color-bg-page;
}

.mine__nav {
  // 组件宿主节点在页面 flex 列里不参与伸缩
  flex-shrink: 0;
}

.mine__head {
  @include flex-column;
  flex-shrink: 0;
}

// StatCards 只带自己的左右 $space-3 内衬，纵向间距归页面。
// 它下面不再垫间距：与列表之间那一格由 PlanList 容器的 margin-top（$card-gap）提供（首页同口径），
// 这里再给就双倍。
.mine__stats {
  margin-top: $card-gap;
}

// 组件宿主节点的兜底：小程序里自定义组件是真实节点，.plan-list 的 flex:1 是相对它算的。
// 页面根 → 宿主 → scroll-view 三段高度连得上（首页 .home__list 同一条）
.mine__list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mine__guest {
  @include flex-center;
  flex: 1;
  width: 100%;
}

// 退出登录浮层（用户裁定 2026-11-13）：absolute 钉在页底， wrapper 透明无底色，
// 列表延伸到页底从按钮四周透出（「被遮住的列表」）；不再占普通流，故列表 flex:1 吃满到页底。
// 置底让位给悬浮胶囊（above-tabbar），否则按钮正好压在胶囊上。
// $extra 与首页发布浮层同口径 $space-3（胶囊长高后带高多 12rpx，间距跟着抬）。
.mine__logout {
  position: absolute;
  left: 0;
  right: 0;
  @include flex-center;
  @include above-tabbar($space-3);
}

// 紧凑 pill 按钮（非通栏色块）：白底 + 投影保证红字在任意列表内容上可读，四周透出列表
.mine__logout-btn {
  @include flex-center;
  min-height: $tap-min-height;
  padding: 0 $space-5;
  background-color: $color-bg-card;
  border-radius: $radius-round;
  box-shadow: $shadow-popup;
  transition: opacity $duration-fast;
}

.mine__logout-btn--hover {
  opacity: 0.7;
}

.mine__logout-text {
  font-size: $font-md;
  font-weight: $font-weight-medium;
  color: $color-danger;
}
</style>
