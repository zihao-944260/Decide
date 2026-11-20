<script setup lang="ts">
import { computed } from 'vue'
import { VoteType } from '@/constants/plan'
import type { PlanOption } from '@/types/models'
import { compactCount, ratioPercent } from '@/utils/format'
import type { Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  showCount: true,
  animated: true,
  size: 'md',
  emptyText: '暂无人表态',
  options: () => [],
  myOption: ''
})

/** 云端计数字段可能是 undefined / NaN，这里一次性钳成非负整数，杜绝 NaN% 与负宽度 */
function safeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

const agree = computed(() => safeCount(props.votes.agree))
const disagree = computed(() => safeCount(props.votes.disagree))
const total = computed(() => agree.value + disagree.value)

/** 0 票是空态而不是 0%:0% 的假比例（§12 T3.2 验收标准） */
const isEmpty = computed(() => total.value <= 0)

/**
 * 占比钳位统一走 utils/format 的 ratioPercent（part/whole → 0~1，whole<=0 给 0），
 * 本地不再写第二份 clamp；0 票由上面的 isEmpty 走空态，不会走到这里。
 */
const agreePercent = computed(() => {
  if (isEmpty.value) return 0
  return Math.round(ratioPercent(agree.value, total.value) * 100)
})
// 反向用 100 减：两边四舍五入后必然铺满整条，不会出现 33% + 66% = 99% 的缝隙
const disagreePercent = computed(() => (isEmpty.value ? 0 : 100 - agreePercent.value))

const agreeStyle = computed(() => `width: ${agreePercent.value}%`)
const disagreeStyle = computed(() => `width: ${disagreePercent.value}%`)

const isMyAgree = computed(() => props.myVote === VoteType.Agree)
const isMyDisagree = computed(() => props.myVote === VoteType.Disagree)

const agreeNameClass = computed(() =>
  isMyAgree.value ? 'vote-ratio-bar__name vote-ratio-bar__name--mine' : 'vote-ratio-bar__name'
)
const disagreeNameClass = computed(() =>
  isMyDisagree.value ? 'vote-ratio-bar__name vote-ratio-bar__name--mine' : 'vote-ratio-bar__name'
)

const segClass = computed(() =>
  props.animated ? 'vote-ratio-bar__seg' : 'vote-ratio-bar__seg vote-ratio-bar__seg--static'
)

const rootClass = computed(() => `vote-ratio-bar vote-ratio-bar--${props.size}`)
// 条高写在 track 自己身上（Skyline 禁后代选择器，不能靠父级 size 类往下压）
const trackClass = computed(() => {
  const classes = ['vote-ratio-bar__track', `vote-ratio-bar__track--${props.size}`]
  if (isEmpty.value) classes.push('vote-ratio-bar__track--empty')
  return classes
})

const agreeCountText = computed(() => `${compactCount(agree.value)}人`)
const disagreeCountText = computed(() => `${compactCount(disagree.value)}人`)

/** 与 OptionCardList 同一道闸门：>= 2 个选项才是选项表决（#61），否则保持赞同/反对双色条 */
const MIN_OPTIONS = 2
const optionMode = computed(() => props.options.length >= MIN_OPTIONS)
const optionTotal = computed(() =>
  props.options.reduce((sum, option) => sum + safeCount(option.count), 0)
)
const optionEmpty = computed(() => optionTotal.value <= 0)
const showEmpty = computed(() => (optionMode.value ? optionEmpty.value : isEmpty.value))

interface OptionRow {
  id: string
  name: string
  percent: number
  countText: string
  nameClass: string
  trackClass: string
  fillClass: string
  fillStyle: string
  percentClass: string
}

/**
 * 每选项一行的视图模型：类名在这里拼好，模板每个节点只挂自己那份平铺 class
 * （Skyline 禁后代选择器，高亮不能靠父行 --mine 往下压）。
 */
const optionRows = computed<OptionRow[]>(() => {
  if (!optionMode.value || optionEmpty.value) return []
  const whole = optionTotal.value
  return props.options.map((option: PlanOption) => {
    const count = safeCount(option.count)
    const percent = Math.round(ratioPercent(count, whole) * 100)
    const mine = option.id === props.myOption
    const fillNames = ['vote-ratio-bar__option-fill']
    if (mine) fillNames.push('vote-ratio-bar__option-fill--mine')
    if (!props.animated) fillNames.push('vote-ratio-bar__option-fill--static')
    return {
      id: option.id,
      name: option.name,
      percent,
      countText: `${compactCount(count)}人`,
      nameClass: mine
        ? 'vote-ratio-bar__option-name vote-ratio-bar__option-name--mine'
        : 'vote-ratio-bar__option-name',
      trackClass: `vote-ratio-bar__option-track vote-ratio-bar__option-track--${props.size}`,
      fillClass: fillNames.join(' '),
      fillStyle: `width: ${percent}%`,
      percentClass: mine
        ? 'vote-ratio-bar__option-percent vote-ratio-bar__option-percent--mine'
        : 'vote-ratio-bar__option-percent'
    }
  })
})
</script>

<template>
  <view :class="rootClass">
    <view v-if="optionMode && !optionEmpty" class="vote-ratio-bar__options">
      <view v-for="row in optionRows" :key="row.id" class="vote-ratio-bar__option">
        <text :class="row.nameClass">{{ row.name }}</text>
        <view :class="row.trackClass">
          <view :class="row.fillClass" :style="row.fillStyle" />
        </view>
        <text :class="row.percentClass">{{ row.percent }}%</text>
        <text v-if="showCount" class="vote-ratio-bar__option-count">{{ row.countText }}</text>
      </view>
    </view>

    <view v-if="!optionMode" :class="trackClass">
      <view
        v-if="!isEmpty"
        class="vote-ratio-bar__seg--agree"
        :class="segClass"
        :style="agreeStyle"
      />
      <view
        v-if="!isEmpty"
        class="vote-ratio-bar__seg--disagree"
        :class="segClass"
        :style="disagreeStyle"
      />
    </view>

    <view v-if="!optionMode && !isEmpty" class="vote-ratio-bar__labels">
      <view class="vote-ratio-bar__group">
        <view v-if="isMyAgree" class="vote-ratio-bar__mark vote-ratio-bar__mark--agree" />
        <text :class="agreeNameClass">赞同</text>
        <text class="vote-ratio-bar__percent vote-ratio-bar__percent--agree"
          >{{ agreePercent }}%</text
        >
        <text v-if="showCount" class="vote-ratio-bar__count">{{ agreeCountText }}</text>
      </view>
      <view class="vote-ratio-bar__group">
        <view v-if="isMyDisagree" class="vote-ratio-bar__mark vote-ratio-bar__mark--disagree" />
        <text :class="disagreeNameClass">反对</text>
        <text class="vote-ratio-bar__percent vote-ratio-bar__percent--disagree"
          >{{ disagreePercent }}%</text
        >
        <text v-if="showCount" class="vote-ratio-bar__count">{{ disagreeCountText }}</text>
      </view>
    </view>

    <text v-if="showEmpty" class="vote-ratio-bar__empty">{{ emptyText }}</text>
  </view>
</template>

<style lang="scss" scoped>
.vote-ratio-bar {
  @include flex-column;
  width: 100%;
}

.vote-ratio-bar__track {
  display: flex;
  flex-direction: row;
  width: 100%;
  overflow: hidden;
  background-color: $color-fill;
  border-radius: $radius-round;
}

.vote-ratio-bar__track--empty {
  background-color: $color-fill-deep;
}

.vote-ratio-bar__seg {
  height: 100%;
  transition: width $duration-base ease-out;
}

// animated=false：同类名后置覆盖 transition；仍保持一个节点一个类名（工程约定，见兼容清单 §1.5 末尾）
.vote-ratio-bar__seg--static {
  transition: none;
}

.vote-ratio-bar__seg--agree {
  background-color: $color-agree;
}

.vote-ratio-bar__seg--disagree {
  background-color: $color-disagree;
}

.vote-ratio-bar__labels {
  @include flex-between;
  margin-top: $space-1;
}

.vote-ratio-bar__group {
  display: flex;
  flex-direction: row;
  align-items: center;
  overflow: hidden;
}

// 我的票标记：真实节点小方块（Skyline 无伪元素）
.vote-ratio-bar__mark {
  flex-shrink: 0;
  width: $space-1;
  height: $space-1;
  margin-right: $space-1;
  border-radius: $radius-sm;
}

.vote-ratio-bar__mark--agree {
  background-color: $color-agree;
}

.vote-ratio-bar__mark--disagree {
  background-color: $color-disagree;
}

.vote-ratio-bar__name {
  flex-shrink: 0;
  margin-right: $space-1;
  color: $color-text-2;
}

.vote-ratio-bar__name--mine {
  color: $color-text-1;
  font-weight: $font-weight-semibold;
}

.vote-ratio-bar__percent {
  flex-shrink: 0;
}

.vote-ratio-bar__percent--agree {
  color: $color-agree;
}

.vote-ratio-bar__percent--disagree {
  color: $color-disagree;
}

.vote-ratio-bar__count {
  flex-shrink: 0;
  margin-left: $space-1;
  color: $color-text-3;
}

.vote-ratio-bar__empty {
  margin-top: $space-1;
  color: $color-text-3;
  text-align: center;
}

// 条高走比例条专用 token（tokens.scss），不借间距 token
.vote-ratio-bar--sm {
  font-size: $font-xs;
}

.vote-ratio-bar--md {
  font-size: $font-sm;
}

.vote-ratio-bar--lg {
  font-size: $font-md;
}

.vote-ratio-bar__track--sm {
  height: $ratio-bar-sm;
}

.vote-ratio-bar__track--md {
  height: $ratio-bar-md;
}

.vote-ratio-bar__track--lg {
  height: $ratio-bar-lg;
}

.vote-ratio-bar__options {
  @include flex-column;
  width: 100%;
}

// Skyline 下 margin 不折叠，行间距只给一侧
.vote-ratio-bar__option {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  margin-bottom: $space-1;
}

// 名称上限 20 字（Limit.OPTION_NAME_MAX），行内放不下就单行 ellipsis，绝不挤掉进度条
.vote-ratio-bar__option-name {
  @include ellipsis-1;
  flex-shrink: 0;
  max-width: $space-5 * 5;
  margin-right: $space-2;
  color: $color-text-2;
}

.vote-ratio-bar__option-name--mine {
  color: $color-primary;
  font-weight: $font-weight-semibold;
}

.vote-ratio-bar__option-track {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background-color: $color-fill;
  border-radius: $radius-round;
}

.vote-ratio-bar__option-track--sm {
  height: $ratio-bar-sm;
}

.vote-ratio-bar__option-track--md {
  height: $ratio-bar-md;
}

.vote-ratio-bar__option-track--lg {
  height: $ratio-bar-lg;
}

.vote-ratio-bar__option-fill {
  height: 100%;
  background-color: $color-fill-deep;
  border-radius: $radius-round;
  transition: width $duration-base ease-out;
}

.vote-ratio-bar__option-fill--mine {
  background-color: $color-primary;
}

.vote-ratio-bar__option-fill--static {
  transition: none;
}

.vote-ratio-bar__option-percent {
  flex-shrink: 0;
  margin-left: $space-2;
  color: $color-text-3;
}

.vote-ratio-bar__option-percent--mine {
  color: $color-primary;
  font-weight: $font-weight-semibold;
}

.vote-ratio-bar__option-count {
  flex-shrink: 0;
  margin-left: $space-1;
  color: $color-text-3;
}
</style>
