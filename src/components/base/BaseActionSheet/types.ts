export interface ActionSheetItem {
  /** 透传给 select 事件的业务标识 */
  key?: string
  text: string
  desc?: string
  disabled?: boolean
  danger?: boolean
}

export interface Props {
  visible: boolean
  actions: ActionSheetItem[]
  /** 顶部说明文字 */
  title?: string
  cancelText?: string
}

export type Emits = {
  (e: 'update:visible', value: boolean): void
  (e: 'select', action: ActionSheetItem, index: number): void
  (e: 'cancel'): void
}
