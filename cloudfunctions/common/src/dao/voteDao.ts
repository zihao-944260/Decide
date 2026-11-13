/**
 * votes 集合数据访问（技术方案 §5.3 / §8.3）。
 *
 * 防重复投票的两层防线：
 * 1. `_id = planId + '#' + openId` 的确定性文档 ID —— 数据库对 _id 的唯一性是内建的，
 *    不依赖控制台补建的 `planId+openId` 唯一索引（SDK 建不了索引，见 §3.1 实测），
 *    并发重复投票在 insert 阶段就会被拒，异常由 handler 翻译成 3003；
 * 2. 事务内先读已有记录，投过任何票（简单或选项）即锁定，直接返回 3003（#60，不允许改票）。
 */
import { Collection, VOTE_TYPES } from '../constants'
import { collection, getCommand, idOf, rowOf, rowsOf, totalOf } from '../db'
import type { Condition, Transaction, VoteDoc, WherePart } from '../types'

export interface VoteRow {
  _id: string
  planId: string
  type: number
}

/** 读取「我投了哪一票」的归一结果：type 为库内原值（0=选项票 / 1=赞成 / 2=反对），optionId 缺省归一为 '' */
export interface ViewerVote {
  type: number
  optionId: string
}

/** 「我参与的」翻页游标带的三列：planId 用于回补计划，createdAt/_id 用于游标 */
export interface VoteCursorRow {
  _id: string
  planId: string
  createdAt: number
}

export function voteDocId(planId: string, openId: string): string {
  return `${planId}#${openId}`
}

export const voteDao = {
  async findByPlanAndUser(planId: string, openId: string): Promise<VoteDoc | null> {
    const raw = await collection(Collection.Votes)
      .where({ planId, openId } as Condition)
      .limit(1)
      .get()
    return rowOf<VoteDoc>(raw)
  },

  /** 详情/纠偏要展示「我投了哪一票」：读 type + optionId，无记录返回 null（投过即锁定，#60） */
  async myVote(planId: string, openId: string): Promise<ViewerVote | null> {
    const raw = await collection(Collection.Votes)
      .where({ planId, openId } as Condition)
      .field({ type: true, optionId: true })
      .limit(1)
      .get()
    const row = rowOf<{ type: number; optionId?: string }>(raw)
    if (!row) return null
    return { type: typeof row.type === 'number' ? row.type : 0, optionId: row.optionId ?? '' }
  },

  /**
   * 列表页批量取「我对这一页计划各投了哪一票」（#60/#61 的 myOption 来源）。
   * 用确定性 _id = planId#openId 做 in 查询，命中主键索引，无需控制台补建 openId+planId 二级索引；
   * 一次往返覆盖整页，避免 N+1。未投的计划不在返回 map 里，调用方按 '' 兜底。
   */
  async mapByPlanIds(openId: string, planIds: readonly string[]): Promise<Record<string, ViewerVote>> {
    if (planIds.length === 0 || !openId) return {}
    const cmd = getCommand()
    const ids = planIds.map((planId) => voteDocId(planId, openId))
    const raw = await collection(Collection.Votes)
      .where({ _id: cmd.in(ids) } as Condition)
      .field({ planId: true, type: true, optionId: true })
      .limit(ids.length)
      .get()
    const rows = rowsOf<{ planId: string; type: number; optionId?: string }>(raw)
    const map: Record<string, ViewerVote> = {}
    for (const row of rows) {
      map[row.planId] = { type: typeof row.type === 'number' ? row.type : 0, optionId: row.optionId ?? '' }
    }
    return map
  },

  async insert(doc: VoteDoc): Promise<string> {
    const raw = await collection(Collection.Votes).add({ data: { ...doc } })
    return idOf(raw)
  },

  /** 列表排序用：按投票时间倒序翻页，返回 planId 顺序即「我参与的」顺序 */
  async listPlanIdsByUser(openId: string, sort: number | null, afterId: string, limit: number): Promise<VoteCursorRow[]> {
    const cmd = getCommand()
    const base: Condition = { openId }
    const cond: WherePart =
      sort === null
        ? base
        : cmd.and(
            base,
            cmd.or({ createdAt: cmd.lt(sort) } as Condition, { createdAt: sort, _id: cmd.lt(afterId) } as Condition),
          )
    const raw = await collection(Collection.Votes)
      .where(cond)
      .field({ planId: true, createdAt: true })
      .orderBy('createdAt', 'desc')
      .orderBy('_id', 'desc')
      .limit(limit)
      .get()
    return rowsOf<VoteCursorRow>(raw)
  },

  /** user.stats 的 joined：一条投票记录 = 一个参与过的计划，所以记录数就是参与数 */
  async countByUser(openId: string): Promise<number> {
    const raw = await collection(Collection.Votes).where({ openId } as Condition).count()
    return totalOf(raw)
  },

  /** 对账用：只数有效票（type 必须在枚举内），历史脏数据不会被算进来 */
  async countByType(planId: string, type: number): Promise<number> {
    const raw = await collection(Collection.Votes).where({ planId, type } as Condition).count()
    return totalOf(raw)
  },

  /** 对账用：一次查出三种计数，省掉 3 次 count 往返（scheduler 也只有 3s） */
  async countAllTypes(planId: string): Promise<{ agree: number; disagree: number; total: number }> {
    const cmd = getCommand()
    const raw = await collection(Collection.Votes)
      .where({ planId, type: cmd.in([...VOTE_TYPES]) } as Condition)
      .field({ type: true })
      .limit(1000)
      .get()
    const rows = rowsOf<{ type: number }>(raw)
    let agree = 0
    let disagree = 0
    for (const row of rows) {
      if (row.type === VOTE_TYPES[0]) agree += 1
      else if (row.type === VOTE_TYPES[1]) disagree += 1
    }
    return { agree, disagree, total: rows.length }
  },

  // === 事务出口 ===

  async txGetById(tx: Transaction, voteId: string): Promise<VoteDoc | null> {
    const raw = await tx.collection(Collection.Votes).doc(voteId).get()
    return rowOf<VoteDoc>(raw)
  },

  async txInsert(tx: Transaction, doc: VoteDoc): Promise<string> {
    const raw = await tx.collection(Collection.Votes).add({ data: { ...doc } })
    return idOf(raw)
  },
}
