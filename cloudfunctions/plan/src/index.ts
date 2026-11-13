/**
 * plan 云函数入口（技术方案 §6.1：一个业务域 = 一个云函数，内部按 action 路由）。
 *
 * action 名是去掉域名前缀的短名（create / update / remove / detail / list / myList），
 * 与 src/api/request.ts 里 `localAction()` 的输出逐字对应。
 * 导出名必须是 `main`：编译产物 index.js 的 `exports.main` 就是云函数的调用入口。
 *
 * 契约里没有 plan.stats（§6.1 与 §6.4 冲突处已由主 agent 裁决归 user 域），这里不注册。
 */
import { createRouter, type ActionMap, type ApiResult } from 'common'
import { create } from './handlers/create'
import { detail } from './handlers/detail'
import { list } from './handlers/list'
import { myList } from './handlers/myList'
import { remove } from './handlers/remove'
import { update } from './handlers/update'

const actions: ActionMap = {
  create,
  update,
  remove,
  detail,
  list,
  myList,
}

const route = createRouter('plan', actions)

export async function main(event: unknown): Promise<ApiResult<unknown>> {
  return route(event)
}
