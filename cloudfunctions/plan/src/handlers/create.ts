/**
 * plan.create —— CloudContract['plan.create']
 * `{ title, blocks, images, deadline, optionsEnabled, options }` → `{ planId }`
 *
 * 校验顺序是刻意的（§11.3 + 3s 超时）：
 * 1. 纯本地校验（normalizePlanWrite + 选项数）—— 非法请求一个 DB/外网请求都不发；
 * 2. 身份与可写状态 —— 一次 users 读；
 * 3. 文本送审 —— 先审后发，命中违规必须在写库之前拦截；
 * 4. 写 plans（status=1）；
 * 5. 图片送审 —— 先发后审，只能在写成功后做，且超预算就跳过（见 writeShared 注释）。
 */
import { planDao, type ActionSpec } from 'common'
import {
  assertPlanCreated,
  buildPlanDoc,
  planContentFields,
  requireWritableUser,
  reviewImages,
  reviewText,
  validatePlanWrite,
} from './writeShared'

export const create: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const { openId, startedAt } = ctx
    const now = Date.now()
    const normalized = validatePlanWrite(payload, now)
    await requireWritableUser(openId)
    await reviewText(openId, normalized.payload, startedAt)

    // openId 只来自 getWXContext（router 已保证非空），payload 里的任何 openId 字段都不读
    const planId = await planDao.create(buildPlanDoc(openId, now, planContentFields(normalized)))
    assertPlanCreated(planId)
    await reviewImages(openId, normalized.payload, ctx)
    return { planId }
  },
}
