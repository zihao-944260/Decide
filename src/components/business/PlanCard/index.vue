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
  animated: true,
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
 * 首次入视口上升动画（#63）：IntersectionObserver 命中一次即 disconnect 解绑，之后不再触发。
 * observer / entered 都是**本卡片实例**setup 里的局部量，回调闭包只捕获自己这份，
 * 不共享 v-for 循环变量 —— 虚拟列表复用实例时 entered 保持 true，不会重播。
 */
const entered = ref(false)
const instance = getCurrentInstance()
let riseObserver: ReturnType<typeof uni.createIntersectionObserver> | null = null
onMounted(() => {
  if (!instance) return
  riseObserver = uni.createIntersectionObserver(instance.proxy, { thresholds: [0.15] })
  riseObserver.relativeToViewport().observe('.plan-card', (res) => {
    if (res.intersectionRatio > 0) {
      entered.value = true
      riseObserver?.disconnect()
      riseObserver = null
    }
  })
})
onBeforeUnmount(() => {
  riseObserver?.disconnect()
  riseObserver = null
})

const closed = computed(() => {
  const status = props.status ?? props.summary.status
  return expired.value || status === PlanStatus.Ended || status === PlanStatus.Removed
})

const rootClass = computed(() => {
  const cls = ['plan-card']
  if (closed.value) cls.push('plan-card--closed')
  if (entered.value) cls.push('plan-card--rise')
  return cls
})

// 列表契约只有 cover（§8.5 裁决 1）：v1 卡片只展示 1 张封面，三图并排是详情页职责
const hasCover = computed(() => !!props.summary.cover)

const agreeText = computed(() => `赞同 ${compactCount(votes.value.agree)}`)
const disagreeText = computed(() => `反对 ${compactCount(votes.value.disagree)}`)
const commentText = computed(() => `评论 ${compactCount(props.summary.commentCount)}`)

function onClick(): void {
  emit('click', planId.value)
}

function onLongPress(): void {
  emit('long-press', planId.value)
}

function onExpire(): void {
  expired.value = true
  emit('expire', planId.value)
}
</script>

<template>
  <view :class="rootClass" hover-class="plan-card--hover" @tap="onClick" @longpress="onLongPress">
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
</template>

<style lang="scss" scoped>
// 首次入视口缓慢上升（#63）：backwards 只在播放期间生效，播完回到常规样式（不压 --closed 的置灰），
// 配合 observer 命中即 disconnect，保证一生只播一次
@keyframes plan-card-rise {
  from {
    opacity: 0;
    transform: translateY(32rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.plan-card--rise {
  animation: plan-card-rise 420ms ease-out backwards;
}

.plan-card {
  @include card;
  width: 100%;
  box-shadow: $shadow-card;
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
