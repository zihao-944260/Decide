/**
 * users 集合数据访问（技术方案 §5.1）。
 *
 * `_id` 直接用 openId：
 * 1. 登录即 upsert，不需要「先查再写」两次往返（3s 超时下很实在）；
 * 2. 天然防并发重复建档（_id 唯一是数据库内建的，不依赖控制台索引）。
 * `openId` 字段仍然冗余保留，方便按字段查询与后续迁移。
 */
import { Collection } from '../constants'
import { collection, getCommand, rowOf, rowsOf, updatedOf } from '../db'
import type { Condition, UserDoc } from '../types'

/** 列表拼作者时只需要这些字段（stats 是冗余展示值，不参与任何判定） */
const AUTHOR_FIELDS: Record<string, boolean> = {
  openId: true,
  nickName: true,
  avatarUrl: true,
  status: true,
  stats: true,
  createdAt: true,
  updatedAt: true,
}

export const userDao = {
  async getByOpenId(openId: string): Promise<UserDoc | null> {
    const raw = await collection(Collection.Users).doc(openId).get()
    return rowOf<UserDoc>(raw)
  },

  /**
   * 批量取作者：一次 in 查询，避免 N+1（首页 10 条计划可能就是 10 个作者）。
   * 返回值按 openId 建索引，缺失的用 fallbackAuthor 兜底。
   */
  async mapByOpenIds(openIds: readonly string[]): Promise<Record<string, UserDoc>> {
    if (openIds.length === 0) return {}
    const cmd = getCommand()
    const raw = await collection(Collection.Users)
      .where({ openId: cmd.in([...openIds]) } as Condition)
      .field(AUTHOR_FIELDS)
      .limit(openIds.length)
      .get()
    const rows = rowsOf<UserDoc>(raw)
    const map: Record<string, UserDoc> = {}
    for (const row of rows) map[row.openId] = row
    return map
  },

  /** 建档：_id=openId，重复建档会抛唯一冲突，由 handler 兜成「已存在」 */
  async create(doc: UserDoc): Promise<void> {
    await collection(Collection.Users).add({ data: { ...doc, _id: doc.openId } })
  },

  /** 更新走 doc(openId)：_id 即 openId，一次写到位，不用先查再改 */
  async update(openId: string, data: Record<string, unknown>): Promise<number> {
    const raw = await collection(Collection.Users).doc(openId).update({ data })
    return updatedOf(raw)
  },
}
