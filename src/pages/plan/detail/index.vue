<script setup lang="ts">
/**
 * 计划详情页（WBS T3.11 页面编排 + T3.12 与列表的 store 联动）。
 *
 * 结构红线（技术方案 §8.4，#79 改文档级滚动）：本页 WebView 渲染，**不用内层 scroll-view**，
 * 整页走 page 文档原生滚动（真机 WKWebView 上 flex 高度链 + overflow:hidden 会裁底致滚不到底）；
 * 内容区 / 选项区 / 投票区 / 评论区全在文档流里，评论区触底由本页 `onReachBottom`
 * 调 CommentList 的 expose.loadMore()（组件内部不嵌 scroll-view）。
 * `CommentInput` fixed 吸底、在文档流之外；导航 fixed + 等高占位。
 *
 * 一致性红线（T3.12 的验收标准「投票后返回列表比例即时更新」）：跨页靠的是 planStore，
 * 不是重新请求。所以本页**刻意不在卸载时清 `voteCounts[planId]` / `myVotes[planId]`** ——
 * 首页 PlanCard 优先读这两个表（§4.7 第 2 条），清掉就退回进详情前的列表快照。
 *
 * 生命周期不在这里手写 onShow/onHide，也不直接调 pauseTick/resumeTick：
 * 全部收在 usePageRefresh 里（§7.3），首屏加载就挂在它的首次 onShow 上。
 */
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import BaseAvatar from '@/components/base/BaseAvatar/index.vue'
import BaseEmpty from '@/components/base/BaseEmpty/index.vue'
import BaseImage from '@/components/base/BaseImage/index.vue'
import BaseNavbar from '@/components/base/BaseNavbar/index.vue'
import BaseSkeleton from '@/components/base/BaseSkeleton/index.vue'
import CommentInput from '@/components/business/CommentInput/index.vue'
import CommentList from '@/components/business/CommentList/index.vue'
import ContentRenderer from '@/components/business/ContentRenderer/index.vue'
import CountDown from '@/components/business/CountDown/index.vue'
import OptionCardList from '@/components/business/OptionCardList/index.vue'
import VoteActions from '@/components/business/VoteActions/index.vue'
import VoteRatioBar from '@/components/business/VoteRatioBar/index.vue'
import { fetchPlanDetail } from '@/api/plan'
import { ApiError } from '@/api/request'
import { PlanStatus } from '@/constants/plan'
import { PAGE_KEYS } from '@/constants/pages'
import {
  invalidatePage,
  NO_VOTE,
  showToastMsg,
  toStoreVote,
  useActionSheet,
  useComments,
  useModal,
  usePageRefresh,
  useServerNow,
  useShare,
  useVote
} from '@/composables'
import { useAppStore } from '@/stores/app'
import { usePlanStore } from '@/stores/plan'
import { useUserStore } from '@/stores/user'
import type { CommentItem as CommentDTO, PlanDetail } from '@/types/models'
import { logger } from '@/utils/logger'
import type { CommentListExpose } from '@/components/business/CommentList/types'
import type { KeyboardPayload, PublishResult } from '@/components/business/CommentInput/types'
import type { DetailQuery, DetailView, LoadPhase } from './types'
import { DETAIL_TAIL_ID, EMPTY_DETAIL_VIEW, GALLERY_RATIO } from './types'

/** 跨页失效标识取自 `@/constants/pages`（唯一字面量来源）；本页是 planDetail，别写成通配 '*' */

const planStore = usePlanStore()
const userStore = useUserStore()
const appStore = useAppStore()
/** 吸顶导航的等高占位：文档级滚动后导航 fixed，内容要从它下面开始（#79） */
const navSpaceStyle = computed(() => `height: ${appStore.navBarHeight}px;`)
const sheet = useActionSheet()
const modal = useModal()

const planId = ref('')
const phase = ref<LoadPhase>('loading')
const loadError = ref('')
const detail = ref<PlanDetail | null>(null)
/** 倒计时归零沿。只影响前端置灰，真实状态仍以云函数为准（§8.5） */
const expired = ref(false)
/** CommentInput 上报的键盘高度（px）：给滚动区尾部腾空间，免得输入条盖住最后一条评论 */
const keyboardLift = ref(0)
const draft = ref('')
const commentListRef = ref<CommentListExpose | null>(null)

/** 整页唯一的时间订阅：评论相对时间与截止判定共用它（§11.1 禁止每条评论各挂定时器） */
const now = useServerNow()

const ready = computed(() => phase.value === 'ready')

/** 选项区是否真的渲染（与 OptionCardList 的 visible 同口径：≥2 个选项）：用来给区块上间距，空时不留缝 */
const hasOptions = computed(() => (detail.value?.options.length ?? 0) >= 2)

/** 权威值写回 store：比例/我的投票/选项票数走 applyVoteResult，展示字段走 patchPlan */
function syncStore(data: PlanDetail): void {
  planStore.applyVoteResult(
    data.planId,
    data.votes,
    toStoreVote(data.myVote),
    data.options,
    data.myOption
  )
  // 刻意不带 votes：上面那行已经是唯一权威写入口，patchPlan 再带一次就变成两处覆盖
  planStore.patchPlan(data.planId, {
    title: data.title,
    summary: data.summary,
    cover: data.cover,
    deadline: data.deadline,
    optionsEnabled: data.optionsEnabled,
    optionCount: data.optionCount,
    status: data.status,
    commentCount: data.commentCount
  })
}

function errorTextOf(err: unknown): string {
  return err instanceof ApiError && err.message ? err.message : '加载失败，请检查网络后重试'
}

async function loadDetail(): Promise<void> {
  const id = planId.value
  if (!id) return
  // 有内容时保持原页面可读（后台刷新失败不该把整页打回骨架/错误态）
  if (!detail.value) phase.value = 'loading'
  try {
    // silent：错误画成整页重试态，不再叠一条 toast（§7.1 的统一提示只服务非 silent 调用）
    const data = await fetchPlanDetail(id, { silent: true })
    detail.value = data
    loadError.value = ''
    // 重拉成功后把归零判定交还权威数据：云端仍说「进行中」就不该继续置灰
    expired.value = false
    // 先灌 store 再翻 ready：视图模型的 votes/myVote 读的是 store，反过来的顺序会有一帧空比例
    syncStore(data)
    phase.value = 'ready'
  } catch (err) {
    logger.warn('plan-detail', 'load failed', err)
    loadError.value = errorTextOf(err)
    if (!detail.value) phase.value = 'error'
  }
}

function retry(): void {
  loadError.value = ''
  void loadDetail()
}

onLoad((query) => {
  const { planId: fromQuery } = (query ?? {}) as DetailQuery
  const id = typeof fromQuery === 'string' ? fromQuery.trim() : ''
  if (!id) {
    // 缺参不渲染「空详情」骗人：能退就退，退不掉（分享直达、页面栈只有本页）才留错误态
    loadError.value = '链接不完整，无法打开该计划'
    phase.value = 'error'
    showToastMsg('参数有误，无法打开该计划')
    if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1 })
    return
  }
  planId.value = id
})

// 首屏加载 = 首次 onShow；从编辑页/分享面板回来时按 staleMs 差异化重拉（§7.3）
usePageRefresh({ key: PAGE_KEYS.planDetail, onRefresh: loadDetail })

const vote = useVote(() => planId.value, {
  // 选项表决走页面这份实例（OptionCardList @vote → castOption）；简单表决由 VoteActions 内部实例经 emit 触发
  onOptionVoted: () => onVoted(),
  onClosed: () => {
    void onServerClosed()
  }
})

const myOpenId = computed(() => userStore.userInfo?.openId ?? '')
const authorOpenId = computed(() => detail.value?.author.openId ?? '')
/** userInfo 是冷启动静默登录异步写回的，允许晚到：判定必须是 computed，不能在 onLoad 里算一次 */
const isAuthor = computed(() => !!myOpenId.value && myOpenId.value === authorOpenId.value)

const closed = computed(() => {
  const data = detail.value
  if (!data) return true
  if (expired.value) return true
  if (data.status !== PlanStatus.Ongoing) return true
  // 校准时间源与 peekNow() 同为 appStore.serverNow()；这里读 now 而不是调 peekNow()，
  // 因为 computed 里只有引用 now 才能在分钟跳变时重新判定
  return data.deadline > 0 && data.deadline <= now.value
})

const view = computed<DetailView>(() => {
  const data = detail.value
  if (!data) return EMPTY_DETAIL_VIEW
  const mine = vote.myVote.value
  return {
    title: data.title,
    authorName: data.author.nickName,
    authorAvatar: data.author.avatarUrl,
    createdAt: data.createdAt,
    deadline: data.deadline,
    hasDeadline: data.deadline > 0,
    blocks: data.blocks,
    // 选项票数与 votes 同源：优先 store（castOption 乐观更新 + 服务端权威值都写这里），空时退回详情快照
    options: vote.optionCounts.value.length > 0 ? vote.optionCounts.value : data.options,
    images: data.images,
    // 比例与「我的选择」的唯一来源是 store（投票后立刻要跟手），而 store 在每次成功加载里
    // 被 syncStore → applyVoteResult 灌过权威值，所以不需要再退回 detail 快照
    votes: vote.counts.value,
    myVote: mine === NO_VOTE ? undefined : mine,
    myOption: vote.myOption.value,
    locked: vote.locked.value,
    commentCount: data.commentCount,
    closed: closed.value,
    isAuthor: isAuthor.value
  }
})

const imagesForPreview = computed(() => view.value.images)

function onImageTap(src: string): void {
  // 与 ContentRenderer 同口径：整组图一次喂进去，用户可左右滑；fileID 预览失败要有反馈
  uni.previewImage({
    urls: imagesForPreview.value,
    current: src,
    fail: () => showToastMsg('图片预览失败，请稍后重试')
  })
}

/** CountDown 的 expire 带 deadline，比对一下免得改期后的旧归零沿把新计划置灰 */
function onExpired(deadline: number): void {
  if (detail.value && detail.value.deadline === deadline) expired.value = true
}

/**
 * 评论数 +1/-1：本页的 detail 和 planStore 的列表桶**都要**改。
 * 首页卡片显示「评论 N」读的是 `summary.commentCount`（PlanCard），只改 detail 就是两处真相，
 * 投完评论返回首页要等列表过期重拉才对得上 —— patchPlan 的注释里点名的正是这条。
 */
function bumpCommentCount(delta: number): void {
  const data = detail.value
  if (!data) return
  const next = Math.max(0, data.commentCount + delta)
  if (next === data.commentCount) return
  data.commentCount = next
  planStore.patchPlan(data.planId, { commentCount: next })
}

const comments = useComments(() => planId.value, {
  // 乐观插入由 useComments 内部做完（appendItem 到尾部），页面只补两件事：计数与滚动
  onPosted: () => {
    bumpCommentCount(1)
    void scrollToBottom()
  },
  onRemoved: () => bumpCommentCount(-1)
})

/**
 * 模板里不写 `comments.posting`：useComments 返回的是**普通对象**，嵌套 Ref 不会被自动解包
 * （只有 setup 顶层绑定会解包），直接把 Ref 当布尔传给组件恒为真。这一层 computed 就是解包点。
 */
const posting = computed(() => comments.posting.value)

/** 触底加载：文档级滚动后用页面 onReachBottom（阈值在 pages.json onReachBottomDistance，与 CommentList/types.ts 同口径） */
onReachBottom(() => {
  void commentListRef.value?.loadMore()
})

function scrollToBottom(): void {
  uni.pageScrollTo({ selector: `#${DETAIL_TAIL_ID}`, duration: 200 })
}

function onKeyboardHeight(payload: KeyboardPayload): void {
  keyboardLift.value = payload.height > 0 ? payload.height : 0
}

const keyboardStyle = computed(() => `height: ${keyboardLift.value}px;`)

/**
 * §8.4 的删除权限是「本人 || 计划作者」。useComments.canRemove 只判本人，
 * 这条注入正是 §4.9 缺口 1 留给页面层的活（裁决：不改 composable）。
 */
function canRemoveComment(comment: CommentDTO): boolean {
  const me = myOpenId.value
  if (!me) return false
  return comment.author.openId === me || me === authorOpenId.value
}

async function confirmAndRemove(commentId: string): Promise<void> {
  const confirmed = await modal.confirm({
    title: '删除评论',
    content: '删除后这条评论将显示为「已删除」，确定删除？',
    confirmText: '删除'
  })
  if (!confirmed) return
  // 失败回滚与提示都在 useComments.remove 内部（它对 api 传了 silent，自己弹那一条），页面不补第二条
  await comments.remove(commentId)
}

function onDeleteComment(commentId: string): void {
  void confirmAndRemove(commentId)
}

async function openDeleteSheet(comment: CommentDTO): Promise<void> {
  const index = await sheet.openNative(['删除'])
  if (index !== 0) return
  await confirmAndRemove(comment.commentId)
}

/** §8.4：长按整条评论 → ActionSheet 的删除入口。无删除权限时连菜单都不该弹 */
function onLongPressComment(comment: CommentDTO): void {
  if (!canRemoveComment(comment)) return
  void openDeleteSheet(comment)
}

async function publishComment(content: string): Promise<PublishResult> {
  const ok = await comments.post(content)
  // toast:false —— useComments.post 的 ApiError 文案已由 api/request 统一 toast（§7.1），
  // 组件再弹一次就串成两条
  return ok ? { ok: true } : { ok: false, toast: false }
}

function onCommentError(message: string): void {
  // 分页失败的提示已由 request 统一 toast（fetchComments 非 silent），页面只留一条埋点
  logger.debug('plan-detail', 'comments paging failed', message)
}

/**
 * 投票成功：applyVoteResult 已由 useVote 内部做过，页面只剩跨页失效这一件事。
 * 两个列表页都要标脏：卡片绑的 `voteCounts` 已被写穿，但**参与人数、评论数是列表快照里的字段**，
 * 只有重拉才追得上 —— 此前只失效了首页，「我的」就滞后到 60s 过期。
 */
function onVoted(): void {
  invalidatePage(PAGE_KEYS.home)
  invalidatePage(PAGE_KEYS.mine)
}

/** 选项表决入口（#58）：OptionCardList 点中某项 → castOption；锁定/截止/在途守卫都在 useVote 内 */
function onOptionVote(optionId: string): void {
  void vote.castOption(optionId)
}

/**
 * 服务端判 3002/3001（已截止 / 已删除）：重拉一次详情，让整页按权威状态置灰。
 * 「我的」比首页更必须失效：状态一改，这条计划就要在 ongoing / ended 两个桶之间搬家，
 * 光改卡片字段搬不了桶，下次进「我的」仍会在「进行中」里看到一条已截止的。
 */
async function onServerClosed(): Promise<void> {
  invalidatePage(PAGE_KEYS.home)
  invalidatePage(PAGE_KEYS.mine)
  await loadDetail()
}

// 分享：标题用计划标题、图用封面（fileID 作分享图在真机可能取不到，微信会退回页面截图，见 README 待验项）
useShare(() => ({
  title: detail.value?.title || '来表个态',
  path: `/pages/plan/detail/index?planId=${planId.value}`,
  imageUrl: detail.value?.cover || undefined,
  query: { planId: planId.value }
}))
</script>

<template>
  <view class="plan-detail">
    <BaseNavbar title="计划详情" fixed />
    <view class="plan-detail__nav-space" :style="navSpaceStyle" />

    <view class="plan-detail__flow">
      <!-- 三态之一：骨架屏（§11.2 用骨架代替白屏） -->
      <view v-if="phase === 'loading'" class="plan-detail__state">
        <BaseSkeleton type="detail" :rows="5" :avatar="true" />
      </view>

      <!-- 三态之二：错误 / 缺参重试 -->
      <view v-if="phase === 'error'" class="plan-detail__state">
        <BaseEmpty :text="loadError" action-text="重新加载" @action="retry" />
      </view>

      <!--
        三态之三：内容。每个区块自己挂 v-if="ready"（不用 <template v-else> 包多格），
        让 scroll-view 的直接子节点就是区块卡片，中间不插 <block> 包装。
      -->
      <!-- 第一卡（用户裁定 2026-11-13）：作者行在最上方 → 标题 → 正文，同一色块 -->
      <view v-if="ready" class="plan-detail__card">
        <view class="plan-detail__author">
          <BaseAvatar class="plan-detail__avatar" :src="view.authorAvatar" size="sm" />
          <text class="plan-detail__author-name">{{ view.authorName }}</text>
          <CountDown
            v-if="view.hasDeadline"
            tone="chip"
            size="lg"
            :deadline="view.deadline"
            :start-at="view.createdAt"
            @expire="onExpired"
          />
        </view>
        <!-- 作者行下的浅色分割线：width:100% 落在卡内衬里，两边各留 $space-3 不顶边（Skyline 无伪元素，用真实节点 + border） -->
        <view class="plan-detail__author-divider" />
        <text class="plan-detail__title">{{ view.title }}</text>
        <!-- 正文：blocks 原样喂给 ContentRenderer，它内部已经 sanitizeBlocks（§8.1） -->
        <view class="plan-detail__body">
          <ContentRenderer :blocks="view.blocks" />
        </view>
      </view>

      <!-- 配图独立色块：列表侧只有 cover，多图并排是详情页的职责（§8.5 契约缺口那条） -->
      <view v-if="ready && view.images.length > 0" class="plan-detail__card">
        <view class="plan-detail__gallery">
          <view v-for="src in view.images" :key="src" class="plan-detail__gallery-item">
            <BaseImage
              :src="src"
              mode="aspectFill"
              :ratio="GALLERY_RATIO"
              radius="md"
              :preview="false"
              @click="onImageTap(src)"
            />
          </view>
        </view>
      </view>

      <!--
        选项区（#58/#60）：≥2 个选项即选项表决，整卡可点投这一项；投过即锁定，其余项置灰。
        开关关闭 / 选项不足 2 个时组件自己整块不渲染，所以外层只给留白、不给底色，
        空的时候是一格 0 高，页面也不需要再判一次空。
      -->
      <view v-if="ready && hasOptions" class="plan-detail__options">
        <OptionCardList
          :options="view.options"
          :votable="!view.isAuthor"
          :my-option="view.myOption"
          :locked="view.locked"
          :closed="view.closed"
          @vote="onOptionVote"
        />
      </view>

      <!-- 投票区：比例展示的唯一出口是 VoteRatioBar，所以 VoteActions 不再开 showCount -->
      <view v-if="ready" class="plan-detail__card">
        <view class="plan-detail__section-head">
          <text class="plan-detail__section-title">表决</text>
          <text v-if="view.closed" class="plan-detail__section-note">已截止</text>
        </view>
        <view class="plan-detail__ratio">
          <VoteRatioBar
            size="lg"
            show-count
            :votes="view.votes"
            :my-vote="view.myVote"
            :options="view.options"
            :my-option="view.myOption"
          />
        </view>
        <!-- 选项表决时投票入口在上方 OptionCardList，这里不再摆赞同/反对（避免两个矛盾入口）；整块隐藏不留缝 -->
        <view v-if="!hasOptions" class="plan-detail__actions">
          <VoteActions
            :plan-id="planId"
            :closed="view.closed"
            :is-author="view.isAuthor"
            :locked="view.locked"
            @voted="onVoted"
            @closed="onServerClosed"
          />
        </view>
      </view>

      <!--
        评论区在滚动流内（§8.4）：组件不嵌 scroll-view，触底加载由本页 scrolltolower 驱动。
        底色卡片不写左右 padding —— CommentList 自己带 0 $space-3 的留白，叠两层会双倍缩进。
      -->
      <view v-if="ready" class="plan-detail__comments">
        <view class="plan-detail__comments-head">
          <text class="plan-detail__section-title">评论</text>
          <text class="plan-detail__section-count">{{ view.commentCount }}</text>
        </view>
        <CommentList
          ref="commentListRef"
          :comments="comments"
          :now="now"
          :can-remove="canRemoveComment"
          @delete="onDeleteComment"
          @long-press="onLongPressComment"
          @error="onCommentError"
        />
      </view>

      <!--
        尾部锚点：① 给 fixed 吸底输入条腾出等高的空间；② 键盘抬起时再叠加事件给的高度；
        ③ 是「发表后滚到底」的 uni.pageScrollTo selector 目标（#79 文档级滚动）。
      -->
      <view :id="DETAIL_TAIL_ID" class="plan-detail__tail">
        <view v-if="keyboardLift > 0" class="plan-detail__keyboard" :style="keyboardStyle" />
      </view>
    </view>

    <!-- 吸底条 fixed 吸底，在文档滚动流之外（§8.4） -->
    <CommentInput
      v-model="draft"
      :posting="posting"
      :publish="publishComment"
      :visible="ready"
      :disabled="closed"
      :placeholder="closed ? '该计划已截止，评论已关闭' : '说点什么…'"
      @keyboard-height="onKeyboardHeight"
    />
  </view>
</template>

<style lang="scss" scoped>
// 一个节点一个类名是工程约定（样式不靠多类名叠加，层叠结果可预测）；平台侧的口径见兼容清单 §1.5 末尾澄清
.plan-detail {
  @include page-root-doc;
  background-color: $color-bg-page;
}

.plan-detail__nav-space {
  width: 100%;
  flex-shrink: 0;
}

.plan-detail__flow {
  width: 100%;
}

// 卡片容器：统一「左右留白 + 上间距」，Skyline 下 margin 不折叠，所以只给单侧
.plan-detail__card {
  @include card;
  margin: $card-gap $space-3 0;
}

.plan-detail__state {
  @include card;
  margin: $card-gap $space-3 0;
}

.plan-detail__title {
  width: 100%;
  margin-top: $space-3;
  font-size: $font-xl;
  font-weight: $font-weight-semibold;
  line-height: $line-tight;
  color: $color-text-1;
  // 无 line-clamp（§2.2 实测不生效）：标题上限 40 字由服务端保证，这里只兜长串换行
  word-break: break-all;
}

.plan-detail__author {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

// 作者行与标题之间的浅色细线：1px 物理像素（rpx 缩放后不可见），宽度吃满卡内衬即两边不顶边
.plan-detail__author-divider {
  width: 100%;
  margin-top: $space-3;
  @include hairline-bottom;
}

.plan-detail__avatar {
  margin-right: $space-2;
}

// 昵称 flex:1 把倒计时顶到最右，不用 margin-left:auto（Skyline 未实测该写法）
.plan-detail__author-name {
  @include ellipsis-1;
  flex: 1;
  min-width: 0;
  font-size: $font-sm;
  color: $color-text-2;
}

.plan-detail__body {
  width: 100%;
  margin-top: $space-4;
}

.plan-detail__gallery {
  display: flex;
  flex-direction: row;
  width: 100%;
  // 上下补 $space-1：与每格左右 $space-1 对齐，使配图四边距一致（以左右为准）
  padding: $space-1 0;
}

// 左右间距挂在每格而不是容器上（PlanList 同口径）：末格的间距不会把三宫格挤成不等宽
.plan-detail__gallery-item {
  flex: 1;
  min-width: 0;
  padding: 0 $space-1;
}

.plan-detail__options {
  @include flex-column;
  // 与主图/其他卡片同一笔上间距（$card-gap）；外层已按 hasOptions 判空，空时整块不渲染不留缝
  margin-top: $card-gap;
  // 不给底色：组件判空后这里是 0 高，不会留下一张空白卡
  padding: 0 $space-3;
}

.plan-detail__section-head {
  @include section-head;
}

.plan-detail__section-title {
  @include section-title;
}

.plan-detail__section-note {
  margin-left: $space-2;
  font-size: $font-xs;
  color: $color-text-3;
}

.plan-detail__section-count {
  margin-left: $space-1;
  font-size: $font-sm;
  color: $color-text-3;
}

// 标题行 padding-bottom 已提供间距，这里不再叠 margin
.plan-detail__ratio {
  width: 100%;
}

.plan-detail__actions {
  width: 100%;
  margin-top: $space-3;
}

.plan-detail__comments {
  @include flex-column;
  // 下外边距刻意比卡间距大一档（48 vs 40rpx）：评论块与吸底输入条之间多留呼吸
  margin: $card-gap $space-3 $space-5;
  background-color: $color-bg-card;
  border-radius: $radius-lg;
}

// 左右与 CommentList 的 0 $space-3 留白对齐；上衬对齐卡内衬、下 24rpx 同标题行规格
.plan-detail__comments-head {
  @include section-head;
  padding: $space-3 $space-3;
}

// 腾出吸底条真实高度 + 一格呼吸：条 = 上 padding($space-1) + 字段($comment-field-height)
// + 下 padding($space-1) + 安全区；#52 降高后让位同步收紧，末条评论完整露在输入条上方
.plan-detail__tail {
  width: 100%;
  @include safe-area-bottom($comment-field-height + $space-4);
}

// 键盘高度是运行时事件给的 px（交互量，不是设计尺寸），沿用 CommentInput 上报的原值
.plan-detail__keyboard {
  width: 100%;
}
</style>

<!-- 文档级滚动（#79）：放开全局 page 的 height:100%/overflow:hidden。
     页级 wxss 晚于 app.wxss 加载、同优先级后写赢；非 scoped 才能命中 page 根节点。
     真机 WKWebView 上旧高度链会把超出视口的内容裁掉致滚不到底，文档原生滚动不依赖高度链。 -->
<style lang="scss">
page {
  height: auto;
  overflow: visible;
}
</style>
