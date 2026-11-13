export type BaseLoadMoreStatus = 'loading' | 'nomore' | 'error'

export interface Props {
  /** 列表底部状态；无状态时由调用方 v-if 隐藏本组件 */
  status: BaseLoadMoreStatus
  loadingText?: string
  nomoreText?: string
  errorText?: string
}

export type Emits = {
  /** error 态点击整行重试（其余状态点击不触发） */
  (e: 'retry'): void
}
