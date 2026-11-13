/**
 * plan.detail —— CloudContract['plan.detail'] → PlanDetail
 *
 * 与列表的差别只有一个：详情要全量 blocks / images / options，并带「我投了哪一票」。
 * 计划本体先读（不存在要立刻 3001，不必再发后面两次读），
 * 之后作者档案与投票记录互不依赖、并发发（§11.1）；
 * 计票数字直接吃 plans.vote 冗余字段，不在请求路径里做 count（3s 预算不允许，对账由 scheduler 兜）。
 *
 * status=3（软删）与不存在统一 3001：不给前端区分二者的义务，也不泄露「删过什么」。
 * 草稿（status=0）只对作者本人可见 —— 它不进任何列表，越权探测时按不存在处理。
 */
import {
  BizError,
  ErrorCode,
  PlanStatus,
  VoteType,
  fallbackAuthor,
  toPlanDetail,
  toUserInfo,
  userDao,
  voteDao,
  type ActionSpec,
} from 'common'
import { getLivePlan, readPlanId } from './writeShared'

export const detail: ActionSpec = {
  kind: 'read',
  run: async (payload, ctx) => {
    const planId = readPlanId(payload)
    const doc = await getLivePlan(planId)
    if (doc.status === PlanStatus.Draft && doc.openId !== ctx.openId) {
      throw new BizError(ErrorCode.NOT_FOUND, '该计划不存在或已被删除')
    }

    const now = Date.now()
    const [author, mine] = await Promise.all([
      userDao.getByOpenId(doc.openId),
      voteDao.myVote(planId, ctx.openId),
    ])
    // myVote：简单票 1|2 原样，选项票（type=0）/ 未投 → 0；myOption：选项票的 optionId，否则 ''（#60/#61）
    const myVote = mine && (mine.type === VoteType.Agree || mine.type === VoteType.Disagree) ? mine.type : 0
    const myOption = mine?.optionId ?? ''
    // 作者档案缺失（历史脏数据 / 未登录过的老作者）给占位身份，详情不能因此整页打不开
    return toPlanDetail(doc, author ? toUserInfo(author) : fallbackAuthor(doc.openId), myVote, now, myOption)
  },
}
