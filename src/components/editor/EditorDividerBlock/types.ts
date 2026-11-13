import type { DividerBlock } from '@/types/models'

/**
 * EditorDividerBlock —— divider 块编辑态（WBS T4.5，技术方案 §8.1）。
 * 没有文本、没有样式字段：`block` 只带 id，容器要的 `blk-${id}` 定位前缀也从那里来。
 */
export interface Props {
  block: DividerBlock
  /** 页面 `editor.focusId === block.id` 的结果。分割线可被选中（长按菜单的「上移/下移/删除」都靠它定位），但没有键盘 */
  focused: boolean
}

export type Emits = {
  /** 点击选中：分割线不是输入控件，tap 即选中，页面调 `editor.setFocus(id)` */
  (e: 'focus', id: string): void
  /** 长按：只往外抛，ActionSheet 归页面 */
  (e: 'long-press', id: string): void
}
