<script setup lang="ts">
import { computed, useSlots } from 'vue'
import BaseButton from '../BaseButton/index.vue'
import type { Props, Emits } from './types'

withDefaults(defineProps<Props>(), {
  icon: '',
  text: '暂无内容',
  actionText: ''
})
const emit = defineEmits<Emits>()

const slots = useSlots()
const hasIconSlot = computed(() => !!slots.icon)
const hasDescSlot = computed(() => !!slots.default)

function onAction(): void {
  emit('action')
}
</script>

<template>
  <view class="base-empty">
    <view v-if="hasIconSlot" class="base-empty__icon">
      <slot name="icon" />
    </view>
    <image v-else-if="icon" class="base-empty__icon" :src="icon" mode="aspectFit" />
    <view v-else class="base-empty__icon">
      <view class="base-empty__sheet">
        <view class="base-empty__line base-empty__line--a" />
        <view class="base-empty__line base-empty__line--b" />
      </view>
    </view>
    <text class="base-empty__text">{{ text }}</text>
    <view v-if="hasDescSlot" class="base-empty__desc">
      <slot />
    </view>
    <view v-if="actionText" class="base-empty__action">
      <BaseButton type="primary" size="md" block @click="onAction">
        <text>{{ actionText }}</text>
      </BaseButton>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.base-empty {
  @include flex-column;
  align-items: center;
  justify-content: center;
  padding: $space-5 $space-4;
}

.base-empty__icon {
  @include flex-center;
  width: $empty-icon-size;
  height: $empty-icon-size;
}

// 缺省「空文档」图形：真实节点 + 常规流叠出（Skyline 无伪元素，慎用绝对定位叠层）
.base-empty__sheet {
  @include flex-column;
  align-items: center;
  justify-content: center;
  width: 56%;
  height: 72%;
  background-color: $color-fill-deep;
  border-radius: $radius-md;
}

.base-empty__line {
  height: $space-1;
  background-color: $color-bg-card;
  border-radius: $radius-round;
}

.base-empty__line--a {
  width: 70%;
}

.base-empty__line--b {
  width: 46%;
  margin-top: $space-2;
}

.base-empty__text {
  margin-top: $space-3;
  text-align: center;
  font-size: $font-md;
  color: $color-text-3;
  line-height: $line-normal;
  word-break: break-all;
}

.base-empty__desc {
  @include flex-column;
  align-items: center;
  margin-top: $space-2;
}

.base-empty__action {
  width: $empty-action-width;
  margin-top: $space-4;
}
</style>
