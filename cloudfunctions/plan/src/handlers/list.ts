/**
 * plan.list —— CloudContract['plan.list'] → PageResult<PlanSummary>（首页）
 *
 * 出参装配全部走 helpers.assembleSummaryPage：与 myList 共用同一份「取作者 → 拼 DTO → 生成游标」，
 * 两个接口的分页语义必须一模一样，否则前端切 tab 时同一份 usePagingList 会漂。
 * status in [1,2] 由 planDao.listPublic 固定（草稿与软删不进列表，§11.3），前端无从传状态。
 */
import { planDao, readPageArgs, type ActionSpec } from 'common'
import { assembleSummaryPage } from './helpers'

export const list: ActionSpec = {
  kind: 'read',
  run: async (payload, ctx) => {
    const args = readPageArgs(payload)
    const rows = await planDao.listPublic({
      sort: args.cursor === null ? null : args.cursor.sort,
      afterId: args.cursor === null ? '' : args.cursor.id,
      limit: args.limit,
    })
    return assembleSummaryPage(rows, args.cursor, args.size, ctx.openId)
  },
}
