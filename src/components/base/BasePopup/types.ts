export type BasePopupPosition = 'top' | 'bottom' | 'center' | 'right'

export interface Props {
  /** 受控显隐，支持 v-model:visible */
  visible: boolean
  position?: BasePopupPosition
  round?: boolean
  /** 右上角关闭按钮 */
  closable?: boolean
  /** 进/退场过渡时长 ms（遮罩 opacity + 面板 transform/opacity） */
  duration?: number
  zIndex?: number
  /** 点击蒙层是否关闭 */
  maskClosable?: boolean
}

export type Emits = {
  (e: 'update:visible', value: boolean): void
  /** 进场动画结束 */
  (e: 'opened'): void
  /** 退场动画结束 */
  (e: 'closed'): void
  (e: 'click-overlay'): void
}
