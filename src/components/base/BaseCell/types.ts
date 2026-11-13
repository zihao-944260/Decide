export interface Props {
  title?: string
  /** 标题下方灰色说明 */
  desc?: string
  /** 右侧值文本 */
  value?: string
  /** 右侧箭头 */
  arrow?: boolean
  /** 左侧图标（image 地址）；也可用 icon 插槽 */
  icon?: string
  /** 卡内模块标题行变体：去内衬（由外层卡提供）、标题 semibold，规格见 mixins section-head/section-title */
  section?: boolean
}

export type Emits = {
  (e: 'click'): void
}
