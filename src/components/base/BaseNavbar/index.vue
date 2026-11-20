<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  title: '',
  backable: true,
  transparent: false,
  fixed: false,
  guardBack: false
})
const emit = defineEmits<Emits>()

// base 组件禁止 import store 的唯一例外（技术方案 §9.1-4）：导航栏必须读状态栏/胶囊数据
const appStore = useAppStore()

const statusStyle = computed(() => `height: ${appStore.statusBarHeight}px;`)
const bodyStyle = computed(() => {
  const rect = appStore.menuButtonRect
  const bodyHeight = appStore.navBarHeight - appStore.statusBarHeight
  let style = `height: ${bodyHeight}px;`
  // 右侧插槽内容不得压到胶囊按钮下面
  // store 里 menuButtonRect 是冻结形状，只有 right/width，左边缘自行推出
  if (rect) style += `padding-right: ${appStore.windowWidth - (rect.right - rect.width)}px;`
  return style
})

function onBack(): void {
  emit('back')
  if (props.guardBack) return
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack({ delta: 1 })
  }
}
</script>

<template>
  <view
    class="base-navbar"
    :class="{ 'base-navbar--transparent': transparent, 'base-navbar--fixed': fixed }"
  >
    <view class="base-navbar__status" :style="statusStyle" />
    <view class="base-navbar__body" :style="bodyStyle">
      <view
        v-if="backable"
        class="base-navbar__back"
        hover-class="base-navbar__back--hover"
        @tap="onBack"
      >
        <view class="base-navbar__back-icon" />
      </view>
      <view v-else class="base-navbar__side" />
      <text class="base-navbar__title">{{ title }}</text>
      <view class="base-navbar__right">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.base-navbar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background-color: $color-bg-card;
}

.base-navbar--transparent {
  background-color: transparent;
}

// 文档级滚动页（WebView）吸顶：不随文档滚走；页面自留等高占位（#79）
.base-navbar--fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: $z-navbar;
}

.base-navbar__status {
  width: 100%;
}

.base-navbar__body {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: $space-1;
  padding-right: $space-2;
}

.base-navbar__back {
  @include flex-center;
  width: $navbar-back-size;
  height: $navbar-back-size;
}

.base-navbar__back--hover {
  opacity: 0.6;
}

.base-navbar__back-icon {
  width: $icon-arrow-size;
  height: $icon-arrow-size;
  margin-left: $space-1;
  border-left: $border-width-thick solid $color-text-1;
  border-bottom: $border-width-thick solid $color-text-1;
  transform: rotate(45deg);
}

.base-navbar__side {
  width: $navbar-back-size;
}

// 标题绝对居中：左右插槽宽度不对称（返回键/胶囊/消息），flex:1 居中会偏左（用户裁定 2026-11-13）
.base-navbar__title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: 50%;
  text-align: center;
  font-size: $font-lg;
  font-weight: $font-weight-semibold;
  color: $color-text-1;
  @include ellipsis-1;
}

.base-navbar__right {
  margin-left: auto;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  min-width: $navbar-back-size;
}
</style>
