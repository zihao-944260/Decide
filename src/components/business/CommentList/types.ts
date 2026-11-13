import type { CommentsController } from '@/composables'
import type { CommentItem as CommentDTO } from '@/types/models'

/**
 * 详情页走 page 文档级滚动（WebView 渲染，#79 弃用内层 scroll-view），评论区在文档流内（§8.4），
 * 所以 CommentList 自己不嵌 scroll-view，触底由页面 `onReachBottom` 调 `commentListRef.loadMore()`。
 * 阈值统一用这个常量：pages.json 详情页 `onReachBottomDistance` 与它同口径（120px），
 * 改这里要同步改 pages.json；页面里不要写魔法数，也不要挂定时器。
 */
export const COMMENT_LOWER_THRESHOLD = 120

/** CommentList 交给页面编排的命令式入口（T3.11 详情页用 ref 拿） */
export interface CommentListExpose {
  /** 整表重拉（进页面 / 切 planId） */
  reload: () => Promise<void>
  /** 强制重拉，绕过 seed 缓存 */
  refresh: () => Promise<void>
  /** 触底加载下一页；hasMore=false 或首屏未就绪时内部自行 no-op */
  loadMore: () => Promise<void>
  /** 乐观追加（发表成功后本地插到末尾，同一 commentId 覆盖不重复） */
  append: (comment: CommentDTO) => void
  /** 乐观移除（只改本地列表，云端调用由页面走 useComments.remove） */
  remove: (commentId: string) => void
  /** 局部改一条（如服务端回吐最新 status） */
  patch: (commentId: string, patch: Partial<CommentDTO>) => void
}

export interface Props {
  /** useComments(planId) 的返回值整体注入：列表/分页/发表/删除状态都在这一个对象上 */
  comments: CommentsController
  /** 相对时间基准（ms）。整页一个 useServerNow() 传下来，禁止每条评论各挂定时器（§11.1） */
  now?: number
  /**
   * 删除权限覆盖。默认走 comments.canRemove（只判「本人可删」）；
   * §8.4 还要求「计划作者可删别人的评论」，那条判定由页面注入（组件不读 planStore）。
   */
  canRemove?: (comment: CommentDTO) => boolean
  /** 挂载即自动拉首屏，默认 true；页面自己在 onLoad 里编排时关掉 */
  autoload?: boolean
  emptyText?: string
  /** 首屏骨架行数 */
  skeletonRows?: number
  /** 每条评论之间是否画分隔线 */
  separated?: boolean
}

export type Emits = {
  /** 删除入口点击，透传 CommentItem 的 (commentId, comment)，api 调用交外层 */
  (e: 'delete', commentId: string, comment: CommentDTO): void
  /** 长按整条，外层弹 ActionSheet（§8.4） */
  (e: 'long-press', comment: CommentDTO): void
  /** 首屏或分页失败，外层可做埋点/重试 */
  (e: 'error', message: string): void
}
