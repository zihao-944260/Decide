export interface Props {
  visible: boolean
  title?: string
  /** 正文；默认插槽可整体替换 */
  content?: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  /** 确认按钮危险色（删除类操作） */
  danger?: boolean
  maskClosable?: boolean
}

export type Emits = {
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}
