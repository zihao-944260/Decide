export type BaseToastType = 'text' | 'success' | 'error' | 'loading'

export interface Props {
  /** 受控显隐，支持 v-model:visible（小程序不能动态挂载节点，故只做受控展示） */
  visible: boolean
  type?: BaseToastType
  /** 文案；给了默认插槽时以插槽为准 */
  message?: string
  /** 自动收起延时 ms；<=0 表示不自动收起（loading 类由业务侧关闭） */
  duration?: number
}

export type Emits = {
  (e: 'update:visible', value: boolean): void
  /** 到时自动收起时触发（业务侧主动置 false 不触发） */
  (e: 'closed'): void
}
