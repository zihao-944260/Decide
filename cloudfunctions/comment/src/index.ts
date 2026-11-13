/**
 * comment 云函数入口（技术方案 §6.1：一个业务域 = 一个云函数，内部按 action 路由）。
 *
 * action 名是去掉域名前缀的短名（create / list / remove），与 src/api/request.ts 的 localAction()
 * 输出逐字对应；三条都要精确覆盖 CloudContract 的 comment 域。
 */
import { createRouter, type ActionMap, type ApiResult } from 'common'
import { create } from './handlers/create'
import { list } from './handlers/list'
import { remove } from './handlers/remove'

const actions: ActionMap = {
  create,
  list,
  remove,
}

const route = createRouter('comment', actions)

export async function main(event: unknown): Promise<ApiResult<unknown>> {
  return route(event)
}
