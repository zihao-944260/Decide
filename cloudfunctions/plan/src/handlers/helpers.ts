/**
 * plan 域共享的内部辅助（不是 action）。
 *
 * 为什么单独一个文件：`plan.list` 与 `plan.myList` 出参结构完全相同（都是 PageResult<PlanSummary>），
 * 「取作者 → 拼 DTO → 生成游标」这段逻辑必须只有一份，否则两个接口的分页语义会漂。
 */
import {
  LISTABLE_PLAN_STATUS,
  PlanStatus,
  buildPage,
  fallbackAuthor,
  planDao,
  toPlanSummary,
  toUserInfo,
  userDao,
  voteDao,
  type Cursor,
  type PageResult,
  type ParticipationCursorRow,
  type PlanRow,
  type PlanSummary,
  type UserDoc,
  type UserInfo
} from 'common'

/** 契约上的四种「我的」筛选，取值与 src/constants/plan.ts 的 MyFilter 一致 */
export type MyFilterValue = 'created' | 'joined' | 'ongoing' | 'ended'

export function statusesForFilter(filter: MyFilterValue): readonly number[] {
  if (filter === 'ongoing') return [PlanStatus.Ongoing]
  if (filter === 'ended') return [PlanStatus.Ended]
  // created 走「在线计划」口径：软删（3）与草稿（0）不进任何列表（§11.3）
  return LISTABLE_PLAN_STATUS
}

async function authorMap(rows: readonly PlanRow[]): Promise<Record<string, UserDoc>> {
  const ids: string[] = []
  for (const row of rows) {
    if (row.openId && !ids.includes(row.openId)) ids.push(row.openId)
  }
  if (ids.length === 0) return {}
  return userDao.mapByOpenIds(ids)
}

export function authorOf(map: Record<string, UserDoc>, openId: string): UserInfo {
  const doc = map[openId]
  // 作者档案缺失（历史脏数据）时给占位身份，不能让整页列表 500
  return doc ? toUserInfo(doc) : fallbackAuthor(openId)
}

/**
 * 计划列表出参：先裁掉多取的那一条再生成游标，最后一次性补作者 + 批量补「我投的选项」。
 * 顺序 = createdAt desc, _id desc（与 planDao 的排序、游标锚点完全一致）。
 * myOption 来源：voteDao.mapByPlanIds 用确定性 _id 一次 in 查询整页（命中主键索引，无 N+1），
 * 与作者装配并行发出；未投的计划取 '' 兜底（#60/#61）。
 */
export async function assembleSummaryPage(
  rows: readonly PlanRow[],
  cursor: Cursor | null,
  size: number,
  viewerOpenId: string
): Promise<PageResult<PlanSummary>> {
  const now = Date.now()
  const page = buildPage(rows, { cursor, size, limit: size + 1 }, (row) => ({
    sort: row.createdAt,
    id: row._id
  }))
  const [map, votes] = await Promise.all([
    authorMap(page.list),
    voteDao.mapByPlanIds(
      viewerOpenId,
      page.list.map((row) => row._id)
    )
  ])
  return {
    list: page.list.map((row) =>
      toPlanSummary(row, authorOf(map, row.openId), now, votes[row._id]?.optionId ?? '')
    ),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore
  }
}

/**
 * 「我参与的」专用：先按 participations 的行翻页，再批量回补计划，最后按参与顺序重排。
 *
 * 为什么分页壳必须由 participations 的行算、而不是回补后的计划行：
 * 这个 tab 的顺序口径是「我最后一次参与（投过票或评过论）的时间」，与计划自己的 createdAt 无关；
 * 游标一旦改用计划时间，orderBy 用的是计划时间、游标却是参与时间，翻页必然重复或漏项。
 * 出参结构仍与 assembleSummaryPage 完全一致（同一份 buildPage + 同一份作者装配 + 同一个游标编码）。
 */
export async function assembleJoinedPage(
  rows: readonly ParticipationCursorRow[],
  cursor: Cursor | null,
  size: number,
  viewerOpenId: string
): Promise<PageResult<PlanSummary>> {
  const page = buildPage(rows, { cursor, size, limit: size + 1 }, (row) => ({
    sort: row.lastActionAt,
    id: row._id
  }))
  const planIds: string[] = []
  for (const row of page.list) {
    // 防脏数据：participations 的 _id=openId#planId 本应保证同一计划只出现一次，真重复了也没必要回补两遍
    if (row.planId && !planIds.includes(row.planId)) planIds.push(row.planId)
  }
  const fetched = await planDao.getRowsByIds(planIds)
  const byId: Record<string, PlanRow> = {}
  for (const row of fetched) byId[row._id] = row
  // 参与之后被软删/状态变化的计划不在在线列表里，直接跳过：宁可少一条也不显示死链。
  // 代价是这一页可能不满 pageSize 条，但 hasMore / nextCursor 仍按 participations 走，前端不会卡在翻页上。
  const listable = statusesForFilter('created')
  const ordered: PlanRow[] = []
  for (const id of planIds) {
    const row = byId[id]
    if (row && listable.includes(row.status)) ordered.push(row)
  }
  const now = Date.now()
  const [map, votes] = await Promise.all([
    authorMap(ordered),
    voteDao.mapByPlanIds(
      viewerOpenId,
      ordered.map((row) => row._id)
    )
  ])
  return {
    list: ordered.map((row) =>
      toPlanSummary(row, authorOf(map, row.openId), now, votes[row._id]?.optionId ?? '')
    ),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore
  }
}
