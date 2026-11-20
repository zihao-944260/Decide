/**
 * comment.create —— CloudContract['comment.create']
 * `{ planId, content }` → `{ comment }`
 *
 * 四件事按顺序落：内容校验 → 送审 → 取 seq → 写评论 + 计数 + 参与记录。
 *
 * seq 来自 `counters`（`{ _id: 'comment:{planId}', value }`，§5.5）：云数据库没有原生自增序列，
 * 「_.inc(1) 再读回」在并发下会给出两个相同值，所以 counterDao 把读-改-写包进事务。
 * 事务冲突时重试一次；两次都抢不到就退回「当前最大 seq + 1」——
 * 兜底值可能重复，但 commentDao.listByPlan 的排序与游标都带 `_id` 次键，
 * 重复 seq 不会漏行也不会错页；相比之下「发不出评论」对用户伤害大得多。
 *
 * 计数为什么不用事务（对照 remove 走了事务）：§5.2 的一致性策略就是「同函数内 _.inc 原子更新 +
 * 每日 scheduler 对账」。这里的插入没有任何前置条件（一次调用必定新增一条），
 * 原子的 _.inc 已经足够；而 remove 的自减有条件（只有 status 真的从 0 翻到 1 才该减），
 * 条件判断和计数变更必须同生共死，那才需要事务。
 */
import {
  BizError,
  CommentStatus,
  ErrorCode,
  Limit,
  PlanStatus,
  SecScene,
  asString,
  assertWritable,
  checkText,
  commentDao,
  commentSeqKey,
  counterDao,
  fallbackAuthor,
  isOpenForAction,
  isTransactionConflict,
  log,
  participationDao,
  planDao,
  toCommentItem,
  toUserInfo,
  userDao,
  type ActionSpec,
  type CommentDoc,
  type UserInfo
} from 'common'

/** 同一评论最多尝试取 seq 的次数：再多会把 3s 预算吃光 */
const SEQ_ATTEMPTS = 2

async function acquireSeq(planId: string): Promise<number> {
  const key = commentSeqKey(planId)
  for (let attempt = 1; attempt <= SEQ_ATTEMPTS; attempt += 1) {
    try {
      return await counterDao.nextSeq(key)
    } catch (err) {
      // 集合缺失/权限之类的真故障照常抛出（router 记 5000 日志），只吞并发冲突
      if (!isTransactionConflict(err)) throw err
      log.warn('counters 事务冲突，重试取号', { planId, attempt, error: String(err) })
    }
  }
  const max = await commentDao.maxSeq(planId)
  log.warn('counters 取号失败，回落 maxSeq', { planId, max })
  return max + 1
}

export const create: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const planId = asString(payload.planId, '计划 ID', 128)
    // 服务端二次校验长度上限（§11.3）：前端同样截到 500，但构造请求不受前端约束
    const content = asString(payload.content, '评论内容', Limit.COMMENT_MAX)
    const { openId, startedAt } = ctx
    const now = Date.now()

    // 两个读互不依赖，并行掉一次往返（3s 超时下每次往返都要抠）
    const [plan, user] = await Promise.all([planDao.getById(planId), userDao.getByOpenId(openId)])
    if (!plan || plan.status === PlanStatus.Removed)
      throw new BizError(ErrorCode.NOT_FOUND, '计划不存在或已删除')
    if (!isOpenForAction(plan.status, plan.deadline ?? 0, now)) {
      throw new BizError(ErrorCode.PLAN_CLOSED, '该计划已截止，无法评论')
    }
    // 未建档（理论上只有绕过 login 的构造请求会这样）不拦，交给 router 的 openId 校验兜底
    if (user) assertWritable(user.status, true)

    // 先审后发：命中违规由 checkText 抛 1001 + 违规文案（§8.4 / §11.3），此时一个字都不落库
    await checkText(openId, content, SecScene.Comment, startedAt)

    const seq = await acquireSeq(planId)
    const doc: CommentDoc = {
      planId,
      openId,
      content,
      seq,
      status: CommentStatus.Normal,
      createdAt: now
    }
    const commentId = await commentDao.insert(doc)
    await planDao.incCommentCount(planId, 1)
    await participationDao.upsert(openId, planId, 'comment', now)

    const author: UserInfo = user ? toUserInfo(user) : fallbackAuthor(openId)
    return { comment: toCommentItem({ ...doc, _id: commentId }, author) }
  }
}
