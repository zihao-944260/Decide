export interface Props {
  /** 占位图地址（fileID / https / 本地）；为空则渲染内置缺省图形 */
  icon?: string
  /** 主文案 */
  text?: string
  /** 操作按钮文案；为空则不渲染按钮 */
  actionText?: string
}

export type Emits = {
  /** 点击操作按钮 */
  (e: 'action'): void
}
