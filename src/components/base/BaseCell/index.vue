<script setup lang="ts">
import { computed, useSlots } from 'vue'
import type { Props, Emits } from './types'

// 模板直接读取解包后的 props，无需接住 withDefaults 返回值
withDefaults(defineProps<Props>(), {
  title: '',
  desc: '',
  value: '',
  arrow: false,
  icon: '',
  section: false,
})
const emit = defineEmits<Emits>()

const slots = useSlots()
const hasIconSlot = computed(() => !!slots.icon)
const hasRightSlot = computed(() => !!slots.right)

function onTap(): void {
  emit('click')
}
</script>

<template>
  <view class="base-cell" :class="{ 'base-cell--section': section }" hover-class="base-cell--hover" @tap="onTap">
    <view v-if="hasIconSlot" class="base-cell__icon">
      <slot name="icon" />
    </view>
    <image v-else-if="icon" class="base-cell__icon-img" :src="icon" mode="aspectFit" />
    <view class="base-cell__main">
      <text :class="section ? 'base-cell__title base-cell__title--section' : 'base-cell__title'">{{ title }}</text>
      <text v-if="desc" class="base-cell__desc">{{ desc }}</text>
    </view>
    <text v-if="value" class="base-cell__value">{{ value }}</text>
    <view v-if="hasRightSlot" class="base-cell__right">
      <slot name="right" />
    </view>
    <view v-if="arrow" class="base-cell__arrow" />
  </view>
</template>

<style lang="scss" scoped>
.base-cell {
  @include tappable;
  padding: $space-2 $space-3;
  background-color: $color-bg-card;
  transition: opacity $duration-fast;
}

.base-cell--hover {
  opacity: 0.7;
}

// 卡内模块标题行：内衬归外层卡，去 min-height、padding-bottom 撑开间距（用户裁定 2026-11-13）；
// 标题字重对齐 section-title（修饰类挂节点自身，Skyline 无后代选择器）
.base-cell--section {
  min-height: 0;
  padding: 0 0 $space-3;
}

.base-cell__title--section {
  font-weight: $font-weight-semibold;
  line-height: $line-tight;
}

.base-cell__icon {
  @include flex-center;
  margin-right: $space-2;
}

.base-cell__icon-img {
  width: $cell-icon-size;
  height: $cell-icon-size;
  margin-right: $space-2;
}

.base-cell__main {
  @include flex-column;
  flex: 1;
  overflow: hidden;
}

.base-cell__title {
  font-size: $font-md;
  color: $color-text-1;
  @include ellipsis-1;
}

.base-cell__desc {
  margin-top: $space-1;
  font-size: $font-sm;
  color: $color-text-3;
  @include ellipsis-1;
}

.base-cell__value {
  flex-shrink: 0;
  margin-left: $space-2;
  font-size: $font-md;
  color: $color-text-2;
}

.base-cell__right {
  @include flex-center;
  flex-shrink: 0;
  margin-left: $space-2;
}

// 右向箭头：真实节点旋转（Skyline 无伪元素）
.base-cell__arrow {
  flex-shrink: 0;
  width: $icon-arrow-size;
  height: $icon-arrow-size;
  margin-left: $space-2;
  border-top: $border-width-thin solid $color-text-3;
  border-right: $border-width-thin solid $color-text-3;
  transform: rotate(45deg);
}
</style>
