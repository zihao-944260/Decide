export interface KeyboardPayload {
  /** 键盘高度（px），0 表示已收起 */
  height: number
  /** 动画时长（ms） */
  duration: number
}

export interface PublishResult {
  ok: boolean
  /** 服务端错误码透出（内容安全命中 = ErrorCode.INVALID_PARAM） */
  code?: number
  /** 失败文案；给了且 toast 不为 false 时由组件走 useToast 提示 */
  message?: string
  /**
   * 是否让组件弹 toast，默认 true。
   * 复用 useComments.post 时传 false —— 它的 ApiError 文案已由 api/request 统一 toast（§7.1），
   * 两处各弹一次会串成两条提示。
   */
  toast?: boolean
}

/** 外层注入的发表函数：组件不认识 api 层，只按返回结果决定清空 / 回滚 / 提示（§9.1 不越层） */
export type PublishFn = (content: string) => Promise<PublishResult>

export interface Props {
  /** v-model：输入内容；外层置空即清空输入框（发表成功后页面清空，或组件自己清） */
  modelValue?: string
  /** 外部在途标记（如 useComments.posting）。与组件内部 submitting 取并集，双重防重复提交 */
  posting?: boolean
  /**
   * 发表函数。传了它，组件在成功后自己清空、失败自己保留原文并透出错误码；
   * 不传则退化为纯事件模式：只 emit('submit', content)，清空由页面调 clear()。
   */
  publish?: PublishFn
  /** 字数上限，默认取 Limit.COMMENT_MAX（服务端同源，§11.3） */
  maxlength?: number
  placeholder?: string
  /** 禁用输入与发送（未登录、已截止、被禁言等由页面判定） */
  disabled?: boolean
  /** 是否显示吸底条（页面可以整体隐藏，隐藏时不占位） */
  visible?: boolean
  /**
   * 组件级键盘避让（默认开）：监听 keyboardheightchange 把 fixed 条顶起、收起自动复位。
   * 开启时组件会强制 textarea 的 adjust-position=false，避免和原生避让叠成两次位移；
   * 关掉就完全交给外层（页面自己 padding-bottom 或原生 adjust-position）。
   */
  avoidKeyboard?: boolean
  /** avoidKeyboard=false 时是否用原生 adjust-position 避让，默认 true（§11.2） */
  adjustPosition?: boolean
  /** 光标与键盘的间距（px），§11.2 指定的避让手段之一 */
  cursorSpacing?: number
  /** 额外底部偏移（px），例如详情页有 FAB 或多层吸底条时叠加 */
  bottomOffset?: number
  /** 输入框最大行数（超过内部滚动、并出现展开按钮），默认 2 */
  maxRows?: number
}

export type Emits = {
  (e: 'update:modelValue', value: string): void
  /** 点击发送且内容合法：内容为 trim 后的文本 */
  (e: 'submit', content: string): void
  /** 服务端拦截 / 发送失败：把错误码与文案透出给外层 */
  (e: 'error', payload: PublishResult): void
  /** 键盘高度变化（height=0 即已复位），页面可据此给列表加 padding-bottom */
  (e: 'keyboard-height', payload: KeyboardPayload): void
  /** 内容超过封顶行数、用户点了展开按钮：页面拉半屏编辑层（draggable-sheet） */
  (e: 'expand'): void
}

/** 页面编排用的命令式入口（T3.11） */
export interface CommentInputExpose {
  focus: () => void
  blur: () => void
  /** 清空输入并同步 v-model */
  clear: () => void
  /** 回填输入（草稿恢复用） */
  setText: (value: string) => void
}
