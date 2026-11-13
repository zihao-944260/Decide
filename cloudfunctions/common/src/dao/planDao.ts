/**
 * plans 集合数据访问（技术方案 §5.2 / §6.3：唯一 db.collection() 出口）。
 *
 * 三条硬约束在这里一次性落地，业务层不再碰投影和游标：
 * 1. 列表投影永不带 blocks / options 明细（§5.2 的 summary 就是为列表页准备的，单条 <1KB）；
 * 2. 分页只用游标，不用 skip（§6.5）；
 * 3. SDK 的 `string | void | IXxxResult` 联合返回只在本层断言一次（见 db.ts 的 rowsOf）。
 */
import { Collection, LISTABLE_PLAN_STATUS, PlanStatus } from '../constants'
import { collection, getCommand, idOf, rowOf, rowsOf, totalOf, updatedOf } from '../db'
import type { Condition, DbLogicCommand, PlanDoc, PlanRow, Transaction, UpdatePayload, VoteCounts } from '../types'

/**
 * 列表投影字段。`optionCount` 是创建/更新时落库的派生字段（否则列表要读回整个 options 数组）；
 * cover 由 images[0] 现算，不额外冗余存储，避免两处数据打架。
 * `options` + `optionVotes` 因 #61（首页卡片逐选项进度条）必须随列表返回：
 * 契约 PlanSummary.options 带 count，mapper.toPlanOptions 用 optionVotes 折算逐选项票数。
 */
const LIST_FIELDS: Record<string, boolean> = {
  openId: true,
  title: true,
  summary: true,
  images: true,
  deadline: true,
  optionsEnabled: true,
  optionCount: true,
  options: true,
  optionVotes: true,
  vote: true,
  commentCount: true,
  status: true,
  createdAt: true,
}

type WherePart = Condition | DbLogicCommand

function merge(...parts: readonly WherePart[]): WherePart {
  const cmd = getCommand()
  return parts.length === 1 ? parts[0] : (cmd.and(...parts) as DbLogicCommand)
}

/**
 * 游标条件：`排序主键越过游标` 或 `主键相等且 _id 越过游标`。
 * 为什么必须带 _id 次键 —— 同一毫秒可以有两条计划（并发创建），
 * 只按 createdAt < c 翻页会在边界处重复或漏数据。
 */
function cursorClause(field: 'createdAt' | 'seq', sort: number, id: string, dir: 'desc' | 'asc'): DbLogicCommand {
  const cmd = getCommand()
  const strict = dir === 'desc' ? cmd.lt(sort) : cmd.gt(sort)
  const tie = dir === 'desc' ? cmd.lt(id) : cmd.gt(id)
  return cmd.or({ [field]: strict } as Condition, { [field]: sort, _id: tie } as Condition)
}

export interface PlanCounters {
  _id: string
  vote: VoteCounts
  commentCount: number
}

/** 游标分页统一入参：limit 由 handler 用 pageSize+1 控制（多取一条判断 hasMore） */
export interface PageQueryArgs {
  readonly sort: number | null
  readonly afterId: string
  readonly limit: number
}

export const planDao = {
  /** 详情与写前校验用全字段读；软删记录也会返回，由调用方判 status=3 */
  async getById(planId: string): Promise<PlanDoc | null> {
    const raw = await collection(Collection.Plans).where({ _id: planId }).limit(1).get()
    return rowOf<PlanDoc>(raw)
  },

  /** 「我参与的」这类先取 id 再补数据的场景：一次 in 查询，顺序由调用方按 ids 重排 */
  async getRowsByIds(planIds: readonly string[]): Promise<PlanRow[]> {
    if (planIds.length === 0) return []
    const cmd = getCommand()
    const raw = await collection(Collection.Plans)
      .where({ _id: cmd.in([...planIds]) })
      .field(LIST_FIELDS)
      .limit(planIds.length)
      .get()
    return rowsOf<PlanRow>(raw)
  },

  /** 公开列表：status in [1,2]（草稿与软删不进列表，§11.3） */
  async listPublic(args: PageQueryArgs): Promise<PlanRow[]> {
    const cmd = getCommand()
    const base: Condition = { status: cmd.in([...LISTABLE_PLAN_STATUS]) }
    const where: WherePart =
      args.sort === null ? base : merge(base, cursorClause('createdAt', args.sort, args.afterId, 'desc'))
    const raw = await collection(Collection.Plans)
      .where(where)
      .field(LIST_FIELDS)
      .orderBy('createdAt', 'desc')
      .orderBy('_id', 'desc')
      .limit(args.limit)
      .get()
    return rowsOf<PlanRow>(raw)
  },

  /**
   * 我的列表：created / ongoing / ended 三种 filter 走这里（joined 由 handler 组合 voteDao）。
   * deadline 可选口径与 countByAuthor 一致：scheduler 翻状态有窗口期（定时触发还可能未配置），
   * ongoing/ended 必须按 deadline 现算，否则过期计划永远筛不进「已截止」（#46）。
   */
  async listByAuthor(
    openId: string,
    statuses: readonly number[],
    args: PageQueryArgs,
    deadline?: { mode: 'active' | 'expired'; now: number },
  ): Promise<PlanRow[]> {
    const cmd = getCommand()
    // expired = status=2 ∪ (status=1 且 deadline>0 且已过)，跨字段 OR 必须顶到 where 顶层
    const statusPart: WherePart =
      deadline && deadline.mode === 'expired'
        ? cmd.or(
            { status: PlanStatus.Ended } as Condition,
            { status: PlanStatus.Ongoing, deadline: cmd.and(cmd.gt(0), cmd.lte(deadline.now)) } as Condition,
          )
        : ({ status: cmd.in([...statuses]) } as Condition)
    const parts: WherePart[] = [{ openId } as Condition, statusPart]
    if (deadline && deadline.mode === 'active') {
      parts.push({ deadline: cmd.or(cmd.eq(0), cmd.gt(deadline.now)) } as Condition)
    }
    const base = merge(...parts)
    const where: WherePart =
      args.sort === null ? base : merge(base, cursorClause('createdAt', args.sort, args.afterId, 'desc'))
    const raw = await collection(Collection.Plans)
      .where(where)
      .field(LIST_FIELDS)
      .orderBy('createdAt', 'desc')
      .orderBy('_id', 'desc')
      .limit(args.limit)
      .get()
    return rowsOf<PlanRow>(raw)
  },

  /**
   * user.stats 的 created / ongoing 两个计数。
   * 「进行中」按 deadline 现场判定而不是只看 status：scheduler 每分钟才翻一次状态，
   * 刚过截止时间的计划不能在这一分钟里仍被算作进行中。
   */
  async countByAuthor(openId: string, mode: 'created' | 'ongoing', now: number): Promise<number> {
    const cmd = getCommand()
    const cond: Condition =
      mode === 'created'
        ? { openId, status: cmd.in([...LISTABLE_PLAN_STATUS]) }
        : { openId, status: PlanStatus.Ongoing, deadline: cmd.or(cmd.eq(0), cmd.gt(now)) }
    const raw = await collection(Collection.Plans).where(cond).count()
    return totalOf(raw)
  },

  /** 到期结算候选（§6.7）：status=1 且 deadline>0 且已过期 */
  async listExpirable(now: number, limit: number): Promise<{ _id: string }[]> {
    const cmd = getCommand()
    const raw = await collection(Collection.Plans)
      .where({ status: PlanStatus.Ongoing, deadline: cmd.and(cmd.gt(0), cmd.lte(now)) })
      .field({ _id: true })
      .orderBy('deadline', 'asc')
      .orderBy('_id', 'asc')
      .limit(limit)
      .get()
    return rowsOf<{ _id: string }>(raw)
  },

  /**
   * 批量置为已截止：一条 where-in 更新搞定一批。
   * 3s 超时下逐条 doc.update 会直接把 scheduler 拖爆，这是 §6.7 分片的前提。
   * 条件里保留 status=1，避免与并发的编辑互相覆盖。
   */
  async markEnded(planIds: readonly string[], now: number): Promise<number> {
    if (planIds.length === 0) return 0
    const cmd = getCommand()
    const raw = await collection(Collection.Plans)
      .where({ _id: cmd.in([...planIds]), status: PlanStatus.Ongoing })
      .update({ data: { status: PlanStatus.Ended, updatedAt: now } })
    return updatedOf(raw)
  },

  /**
   * 对账游标分页：按 `_id` 升序遍历在线计划。
   * 不用 createdAt 是因为同一毫秒可能有多条；_id 唯一，游标严格递增，不漏不重。
   */
  async listForReconcile(afterId: string, limit: number): Promise<PlanCounters[]> {
    const cmd = getCommand()
    const base: Condition = { status: cmd.in([...LISTABLE_PLAN_STATUS]) }
    const where: WherePart = afterId ? merge(base, { _id: cmd.gt(afterId) } as Condition) : base
    const raw = await collection(Collection.Plans)
      .where(where)
      .field({ vote: true, commentCount: true })
      .orderBy('_id', 'asc')
      .limit(limit)
      .get()
    return rowsOf<PlanCounters>(raw)
  },

  async create(doc: PlanDoc): Promise<string> {
    const raw = await collection(Collection.Plans).add({ data: { ...doc } })
    return idOf(raw)
  },

  /** 编辑：blocks/images/options/summary/optionCount 由 handler 组装成完整替换载荷 */
  async updateContent(planId: string, data: UpdatePayload): Promise<number> {
    const raw = await collection(Collection.Plans).doc(planId).update({ data })
    return updatedOf(raw)
  },

  /**
   * 计数冗余原子更新（§5.2 一致性策略）。
   * 刻意用 `_.inc` 而不是「读-改-写」：并发投票时后者会丢计数。
   */
  async incVote(planId: string, key: 'agree' | 'disagree', delta: number): Promise<number> {
    const cmd = getCommand()
    const raw = await collection(Collection.Plans).doc(planId).update({ data: { [`vote.${key}`]: cmd.inc(delta) } })
    return updatedOf(raw)
  },

  async incCommentCount(planId: string, delta: number): Promise<number> {
    const cmd = getCommand()
    const raw = await collection(Collection.Plans)
      .doc(planId)
      .update({ data: { commentCount: cmd.inc(delta) } })
    return updatedOf(raw)
  },

  /** 软删除：status=3，记录保留（§11.3） */
  async softRemove(planId: string, now: number): Promise<number> {
    const raw = await collection(Collection.Plans)
      .doc(planId)
      .update({ data: { status: PlanStatus.Removed, updatedAt: now } })
    return updatedOf(raw)
  },

  // === 事务出口（供 vote.submit 使用；事务内只能走 doc()，见 dao/voteDao 注释） ===

  async txGetPlan(tx: Transaction, planId: string): Promise<PlanDoc | null> {
    const raw = await tx.collection(Collection.Plans).doc(planId).get()
    return rowOf<PlanDoc>(raw)
  },

  async txIncVote(tx: Transaction, planId: string, key: 'agree' | 'disagree', delta: number): Promise<void> {
    const cmd = getCommand()
    await tx.collection(Collection.Plans).doc(planId).update({ data: { [`vote.${key}`]: cmd.inc(delta) } })
  },

  /**
   * 选项表决的逐选项计数原子自增（#61）：_.inc 落在 `optionVotes.{optionId}` 路径上。
   * 与 txIncVote 同理，刻意不用「读-改-写」，并发投同一选项时后者会丢计数。
   * optionId 必须先由 handler 校验存在于 plan.options（挡住伪造选项与点号路径注入）。
   */
  async txIncOptionVote(tx: Transaction, planId: string, optionId: string, delta: number): Promise<void> {
    const cmd = getCommand()
    await tx.collection(Collection.Plans).doc(planId).update({ data: { [`optionVotes.${optionId}`]: cmd.inc(delta) } })
  },

  /** 对账修正：只在计数确实漂移时由 scheduler 调用 */
  async setCounts(planId: string, vote: VoteCounts, commentCount: number): Promise<number> {
    const raw = await collection(Collection.Plans).doc(planId).update({ data: { vote, commentCount } })
    return updatedOf(raw)
  },
}
