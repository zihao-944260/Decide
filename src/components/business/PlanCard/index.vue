<script lang="ts">
/**
 * 错峰批次计数**必须**在模块作用域：<script setup> 里的每个声明都是「每实例一份」，
 * 放在那里每张卡都会从 0 开始，序号恒为 0 → 全部同时开播。
 * 这里只负责给同一批挂载的卡片排序，120ms 内没有新卡挂载就归零。
 */
let batchSeq = 0
let batchResetTimer: ReturnType<typeof setTimeout> | null = null
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'
import BaseAvatar from '@/components/base/BaseAvatar/index.vue'
import BaseImage from '@/components/base/BaseImage/index.vue'
import CountDown from '@/components/business/CountDown/index.vue'
import VoteRatioBar from '@/components/business/VoteRatioBar/index.vue'
import { PlanStatus } from '@/constants/plan'
import { usePlanStore } from '@/stores/plan'
import type { PlanOption, VoteCounts } from '@/types/models'
import { compactCount } from '@/utils/format'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  animated: true
})
const emit = defineEmits<Emits>()

const planStore = usePlanStore()

const planId = computed(() => props.summary.planId)

/**
 * §10「详情页投票后返回列表比例即时同步」的落点：
 * 计数优先读 planStore.voteCounts（useVote 乐观更新 + 服务端返回都写在这里），
 * store 里没有这条 plan 才退回列表快照。用 computed 派生，不 watch、不副作用 ——
 * 列表滚动时卡片重渲染只取值，不产生第二份状态。
 */
const votes = computed<VoteCounts>(() => planStore.voteCounts[planId.value] ?? props.summary.votes)
/** 运行时可能是 undefined（Record 取值未命中），VoteRatioBar 内部按「非 1/2 即未投票」处理 */
const myVote = computed(() => planStore.myVotes[planId.value])

/**
 * 选项表决（#61）：逐选项票数直接绑列表快照 —— planStore.applyVoteResult 会把它 patch 回 summary，
 * 所以投票后返回列表这张卡不用重查就是新值。>= 2 的闸门在 VoteRatioBar 内部，这里只负责透传。
 */
const options = computed<PlanOption[]>(() => props.summary.options ?? [])

/** 选项表决（>=2 与 VoteRatioBar 同闸门）：底栏不再摆赞同/反对，避免与每选项条两套口径（#65） */
const hasOptions = computed(() => options.value.length >= 2)

/** 倒计时归零那一刻由 CountDown 报上来，只做视觉置灰（真状态云端裁决，§8.5） */
const expired = ref(false)

/**
 * 首次出现上升（#63）：首页列表是 scroll-view type="list"（Skyline 虚拟列表），
 * 卡片被挂载就说明它正在接近视口，因此「挂载后隔一帧开始播」≈「首次出现时开始播」。
 * 上一版用 IntersectionObserver，真机上回调没有触发，卡片一直停在偏移态（看起来像边距变大），故弃用。
 *
 * 错峰：同一批挂载的卡片按挂载顺序依次开播（第一张先起、第二张随后），不一起动。
 * batchSeq 是这里唯一的模块级共享量，且只按时间窗口计数：120ms 内没有新卡挂载就归零，
 * 因此「加载更多」追加的新一批会重新从头错峰，而不是接着上一批的序号继续等。
 *
 * 闭包边界（v-for 安全的关键）：序号在挂载时就固化进本实例，riseState 与定时器都只属于本卡片，
 * 各卡互不串扰；定时器只做「摘类」这一件事，并在卸载时清理。
 * 不管 transition 有没有执行，类最终都会被摘掉 —— 样式必然回到常规，
 * 绝不会像观察器方案那样把卡片永久停在偏移位置（表现成「边距变大」）。
 *
 * 起点只有 transform：卡片全程可见，不用 opacity 起步（真机曾出现「数据在、卡片全透明」），
 * 也不改 padding / margin / 圆角 / 阴影这些基础样式。
 *
 * 动画节点必须在 open-container 外层的普通 view 上（.plan-card__wrap）：
 * open-container 会按自身圆角裁切子树，位移放在它内部的卡片上会被裁成「在自己的盒子里上滑」，
 * 看起来不再是相对列表容器上升；外层 wrapper 做位移时容器整体跟着走，且不改变任何布局。
 */
const RISE_START_DELAY = 50
/** 相邻两张卡的开播间隔：100ms，肉眼能看出「一张接一张」，又不会等到最后才动 */
const RISE_STAGGER_STEP = 100
/** 序号封顶：批次很长时最后一张最多晚 1s 开播，避免尾部卡片等到天荒地老 */
const RISE_STAGGER_MAX_INDEX = 10
const RISE_BATCH_RESET = 120

/** ready：先以起点位移渲染，错峰到点后摘类开播；done：已入场（或整屏降级） */
const riseState = ref<'ready' | 'done'>(props.animated ? 'ready' : 'done')
let riseTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (riseState.value !== 'ready') return
  const seq = Math.min(batchSeq++, RISE_STAGGER_MAX_INDEX)
  if (batchResetTimer) clearTimeout(batchResetTimer)
  batchResetTimer = setTimeout(() => {
    batchSeq = 0
    batchResetTimer = null
  }, RISE_BATCH_RESET)

  // 先让起点位移真正画出一帧，再摘类，transition 才有可动的起点；seq 决定这一帧落在第几拍
  riseTimer = setTimeout(
    () => {
      riseTimer = null
      riseState.value = 'done'
    },
    RISE_START_DELAY + seq * RISE_STAGGER_STEP
  )
})

onBeforeUnmount(() => {
  if (riseTimer) {
    clearTimeout(riseTimer)
    riseTimer = null
  }
})

const closed = computed(() => {
  const status = props.status ?? props.summary.status
  return expired.value || status === PlanStatus.Ended || status === PlanStatus.Removed
})

const rootClass = computed(() => {
  const cls = ['plan-card']
  if (closed.value) cls.push('plan-card--closed')
  return cls
})

/** 入场上升挂在 open-container 的外层（见上方注释：容器内部位移会被裁切） */
const wrapClass = computed(() =>
  riseState.value === 'ready' ? 'plan-card__wrap plan-card--rise' : 'plan-card__wrap'
)

// 列表契约只有 cover（§8.5 裁决 1）：v1 卡片只展示 1 张封面，三图并排是详情页职责
const hasCover = computed(() => !!props.summary.cover)

const agreeText = computed(() => `赞同 ${compactCount(votes.value.agree)}`)
const disagreeText = computed(() => `反对 ${compactCount(votes.value.disagree)}`)
const commentText = computed(() => `评论 ${compactCount(props.summary.commentCount)}`)

/** OpenContainer 实例查询的兜底窗口：查不到也必须放行点击，绝不把导航卡死 */
const OPEN_CONTAINER_QUERY_TIMEOUT = 200

/**
 * 容器转场动画的触发方式（实测口径）：
 * 「点 open-container → 页面 navigateTo」的隐式关联在 本组件 → PlanList → 页面 这条链路上
 * 真机不触发动画（能跳转、无放大转场），因此改用官方显式 API：把 SelectorQuery 拿到的
 * OpenContainer 实例交给页面，由页面调 navigateTo({ withOpenContainer })（基础库 3.12.2+，
 * 低版本该参数被忽略、退化为普通跳转）。
 * 查询完成/失败/超时才 emit，保证页面拿到的实例是同一帧的节点；超时兜底不能省。
 */
function onClick(): void {
  const vm = getCurrentInstance()
  let settled = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const settle = (node?: unknown): void => {
    if (settled) return
    settled = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    emit('click', planId.value, node)
  }

  timer = setTimeout(() => settle(), OPEN_CONTAINER_QUERY_TIMEOUT)
  try {
    uni
      .createSelectorQuery()
      .in(vm?.proxy)
      .select('.plan-card__open')
      .node((res: { node?: unknown }) => settle(res?.node))
      .exec()
  } catch {
    settle()
  }
}

function onExpire(): void {
  expired.value = true
  emit('expire', planId.value)
}
</script>

<template>
  <!-- 容器转场动画：点卡片后页面调 wx.navigateTo（withOpenContainer 显式触发），
       框架把卡片位置无缝放大成详情页。数字是 px（12 = 卡片 24rpx 在 375 屏上的实际圆角）；
       底色取页面灰：closed 态与页面融为一体，open 态与详情页底色一致。
       @tap 挂在 open-container 上；入场上升的位移在它外层的 __wrap 上（容器会裁切子树，位移不能放里面）。 -->
  <view :class="wrapClass">
    <open-container
      class="plan-card__open"
      closed-color="#f5f6f8"
      closed-border-radius="12"
      closed-elevation="0"
      open-color="#f5f6f8"
      open-border-radius="0"
      open-elevation="0"
      transition-type="fade"
      transition-duration="300"
      @tap="onClick"
    >
      <view :class="rootClass" hover-class="plan-card--hover">
        <view class="plan-card__head">
          <view class="plan-card__author">
            <view class="plan-card__avatar">
              <BaseAvatar :src="summary.author.avatarUrl" size="sm" />
            </view>
            <text class="plan-card__nick">{{ summary.author.nickName }}</text>
          </view>
          <view class="plan-card__count">
            <CountDown
              :deadline="summary.deadline"
              :start-at="summary.createdAt"
              tone="chip"
              size="sm"
              @expire="onExpire"
            />
          </view>
        </view>

        <text class="plan-card__title">{{ summary.title }}</text>
        <!-- 摘要已由云端截到 60 字（common/mapper buildSummary），前端只做单行 ellipsis，绝不裁行数 -->
        <text class="plan-card__desc">{{ summary.summary }}</text>

        <view v-if="hasCover" class="plan-card__cover">
          <BaseImage :src="summary.cover" mode="aspectFill" :ratio="16 / 9" radius="md" />
        </view>

        <view class="plan-card__ratio">
          <VoteRatioBar
            :votes="votes"
            :my-vote="myVote"
            :options="options"
            :my-option="summary.myOption"
            size="sm"
            :show-count="false"
            :animated="animated"
          />
        </view>

        <view class="plan-card__foot">
          <slot name="footer">
            <text v-if="!hasOptions" class="plan-card__stat">{{ agreeText }}</text>
            <text v-if="!hasOptions" class="plan-card__stat">{{ disagreeText }}</text>
            <text class="plan-card__stat">{{ commentText }}</text>
          </slot>
        </view>
      </view>
    </open-container>
  </view>
</template>

<style lang="scss" scoped>
// 入场上升（#63）：动画节点是 open-container 外层的普通 view —— 位移放在容器内部会被裁切
// （真机表现：每张卡在自己的盒子内上滑，而不是相对列表容器上升）。
// 起点只有一段位移，不参与布局、不改任何可见样式（卡片始终可见）；
// 64rpx = 卡间距 40rpx + 卡内底 padding 24rpx：起点最多压到下一张卡的背景，不遮挡正文。
.plan-card__wrap {
  width: 100%;
  transition: transform 800ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.plan-card--rise {
  transform: translateY(64rpx);
}

.plan-card {
  @include card;
  width: 100%;
  box-shadow: $shadow-card;
  // 位移动画在 __wrap 上；卡片自身只保留 opacity 的快档
  transition: opacity $duration-fast;
}

.plan-card--hover {
  opacity: 0.85;
}

// 截止/软删：整卡置灰（§8.5「前端只置灰不判状态」的视觉落点）
.plan-card--closed {
  opacity: 0.6;
}

.plan-card__head {
  @include flex-between;
  width: 100%;
}

.plan-card__author {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.plan-card__avatar {
  flex-shrink: 0;
  margin-right: $space-1;
}

.plan-card__nick {
  @include ellipsis-1;
  flex: 1;
  font-size: $font-sm;
  color: $color-text-2;
}

.plan-card__count {
  flex-shrink: 0;
  margin-left: $space-2;
}

.plan-card__title {
  @include ellipsis-1;
  width: 100%;
  margin-top: $space-2;
  font-size: $font-md;
  font-weight: $font-weight-semibold;
  line-height: $line-tight;
  color: $color-text-1;
}

.plan-card__desc {
  @include ellipsis-1;
  width: 100%;
  margin-top: $space-1;
  font-size: $font-sm;
  line-height: $line-normal;
  color: $color-text-3;
}

.plan-card__cover {
  width: 100%;
  margin-top: $space-2;
  overflow: hidden;
  border-radius: $radius-md;
}

.plan-card__ratio {
  width: 100%;
  margin-top: $space-3;
}

.plan-card__foot {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  margin-top: $space-2;
}

.plan-card__stat {
  flex-shrink: 0;
  margin-right: $space-3;
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}
</style>
