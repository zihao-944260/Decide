/**
 * comments 集合数据访问（技术方案 §5.4 / §8.4）。
 *
 * 顺序展示靠 `seq`：同一计划内自增、升序返回，游标也用 seq（§6.5）。
 * 软删（status=1）的记录**仍然留在列表里**，因为前端要显示「该评论已删除」占位（§8.4），
 * 过滤掉会让中间空出一格、评论时间线看起来被篡改；`CommentItem.status` 就是为此存在。
 * 而 plans.commentCount 只统计正常评论，所以 dao 同时提供两种查询。
 */
import { Collection, CommentStatus } from '../constants'
import { collection, getCommand, idOf, rowOf, rowsOf, totalOf, updatedOf } from '../db'
import type { CommentDoc, Condition, UpdatePayload, WherePart } from '../types'

const LIST_FIELDS: Record<string, boolean> = {
  planId: true,
  openId: true,
  content: true,
  seq: true,
  status: true,
  createdAt: true,
}

export const commentDao = {
  /**
   * 评论分页：seq 升序 + _id 兜底次键。
   * 带 _id 是因为 counters 并发自增理论上可能给出重复 seq，
   * 只用 seq 做游标会在重复值处漏掉一条。
   */
  async listByPlan(planId: string, seq: number | null, afterId: string, limit: number): Promise<CommentDoc[]> {
    const cmd = getCommand()
    const base: Condition = { planId, status: cmd.in([CommentStatus.Normal, CommentStatus.Removed]) }
    const cond: WherePart =
      seq === null
        ? base
        : cmd.and(
            base,
            cmd.or({ seq: cmd.gt(seq) } as Condition, { seq, _id: cmd.gt(afterId) } as Condition),
          )
    const raw = await collection(Collection.Comments)
      .where(cond)
      .field(LIST_FIELDS)
      .orderBy('seq', 'asc')
      .orderBy('_id', 'asc')
      .limit(limit)
      .get()
    return rowsOf<CommentDoc>(raw)
  },

  async getById(commentId: string): Promise<CommentDoc | null> {
    const raw = await collection(Collection.Comments).where({ _id: commentId }).limit(1).get()
    return rowOf<CommentDoc>(raw)
  },

  async insert(doc: CommentDoc): Promise<string> {
    const raw = await collection(Collection.Comments).add({ data: { ...doc } })
    return idOf(raw)
  },

  /** 软删除：内容保留（审计与回调排查要用），只翻 status */
  async softRemove(commentId: string): Promise<number> {
    const data: UpdatePayload = { status: CommentStatus.Removed }
    const raw = await collection(Collection.Comments).doc(commentId).update({ data })
    return updatedOf(raw)
  },

  /** 对账用：只数未被删除的评论，和 plans.commentCount 的语义一致 */
  async countNormal(planId: string): Promise<number> {
    const raw = await collection(Collection.Comments)
      .where({ planId, status: CommentStatus.Normal } as Condition)
      .count()
    return totalOf(raw)
  },

  /** 取当前最大 seq：counters 文档缺失时的兜底起点（例如老数据或 counters 被误清） */
  async maxSeq(planId: string): Promise<number> {
    const raw = await collection(Collection.Comments)
      .where({ planId } as Condition)
      .field({ seq: true })
      .orderBy('seq', 'desc')
      .limit(1)
      .get()
    const row = rowOf<{ seq: number }>(raw)
    return typeof row?.seq === 'number' ? row.seq : 0
  },
}
