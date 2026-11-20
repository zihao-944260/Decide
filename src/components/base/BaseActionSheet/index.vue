<script setup lang="ts">
import BasePopup from '../BasePopup/index.vue'
import type { ActionSheetItem, Props, Emits } from './types'

withDefaults(defineProps<Props>(), {
  title: '',
  cancelText: '取消'
})
const emit = defineEmits<Emits>()

function onVisibleChange(value: boolean): void {
  emit('update:visible', value)
  if (!value) emit('cancel')
}

function onSelect(action: ActionSheetItem, index: number): void {
  if (action.disabled) return
  emit('select', action, index)
}
</script>

<template>
  <BasePopup :visible="visible" position="bottom" :round="true" @update:visible="onVisibleChange">
    <view class="base-action-sheet">
      <view v-if="title" class="base-action-sheet__header">
        <text class="base-action-sheet__title">{{ title }}</text>
      </view>
      <!-- WebView 页 type="list" 触摸滚动失效（#73/#78 同根因）；普通 scroll-view 必须显式 scroll-y -->
      <scroll-view class="base-action-sheet__scroll" :scroll-y="true">
        <view
          v-for="(action, index) in actions"
          :key="action.key ?? index"
          class="base-action-sheet__item"
          :class="{ 'base-action-sheet__item--disabled': action.disabled }"
          hover-class="base-action-sheet__item--hover"
          @tap="onSelect(action, index)"
        >
          <view class="base-action-sheet__item-main">
            <text
              class="base-action-sheet__item-text"
              :class="{ 'base-action-sheet__item-text--danger': action.danger }"
              >{{ action.text }}</text
            >
            <text v-if="action.desc" class="base-action-sheet__item-desc">{{ action.desc }}</text>
          </view>
          <view v-if="index < actions.length - 1" class="base-action-sheet__divider" />
        </view>
      </scroll-view>
      <view class="base-action-sheet__gap" />
      <view
        class="base-action-sheet__cancel"
        hover-class="base-action-sheet__cancel--hover"
        @tap="onVisibleChange(false)"
      >
        <text class="base-action-sheet__cancel-text">{{ cancelText }}</text>
      </view>
    </view>
  </BasePopup>
</template>

<style lang="scss" scoped>
.base-action-sheet {
  @include flex-column;
}

.base-action-sheet__header {
  @include flex-center;
  padding: $space-3;
}

.base-action-sheet__title {
  font-size: $font-sm;
  color: $color-text-3;
}

.base-action-sheet__scroll {
  max-height: 50vh;
}

.base-action-sheet__item {
  @include flex-column;
  background-color: $color-bg-card;
}

.base-action-sheet__item--hover {
  background-color: $color-fill;
}

.base-action-sheet__item--disabled {
  opacity: 0.4;
}

.base-action-sheet__item-main {
  @include flex-column;
  align-items: center;
  justify-content: center;
  min-height: $tap-min-height;
  padding: $space-2 $space-3;
}

.base-action-sheet__item-text {
  font-size: $font-lg;
  color: $color-text-1;
}

.base-action-sheet__item-text--danger {
  color: $color-danger;
}

.base-action-sheet__item-desc {
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-text-3;
}

.base-action-sheet__divider {
  height: 1px;
  background-color: $color-border;
}

.base-action-sheet__gap {
  height: $space-2;
  background-color: $color-bg-page;
}

.base-action-sheet__cancel {
  @include flex-center;
  min-height: $tap-min-height;
  background-color: $color-bg-card;
}

.base-action-sheet__cancel--hover {
  background-color: $color-fill;
}

.base-action-sheet__cancel-text {
  font-size: $font-lg;
  color: $color-text-2;
}
</style>
