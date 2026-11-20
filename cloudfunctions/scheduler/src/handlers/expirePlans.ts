/**
 * 到期结算：把 `status=1 && deadline>0 && deadline<=now` 的计划批量置为 `status=2`（§6.7）。
 *
 * 3s 分片怎么设计（这是本 job 唯一难点）：
 * 1. **一批 = 一次查询 + 一次更新**：planDao.markEnded 用 `where({_id in [...], status=1})` 的
 *    集合级更新，100 条只花 2 个往返；逐条 doc.update 要 100 个往返，3s 绝对跑不完。
 * 2. **循环到无数据**：被置成 2 的记录不会再次出现在 listExpirable 里，所以游标天然前进，
 *    不需要额外记 offset（也就不存在 offset 与并发写互相打乱的老问题）。
 * 3. **每轮开头查时间预算**：预算用尽就带着 `truncated` 收工，剩下的留给下一分钟的触发器。
 *    本 job 是幂等的纯状态机（1→2 不可逆、条件里带 status=1），重复执行与漏执行一轮都不产生脏数据。
 * 4. **MAX_ROUNDS 兜底**：防止极端情况（markEnded 返回 0 但查询仍返回满批）把时间片耗光。
 *
 * `now` 在入口取一次并贯穿整轮：一轮里用同一个服务端时间，才能保证
 * 「这一批都是已截止」的判定自洽（用不断前进的 now 会把刚创建、还没到期的计划也算进去）。
 */
import { ServerLimit, log, planDao } from 'common'

/** 单次调用的最大批次轮数：5 轮 = 500 条，够覆盖积压，又把时间片留给响应链路 */
const MAX_ROUNDS = 5

export async function expirePlans(startedAt: number): Promise<Record<string, unknown>> {
  const now = Date.now()
  let scanned = 0
  let ended = 0
  let rounds = 0
  let truncated = false

  while (rounds < MAX_ROUNDS) {
    if (Date.now() - startedAt > ServerLimit.TIME_BUDGET_MS) {
      truncated = true
      break
    }
    const rows = await planDao.listExpirable(now, ServerLimit.SCHED_BATCH)
    if (rows.length === 0) break
    scanned += rows.length
    // orderBy(deadline asc)：最早过期的先结算，被截断时积压的一定是最新的那批
    ended += await planDao.markEnded(
      rows.map((row) => row._id),
      now
    )
    rounds += 1
    if (rows.length < ServerLimit.SCHED_BATCH) break
  }

  if (truncated) log.warn('到期结算被时间预算截断，下一轮继续', { scanned, ended, rounds })
  return { scanned, ended, rounds, truncated }
}
