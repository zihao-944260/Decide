import type { RequestOptions } from '@/api/request'
import { request } from '@/api/request'
import type { CloudContract } from '@/types/cloud'
import type { UserInfo, UserStats } from '@/types/models'

/**
 * 用户域接口。契约见 CloudContract['user.*']，参数/返回类型直接取自契约，
 * 避免手抄字段导致前后端漂移。options 透传给 request（乐观更新场景需要 silent）。
 */

export function login(
  params: CloudContract['user.login']['req'] = {},
  options?: RequestOptions
): Promise<{ userInfo: UserInfo; isNew: boolean }> {
  return request('user.login', params, options)
}

export function updateProfile(
  params: CloudContract['user.updateProfile']['req'],
  options?: RequestOptions
): Promise<{ userInfo: UserInfo }> {
  return request('user.updateProfile', params, options)
}

export function fetchStats(options?: RequestOptions): Promise<UserStats> {
  return request('user.stats', {}, options)
}
