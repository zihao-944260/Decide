<script setup lang="ts">
/**
 * OptionCardList：纵向铺开选项卡（§8.6）。
 * 不传票数、不排序 —— 计数与顺序的权威都在云端；表决态只把锁定/截止翻译成每卡的禁用态。
 */
import { computed } from 'vue'
import OptionCard from '../OptionCard/index.vue'
import type { Emits, Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  previewable: true,
  votable: false,
  myOption: '',
  locked: false,
  closed: false
})
const emit = defineEmits<Emits>()

/** §8.6 提交校验就是「至少 2 个选项」，少于 2 个说明开关关闭 → 整块不渲染 */
const MIN_OPTIONS = 2
const visible = computed(() => props.options.length >= MIN_OPTIONS)

/** 截止是一票都不能投；锁定只封「别的项」，我投的那一项仍保持可点高亮 */
function cardDisabled(optionId: string): boolean {
  return props.closed || (props.locked && optionId !== props.myOption)
}

function onVote(optionId: string): void {
  emit('vote', optionId)
}
</script>

<template>
  <!-- 开关关闭（选项 < 2）时不渲染，也不留空白占位（§8.6） -->
  <view v-if="visible" class="option-card-list">
    <view v-for="(option, index) in props.options" :key="option.id" class="option-card-list__item">
      <OptionCard
        :option="option"
        :index="index"
        :previewable="props.previewable"
        :votable="props.votable"
        :selected="option.id === props.myOption"
        :disabled="cardDisabled(option.id)"
        @vote="onVote"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.option-card-list {
  @include flex-column;
  width: 100%;
}

// Skyline 下 margin 不折叠，纵向间距只给一侧
.option-card-list__item {
  @include flex-column;
  width: 100%;
  margin-bottom: $space-3;
}
</style>
