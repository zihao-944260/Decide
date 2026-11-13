export interface Props {
  /** 标题，超长单行省略 */
  title?: string
  /** 是否显示返回按钮 */
  backable?: boolean
  /** 透明背景（沉浸式头图页用），文字仍为深色 */
  transparent?: boolean
  /** 吸顶（position:fixed）：文档级滚动的 WebView 页用，页面需自留等高占位 */
  fixed?: boolean
  /**
   * 返回拦截：true 时组件**只 emit('back')、不再 navigateBack**，
   * 由页面自己决定要不要走（编辑页的离开确认靠它 —— mp-weixin 不触发 onBackPress，
   * 拦截只能挂在这个按钮上；iOS 侧滑返回无法在此覆盖，见组件 README）。
   */
  guardBack?: boolean
}

export type Emits = {
  /**
   * 点击返回。`guardBack` 为 false（默认）时组件随后自动 navigateBack，事件只供埋点/附加逻辑；
   * 为 true 时组件**不再返回**，是否离开完全由页面的 `@back` 处理器决定。
   */
  (e: 'back'): void
}
