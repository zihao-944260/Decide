<script setup lang="ts">
import { computed, onBeforeUnmount, useSlots, watch } from 'vue'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  message: '',
  duration: 2000,
})
const emit = defineEmits<Emits>()

const slots = useSlots()
const hasContentSlot = computed(() => !!slots.default)

let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function onTimeout(): void {
  emit('update:visible', false)
  emit('closed')
}

// visible / 文案 / 时长任一变化都重新计时，避免连续两次调用共用旧定时器
watch(
  () => [props.visible, props.message, props.duration],
  () => {
    clearTimer()
    if (props.visible && props.duration > 0) timer = setTimeout(onTimeout, props.duration)
  },
  { immediate: true }
)

onBeforeUnmount(clearTimer)
</script>

<template>
  <view v-if="visible" class="base-toast">
    <view class="base-toast__bubble">
      <view v-if="type === 'success'" class="base-toast__icon">
        <view class="base-toast__check" />
      </view>
      <text v-else-if="type === 'error'" class="base-toast__glyph">✕</text>
      <view v-else-if="type === 'loading'" class="base-toast__icon">
        <view class="base-toast__spinner" />
      </view>
      <view v-if="hasContentSlot" class="base-toast__slot">
        <slot />
      </view>
      <text v-else-if="message" class="base-toast__text">{{ message }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@keyframes base-toast-spin {
  to {
    transform: rotate(360deg);
  }
}

// 进场只淡入：v-if 首次挂载即触发 animation，无需 JS 掐帧
@keyframes base-toast-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

// 全宽窄条而非全屏蒙层：Skyline 下 pointer-events 未列入兼容清单，
// 用「条带高度=气泡高度」把误吞点击的区域压到最小
.base-toast {
  position: fixed;
  top: $toast-offset-top;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  z-index: $z-toast;
  animation: base-toast-in $duration-fast ease-out;
}

.base-toast__bubble {
  @include flex-column;
  align-items: center;
  max-width: $toast-max-width;
  padding: $space-4 $space-3;
  background-color: $color-toast-bg;
  border-radius: $radius-md;
}

.base-toast__icon {
  @include flex-center;
  width: $toast-icon-size;
  height: $toast-icon-size;
  margin-bottom: $space-2;
}

// 勾：真实节点两条边框旋转（Skyline 无伪元素）
.base-toast__check {
  width: 50%;
  height: 28%;
  margin-bottom: $space-1;
  border-bottom: $border-width-thick solid $color-text-inverse;
  border-left: $border-width-thick solid $color-text-inverse;
  transform: rotate(-45deg);
}

// 叉：沿用 BasePopup 关闭按钮的文字字形，省掉两层 absolute 叠放
.base-toast__glyph {
  margin-bottom: $space-1;
  text-align: center;
  font-size: $font-xl;
  line-height: $line-tight;
  color: $color-text-inverse;
}

.base-toast__spinner {
  width: 80%;
  height: 80%;
  border: $border-width-thick solid $color-text-inverse;
  border-top-color: transparent;
  border-radius: $radius-round;
  animation: base-toast-spin 800ms linear infinite;
}

.base-toast__slot {
  @include flex-column;
  align-items: center;
}

.base-toast__text {
  text-align: center;
  font-size: $font-md;
  color: $color-text-inverse;
  line-height: $line-normal;
  word-break: break-all;
}
</style>
