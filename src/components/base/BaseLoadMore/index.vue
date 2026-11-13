<script setup lang="ts">
import { computed } from 'vue'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  loadingText: '加载中…',
  nomoreText: '没有更多了',
  errorText: '加载失败，点击重试',
})
const emit = defineEmits<Emits>()

// 三态共用一个文本节点，避免在模板里写三套 v-if 分支
const text = computed(() => {
  if (props.status === 'loading') return props.loadingText
  if (props.status === 'nomore') return props.nomoreText
  return props.errorText
})
const textClass = computed(() => `base-load-more__text--${props.status}`)

function onTap(): void {
  if (props.status !== 'error') return
  emit('retry')
}
</script>

<template>
  <view
    class="base-load-more"
    :hover-class="status === 'error' ? 'base-load-more--hover' : 'none'"
    @tap="onTap"
  >
    <view v-if="status === 'loading'" class="base-load-more__spinner" />
    <view v-if="status === 'nomore'" class="base-load-more__line" />
    <text class="base-load-more__text" :class="textClass">{{ text }}</text>
    <view v-if="status === 'nomore'" class="base-load-more__line" />
  </view>
</template>

<style lang="scss" scoped>
@keyframes base-load-more-spin {
  to {
    transform: rotate(360deg);
  }
}

.base-load-more {
  @include tappable;
  justify-content: center;
  padding: $space-2 $space-3;
  transition: opacity $duration-fast;
}

.base-load-more--hover {
  opacity: 0.6;
}

.base-load-more__spinner {
  flex-shrink: 0;
  width: $spinner-sm;
  height: $spinner-sm;
  margin-right: $space-1;
  border: $border-width-thick solid $color-primary;
  border-top-color: transparent;
  border-radius: $radius-round;
  animation: base-load-more-spin 800ms linear infinite;
}

.base-load-more__text {
  font-size: $font-sm;
}

.base-load-more__text--loading,
.base-load-more__text--nomore {
  color: $color-text-3;
}

.base-load-more__text--nomore {
  margin: 0 $space-2;
}

.base-load-more__text--error {
  color: $color-primary;
}

// 装饰短线：真实节点（Skyline 无伪元素）
.base-load-more__line {
  flex-shrink: 0;
  width: $load-more-line-width;
  height: 1px;
  background-color: $color-border;
}
</style>
