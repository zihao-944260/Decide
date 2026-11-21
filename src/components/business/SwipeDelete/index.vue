<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { Emits, Props, SwipeAction } from './types'

const emit = defineEmits<Emits>()

/**
 * 左滑出操作按钮条：卡片与 N 颗按钮的「组」是 flex 行里两个「行级」节点。卡片在上层（z-index 1、宽 100%），
 * 按钮组定宽 N×140rpx 排在行末、溢出到列表容器（.plan-list）右缘外，由容器裁掉（收起态不可见）；
 * 按钮组高度走 flex stretch 自动跟卡，全程不用 absolute（Skyline 下 absolute 的
 * top/bottom 双锚点与百分比高度都不可靠 —— 旧版卡后垫卡高红条就是高度错位露出
 * 红块 + 圆角缝露红角，已改为行级并排）。展开时卡片与按钮组同步 translateX 左移让出按钮。
 *
 * 行级**不做**裁切（无 overflow hidden）：裁切在列表容器层（所有卡共享同一父级裁切，
 * 入场上升相对它发生）。行级裁切会把卡片入场上升裁成「在自己的盒子内上滑」——
 * open-container 内部位移的旧坑（PlanCard README），2026-11-21 我的页真机复现后移除。
 * 按钮组自身带 overflow hidden 裁自家圆角（它不包卡片，裁不到上升位移）。
 *
 * 按钮组里 N 颗 140rpx 等宽按钮并排：danger（删除）红底、其余中性灰底。
 * 按钮数量按条目给（外层 PlanList 逐卡算）：已截止只 1 颗删除、未截止 3 颗
 * （编辑计划 / 提前截止 / 删除计划，口径与长按菜单一致）——展开位移 = N × 140rpx。
 * 全组零 overflow：组上 overflow hidden 在 Skyline 下会把 flex stretch 掉、按钮高度
 * 塌成文字高（2026-11-21 三键版真机「滑开但看不到按钮」），圆角改由两头按钮自带。
 *
 * 手势口径（Skyline 下动效只走 CSS transition，worklet 跟手不可用，兼容清单 §2.5）：
 * - 「横向意图明确」才接管（|dx| > 8px 且不小于 0.8|dy|，近 45° 斜滑也优先横滑）；
 *   「竖向意图明确」（|dy| > 8px 且 > 1.5|dx|）才锁死放行给 scroll-view；
 *   中间地带的斜滑不锁死、持续观察，避免竖分量先越线导致横滑「有时触发不了」；
 * - 松手开 250ms transition 吸附：快左甩（> 0.4px/ms）张开、快右甩收起，慢放按
 *   位移（按钮宽一半）决断；
 * - touchcancel（scroll-view 接管/系统打断）走同一吸附口径，卡片不会卡在中间位移；
 * - 展开后点卡片正文进详情的同时平滑收起。
 *
 * 横竖手势冲突（稳定版基库能用的解，兼容清单 §2.3）：原生竖向滚动的接管阈值 JS 侧拦不住
 * （min-drag-distance 真机未生效；worklet 手势组件要 Nightly 基库，上不了生产）。
 * 组件在横向接管时 emit `swiping-change(true)`、手势结束（end/cancel/卸载兜底）emit
 * `swiping-change(false)`，外层 PlanList 据此把 scroll-view 的 `scroll-y` 在横滑期间
 * 动态切 false —— 竖向滚动整段关断、松手恢复。单键版真机验证过。
 * 前提（2026-11-21 三键版踩过后写死）：外层重渲染（swipingCount 变化）时**本组件的
 * props 引用必须稳定**——外层若每次重渲染新建 actions 数组传进来，子组件跟着重渲染，
 * Skyline 会掐断在途手势（卡片钉死在 0 位，表现「左滑失效」）。
 */

/** 单颗按钮 140rpx 的 px 值：展开位移 = 按钮数 × 它，半开阈值同理 */
const ACTION_WIDTH_PX = uni.upx2px(140)
/** 死区（px）：位移小于它算手指抖动，不参与方向判定 */
const DEAD_ZONE = 8
/** 松手速度阈值（px/ms）：超过它按甩动方向定开合，不再看位移 */
const FLICK_VELOCITY = 0.4
/** 吸附 transition 时长（ms），与 $duration-base 同档 */
const SNAP_MS = 250

const props = defineProps<Props>()

const open = ref(false)
const dragging = ref(false)
/** 卡片与按钮组共用位移（px）：0 = 收起，-actionsTotalPx = 展开 */
const offset = ref(0)

/** 展开位移 = 按钮数 × 单颗宽（按条目不同：已截止 1 颗 / 未截止 3 颗） */
const actionsTotalPx = computed(() => props.actions.length * ACTION_WIDTH_PX)

let startX = 0
let startY = 0
/** 本次按压是否已定方向（横接管 / 竖放行，定后不翻） */
let decided = false
let horizontal = false
let lastX = 0
let lastT = 0
/** 最近一次 move 的速度（px/ms，左为负） */
let velocity = 0
/** swiping-change 是否已通知外层 true（卸载兜底与去重用） */
let swipingNotified = false

function notifySwiping(on: boolean): void {
  if (swipingNotified === on) return
  swipingNotified = on
  emit('swiping-change', on)
}

function baseOffset(): number {
  return open.value ? -actionsTotalPx.value : 0
}

function clamp(v: number): number {
  return Math.min(0, Math.max(-actionsTotalPx.value, v))
}

function onTouchStart(event: TouchEvent): void {
  const touch = event.touches[0]
  if (!touch) return
  startX = touch.clientX
  startY = touch.clientY
  lastX = touch.clientX
  lastT = Date.now()
  velocity = 0
  decided = false
  horizontal = false
}

function onTouchMove(event: TouchEvent): void {
  const touch = event.touches[0]
  if (!touch) return
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY
  if (!decided) {
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    if (adx > DEAD_ZONE && adx >= ady * 0.8) {
      // 横向意图明确（允许竖向分量略大）：接管，跟手开始；同时通知外层关竖向滚动
      decided = true
      horizontal = true
      dragging.value = true
      notifySwiping(true)
    } else if (ady > DEAD_ZONE && ady > adx * 1.5) {
      // 竖向意图明确：放行给 scroll-view，本次按压不再接管
      decided = true
    }
  }
  if (!horizontal) return
  const now = Date.now()
  const dt = now - lastT
  if (dt > 0) {
    velocity = (touch.clientX - lastX) / dt
  }
  lastX = touch.clientX
  lastT = now
  offset.value = clamp(baseOffset() + dx)
}

function onTouchEnd(): void {
  if (!horizontal) return
  // 开 transition 吸附：快甩看速度、慢放看位移
  dragging.value = false
  notifySwiping(false)
  const target =
    velocity < -FLICK_VELOCITY
      ? true
      : velocity > FLICK_VELOCITY
        ? false
        : offset.value < -actionsTotalPx.value / 2
  horizontal = false
  open.value = target
  offset.value = target ? -actionsTotalPx.value : 0
}

function onTouchCancel(): void {
  if (!horizontal) return
  // 被打断（scroll-view 接管、来电等）：按当前位移就近吸附，不留卡住的中间态
  dragging.value = false
  notifySwiping(false)
  const target = offset.value < -actionsTotalPx.value / 2
  horizontal = false
  open.value = target
  offset.value = target ? -actionsTotalPx.value : 0
}

/** 展开态点卡片正文（open-container 进详情）：同步平滑收起，转场从原位开始 */
function onCardTap(): void {
  if (!open.value) return
  open.value = false
  offset.value = 0
}

/** 点某颗按钮：只带回 key，动作分派归外层（PlanList 带上 planId 上抛给页面） */
function onAction(action: SwipeAction): void {
  emit('action', action.key)
}

/** 配色：danger 红底（删除），中性灰底（编辑/提前截止）；文字恒白（两底上都够对比度） */
function buttonClassList(action: SwipeAction, i: number, n: number): string[] {
  const cls = [
    'swipe-delete__action',
    action.danger ? 'swipe-delete__action--danger' : 'swipe-delete__action--neutral'
  ]
  // 圆角只落两头按钮（中间方块角相邻拼接不露缝；组上不上 overflow hidden，见文件头）
  if (n === 1) cls.push('swipe-delete__action--only')
  else {
    if (i === 0) cls.push('swipe-delete__action--first')
    if (i === n - 1) cls.push('swipe-delete__action--last')
  }
  return cls
}

// 删除成功后本组件随列表项卸载：若卸载时手势还挂着，把竖向滚动还给列表，
// 否则外层 scroll-y 永久卡 false（swipingCount 扣不回来）
onUnmounted(() => {
  notifySwiping(false)
})

const moveStyle = computed(() => ({
  transform: `translateX(${offset.value}px)`,
  transition: dragging.value ? 'none' : `transform ${SNAP_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
}))
</script>

<template>
  <view class="swipe-delete">
    <view
      class="swipe-delete__card"
      :style="moveStyle"
      @tap="onCardTap"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
    >
      <slot />
    </view>
    <!-- 按钮组在行末、溢出到容器右缘外（列表容器裁切）；收起态不可见，展开时与卡片同步左移露出 -->
    <view v-if="actions.length" class="swipe-delete__actions" :style="moveStyle">
      <view
        v-for="(action, i) in actions"
        :key="action.key"
        :class="buttonClassList(action, i, actions.length)"
        hover-class="swipe-delete__action--hover"
        @tap="onAction(action)"
      >
        <text class="swipe-delete__action-text">{{ action.label }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
// flex 行级并排（零 absolute）：按钮组（N × 140rpx 等宽并排）排满卡片后溢出到**容器**（.plan-list）右缘外，
// 由容器圆角 + overflow hidden 裁掉，收起态完全不可见；组内每颗按钮高度跟卡走 stretch。
// 行级**不**上 overflow hidden（包括按钮组自身）：组上 overflow hidden 在 Skyline 会把
// stretch 高度塌成内容高（2026-11-21 三键版真机「滑开但看不到按钮」）；组里按钮方块角
// 靠「两头按钮自带圆角 + 中间直角相邻拼接」处理，裁切只落在列表容器层
// （行级裁切会把入场上升裁成「每张卡在自己的盒子内上滑」，PlanCard README 旧坑）。
.swipe-delete {
  display: flex;
}

.swipe-delete__card {
  position: relative;
  z-index: 1;
  flex: 0 0 100%;
  width: 100%;
}

// 组只是并排容器：不裁切、不圆角（圆角归两头按钮）
.swipe-delete__actions {
  display: flex;
}

.swipe-delete__action {
  flex: 0 0 140rpx;
  @include flex-center;
}

// 圆角只给两头：单颗全圆；多颗时首颗左边圆、末颗右边圆，中间直角无缝拼接
.swipe-delete__action--only {
  border-radius: $radius-lg;
}

.swipe-delete__action--first {
  border-top-left-radius: $radius-lg;
  border-bottom-left-radius: $radius-lg;
}

.swipe-delete__action--last {
  border-top-right-radius: $radius-lg;
  border-bottom-right-radius: $radius-lg;
}

// 删除红底（破坏性动作）/ 编辑·提前截止中性灰底（$color-text-2 上白字可读）
.swipe-delete__action--danger {
  background-color: $color-danger;
}

.swipe-delete__action--neutral {
  background-color: $color-text-2;
}

.swipe-delete__action--hover {
  opacity: 0.85;
}

.swipe-delete__action-text {
  font-size: $font-sm;
  font-weight: $font-weight-medium;
  color: $color-bg-card;
}
</style>
