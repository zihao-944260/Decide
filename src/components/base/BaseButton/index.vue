<script setup lang="ts">
import { computed } from 'vue'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  type: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false,
})
const emit = defineEmits<Emits>()

const interactive = computed(() => !props.disabled && !props.loading)
const rootClass = computed(() => [
  `base-button--${props.type}`,
  `base-button--${props.size}`,
  {
    'base-button--block': props.block,
    'base-button--disabled': props.disabled,
  },
])
const spinnerClass = computed(() => ({
  'base-button__spinner--dark': props.type === 'secondary' || props.type === 'text',
}))

function onTap(): void {
  if (!interactive.value) return
  emit('click')
}
</script>

<template>
  <view
    class="base-button"
    :class="rootClass"
    :hover-class="interactive ? 'base-button--hover' : 'none'"
    @tap="onTap"
  >
    <view v-if="loading" class="base-button__spinner" :class="spinnerClass" />
    <view class="base-button__body">
      <slot />
    </view>
  </view>
</template>

<style lang="scss" scoped>
@keyframes base-button-spin {
  to {
    transform: rotate(360deg);
  }
}

.base-button {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: $radius-round;
  transition: opacity $duration-fast;
}

.base-button--block {
  width: 100%;
}

.base-button--hover {
  opacity: 0.8;
}

.base-button--disabled {
  opacity: 0.5;
}

// 尺寸：sm/md 同为最小可点击高度（§9.1-8），仅字号与左右留白递减
.base-button--sm {
  height: $tap-min-height;
  padding: 0 $space-4;
  font-size: $font-sm;
}

.base-button--md {
  height: $tap-min-height;
  padding: 0 $space-5;
  font-size: $font-md;
}

.base-button--lg {
  height: $button-height-lg;
  padding: 0 $space-5;
  font-size: $font-lg;
}

.base-button--primary {
  background-color: $color-primary;
  color: $color-text-inverse;
}

.base-button--secondary {
  background-color: $color-primary-light;
  color: $color-primary;
}

.base-button--danger {
  background-color: $color-danger;
  color: $color-text-inverse;
}

.base-button--text {
  background-color: transparent;
  color: $color-primary;
  padding-left: $space-2;
  padding-right: $space-2;
}

.base-button__body {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.base-button__spinner {
  width: $spinner-sm;
  height: $spinner-sm;
  margin-right: $space-1;
  border: $border-width-thick solid $color-text-inverse;
  border-top-color: transparent;
  border-radius: $radius-round;
  animation: base-button-spin 800ms linear infinite;
}

.base-button__spinner--dark {
  border-color: $color-primary;
  border-top-color: transparent;
}
</style>
