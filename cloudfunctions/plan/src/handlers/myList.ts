/**
 * plan.myList —— CloudContract['plan.myList']（我的页四个 tab）
 * `{ filter: created|joined|ongoing|ended, cursor?, pageSize }` → PageResult<PlanSummary>
 *
 * 四条分支的口径（§8.7）：
 * - created / ongoing / ended：都以「我是作者」为前提，只差状态集合，走 planDao.listByAuthor；
 * - joined：以「我投过票 **或** 评过论」为前提，唯一权威数据源是 participations 冗余集合，
 *   排序键是最后一次参与时间（lastActionAt），所以翻页与游标都来自 participations 行（helpers 里装配）。
 *
 * 游标对前端不透明，但**每个 tab 各用自己的那一串**（planStore 按 filter 分桶缓存）：
 * created/ongoing/ended 的锚点是计划的 createdAt，joined 的锚点是 participations.lastActionAt，
 * 编码格式相同（v1:sort:_id）而语义不同，跨 tab 复用游标只会得到另一页，不会串数据。
 */
import { MY_FILTERS, inEnum, participationDao, planDao, readPageArgs, type ActionSpec } from 'common'
import { assembleJoinedPage, assembleSummaryPage, statusesForFilter } from './helpers'

export const myList: ActionSpec = {
  kind: 'read',
  run: async (payload, ctx) => {
    const filter = inEnum(payload.filter, '筛选口径', MY_FILTERS)
    const args = readPageArgs(payload)
    const sort = args.cursor === null ? null : args.cursor.sort
    const afterId = args.cursor === null ? '' : args.cursor.id

    if (filter === 'joined') {
      // 「我参与的」= 投过票或评过论，走 §8.7 的 participations 冗余集合（vote 与 comment 两边都往里写）。
      // sort/afterId 与 participationDao.listByUser 的 orderBy('lastActionAt','desc').orderBy('_id','desc')
      // 是同一个字段，所以游标锚点与排序口径天然对齐；建表前 dao 返回空页而不是 5000。
      const rows = await participationDao.listByUser(ctx.openId, sort, afterId, args.limit)
      return assembleJoinedPage(rows, args.cursor, args.size, ctx.openId)
    }

    // ongoing / ended 与 user.stats 同口径：deadline 现算（planDao.countByAuthor 同款），
    // 不依赖 scheduler 把 status 1→2 翻完 —— 定时触发未配置或窗口期内的过期计划也能筛进「已截止」（#46）。
    // created 仍走 LISTABLE_PLAN_STATUS，展示态由 mapper.effectiveStatus 折算。
    const now = Date.now()
    const deadline =
      filter === 'ongoing'
        ? { mode: 'active' as const, now }
        : filter === 'ended'
          ? { mode: 'expired' as const, now }
          : undefined
    const rows = await planDao.listByAuthor(
      ctx.openId,
      statusesForFilter(filter),
      {
        sort,
        afterId,
        limit: args.limit,
      },
      deadline,
    )
    return assembleSummaryPage(rows, args.cursor, args.size, ctx.openId)
  },
}
