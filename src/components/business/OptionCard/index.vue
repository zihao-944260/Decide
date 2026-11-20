<script setup lang="ts">
/**
 * OptionCard：序号徽标 + 名称 + 16:9 配图（§8.6）。
 * 展示态纯看；表决态（#60）整卡可点，点中即投这一项，票数展示归 VoteRatioBar。
 */
import { computed } from 'vue'
import BaseImage from '../../base/BaseImage/index.vue'
import { pad2 } from '@/utils/format'
import type { Emits, Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  previewable: true,
  votable: false,
  selected: false,
  disabled: false
})
const emit = defineEmits<Emits>()

/** §8.6：选项配图统一 16:9。ratio 语义与 BaseImage / blocks.ts 一致，都是 宽/高 */
const IMAGE_RATIO = 16 / 9

const interactive = computed(() => props.votable && !props.disabled)
/** 表决态下配图不再抢点击：预览会把这一票吞掉，所以整卡（含图）都只投这一项 */
const preview = computed(() => props.previewable && !props.votable)

// 选中优先于禁用：锁定后「我投的那一项」必须仍是高亮，而不是跟其余项一起置灰
const rootClass = computed(() => {
  const names = ['option-card']
  if (props.selected) names.push('option-card--selected')
  else if (props.disabled) names.push('option-card--disabled')
  return names
})

const badgeClass = computed(() =>
  props.selected ? 'option-card__badge option-card__badge--selected' : 'option-card__badge'
)
const badgeTextClass = computed(() =>
  props.selected
    ? 'option-card__badge-text option-card__badge-text--selected'
    : 'option-card__badge-text'
)
const nameClass = computed(() =>
  props.selected ? 'option-card__name option-card__name--selected' : 'option-card__name'
)

function onTap(): void {
  if (!interactive.value) return
  emit('vote', props.option.id)
}
</script>

<template>
  <view :class="rootClass" :hover-class="interactive ? 'option-card--hover' : 'none'" @tap="onTap">
    <view class="option-card__head">
      <view :class="badgeClass">
        <text :class="badgeTextClass">{{ pad2(index + 1) }}</text>
      </view>
      <!-- 名称上限 Limit.OPTION_NAME_MAX(20) 由编辑器与服务端保证，这里只做单行 ellipsis -->
      <text :class="nameClass">{{ option.name }}</text>
      <text v-if="selected" class="option-card__flag">已选</text>
    </view>
    <!-- 无图即纯文字卡（§8.6），不留空图位 -->
    <view v-if="option.image" class="option-card__media">
      <BaseImage
        :src="option.image"
        mode="aspectFill"
        :ratio="IMAGE_RATIO"
        radius="md"
        :preview="preview"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.option-card {
  @include flex-column;
  padding: $space-3;
  background-color: $color-bg-card;
  border-radius: $radius-lg;
  border: $border-width-thin solid $color-border;
  transition: opacity $duration-fast;
}

.option-card--selected {
  background-color: $color-primary-light;
  border-color: $color-primary;
}

.option-card--disabled {
  opacity: 0.5;
}

.option-card--hover {
  opacity: 0.85;
}

.option-card__head {
  @include flex-center;
  justify-content: flex-start;
  min-height: $tap-min-height;
}

.option-card__badge {
  @include flex-center;
  flex-shrink: 0;
  min-width: $space-5;
  height: $space-5;
  margin-right: $space-2;
  padding: 0 $space-1;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.option-card__badge--selected {
  background-color: $color-primary;
}

.option-card__badge-text {
  font-size: $font-xs;
  color: $color-text-3;
}

.option-card__badge-text--selected {
  color: $color-text-inverse;
}

.option-card__name {
  @include ellipsis-1;
  flex: 1;
  font-size: $font-md;
  line-height: $line-tight;
  color: $color-text-1;
}

.option-card__name--selected {
  color: $color-primary;
  font-weight: $font-weight-semibold;
}

.option-card__flag {
  flex-shrink: 0;
  margin-left: $space-2;
  font-size: $font-xs;
  color: $color-primary;
}

.option-card__media {
  @include flex-column;
  width: 100%;
  margin-top: $space-2;
}
</style>
