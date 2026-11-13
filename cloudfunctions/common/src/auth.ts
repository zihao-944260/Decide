/**
 * 鉴权与归属校验（技术方案 §6.3 / §11.3）。
 *
 * openId 只认 `cloud.getWXContext().OPENID`。payload 里出现的任何 openId 字段一律忽略，
 * 否则前端可以伪造身份投票 / 删他人评论 / 越权改计划。
 */
import * as cloud from 'wx-server-sdk'
import { BizError, ErrorCode } from './errors'

/** 缺失时返回空串（登录链路之外的 action 由 requireOpenId 抛 1002） */
export function getOpenId(): string {
  const ctx = cloud.getWXContext() as unknown as { OPENID?: string; AppID?: string }
  return typeof ctx.OPENID === 'string' ? ctx.OPENID : ''
}

export function requireOpenId(): string {
  const openId = getOpenId()
  if (!openId) throw new BizError(ErrorCode.UNAUTHORIZED, '登录状态已失效，请重新进入小程序')
  return openId
}

/** 计划归属：仅作者可编辑 / 删除 */
export function assertAuthor(plan: { openId?: string }, openId: string): void {
  if (plan.openId !== openId) throw new BizError(ErrorCode.FORBIDDEN, '只有发起人可以操作该计划')
}

/** 评论删除权限：评论作者本人或计划作者（§6.4） */
export function assertCommentDeleter(commentOpenId: string, planOpenId: string, openId: string): void {
  if (commentOpenId !== openId && planOpenId !== openId) {
    throw new BizError(ErrorCode.FORBIDDEN, '没有权限删除这条评论')
  }
}

/** 封禁 / 禁言用户不能写（status 见 src/constants/plan.ts 的 UserStatus 镜像） */
export function assertWritable(status: number, mutedIsEnough: boolean): void {
  if (status === 2) throw new BizError(ErrorCode.FORBIDDEN, '账号已被封禁，无法操作')
  if (mutedIsEnough && status === 1) throw new BizError(ErrorCode.FORBIDDEN, '账号已被禁言，暂时无法发布')
}
