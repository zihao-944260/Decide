/**
 * plan.remove —— CloudContract['plan.remove']
 * `{ planId }` → `{ ok: true }`（§11.3：软删除 status=3）
 *
 * 为什么是软删：plans 上的 vote/commentCount 是别人投票与评论的权威冗余计数，
 * 物理删文档会让 votes/comments 变成孤儿、对账也无从下手；列表与详情用 status in [1,2] 过滤即可。
 * 重复删除走 3001（getLivePlan 把 Removed 一并当不存在），前端拿到就刷新列表，不会卡在死页。
 */
import { assertAuthor, planDao, type ActionSpec } from 'common'
import { getLivePlan, readPlanId } from './writeShared'

export const remove: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const planId = readPlanId(payload)
    const doc = await getLivePlan(planId)
    assertAuthor(doc, ctx.openId)
    // 只翻状态 + updatedAt：不动 blocks/options，将来做「回收站」还留得住原文
    await planDao.softRemove(planId, Date.now())
    return { ok: true }
  }
}
