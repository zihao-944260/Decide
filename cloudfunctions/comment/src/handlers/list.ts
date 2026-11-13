/**
 * comment.list —— CloudContract['comment.list']
 * `{ planId, cursor?, pageSize? }` → `PageResult<CommentItem>`
 *
 * 游标 = `seq` 升序（§6.5），对前端是不透明 string（common/cursor.ts 的 v1:sort:id）。
 * pageSize 默认 20 = `Limit.COMMENT_PAGE_SIZE`，比计划列表的 10 大一档：
 * 评论是详情页里的连续流，一页 10 条会明显增加触底翻页次数。
 *
 * **已删除评论仍然返回**（status=1、content 由 toCommentItem 置空），
 * 前端按 §5.4/§8.4 渲染「该评论已删除」灰色占位。这里刻意不遵守 §11.3
 * 「列表查询统一带 status=0」那一条：过滤掉已删除记录会让时间线中间凭空缺一格，
 * 看起来像内容被篡改，页大小也会随删除动作抖动；保留占位才符合 §5.4 的字段语义。
 * 计数不受影响 —— plans.commentCount 只统计 status=0（见 commentDao.countNormal / scheduler 对账）。
 *
 * 唯一的越权风险是「软删计划」的评论仍能被直接调接口读到，所以先校验计划存在与 status=3；
 * 已截止（status=2）的计划仍然可读评论 —— 查看历史讨论是截止后保留的能力。
 */
import {
  BizError,
  ErrorCode,
  Limit,
  PlanStatus,
  ServerLimit,
  asString,
  buildPage,
  commentDao,
  fallbackAuthor,
  planDao,
  readPageArgs,
  toCommentItem,
  toUserInfo,
  userDao,
  type ActionSpec,
  type CommentItem,
} from 'common'

const PLAN_ID_MAX = 128

export const list: ActionSpec = {
  kind: 'read',
  run: async (payload) => {
    const planId = asString(payload.planId, '计划 ID', PLAN_ID_MAX)
    const plan = await planDao.getById(planId)
    if (!plan || plan.status === PlanStatus.Removed) throw new BizError(ErrorCode.NOT_FOUND, '计划不存在或已删除')

    const args = readPageArgs(payload, ServerLimit.COMMENT_PAGE_SIZE_MAX, Limit.COMMENT_PAGE_SIZE)
    // cursor 缺省时传 null 走首页；_id 次键用于 seq 重复（counters 竞态兜底）时不重不漏
    const rows = await commentDao.listByPlan(planId, args.cursor?.sort ?? null, args.cursor?.id ?? '', args.limit)

    const openIds: string[] = []
    for (const row of rows) {
      if (row.openId && !openIds.includes(row.openId)) openIds.push(row.openId)
    }
    const authors = await userDao.mapByOpenIds(openIds)

    const page = buildPage(rows, args, (row) => ({ sort: row.seq, id: row._id ?? '' }))
    const items: CommentItem[] = page.list.map((row) => {
      const doc = authors[row.openId]
      return toCommentItem(row, doc ? toUserInfo(doc) : fallbackAuthor(row.openId))
    })
    return { list: items, nextCursor: page.nextCursor, hasMore: page.hasMore }
  },
}
