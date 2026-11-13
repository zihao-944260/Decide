/**
 * comment.remove —— CloudContract['comment.remove']
 * `{ commentId }` → `{ ok: true }`
 *
 * 软删除（status=1）：内容保留在库里（审计、违规回溯要用），只在出参里由 toCommentItem 抹掉，
 * 列表仍返回占位记录（见 handlers/list 的取舍说明）。
 *
 * 权限：评论作者本人 或 计划作者（§6.4）。`assertCommentDeleter` 需要 plan.openId，
 * 但**本人删自己的评论时不读 plans** —— 省一次往返（3s 预算下每次往返都要抠），
 * 也只有越权那一条路径才付得出这次读。已截止的计划仍然允许删（作者清理历史讨论），
 * 所以这里不判 deadline，只让计划作者身份说了算。
 *
 * 状态翻转为什么走事务：`commentCount` 的自减只有在「这条评论确实从 0 翻到 1」时才该发生。
 * 用普通读-判-写，两个并发删除会都读到 status=0、都执行自减，计数从此偏低。
 * 事务里重读同一条 comments 文档再 update，微信云开发对同一文档的并发事务写会判冲突回滚，
 * 于是「恰好一方成功、另一方看到 status=1 走 3003」，自减最多发出一次。
 *
 * commentCount 是否 -1：**是**。理由有两条 ——
 * 1. §5.4 的 status=1 是「占位显示」而非「还在计数」，commentDao.countNormal 与
 *    scheduler 每日对账都只数 status=0；评论数与「有效评论」必须同口径，否则详情页计数长期虚高，
 *    而虚高的计数正是每天 04:00 要被对账改回去的东西 —— 两处口径不一致就是自找抖动。
 * 2. 自减刻意留在事务外（§5.2 的策略就是「同函数内 _.inc 原子更新 + 每日对账」）：
 *    事务只锁 comments 一条文档，不与并发投票抢 plans 的写锁，冲突率更低；
 *    代价是 commit 后进程崩溃会漏一次自减，由对账兜回，比重试整套事务更便宜。
 */
import {
  BizError,
  Collection,
  CommentStatus,
  ErrorCode,
  assertCommentDeleter,
  asString,
  commentDao,
  isTransactionConflict,
  log,
  planDao,
  rowOf,
  startTransaction,
  type ActionSpec,
  type CommentDoc,
  type Transaction,
  type UpdatePayload,
} from 'common'

const ID_MAX = 128
const TX_ATTEMPTS = 2

/** ok=本次事务真的翻转了 status；already=进来时就已是删除态（并发对手先删了） */
type FlipResult = 'ok' | 'already'

async function rollbackQuiet(tx: Transaction, err: unknown): Promise<void> {
  try {
    await tx.rollback(err)
  } catch (rollbackErr) {
    // 回滚失败通常意味着事务已结束（超时/已提交），继续抛原始错误更有诊断价值
    log.warn('transaction.rollback 失败', { error: String(rollbackErr) })
  }
}

async function flipRemovedOnce(commentId: string): Promise<FlipResult> {
  const tx = await startTransaction()
  try {
    // 事务内重读：出参 comment 只是快速失败路径的预读，权威判定必须在这里做
    const current = rowOf<CommentDoc>(await tx.collection(Collection.Comments).doc(commentId).get())
    if (!current) {
      await tx.rollback('comment-not-found')
      throw new BizError(ErrorCode.NOT_FOUND, '评论不存在或已删除')
    }
    if (current.status === CommentStatus.Removed) {
      await tx.rollback('already-removed')
      return 'already'
    }
    await tx
      .collection(Collection.Comments)
      .doc(commentId)
      .update({ data: { status: CommentStatus.Removed } as UpdatePayload })
    await tx.commit()
    return 'ok'
  } catch (err) {
    await rollbackQuiet(tx, err)
    throw err
  }
}

export const remove: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const commentId = asString(payload.commentId, '评论 ID', ID_MAX)
    const { openId } = ctx

    const comment = await commentDao.getById(commentId)
    if (!comment) throw new BizError(ErrorCode.NOT_FOUND, '评论不存在或已删除')
    if (comment.status === CommentStatus.Removed) throw new BizError(ErrorCode.DUPLICATED, '该评论已删除')

    if (comment.openId !== openId) {
      const plan = await planDao.getById(comment.planId)
      assertCommentDeleter(comment.openId, plan?.openId ?? '', openId)
    }

    let result: FlipResult = 'already'
    for (let attempt = 1; attempt <= TX_ATTEMPTS; attempt += 1) {
      try {
        result = await flipRemovedOnce(commentId)
        break
      } catch (err) {
        // 业务判定（3001）不参与重试；只有事务冲突才值得再来一次
        if (err instanceof BizError) throw err
        if (!isTransactionConflict(err)) throw err
        log.warn('评论删除事务冲突，重试', { commentId, attempt, error: String(err) })
      }
    }
    if (result === 'already') throw new BizError(ErrorCode.DUPLICATED, '该评论已删除')

    // 自减只在事务真的翻转成功时发出（上面已保证最多发出一次）
    await planDao.incCommentCount(comment.planId, -1)
    return { ok: true }
  },
}
