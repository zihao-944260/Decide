<script setup lang="ts">
/**
 * EditorDividerBlock —— divider 块编辑态（T4.5）。
 *
 * 分割线是**真实节点 + border**（`@include hairline-top`），不是伪元素：
 * 兼容清单 §1.5 把 `::after` 列为「模拟器可用但官方声明不支持」，工程规范按不支持执行，
 * 只读态 ContentRenderer 的 `.content-renderer__divider` 也是同一写法 —— 编辑态与展示态共用
 * 「1px + $color-border + 上下 $space-3」这一个口径。
 *
 * 线本身只有 1px 高，点不中，所以外面套一层 $tap-min-height 的容器承担点击/长按（§9.1-8）。
 */
import type { Emits, Props } from './types'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function onTap(): void {
  emit('focus', props.block.id)
}

function onLongPress(): void {
  emit('long-press', props.block.id)
}
</script>

<template>
  <view
    class="editor-divider-block"
    hover-class="editor-divider-block--hover"
    @tap="onTap"
    @longpress="onLongPress"
  >
    <view
      class="editor-divider-block__line"
      :class="{ 'editor-divider-block__line--focused': focused }"
    />
  </view>
</template>

<style lang="scss" scoped>
.editor-divider-block {
  @include flex-column;
  justify-content: center;
  width: 100%;
  min-height: $tap-min-height;
  border-radius: $radius-sm;
}

.editor-divider-block--hover {
  background-color: $color-primary-light;
}

.editor-divider-block__line {
  width: 100%;
  @include hairline-top;
}

// 选中态：线加粗并换成主题色。Skyline 禁后代选择器，所以修饰类挂在被选中的那个节点上
.editor-divider-block__line--focused {
  border-top: $border-width-thick solid $color-primary;
}
</style>
