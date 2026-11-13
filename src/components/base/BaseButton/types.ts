export type BaseButtonType = 'primary' | 'secondary' | 'text' | 'danger'
export type BaseButtonSize = 'sm' | 'md' | 'lg'

export interface Props {
  type?: BaseButtonType
  size?: BaseButtonSize
  loading?: boolean
  disabled?: boolean
  /** 宽度撑满父容器 */
  block?: boolean
}

export type Emits = {
  (e: 'click'): void
}
