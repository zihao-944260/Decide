<script setup lang="ts">
/**
 * EditorTextBlock —— text 块编辑态（T4.2，技术方案 §8.1）。
 *
 * 渲染/编辑同源（§10）：字号·行高·字重·对齐·颜色**只来自** utils/blocks.ts 的 `blockStyle()`，
 * 与详情页 ContentRenderer 同一个函数。这里再算一份 level→fontSize 就是「编辑时长得跟发布后
 * 不一样」这类回归的开始，所以组件里没有任何 level 分支样式。
 *
 * 段落级样式（兼容清单 §2.4）：Skyline 下 textarea 取不到选区（bindselectionchange canIUse=false、
 * selection-start/end 无高亮），所以不存在「选中部分文字加粗」的实现路径 —— 一个块整段一种样式，
 * 一个块也就是一个 textarea。
 *
 * Skyline 取舍：
 * - textarea 只挂实测过的属性集 `auto-height / adjust-position / cursor-spacing / hold-keyboard /
 *   disable-default-padding / maxlength`；
 * - 不用 `-webkit-line-clamp`（§2.2 实测不生效），长文靠 auto-height 撑开；
 * - 不用后代选择器 / 伪元素（§1.5 规范按不支持执行），聚焦态是 modifier 类直接挂在节点上；
 * - 组件内不出现 scroll-view / SelectorQuery / boundingClientRect（§2.3 视口外节点被虚拟化，测它会挂起）。
 */
import { computed } from 'vue'
import { Limit, TextInput } from '@/constants/plan'
import { blockStyle } from '@/utils/blocks'
import { readInputValue } from '@/utils/event'
import type { BlockStyle } from '@/utils/blocks'
import type { Emits, Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  maxlength: Limit.BLOCK_TEXT_MAX,
  placeholder: '写点什么…'
})
const emit = defineEmits<Emits>()

/** 段落样式对象：直接交给内联 style，默认色由 tokens 兜（blockStyle 只在用户显式设色时输出 color） */
const style = computed<BlockStyle>(() => blockStyle(props.block))
const length = computed(() => props.block.text.length)
/** 计数口径 = **原始字符数**：与 textarea 原生 maxlength、云函数 asString 截断同源；
 * 页面顶部总字数用的 blocksCharCount 去空白，两者语义不同，不要互换 */
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
  <view class="editor-text-block" @longpress="onLongPress">
    <textarea
      class="editor-text-block__input"
      :class="{ 'editor-text-block__input--focused': focused }"
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
    <view v-if="showCounter" class="editor-text-block__counter">
      <text
        class="editor-text-block__counter-text"
        :class="{
          'editor-text-block__counter-text--warn': isWarn,
          'editor-text-block__counter-text--full': isFull
        }"
      >
        {{ length }}/{{ maxlength }}
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.editor-text-block {
  @include flex-column;
  width: 100%;
}

.editor-text-block__input {
  width: 100%;
  // 可点区域最小 $tap-min-height（§9.1-8）：单行 auto-height 只有 1~2 个行高，
  // 空块尤其难点中，这里给一个下限，不影响 auto-height 向上撑开
  min-height: $tap-min-height;
  font-family: inherit;
  color: $color-text-1;
  background-color: transparent; // 关键字而非色板值：编辑态必须透出页面底色才能和只读态对齐
  border: 0;
  border-radius: $radius-sm;
  transition: background-color $duration-fast linear;
}

// 聚焦态修饰类直接挂节点：Skyline 规范禁后代选择器（兼容清单 §1.5），
// 写 `.editor-text-block--focused .editor-text-block__input` 是看不见的样式
.editor-text-block__input--focused {
  background-color: $color-primary-light;
}

.editor-text-block__counter {
  @include flex-column;
  align-items: flex-end;
  width: 100%;
}

.editor-text-block__counter-text {
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}

// 超出前的提示态：色板里没有 warning 色，只能取「比默认更深一档」的中性色，不新造色值
.editor-text-block__counter-text--warn {
  color: $color-text-2;
}

.editor-text-block__counter-text--full {
  color: $color-danger;
}
</style>
