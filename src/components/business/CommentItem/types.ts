import type { CommentItem as CommentDTO } from '@/types/models'

export interface Props {
  /** 单条评论 DTO；status !== Normal 时渲染灰色占位（§8.4） */
  comment: CommentDTO
  /** 是否本人评论；外层直接用 useComments 的 canRemove(comment) 结果传入 */
  isSelf?: boolean
  /**
   * 删除入口的显式开关，优先级高于 isSelf。
   * §8.4 还允许「计划作者删别人的评论」，而 useComments.canRemove 只判定本人，
   * 那条规则由页面注入（组件不越权读 planStore）。
   */
  deletable?: boolean
  /** 相对时间基准（ms）。由外层 useServerNow() 一处算好传进来，组件内不开定时器（§11.1） */
  now?: number
  /** 是否显示底部分隔线（列表最后一项由外层关掉） */
  separated?: boolean
  /** 列表首项：顶 padding 归零（标题行 padding-bottom 已提供间距，避免双倍） */
  first?: boolean
}

export type Emits = {
  /** 点击删除按钮：只抛 id + 原始 DTO，真正调 api 由外层负责 */
  (e: 'delete', commentId: string, comment: CommentDTO): void
  /** 长按整条（§8.4 的 ActionSheet 入口），同样不改数据，由外层决定弹什么 */
  (e: 'long-press', comment: CommentDTO): void
}
