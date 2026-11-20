<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  src: '',
  mode: 'aspectFill',
  ratio: 0,
  lazy: true,
  radius: 'none',
  preview: false
})
const emit = defineEmits<Emits>()

const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  }
)

const rootClass = computed(() => (props.radius === 'none' ? '' : `base-image--${props.radius}`))
const ratioStyle = computed(() => (props.ratio > 0 ? `aspect-ratio: ${props.ratio};` : ''))
const showImage = computed(() => !!props.src && !failed.value)

function onLoad(): void {
  emit('load')
}

function onError(): void {
  failed.value = true
  emit('error')
}

function onTap(): void {
  if (props.preview && showImage.value) {
    uni.previewImage({ urls: [props.src] })
  }
  emit('click')
}

function onRetry(): void {
  // failed 翻转会让 v-if 重建 image 节点，从而重新发起加载
  if (failed.value) failed.value = false
}
</script>

<template>
  <view class="base-image" :class="rootClass" :style="ratioStyle" @tap="onTap">
    <image
      v-if="showImage"
      class="base-image__inner"
      :class="{ 'base-image__inner--fill': ratio > 0 }"
      :src="src"
      :mode="mode"
      :lazy-load="lazy"
      @load="onLoad"
      @error="onError"
    />
    <view v-if="!src || failed" class="base-image__placeholder" @tap.stop="onRetry">
      <text v-if="failed" class="base-image__retry-text">加载失败，点击重试</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.base-image {
  position: relative;
  width: 100%;
  overflow: hidden;
  background-color: $color-fill;
}

.base-image--sm {
  border-radius: $radius-sm;
}

.base-image--md {
  border-radius: $radius-md;
}

.base-image--lg {
  border-radius: $radius-lg;
}

.base-image--round {
  border-radius: $radius-round;
}

.base-image__inner {
  width: 100%;
}

// 未传 ratio 时不设高度：widthFix 由图片自撑，其余模式请调用方给外层定高
.base-image__inner--fill {
  height: 100%;
}

.base-image__placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  @include flex-center;
  background-color: $color-fill;
}

.base-image__retry-text {
  font-size: $font-xs;
  color: $color-text-3;
}
</style>
