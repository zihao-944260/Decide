<script setup lang="ts">
import { computed, useSlots } from 'vue'
import BasePopup from '../BasePopup/index.vue'
import BaseButton from '../BaseButton/index.vue'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  title: '',
  content: '',
  confirmText: '确定',
  cancelText: '取消',
  showCancel: true,
  danger: false,
  maskClosable: false,
})
const emit = defineEmits<Emits>()

const slots = useSlots()
const hasContentSlot = computed(() => !!slots.default)
const confirmType = computed(() => (props.danger ? 'danger' : 'primary'))

function onVisibleChange(value: boolean): void {
  emit('update:visible', value)
}

function onConfirm(): void {
  emit('confirm')
}

function onCancel(): void {
  emit('update:visible', false)
  emit('cancel')
}
</script>

<template>
  <BasePopup
    :visible="visible"
    position="center"
    :round="false"
    :mask-closable="maskClosable"
    @update:visible="onVisibleChange"
  >
    <view class="base-modal">
      <text v-if="title" class="base-modal__title">{{ title }}</text>
      <view v-if="hasContentSlot" class="base-modal__content">
        <slot />
      </view>
      <text v-else-if="content" class="base-modal__text">{{ content }}</text>
      <view class="base-modal__footer">
        <view v-if="showCancel" class="base-modal__btn">
          <BaseButton type="secondary" size="md" block @click="onCancel">
            <text>{{ cancelText }}</text>
          </BaseButton>
        </view>
        <view class="base-modal__btn">
          <BaseButton :type="confirmType" size="md" block @click="onConfirm">
            <text>{{ confirmText }}</text>
          </BaseButton>
        </view>
      </view>
    </view>
  </BasePopup>
</template>

<style lang="scss" scoped>
.base-modal {
  @include flex-column;
  padding: $space-4 $space-4 $space-3;
}

.base-modal__title {
  text-align: center;
  font-size: $font-lg;
  font-weight: $font-weight-semibold;
  color: $color-text-1;
}

.base-modal__content {
  margin-top: $space-3;
}

.base-modal__text {
  margin-top: $space-3;
  text-align: center;
  font-size: $font-md;
  color: $color-text-2;
  line-height: $line-loose;
  word-break: break-all;
}

.base-modal__footer {
  display: flex;
  flex-direction: row;
  margin-top: $space-4;
}

.base-modal__btn {
  flex: 1;
  margin-left: $space-2;

  // flex 下 margin 不折叠（兼容清单 §2.2），首个按钮手动去左边距
  &:first-child {
    margin-left: 0;
  }
}
</style>
