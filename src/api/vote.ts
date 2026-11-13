import type { RequestOptions } from '@/api/request'
import { request } from '@/api/request'
import type { VoteTypeValue } from '@/constants/plan'
import type { PlanOption, VoteCounts } from '@/types/models'

/**
 * 投票域接口。返回值是服务端事务后的权威计数，
 * 调用方（useVote / planStore）必须以它覆盖本地乐观值（技术方案 §8.3）。
 * 二选一：optionId 非空 = 选项表决；否则 type=1|2 简单表决。投过即锁定（改票回 3003）。
 */
export interface VoteSubmitPayload {
  type?: VoteTypeValue
  optionId?: string
}

export interface VoteSubmitResult {
  votes: VoteCounts
  myVote: number
  options: PlanOption[]
  myOption: string
}

export function submitVote(
  planId: string,
  payload: VoteSubmitPayload,
  options?: RequestOptions,
): Promise<VoteSubmitResult> {
  return request('vote.submit', { planId, ...payload }, options)
}