/**
 * participations 冗余集合数据访问（技术方案 §8.7：「我参与的」= 投过票 **或** 评过论，不做聚合查询）。
 *
 * 为什么要在 common 里有一份：vote 与 comment 两个域原先各写了一个私有写入器（逻辑相同、只差注释），
 * 副本一旦分叉，plan.myList(joined) 的顺序就随「最后一个写它的域」漂移。这里收敛成唯一通路，
 * 消费方是 plan.myList(joined) 与 user.stats(joined)。
 *
 * 三条设计理由（语义与私有版本一致，只是换位置）：
 * 1. `_id = openId + '#' + planId`：确定性主键让同一用户对同一计划的多次动作天然收敛成一条记录，
 *    不依赖控制台唯一索引（SDK 建不了索引）；
 * 2. 写全程 best-effort：这是展示型冗余，写失败绝不能把 vote.submit / comment.create 的主链路带崩，
 *    只记 warn；漏记录的表现是「我参与的」少一条，用户再投/再评一次即补齐；
 * 3. 一次 get + 一次 set：set 是 upsert 语义，省掉「先判存在再分支 insert/update」的两步写法。
 *
 * 读侧必须容「集合不存在」：`participations` 尚未在控制台建表（CLI 建不了，见 §3.1），
 * 缺表时返回空页 / 0 并留一条 warn，而不是让「我参与的」和统计卡在上线当天直接 5000；
 * 建表之后无需改代码，同一个查询自动开始返回数据。
 */
import { Collection } from '../constants'
import { collection, getCommand, isCollectionMissing, rowOf, rowsOf, totalOf } from '../db'
import { log } from '../logger'
import type { Condition, UpdatePayload, WherePart } from '../types'

/** types 记录该用户对这个计划做过哪类动作（§8.7 只给了 `types: []` 没定义值域，此处取动作种类） */
export type ParticipationKind = 'vote' | 'comment'

interface ParticipationDoc {
  _id?: string
  openId: string
  planId: string
  lastActionAt: number
  types: string[]
}

/** 「我参与的」翻页游标带的三列：planId 用于回补计划，lastActionAt/_id 用于游标 */
export interface ParticipationCursorRow {
  _id: string
  planId: string
  lastActionAt: number
}

function participationId(openId: string, planId: string): string {
  return `${openId}#${planId}`
}

/** 缺表留痕：读路径只有这一种错误可以吞，其余照常抛出交给 router 记 5000 */
function warnMissingCollection(scene: string, openId: string, err: unknown): void {
  log.warn('participations 集合尚未在控制台建表，读路径暂返回空结果', {
    scene,
    openId,
    error: err instanceof Error ? err.message : String(err),
  })
}

export const participationDao = {
  async upsert(openId: string, planId: string, kind: ParticipationKind, now: number): Promise<void> {
    try {
      const ref = collection(Collection.Participations).doc(participationId(openId, planId))
      const existing = rowOf<ParticipationDoc>(await ref.get())
      const previous = existing?.types ?? []
      const data: UpdatePayload = {
        openId,
        planId,
        lastActionAt: now,
        types: previous.includes(kind) ? previous : [...previous, kind],
      }
      await ref.set({ data })
    } catch (err) {
      log.warn('participations 冗余写入失败（不影响主链路）', {
        planId,
        kind,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  /**
   * 「我参与的」翻页：顺序 = 我最后一次参与的时间（lastActionAt desc），次键 _id 打破同毫秒并列。
   * 游标锚点与 orderBy 用的是同一个字段，翻页不重不漏；limit 由调用方给 pageSize+1 判 hasMore。
   */
  async listByUser(
    openId: string,
    lastActionAt: number | null,
    afterId: string,
    limit: number,
  ): Promise<ParticipationCursorRow[]> {
    const cmd = getCommand()
    const base: Condition = { openId }
    const cond: WherePart =
      lastActionAt === null
        ? base
        : cmd.and(
            base,
            cmd.or(
              { lastActionAt: cmd.lt(lastActionAt) } as Condition,
              { lastActionAt, _id: cmd.lt(afterId) } as Condition,
            ),
          )
    try {
      const raw = await collection(Collection.Participations)
        .where(cond)
        .field({ planId: true, lastActionAt: true })
        .orderBy('lastActionAt', 'desc')
        .orderBy('_id', 'desc')
        .limit(limit)
        .get()
      return rowsOf<ParticipationCursorRow>(raw)
    } catch (err) {
      if (!isCollectionMissing(err)) throw err
      warnMissingCollection('「我参与的」列表', openId, err)
      return []
    }
  },

  /** user.stats 的 joined：一条记录 = 一个参与过的计划（_id 天然去重），所以记录数就是参与数 */
  async countByUser(openId: string): Promise<number> {
    try {
      const raw = await collection(Collection.Participations).where({ openId } as Condition).count()
      return totalOf(raw)
    } catch (err) {
      if (!isCollectionMissing(err)) throw err
      warnMissingCollection('「我参与的」统计', openId, err)
      return 0
    }
  },
}
