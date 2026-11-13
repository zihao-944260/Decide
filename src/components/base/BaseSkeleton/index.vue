<script setup lang="ts">
import { computed } from 'vue'
import type { Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  avatar: false,
  type: 'card',
  count: 3,
  animated: true,
})

// 骨架只画形状不画内容，占位元素用长度数组驱动 v-for
function build(len: number): number[] {
  return Array.from({ length: len }, (_unused, index) => index + 1)
}

// card 型叠两张仿 PlanCard 的整卡（#64：单张小骨架与真列表观感差太远）；list/comment 用 count；detail 单块
const groupCount = computed(() => {
  if (props.type === 'list' || props.type === 'comment') return Math.max(1, props.count)
  if (props.type === 'card') return 2
  return 1
})
const groups = computed(() => build(groupCount.value))
const rowList = computed(() => build(Math.max(1, props.rows)))
// 头像尺寸随形态变化：卡片行/评论用小头像、详情页用大头像
const avatarClass = computed(() => `base-skeleton__avatar--${props.type === 'detail' ? 'detail' : 'list'}`)
const barClass = computed(() => ({ 'base-skeleton__bar--animated': props.animated }))

// 首行在没有大标题时不吃上间距，否则卡片 padding 之上会多出一截空白
function rowMod(index: number): Record<string, boolean> {
  return {
    'base-skeleton__row--short': index === rowList.value.length - 1,
    'base-skeleton__row--tight': index === 0 && props.type !== 'detail',
  }
}
</script>

<template>
  <view class="base-skeleton">
    <view
      v-for="group in groups"
      :key="group"
      class="base-skeleton__group"
      :class="{ 'base-skeleton__group--gap': type === 'card' && group > 1 }"
    >
      <!-- card：仿 PlanCard 的整卡结构（头行/标题/摘要/封面/比例/底栏），尺寸对齐真卡（#64） -->
      <view v-if="type === 'card'" class="base-skeleton__card">
        <view class="base-skeleton__head">
          <view class="base-skeleton__avatar base-skeleton__avatar--card" :class="barClass" />
          <view class="base-skeleton__nick" :class="barClass" />
          <view class="base-skeleton__chip" :class="barClass" />
        </view>
        <view class="base-skeleton__titlebar" :class="barClass" />
        <view class="base-skeleton__descbar" :class="barClass" />
        <view class="base-skeleton__cover" :class="barClass" />
        <view class="base-skeleton__ratio" :class="barClass" />
        <view class="base-skeleton__foot">
          <view class="base-skeleton__stat" :class="barClass" />
          <view class="base-skeleton__stat" :class="barClass" />
          <view class="base-skeleton__stat" :class="barClass" />
        </view>
      </view>

      <!-- comment：仿 CommentItem（头像 + 昵称/时间行 + 内容行），边距与真评论项同源（#67） -->
      <view
        v-else-if="type === 'comment'"
        class="base-skeleton__comment"
        :class="{ 'base-skeleton__comment--first': group === 1 }"
      >
        <view class="base-skeleton__avatar base-skeleton__avatar--list" :class="barClass" />
        <view class="base-skeleton__lines">
          <view class="base-skeleton__comment-head">
            <view class="base-skeleton__nickbar" :class="barClass" />
            <view class="base-skeleton__timebar" :class="barClass" />
          </view>
          <view
            v-for="(row, rowIndex) in rowList"
            :key="row"
            class="base-skeleton__crow"
            :class="[barClass, { 'base-skeleton__crow--short': rowIndex === rowList.length - 1 }]"
          />
        </view>
      </view>

      <!-- detail / list：通用「头像 + 行」结构 -->
      <view v-else class="base-skeleton__item">
        <view v-if="avatar" class="base-skeleton__avatar" :class="[avatarClass, barClass]" />
        <view class="base-skeleton__lines">
          <view v-if="type === 'detail'" class="base-skeleton__title" :class="barClass" />
          <view
            v-for="(row, rowIndex) in rowList"
            :key="row"
            class="base-skeleton__row"
            :class="[barClass, rowMod(rowIndex)]"
          />
        </view>
      </view>
      <view v-if="(type === 'list' || type === 'comment') && group < groups.length" class="base-skeleton__divider" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
@keyframes base-skeleton-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

.base-skeleton {
  @include flex-column;
}

.base-skeleton__group {
  @include flex-column;
}

// card 叠放时卡间与真列表同源 $card-gap
.base-skeleton__group--gap {
  margin-top: $card-gap;
}

// 仿 PlanCard 整卡：同 card mixin（内衬/底色/圆角），宽度由外层 PlanList 通栏控制
.base-skeleton__card {
  @include card;
}

.base-skeleton__head {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

.base-skeleton__nick {
  flex: 1;
  min-width: 0;
  height: $skeleton-bar-height;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.base-skeleton__chip {
  flex-shrink: 0;
  width: 140rpx;
  height: $skeleton-bar-height;
  margin-left: $space-2;
  background-color: $color-fill;
  border-radius: $radius-round;
}

.base-skeleton__titlebar {
  width: 70%;
  height: $skeleton-bar-height-lg;
  margin-top: $space-2;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.base-skeleton__descbar {
  width: 90%;
  height: $skeleton-bar-height;
  margin-top: $space-1;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

// 封面占位：近似真卡 16/9 封面高度，圆角同 BaseImage md
.base-skeleton__cover {
  width: 100%;
  height: 300rpx;
  margin-top: $space-2;
  background-color: $color-fill;
  border-radius: $radius-md;
}

.base-skeleton__ratio {
  width: 100%;
  height: $ratio-bar-md;
  margin-top: $space-3;
  background-color: $color-fill;
  border-radius: $radius-round;
}

.base-skeleton__foot {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  margin-top: $space-2;
}

.base-skeleton__stat {
  flex-shrink: 0;
  width: 90rpx;
  height: $skeleton-bar-height;
  margin-right: $space-3;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.base-skeleton__item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.base-skeleton__lines {
  @include flex-column;
  flex: 1;
  overflow: hidden;
}

.base-skeleton__avatar {
  flex-shrink: 0;
  margin-right: $space-2;
  background-color: $color-fill;
  border-radius: $radius-round;
}

.base-skeleton__avatar--card,
.base-skeleton__avatar--list {
  width: $avatar-sm;
  height: $avatar-sm;
}

.base-skeleton__avatar--detail {
  width: $avatar-lg;
  height: $avatar-lg;
}

.base-skeleton__title {
  width: 45%;
  height: $skeleton-bar-height-lg;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.base-skeleton__row {
  height: $skeleton-bar-height;
  margin-top: $space-2;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

// flex 下 margin 不折叠，末行缩短只为打破等宽节奏
.base-skeleton__row--short {
  width: 60%;
}

.base-skeleton__row--tight {
  margin-top: 0;
}

.base-skeleton__bar--animated {
  animation: base-skeleton-pulse 1200ms ease-in-out infinite alternate;
}

.base-skeleton__divider {
  height: 1px;
  margin: $space-2 0;
  background-color: $color-border;
}

// comment 形态：与 CommentItem 同边距（上下 $space-2、首条 0），头像右间距复用 base avatar（#67）
.base-skeleton__comment {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: $space-2 0;
}

.base-skeleton__comment--first {
  padding-top: 0;
}

.base-skeleton__comment-head {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.base-skeleton__nickbar {
  width: 40%;
  height: $skeleton-bar-height;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.base-skeleton__timebar {
  width: 20%;
  height: $skeleton-bar-height;
  margin-left: $space-2;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.base-skeleton__crow {
  width: 90%;
  height: $skeleton-bar-height;
  margin-top: $space-1;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.base-skeleton__crow--short {
  width: 60%;
}
</style>