/**
 * vote.submit —— CloudContract['vote.submit']
 * `{ planId, type?: 1|2, optionId? }` → `{ votes, myVote, options, myOption }`
 *
 * 两种模式（契约二选一）：
 * - optionId 非空 = 选项表决（type 忽略）：校验 optionId 存在于 plan.options，
 *   插一条 type=0 + optionId 的票，_.inc 该选项的 optionVotes 计数；myVote=0、myOption=optionId。
 * - 否则 type=1|2 = 简单表决：插 type 票，_.inc plans.vote.{agree|disagree}；myOption=''、options=[]。
 *
 * 投过即锁定（#60）：只要库里已有**任何**投票记录（简单或选项），一律不允许改票，
 * 回滚并抛 3003，把权威 {votes,myVote,options,myOption} 带回前端静默纠偏。
 * 旧版「改票（旧-1新+1）」分支已移除——首次投票 insert，此后同票/异票都回 3003。
 *
 * 技术方案 §8.3 的一致性流程，全部在**一个事务**里完成：
 * 读计划（存在性 / status / deadline / 是否本人计划 / 选项合法性）→ 读 votes 记录 →
 * 有记录则 3003 锁定；无记录则 insert + 对应计数 _.inc → commit。
 *
 * 事务边界为什么划在这儿：`votes` 与 `plans.vote` / `plans.optionVotes` 是两个文档，
 * 任何非原子的「写一条 + inc 另一条」都会在并发双击时留下票已落、计数没落（或反之）的半状态，
 * 而计数是列表比例条 / 逐选项进度条的唯一来源。微信云开发事务对同一文档的并发写会判冲突并回滚，所以：
 * - `isDuplicateKeyError`：读空后并发 insert 撞了确定性 _id → 与冲突同等处理，重试一次，
 *   第二次必然读到已有记录并落到「锁定 3003」分支；
 * - `isTransactionConflict`：与并发投票/编辑抢同一计划文档 → 同样重试一次；
 * - 重试仍失败：回读库里的真实状态按 3003 纠偏 —— 前端收到 3003 会静默 correctFromServer，
 *   比让用户看到「服务开小差了」更贴近真实情况（票其实已经被记下了，只是不是我们这次写的）；
 *   只有回读发现确实没有票记录时才算服务端失败（5000）。
 *
 * 时间基准：deadline 一律与 `Date.now()`（云函数所在服务器时间）比较，绝不信前端时钟（§11.3），
 * 否则改本机时间就能绕过截止继续投票。
 *
 * v1 不做取消投票（主 agent 裁决）：没有 type=0 的简单票分支，也不删 votes 记录。
 */
import {
  BizError,
  ErrorCode,
  PlanStatus,
  VoteType,
  asOptionalString,
  asString,
  inEnum,
  isOpenForAction,
  isDuplicateKeyError,
  isTransactionConflict,
  log,
  participationDao,
  planDao,
  startTransaction,
  toPlanOptions,
  voteDao,
  voteDocId,
  type ActionSpec,
  type PlanOption,
  type Transaction,
  type VoteCounts,
  type VoteDoc,
  type VoteTypeValue
} from 'common'

const ALLOWED_TYPES: readonly VoteTypeValue[] = [VoteType.Agree, VoteType.Disagree]

/** 抢同一计划文档时的重试次数：1 次足够覆盖双击，再多会把 3s 预算吃光 */
const TX_ATTEMPTS = 2

/** 选项 id 长度上限：与 planPayload 的选项 id 校验同口径（前端 nanoid，64 已足够宽） */
const OPTION_ID_MAX = 64

interface VoteOutcome {
  readonly votes: VoteCounts
  readonly myVote: number
  readonly options: PlanOption[]
  readonly myOption: string
}

/** 投票请求的两种模式：optionId 非空 = 选项表决；否则 type=1|2 简单表决 */
type VoteMode = { kind: 'option'; optionId: string } | { kind: 'simple'; type: VoteTypeValue }

function countKeyOf(type: number): 'agree' | 'disagree' {
  return type === VoteType.Agree ? 'agree' : 'disagree'
}

/** 库内 type 折算成契约 myVote：1|2 原样，0（选项票）/ 脏值 → 0 */
function myVoteOf(type: number): number {
  return type === VoteType.Agree || type === VoteType.Disagree ? type : 0
}

/**
 * common 的 counterDao 内部有同样的 rollback 兜底，但 `rollbackQuiet` 没被导出（是 counterDao 的模块私有函数），
 * 这里留一份私有版本 —— 上提它要改 common 的出口面，不在本轮范围内。
 */
async function rollbackQuiet(tx: Transaction, err: unknown): Promise<void> {
  try {
    await tx.rollback(err)
  } catch (rollbackErr) {
    // 回滚失败通常意味着事务已结束（超时/已提交），继续抛原始错误更有诊断价值
    log.warn('transaction.rollback 失败', { error: String(rollbackErr) })
  }
}

/** 单次尝试：要么完整落库并 commit，要么回滚后抛错，绝不留下中间态 */
async function castOnce(
  openId: string,
  planId: string,
  mode: VoteMode,
  now: number
): Promise<VoteOutcome> {
  const tx = await startTransaction()
  try {
    const plan = await planDao.txGetPlan(tx, planId)
    if (!plan) throw new BizError(ErrorCode.NOT_FOUND, '计划不存在或已删除')
    if (plan.status === PlanStatus.Removed)
      throw new BizError(ErrorCode.NOT_FOUND, '计划不存在或已删除')
    // §8.3「主态不显示投票按钮」的服务端对应物：前端藏按钮挡不住构造请求，作者票会带偏比例条
    if (plan.openId === openId) throw new BizError(ErrorCode.FORBIDDEN, '不能给自己发起的计划投票')
    if (!isOpenForAction(plan.status, plan.deadline ?? 0, now)) {
      throw new BizError(ErrorCode.PLAN_CLOSED, '该计划已截止，无法投票')
    }
    // 选项模式：optionId 必须真实存在于 plan.options。既挡住伪造选项，也挡住用点号构造 _.inc 路径注入
    if (
      mode.kind === 'option' &&
      !(plan.options ?? []).some((option) => option.id === mode.optionId)
    ) {
      throw new BizError(ErrorCode.INVALID_PARAM, '投票选项不存在')
    }

    const voteId = voteDocId(planId, openId)
    const mine = await voteDao.txGetById(tx, voteId)
    // 事务内读到的计数 + 本次事务的增量 = commit 后的权威值：
    // 事务对 plans 文档加了写锁，别的投票要么先于我们（已体现在这次读到的计数里）、要么冲突回滚，
    // 所以这个本地推算不会丢增量；commit 后仍会回读一次做最终校准。
    const votes: VoteCounts = { agree: plan.vote?.agree ?? 0, disagree: plan.vote?.disagree ?? 0 }
    const options = toPlanOptions(plan.optionsEnabled === true, plan.options, plan.optionVotes)

    // #60 投过即锁定：已有任何投票记录（简单或选项）都不允许改票，
    // 计数一个都不动，回滚并把权威 {votes,myVote,options,myOption} 带回前端纠偏（§6.2：3003 = 静默纠正本地态）
    if (mine) {
      throw new BizError(ErrorCode.DUPLICATED, '已经投过票，不能修改', {
        votes,
        myVote: myVoteOf(mine.type),
        options,
        myOption: mine.optionId ?? ''
      })
    }

    let myVote = 0
    let myOption = ''
    if (mode.kind === 'option') {
      // 选项票 type=0，不计入 vote.agree/disagree（对账 countAllTypes 只数 1|2，天然忽略选项票）
      const doc: VoteDoc = {
        _id: voteId,
        planId,
        openId,
        type: 0,
        optionId: mode.optionId,
        createdAt: now,
        updatedAt: now
      }
      await voteDao.txInsert(tx, doc)
      await planDao.txIncOptionVote(tx, planId, mode.optionId, 1)
      for (const option of options) {
        if (option.id === mode.optionId) option.count += 1
      }
      myOption = mode.optionId
    } else {
      const doc: VoteDoc = {
        _id: voteId,
        planId,
        openId,
        type: mode.type,
        createdAt: now,
        updatedAt: now
      }
      await voteDao.txInsert(tx, doc)
      const key = countKeyOf(mode.type)
      await planDao.txIncVote(tx, planId, key, 1)
      votes[key] += 1
      myVote = mode.type
    }

    await tx.commit()
    return { votes, myVote, options, myOption }
  } catch (err) {
    await rollbackQuiet(tx, err)
    throw err
  }
}

/**
 * commit 之后回读一次真实计数。
 * 与事务内推算不一致时（库里本来就有历史漂移、或上一轮冲突留下偏差）以库为准 ——
 * 前端要用这个值覆盖乐观更新，回错值会让比例条 / 逐选项进度条从此一直偏着（§8.3 第 5 步）。
 * 回读失败不致命：退回事务内推算值，避免这次已经投成功的请求被误报成失败。
 * myVote / myOption 是本次刚落的票，回读只校准计数与选项票数。
 */
async function authoritative(planId: string, fallback: VoteOutcome): Promise<VoteOutcome> {
  try {
    const fresh = await planDao.getById(planId)
    if (!fresh) return fallback
    return {
      votes: { agree: fresh.vote?.agree ?? 0, disagree: fresh.vote?.disagree ?? 0 },
      myVote: fallback.myVote,
      options: toPlanOptions(fresh.optionsEnabled === true, fresh.options, fresh.optionVotes),
      myOption: fallback.myOption
    }
  } catch (err) {
    log.warn('权威计数回读失败，回落事务内计算值', { planId, error: String(err) })
    return fallback
  }
}

/**
 * 冲突重试耗尽后的纠偏读：把库里的真实票与计数原样交回前端。
 * 回读不到记录说明两次事务都没写成、且并发方也没写 —— 那是真失败，按 5000 报出去。
 */
async function correctOrFail(planId: string, openId: string): Promise<never> {
  const [plan, mine] = await Promise.all([planDao.getById(planId), voteDao.myVote(planId, openId)])
  if (!mine) {
    throw new BizError(ErrorCode.SERVER_ERROR, '投票未能完成，请稍后重试')
  }
  throw new BizError(ErrorCode.DUPLICATED, '投票已记录，请以最新计数为准', {
    votes: { agree: plan?.vote?.agree ?? 0, disagree: plan?.vote?.disagree ?? 0 },
    myVote: myVoteOf(mine.type),
    options: toPlanOptions(plan?.optionsEnabled === true, plan?.options, plan?.optionVotes),
    myOption: mine.optionId
  })
}

export const submit: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const planId = asString(payload.planId, '计划 ID', 128)
    // optionId 非空 = 选项表决（type 忽略）；否则按简单表决校验 type ∈ {1,2}
    const optionId = asOptionalString(payload.optionId, '投票选项', OPTION_ID_MAX)
    const mode: VoteMode =
      optionId !== ''
        ? { kind: 'option', optionId }
        : { kind: 'simple', type: inEnum<VoteTypeValue>(payload.type, '投票类型', ALLOWED_TYPES) }
    const { openId } = ctx
    const now = Date.now()

    for (let attempt = 1; attempt <= TX_ATTEMPTS; attempt += 1) {
      try {
        const outcome = await castOnce(openId, planId, mode, now)
        // 冗余参与记录：只在票真的落库后写（§8.7，best-effort，见 common 的 participationDao）
        await participationDao.upsert(openId, planId, 'vote', now)
        return await authoritative(planId, outcome)
      } catch (err) {
        // 业务判定（3001/3002/2001/1001/3003）不参与重试：重试会把同一句拒绝再算一遍，白花时间
        if (err instanceof BizError) throw err
        const retryable = isDuplicateKeyError(err) || isTransactionConflict(err)
        if (!retryable) throw err
        log.warn('投票事务需重试', {
          planId,
          attempt,
          duplicate: isDuplicateKeyError(err),
          error: String(err)
        })
      }
    }

    return correctOrFail(planId, openId)
  }
}
