<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom',
  round: true,
  closable: false,
  duration: 300,
  zIndex: 1000, // 与 $z-popup 保持一致（SCSS 变量无法在 TS 默认值中引用）
  maskClosable: true,
})
const emit = defineEmits<Emits>()

/**
 * 为什么不用 page-container（#78）：它在 WebView 渲染页的手势/高度行为从未实测（兼容清单 §2.8
 * 「没测过≠可以用」），真机表现为弹层内 scroll-view 滚不动、触摸弹层却滚动外层页面；
 * 且它要求一页单实例。fixed 遮罩 + fixed 面板是两渲染器都实测可用的形状（清单 §2.2 fixed ✅）。
 * 遮罩 catchtouchmove 断掉触摸冒泡到外层滚动容器；WebView 页另由 page-meta 在弹层期间锁文档滚动。
 */

/** host 决定节点是否存在，shown 驱动进/退场过渡 class；分两帧保证 transition 有起点 */
const host = ref(props.visible)
const shown = ref(props.visible)

let riseTimer: ReturnType<typeof setTimeout> | undefined
let openedTimer: ReturnType<typeof setTimeout> | undefined
let dropTimer: ReturnType<typeof setTimeout> | undefined

function clearTimers(): void {
  clearTimeout(riseTimer)
  clearTimeout(openedTimer)
  clearTimeout(dropTimer)
  riseTimer = undefined
  openedTimer = undefined
  dropTimer = undefined
}

watch(
  () => props.visible,
  (value) => {
    clearTimers()
    if (value) {
      host.value = true
      riseTimer = setTimeout(() => {
        riseTimer = undefined
        shown.value = true
        openedTimer = setTimeout(() => {
          openedTimer = undefined
          emit('opened')
        }, props.duration)
      }, 30)
      return
    }
    if (!host.value) return
    shown.value = false
    dropTimer = setTimeout(() => {
      dropTimer = undefined
      if (props.visible) return
      host.value = false
      emit('closed')
    }, props.duration + 80)
  },
)

onUnmounted(clearTimers)

const rootStyle = computed(() => `z-index: ${props.zIndex};`)
const maskStyle = computed(() => `z-index: ${props.zIndex}; transition-duration: ${props.duration}ms;`)
const panelStyle = computed(() => `z-index: ${props.zIndex + 1}; transition-duration: ${props.duration}ms;`)

function close(): void {
  emit('update:visible', false)
}

function onOverlayTap(): void {
  emit('click-overlay')
  if (props.maskClosable) close()
}

/** 遮罩 catchtouchmove 的空处理器：防穿透靠 .stop.prevent 编译出的 catch，不靠逻辑 */
function onMaskTouchMove(): void {}
</script>

<template>
  <view v-if="host" class="base-popup" :style="rootStyle">
    <view
      class="base-popup__mask"
      :class="{ 'base-popup__mask--on': shown }"
      :style="maskStyle"
      @tap="onOverlayTap"
      @touchmove.stop.prevent="onMaskTouchMove"
    />
    <view
      class="base-popup__panel"
      :class="[
        `base-popup__panel--${position}`,
        shown ? `base-popup__panel--on-${position}` : '',
        round ? `base-popup__panel--round-${position}` : '',
      ]"
      :style="panelStyle"
    >
      <view
        v-if="closable"
        class="base-popup__close"
        hover-class="base-popup__close--hover"
        @tap="close"
      >
        <text class="base-popup__close-icon">✕</text>
      </view>
      <slot />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.base-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.base-popup__mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: $color-mask;
  opacity: 0;
  transition: opacity $duration-base;
}

.base-popup__mask--on {
  opacity: 1;
}

.base-popup__panel {
  @include flex-column;
  position: absolute;
  background-color: $color-bg-card;
  transition: transform $duration-base, opacity $duration-base;
}

.base-popup__panel--bottom {
  left: 0;
  right: 0;
  bottom: 0;
  transform: translateY(100%);
  @include safe-area-bottom;
}

.base-popup__panel--top {
  left: 0;
  right: 0;
  top: 0;
  transform: translateY(-100%);
}

.base-popup__panel--center {
  left: 50%;
  top: 50%;
  width: $modal-width;
  overflow: hidden;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
}

.base-popup__panel--right {
  top: 0;
  bottom: 0;
  right: 0;
  height: 100%;
  transform: translateX(100%);
}

// 进/退场终态按位置各挂一个类：Skyline 不认多类名叠加的复合选择器（兼容清单 §1.5）
.base-popup__panel--on-bottom {
  transform: translateY(0);
}

.base-popup__panel--on-top {
  transform: translateY(0);
}

.base-popup__panel--on-center {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.base-popup__panel--on-right {
  transform: translateX(0);
}

.base-popup__panel--round-bottom {
  border-radius: $radius-lg $radius-lg 0 0;
}

.base-popup__panel--round-top {
  border-radius: 0 0 $radius-lg $radius-lg;
}

.base-popup__panel--round-center {
  border-radius: $radius-lg;
}

.base-popup__close {
  position: absolute;
  top: 0;
  right: 0;
  @include flex-center;
  width: $tap-min-height;
  height: $tap-min-height;
  z-index: 1;
}

.base-popup__close--hover {
  opacity: 0.6;
}

.base-popup__close-icon {
  font-size: $icon-close-size;
  color: $color-text-3;
}
</style>