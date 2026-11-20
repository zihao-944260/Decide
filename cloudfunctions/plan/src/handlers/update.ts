/**
 * plan.update —— CloudContract['plan.update']
 * `{ planId, ...同 create }` → `{ ok: true }`（§6.1：仅作者，草稿/进行中可改）
 *
 * 与 create 共用同一套校验与审核时序（writeShared），差别只有两处：
 * 1. 先读计划本体，才能做归属/状态判定，并把旧 deadline 作为「允许原样保留」的值传进校验；
 * 2. 写的是整组内容字段替换，不碰 status 与计数冗余（计数只能由 vote/comment 原子自增）。
 */
import { assertAuthor, planDao, type ActionSpec } from 'common'
import {
  assertPlanUpdatable,
  buildPlanPatch,
  getLivePlan,
  planContentFields,
  readPlanId,
  requireWritableUser,
  reviewImages,
  reviewText,
  validatePlanWrite
} from './writeShared'

export const update: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const { openId, startedAt } = ctx
    const planId = readPlanId(payload)
    const now = Date.now()

    // 计划与作者档案互不依赖，并发读省一次往返（3s 预算下很实在）
    const [doc] = await Promise.all([getLivePlan(planId), requireWritableUser(openId)])
    assertAuthor(doc, openId)
    // 已截止（含 scheduler 还没翻状态的惰性窗口）只读；软删不允许被编辑复活
    assertPlanUpdatable(doc, now)

    const normalized = validatePlanWrite(payload, now, doc.deadline)
    await reviewText(openId, normalized.payload, startedAt)
    await planDao.updateContent(planId, buildPlanPatch(planContentFields(normalized), now))

    // 内容变了就重新送审：改一次文案不能把上一版违规图片洗白
    await reviewImages(openId, normalized.payload, ctx)

    // dao 返回的 updated=0 不算失败：内容与库里完全相同时数据库也可能报 0 条修改，
    // 而上面已经确认过文档存在且可编辑，这里报错只会让前端误判成「没保存」。
    // status 也不在这里翻：已截止的计划上面已经拦掉，1 → 2 的翻转只交给 scheduler（§6.7），
    // 读路径的「惰性截止」由 mapper.effectiveStatus 折算，不需要写路径配合。
    return { ok: true }
  }
}
