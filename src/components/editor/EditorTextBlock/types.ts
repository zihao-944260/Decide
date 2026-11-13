import type { TextBlock } from '@/types/models'

/**
 * EditorTextBlock —— 单个 text 块的编辑态（WBS T4.2，技术方案 §8.1）。
 *
 * 受控组件：文本与段落样式**只从 `block` 读**，组件不持有第二份真相，
 * 也不生成/删除块 id、不 reorder、不调 useEditor/store/api（§11 四路共用约束）。
 * 唯一的写出口是 `input`，页面把它接到 `editor.setText(id, text)`。
 */
export interface Props {
  /** 当前块（TextBlock）。level/bold/align/color 经 utils/blocks.ts 的 blockStyle() 变成内联样式 */
  block: TextBlock
  /**
   * 页面 `editor.focusId === block.id` 的结果。
   * **只驱动视觉态**（聚焦底色、计数可见），不驱动原生 `focus` 属性 ——
   * 「外部置 focus 即弹键盘」不在兼容清单 §2.4 的实测属性集里，不敢拿来当滚动/聚焦的手段。
   */
  focused: boolean
  /** 字数上限，默认 Limit.BLOCK_TEXT_MAX；与云函数 planPayload.ts 的截断值同源（§11.3） */
  maxlength?: number
  /** 空块占位文案 */
  placeholder?: string
}

/**
 * 事件载荷一律带块 id：容器 EditorBlockList 因此可以**原样转发**，
 * 不需要在模板里写内联箭头去补 id（uni-mp-vue 的 triggerEvent 转发开销见 EditorBlockList/README.md）。
 */
export type Emits = {
  /** textarea 聚焦：页面调 `editor.setFocus(id)`（同时写 scrollIntoViewId） */
  (e: 'focus', id: string): void
  /**
   * textarea 失焦，带 id。页面**必须带守卫**：
   * `if (editor.focusId.value === id) editor.blur()` ——
   * 从 A 块切到 B 块时 mp 的 blur/focus 顺序不保证，无守卫会把刚设好的 focusId 又抹掉。
   */
  (e: 'blur', id: string): void
  /** 文本变更（整段回传，不截断；上限截断由页面 setText 做，保持单一口径） */
  (e: 'input', id: string, text: string): void
  /** 长按整块：只往外抛，ActionSheet 归页面（组件不弹层，§11） */
  (e: 'long-press', id: string): void
}
