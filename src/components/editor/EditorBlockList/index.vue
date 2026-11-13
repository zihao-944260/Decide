<script setup lang="ts">
/**
 * EditorBlockList —— 编辑器块容器（T4.7，技术方案 §8.1 / §9.2）。
 * 职责边界与三条「刻意不做」见 ./types.ts 文件头；页面接线见 ./README.md。
 */
import { computed } from 'vue'
import EditorDividerBlock from '@/components/editor/EditorDividerBlock/index.vue'
import EditorImageBlock from '@/components/editor/EditorImageBlock/index.vue'
import EditorQuoteBlock from '@/components/editor/EditorQuoteBlock/index.vue'
import EditorTextBlock from '@/components/editor/EditorTextBlock/index.vue'
import type { Block, DividerBlock, ImageBlock, QuoteBlock, TextBlock } from '@/types/models'
import type { EditorBlockLongPressEvent, Emits, ImageUpdatePayload, Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  focusId: '',
})
const emit = defineEmits<Emits>()

/** 认识的四类块；其余（旧草稿/手工改坏的数据）整块跳过，不渲染也不报错 */
const TYPES: readonly Block['type'][] = ['text', 'image', 'quote', 'divider']

/**
 * 预映射成判别联合：模板四条分支各自窄化到确定形状，避免在模板里写类型断言
 * （ContentRenderer 用的同一手法）。
 */
type RenderItem =
  | { kind: 'text'; id: string; block: TextBlock }
  | { kind: 'quote'; id: string; block: QuoteBlock }
  | { kind: 'image'; id: string; block: ImageBlock }
  | { kind: 'divider'; id: string; block: DividerBlock }

function isRenderable(block: Block | undefined): block is Block {
  return !!block && TYPES.includes(block.type)
}

function toItem(block: Block): RenderItem {
  if (block.type === 'text') return { kind: 'text', id: block.id, block }
  if (block.type === 'quote') return { kind: 'quote', id: block.id, block }
  if (block.type === 'image') return { kind: 'image', id: block.id, block }
  return { kind: 'divider', id: block.id, block }
}

/**
 * 不 sanitize、不 sort、不 ensureTrailingTextBlock：这三件事都会改写页面持有的那份数据，
 * 而组件是受控的（props in / emits out）。只保留一层「认不认识的 type」防御，
 * 让 useEditor 的兜底责任留在 useEditor。
 */
const items = computed<RenderItem[]>(() =>
  (Array.isArray(props.blocks) ? props.blocks : []).filter(isRenderable).map(toItem)
)

/**
 * 页面 `scroll-view :scroll-into-view` 的目标 id 前缀。
 * **必须是 `blk-${block.id}`**：`useEditor.setFocus` 写进 scrollIntoViewId 的正是这个字符串
 * （src/composables/useEditor.ts:142-145）。拼错不报错，只会「聚焦不滚动」。
 */
function blockNodeId(id: string): string {
  return `blk-${id}`
}

function isFocused(id: string): boolean {
  return props.focusId === id
}

function onFocus(id: string): void {
  emit('focus', id)
}

function onBlur(id: string): void {
  emit('blur', id)
}

function onInput(id: string, text: string): void {
  emit('input', id, text)
}

/**
 * 图片块的 `update` 载荷不带 id（跨路契约，H2 拥有），容器在这里补上，
 * 页面才能直接喂 `editor.updateImage(id, next)`。
 * 这是本组件唯一一处内联事件表达式，原因写在 README「为什么只有 update 特殊」。
 */
function onImageUpdate(id: string, next: ImageUpdatePayload): void {
  emit('update', id, next)
}

function onRemove(id: string): void {
  emit('remove', id)
}

function onLongPress(id: string): void {
  // index 用原始 props.blocks 的下标：过滤掉的脏块不该把序号挪位，
  // 页面的 moveBlock/上移下移 disabled 判定都以那份数组为准
  const index = (Array.isArray(props.blocks) ? props.blocks : []).findIndex((block) => block?.id === id)
  if (index < 0) return
  const payload: EditorBlockLongPressEvent = { id, index }
  emit('long-press', payload)
}
</script>

<template>
  <view class="editor-block-list">
    <view
      v-for="item in items"
      :id="blockNodeId(item.id)"
      :key="item.id"
      class="editor-block-list__block"
    >
      <template v-if="item.kind === 'text'">
        <EditorTextBlock
          :block="item.block"
          :focused="isFocused(item.id)"
          @focus="onFocus"
          @blur="onBlur"
          @input="onInput"
          @long-press="onLongPress"
        />
      </template>

      <template v-else-if="item.kind === 'quote'">
        <EditorQuoteBlock
          :block="item.block"
          :focused="isFocused(item.id)"
          @focus="onFocus"
          @blur="onBlur"
          @input="onInput"
          @long-press="onLongPress"
        />
      </template>

      <template v-else-if="item.kind === 'image'">
        <EditorImageBlock
          :block="item.block"
          :focused="isFocused(item.id)"
          @focus="onFocus"
          @remove="onRemove"
          @long-press="onLongPress"
          @update="(next: ImageUpdatePayload) => onImageUpdate(item.id, next)"
        />
      </template>

      <template v-else>
        <EditorDividerBlock
          :block="item.block"
          :focused="isFocused(item.id)"
          @focus="onFocus"
          @long-press="onLongPress"
        />
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
// 普通 view 容器：滚动、触底、scroll-into-view 全在页面的 scroll-view 上（§11），
// 这里再套一层 scroll-view 就是 Skyline 下未验证的嵌套滚动。
.editor-block-list {
  @include flex-column;
  width: 100%;
}

// 块间距与 ContentRenderer 的 .content-renderer__block 同一个口径（$space-2 单侧给距，
// Skyline 下 margin 不折叠，兼容清单 §2.2），编辑态与展示态换行节奏一致。
.editor-block-list__block {
  @include flex-column;
  width: 100%;
  margin-bottom: $space-2;
}
</style>
