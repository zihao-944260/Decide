import type { ImageBlock } from '@/types/models'

/**
 * 跨路契约（§11）：本文件的 `Props` / `Emits` 是 H1 的 `EditorBlockList` 直接消费的形状，
 * 两侧 prompt 里给的是同一段字面量。**改这里 = 改接口**，任何偏差都会让编辑器的图片块直接崩。
 */
export interface Props {
  /** 空 fileID = 还没选图的占位态，渲染「点击选择图片」卡片 */
  block: ImageBlock
  focused: boolean
}
export type Emits = {
  (e: 'focus', id: string): void
  (e: 'update', next: { fileID: string; w: number; h: number }): void
  (e: 'remove', id: string): void
  (e: 'long-press', id: string): void
}
