<script setup lang="ts">
/**
 * EditorQuoteBlock —— quote 块编辑态（T4.5）。
 *
 * 外观刻意与 ContentRenderer 的只读引用块**逐条对齐**（同一批 token、同一个 border-left 口径），
 * 否则编辑时是引用、发布后变成另一回事：
 *   padding $space-2 $space-3 / background $color-fill / border-left $border-width-thick solid $color-primary
 *   / radius $radius-sm / 正文字号取 blockStyle(quote)（= level 3 那档）/ 正文色 $color-text-2。
 * 左侧色条用 border-left 而不是再摆一个 `__bar` 节点：多一个节点就多一套宽度口径，且伪元素被规范禁掉。
 */
import { computed } from 'vue'
import { Limit, TextInput } from '@/constants/plan'
import { blockStyle } from '@/utils/blocks'
import { readInputValue } from '@/utils/event'
import type { BlockStyle } from '@/utils/blocks'
import type { Emits, Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  maxlength: Limit.BLOCK_TEXT_MAX,
  placeholder: '引用内容…'
})
const emit = defineEmits<Emits>()

/** 与 text 块同一个样式函数：quote 走 blockStyle 的 quote 分支（字号/行高/左对齐） */
const style = computed<BlockStyle>(() => blockStyle(props.block))
const length = computed(() => props.block.text.length)
const showCounter = computed(() => props.focused || length.value > 0)
const isFull = computed(() => length.value >= props.maxlength)
const isWarn = computed(
  () => !isFull.value && props.maxlength - length.value <= TextInput.WARN_REMAINING
)

function onInput(event: unknown): void {
  emit('input', props.block.id, readInputValue(event))
}

function onFocus(): void {
  emit('focus', props.block.id)
}

function onBlur(): void {
  emit('blur', props.block.id)
}

function onLongPress(): void {
  emit('long-press', props.block.id)
}
</script>

<template>
  <view class="editor-quote-block" @longpress="onLongPress">
    <textarea
      class="editor-quote-block__input"
      :class="{ 'editor-quote-block__input--focused': focused }"
      :style="style"
      :value="block.text"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :auto-height="true"
      :adjust-position="true"
      :cursor-spacing="TextInput.CURSOR_SPACING"
      :hold-keyboard="true"
      :disable-default-padding="true"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <view v-if="showCounter" class="editor-quote-block__counter">
      <text
        class="editor-quote-block__counter-text"
        :class="{
          'editor-quote-block__counter-text--warn': isWarn,
          'editor-quote-block__counter-text--full': isFull
        }"
      >
        {{ length }}/{{ maxlength }}
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.editor-quote-block {
  @include flex-column;
  width: 100%;
  padding: $space-2 $space-3;
  background-color: $color-fill;
  border-left: $border-width-thick solid $color-primary;
  border-radius: $radius-sm;
}

.editor-quote-block__input {
  width: 100%;
  min-height: $tap-min-height;
  font-family: inherit;
  // 默认色与 ContentRenderer 的引用正文一致；blockStyle 不给 quote 输出 color，所以这里不会被内联样式覆盖
  color: $color-text-2;
  background-color: transparent;
  border: 0;
  transition: background-color $duration-fast linear;
}

.editor-quote-block__input--focused {
  background-color: $color-primary-light;
}

.editor-quote-block__counter {
  @include flex-column;
  align-items: flex-end;
  width: 100%;
}

.editor-quote-block__counter-text {
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}

.editor-quote-block__counter-text--warn {
  color: $color-text-2;
}

.editor-quote-block__counter-text--full {
  color: $color-danger;
}
</style>
