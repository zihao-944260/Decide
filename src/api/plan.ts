import type { RequestOptions } from '@/api/request'
import { request } from '@/api/request'
import type { MyFilter } from '@/constants/plan'
import type { PageQuery, PageResult } from '@/types/api'
import type { CloudContract, PlanWritePayload } from '@/types/cloud'
import type { PlanDetail, PlanSummary } from '@/types/models'

/** 计划域接口。游标为不透明 string，前端只透传不解析（契约注释约定）。 */

export function createPlan(
  payload: PlanWritePayload,
  options?: RequestOptions
): Promise<{ planId: string }> {
  return request('plan.create', payload, options)
}

export function updatePlan(
  payload: PlanWritePayload & { planId: string },
  options?: RequestOptions
): Promise<{ ok: true }> {
  return request('plan.update', payload, options)
}

export function removePlan(planId: string, options?: RequestOptions): Promise<{ ok: true }> {
  return request('plan.remove', { planId }, options)
}

export function fetchPlanDetail(planId: string, options?: RequestOptions): Promise<PlanDetail> {
  return request('plan.detail', { planId }, options)
}

export function fetchPlanList(
  query: PageQuery = {},
  options?: RequestOptions
): Promise<PageResult<PlanSummary>> {
  return request('plan.list', query, options)
}

export function fetchMyPlans(
  query: PageQuery & { filter: MyFilter },
  options?: RequestOptions
): Promise<PageResult<PlanSummary>> {
  return request('plan.myList', query as CloudContract['plan.myList']['req'], options)
}
