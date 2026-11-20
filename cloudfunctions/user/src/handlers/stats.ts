/**
 * user.stats —— CloudContract['user.stats']
 * `{}` → `{ created, joined, ongoing }`（§8.7 的三张数据卡）
 *
 * 口径：
 * - created  = 我发起且未删除（status in [1,2]）
 * - joined   = 我参与过的计划数（§8.7 的 participations：投过票 **或** 评过论）。
 *              记录 _id=openId#planId 天然去重，所以「记录数 == 参与计划数」，
 *              不需要 distinct 聚合（云函数 3s 超时下聚合代价太高）；
 *              participations 还没在控制台建表时 countByUser 返回 0，不把这个接口打挂
 * - ongoing  = 我发起且未截止；deadline 已过期但 scheduler 还没翻状态的窗口内按「已截止」算
 *
 * 三条 count 并发发出（§11.1）；查完顺手把结果回写 users.stats，
 * 让列表页拼作者卡片时不必再逐条统计 —— 这是「异步冗余」的兑现点。
 */
import { participationDao, planDao, userDao, type ActionSpec, type UserStats } from 'common'

export const stats: ActionSpec = {
  kind: 'read',
  run: async (_payload, ctx) => {
    const { openId } = ctx
    const now = Date.now()
    const [created, joined, ongoing] = await Promise.all([
      planDao.countByAuthor(openId, 'created', now),
      participationDao.countByUser(openId),
      planDao.countByAuthor(openId, 'ongoing', now)
    ])
    const result: UserStats = { created, joined, ongoing }

    // 回写失败不能把统计接口打死，前端拿到的已经是权威值
    try {
      await userDao.update(openId, { stats: result })
    } catch {
      /* 静默：stats 只是冗余展示字段 */
    }
    return result
  }
}
