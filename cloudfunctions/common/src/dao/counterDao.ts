/**
 * counters 集合数据访问（技术方案 §5.5）。
 *
 * 云数据库没有原生自增序列，评论 `seq` 靠 `{ _id: 'comment:{planId}', value }` 自增读回。
 * 这里用**事务**而不是「inc + 读回」两次独立请求：
 * 后者在并发下两个请求可能读到同一个值，导致同一条计划出现重复 seq，
 * 评论顺序展示（§8.4）就会出现两条并列的记录。事务里读-改-写是原子的，
 * 冲突时数据库回滚其中一个，由调用方重试一次即可。
 *
 * 另外复用同一张表存对账游标（marker 字段），避免为 scheduler 再开一个集合。
 */
import { Collection } from '../constants'
import { collection, getCommand, rowOf, startTransaction, updatedOf } from '../db'
import { log } from '../logger'
import type { CounterDoc, UpdatePayload } from '../types'

export function commentSeqKey(planId: string): string {
  return `comment:${planId}`
}

export const RECONCILE_CURSOR_KEY = 'reconcile:cursor'

async function rollbackQuiet(tx: { rollback(reason?: unknown): Promise<unknown> }, err: unknown): Promise<void> {
  try {
    await tx.rollback(err)
  } catch (rollbackErr) {
    // 回滚失败通常是事务已结束（超时/已提交），继续抛原始错误更有诊断价值
    log.warn('transaction.rollback 失败', { error: String(rollbackErr) })
  }
}

export const counterDao = {
  /**
   * 取评论顺序号。首次写入时事务里的 doc.set 直接落 value=1，
   * 所以不需要「先补一条 counter 文档再 inc」这种两步写法。
   */
  async nextSeq(key: string): Promise<number> {
    const tx = await startTransaction()
    try {
      const raw = await tx.collection(Collection.Counters).doc(key).get()
      const current = rowOf<CounterDoc>(raw)
      const next = (current?.value ?? 0) + 1
      await tx.collection(Collection.Counters).doc(key).set({ data: { value: next, updatedAt: Date.now() } })
      await tx.commit()
      return next
    } catch (err) {
      await rollbackQuiet(tx, err)
      throw err
    }
  },

  async getMarker(key: string): Promise<string> {
    const raw = await collection(Collection.Counters)
      .where({ _id: key })
      .field({ marker: true })
      .limit(1)
      .get()
    return rowOf<{ marker?: string }>(raw)?.marker ?? ''
  },

  /** 对账游标写回：文档可能不存在，用 doc().set() 一次搞定 upsert */
  async setMarker(key: string, marker: string): Promise<number> {
    const data: UpdatePayload = { marker, updatedAt: Date.now() }
    const raw = await collection(Collection.Counters).doc(key).set({ data })
    return updatedOf(raw)
  },

  /** scheduler 每批之间让出时间片：游标推进失败也不能把已算好的结果丢掉 */
  async advanceMarker(key: string, marker: string): Promise<void> {
    try {
      await this.setMarker(key, marker)
    } catch (err) {
      log.warn('对账游标写回失败（下一轮会重复处理这一段）', { key, marker, error: String(err) })
    }
  },

  /** 计数兜底：counters 文档被误清时按评论表的 maxSeq 重新播种 */
  async seed(key: string, value: number): Promise<void> {
    const cmd = getCommand()
    const raw = await collection(Collection.Counters)
      .doc(key)
      .update({ data: { value: cmd.set(value), updatedAt: Date.now() } as UpdatePayload })
    updatedOf(raw)
  },
}
