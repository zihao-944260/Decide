/**
 * 计数对账：重算 `plans.vote` 与 `plans.commentCount`（§6.7 每天 04:00）。
 *
 * 为什么必须有这一步：`_.inc` 只保证单次写入原子，不保证跨集合的因果一致 ——
 * 评论插入成功但 incCommentCount 超时、投票事务提交后进程被杀、手工改库、
 * 以及 comment.remove 那种「事务已提交、自减留在事务外」的设计（见 comment/src/handlers/remove），
 * 都会留下漂移。冗余计数的消费方是列表比例条和「N 条评论」，偏了就是显性 bug。
 *
 * 3s 分片：
 * 1. 游标 = `_id` 升序（planDao.listForReconcile），严格递增、不漏不重，
 *    不用 createdAt 是因为同一毫秒可能有多条；
 * 2. 游标落在 `counters` 的 `reconcile:cursor` 文档里，**每批处理完立刻推进**，
 *    所以被时间预算截断的那一轮下次从断点继续，而不是从头再扫一遍（counterDao.advanceMarker
 *    吞写入异常：游标没推回去最多是下一轮重复处理这一段，对账本身幂等，重复不产生错误数据）；
 * 3. 每批 RECONCILE_MAX_PLANS 条，批内逐条检查预算，用尽即带 truncated 收工；
 * 4. 全表扫完把游标复位成 ''，下一轮从头部开始。
 *
 * 只在真的漂移时才写库：每天对全量计划做无差别的 setCounts 会刷脏 updatedAt，
 * 而 updatedAt 是「计划是否被编辑过」的展示依据。
 */
import {
  RECONCILE_CURSOR_KEY,
  ServerLimit,
  VoteType,
  commentDao,
  counterDao,
  log,
  planDao,
  voteDao,
  type VoteCounts
} from 'common'

/**
 * voteDao.countAllTypes 内部是 `limit(1000)` 的一次读取（common 没把这个上限导出来）。
 * 命中上限说明这条计划的票数已经超出「数行」这条路，必须换成两次 count ——
 * 否则会把 1000+ 票的计数据写回库，等于对账本身制造新漂移。
 */
const VOTE_SCAN_LIMIT = 1000

function hasDrift(
  stored: VoteCounts,
  storedCommentCount: number,
  real: VoteCounts,
  realCommentCount: number
): boolean {
  return (
    stored.agree !== real.agree ||
    stored.disagree !== real.disagree ||
    storedCommentCount !== realCommentCount
  )
}

export async function reconcileCounts(startedAt: number): Promise<Record<string, unknown>> {
  let marker = await counterDao.getMarker(RECONCILE_CURSOR_KEY)
  let scanned = 0
  let fixed = 0
  let batches = 0
  let truncated = false

  while (true) {
    if (Date.now() - startedAt > ServerLimit.TIME_BUDGET_MS) {
      truncated = true
      break
    }
    const rows = await planDao.listForReconcile(marker, ServerLimit.RECONCILE_MAX_PLANS)
    if (rows.length === 0) break
    batches += 1

    for (const row of rows) {
      marker = row._id
      scanned += 1
      const counted = await voteDao.countAllTypes(row._id)
      const votes: VoteCounts =
        counted.total >= VOTE_SCAN_LIMIT
          ? {
              agree: await voteDao.countByType(row._id, VoteType.Agree),
              disagree: await voteDao.countByType(row._id, VoteType.Disagree)
            }
          : { agree: counted.agree, disagree: counted.disagree }
      const commentCount = await commentDao.countNormal(row._id)

      if (
        hasDrift(row.vote ?? { agree: 0, disagree: 0 }, row.commentCount ?? 0, votes, commentCount)
      ) {
        await planDao.setCounts(row._id, votes, commentCount)
        fixed += 1
        log.info('对账修正计数', { planId: row._id, votes, commentCount })
      }

      // 单条计划也要看预算：批边界检查会让一批 40 条直接冲过 3s
      if (Date.now() - startedAt > ServerLimit.TIME_BUDGET_MS) {
        truncated = true
        break
      }
    }

    await counterDao.advanceMarker(RECONCILE_CURSOR_KEY, marker)
    if (truncated) break
    // 不满一批 = 已经扫到集合尾部（游标条件用的严格 gt，不会重复返回同一批）
    if (rows.length < ServerLimit.RECONCILE_MAX_PLANS) {
      marker = ''
      break
    }
  }

  // 扫完复位：留着末位 _id 的话，下一轮会从中间开始，前面的计划常年得不到对账
  if (!truncated) await counterDao.advanceMarker(RECONCILE_CURSOR_KEY, '')
  // nextCursor 是本轮结束时游标应在的位置（'' = 下一轮从头开始），只进日志便于控制台核对
  return { scanned, fixed, batches, truncated, nextCursor: marker }
}
