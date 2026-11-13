import type { ParagraphStyle } from '@/utils/blocks'
import type { TextBlock } from '@/types/models'

export interface Props {
  /**
   * 当前聚焦块的段落样式，直接喂 `useEditor().activeStyle`。
   * null = 没有聚焦块或聚焦的是图片/引用/分割线块 → 样式项没有高亮对象（配合 stylable 置灰）。
   */
  activeStyle: ParagraphStyle | null
  /** `useEditor().stylable`：false 时样式项**置灰不可点**（不隐藏 —— 隐藏会让工具栏宽度跳动） */
  stylable: boolean
  /** 整条禁用（发布在途、页面忙），样式项与插入项一起置灰 */
  disabled?: boolean
  /** 当前有聚焦块（页面喂 `!!focusId`）：工具栏不认识焦点，删除项能否点由页面下结论 */
  canRemove?: boolean
}

/**
 * 工具栏是纯受控组件：点击只抛事件，不改任何数据。
 * 页面侧一一对应到 useEditor 的方法（README 有可抄接线）。
 */
export type Emits = {
  (e: 'set-level', level: TextBlock['level']): void
  (e: 'toggle-bold'): void
  /** 值取自 constants/plan 的 TEXT_COLORS[].value；'' = 复位为默认正文色（不是第六种颜色） */
  (e: 'set-color', color: string): void
  (e: 'set-align', align: TextBlock['align']): void
  (e: 'insert-quote'): void
  (e: 'insert-divider'): void
  /** 只抛事件：上传发生在图片块里，不在工具栏里（页面 editor.insertImage('', 0, 0) 落一个空块） */
  (e: 'insert-image'): void
  /** 删除当前聚焦块；焦点转移到邻居块由 useEditor.removeBlock 自带，页面无需再补 blur */
  (e: 'remove'): void
}
