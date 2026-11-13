<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import type { Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  src: '',
  size: 'md',
  shape: 'circle',
})

const slots = useSlots()
const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  }
)

const hasFallbackSlot = computed(() => !!slots.default)
const showImage = computed(() => !!props.src && !failed.value)
const rootClass = computed(() => [`base-avatar--${props.size}`, `base-avatar--${props.shape}`])

function onError(): void {
  failed.value = true
}
</script>

<template>
  <view class="base-avatar" :class="rootClass">
    <image v-if="showImage" class="base-avatar__img" :src="src" mode="aspectFill" @error="onError" />
    <view v-else-if="hasFallbackSlot" class="base-avatar__fallback">
      <slot />
    </view>
    <view v-else class="base-avatar__fallback">
      <view class="base-avatar__head" />
      <view class="base-avatar__body" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.base-avatar {
  @include flex-center;
  flex-shrink: 0;
  overflow: hidden;
  background-color: $color-fill-deep;
}

.base-avatar--sm {
  width: $avatar-sm;
  height: $avatar-sm;
}

.base-avatar--md {
  width: $avatar-md;
  height: $avatar-md;
}

.base-avatar--lg {
  width: $avatar-lg;
  height: $avatar-lg;
}

.base-avatar--circle {
  border-radius: $radius-round;
}

.base-avatar--square {
  border-radius: $radius-md;
}

.base-avatar__img {
  width: 100%;
  height: 100%;
}

.base-avatar__fallback {
  @include flex-column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

// 缺省人形：真实节点拼出（Skyline 无伪元素）
.base-avatar__head {
  width: 32%;
  height: 32%;
  border-radius: $radius-round;
  background-color: $color-text-3;
  opacity: 0.45;
}

.base-avatar__body {
  width: 64%;
  height: 40%;
  margin-top: 12%;
  margin-bottom: -22%;
  border-radius: $radius-round $radius-round 0 0;
  background-color: $color-text-3;
  opacity: 0.45;
}
</style>
