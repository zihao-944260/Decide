import type { QuoteBlock } from '@/types/models'

/**
 * EditorQuoteBlock —— quote 块编辑态（WBS T4.5，技术方案 §8.1）。
 * 与 EditorTextBlock 同一条受控纪律：数据只从 `block` 读，写只走 `input`。
 */
export interface Props {
  /** 当前块（QuoteBlock）。只有 text，没有 level/bold/color/align —— 工具栏对非 text 块置灰（utils/blocks.ts 的 isStylable） */
  block: QuoteBlock
  /** 页面 `editor.focusId === block.id` 的结果，只驱动视觉态 */
  focused: boolean
  /** 字数上限，默认 Limit.BLOCK_TEXT_MAX（quote 与 text 共用同一个上限，云端同源） */
  maxlength?: number
  /** 空块占位文案 */
  placeholder?: string
}

/** 载荷一律带 id，容器可原样转发 */
export type Emits = {
  (e: 'focus', id: string): void
  /** 页面必须带守卫：`if (focusId === id) editor.blur()` */
  (e: 'blur', id: string): void
  (e: 'input', id: string, text: string): void
  (e: 'long-press', id: string): void
}
