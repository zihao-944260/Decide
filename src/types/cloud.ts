import type { MyFilter, VoteTypeValue } from '@/constants/plan'
import type { PageQuery, PageResult } from '@/types/api'
import type {
  Block,
  CommentItem,
  PlanDetail,
  PlanOption,
  PlanSummary,
  UserInfo,
  UserStats,
  VoteCounts
} from '@/types/models'

export type CloudFunctionName = 'user' | 'plan' | 'vote' | 'comment'

export interface PlanWritePayload {
  title: string
  blocks: Block[]
  images: string[]
  deadline: number
  optionsEnabled: boolean
  options: PlanOption[]
}

/**
 * 前后端唯一契约。云函数 action 与前端 api/*.ts 都以此为准，
 * 新增接口先改这里，两端同时获得类型约束。
 * 游标统一为不透明 string（列表 = createdAt+_id，评论 = seq），前端不解析。
 */
export interface CloudContract {
  'user.login': {
    req: { nickName?: string; avatarUrl?: string }
    res: { userInfo: UserInfo; isNew: boolean }
  }
  'user.updateProfile': {
    req: { nickName: string; avatarUrl: string }
    res: { userInfo: UserInfo }
  }
  'user.stats': {
    req: Record<string, never>
    res: UserStats
  }
  'plan.create': {
    req: PlanWritePayload
    res: { planId: string }
  }
  'plan.update': {
    req: PlanWritePayload & { planId: string }
    res: { ok: true }
  }
  'plan.remove': {
    req: { planId: string }
    res: { ok: true }
  }
  'plan.detail': {
    req: { planId: string }
    res: PlanDetail
  }
  'plan.list': {
    req: PageQuery
    res: PageResult<PlanSummary>
  }
  'plan.myList': {
    req: PageQuery & { filter: MyFilter }
    res: PageResult<PlanSummary>
  }
  'vote.submit': {
    // 二选一：optionId 非空 = 选项表决（type 忽略）；否则 type=1|2 简单表决。投过即锁定，改票回 3003
    req: { planId: string; type?: VoteTypeValue; optionId?: string }
    res: { votes: VoteCounts; myVote: number; options: PlanOption[]; myOption: string }
  }
  'comment.create': {
    req: { planId: string; content: string }
    res: { comment: CommentItem }
  }
  'comment.list': {
    req: { planId: string } & PageQuery
    res: PageResult<CommentItem>
  }
  'comment.remove': {
    req: { commentId: string }
    res: { ok: true }
  }
}

export type CloudAction = keyof CloudContract

/** 云函数入参线格式：action 用去掉域名前缀的短名，业务参数一律放在 payload 里 */
export interface CloudEvent<P = unknown> {
  action: string
  payload: P
}

/** 幂等 action：超时后可安全重试一次（技术方案 §7.1 第 5 条） */
export const IDEMPOTENT_ACTIONS: readonly CloudAction[] = [
  'plan.detail',
  'plan.list',
  'plan.myList',
  'user.stats',
  'comment.list'
] as const

export function functionNameOf(action: CloudAction): CloudFunctionName {
  return action.slice(0, action.indexOf('.')) as CloudFunctionName
}
