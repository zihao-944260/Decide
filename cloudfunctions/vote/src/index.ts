/**
 * vote 云函数入口（技术方案 §6.1：一个业务域 = 一个云函数，内部按 action 路由）。
 *
 * action 名是去掉域名前缀的短名（submit），与 src/api/request.ts 的 localAction() 输出逐字对应；
 * 契约只有 vote.submit 一条，出参必须是事务后的权威计数（§8.3 第 5 步）。
 */
import { createRouter, type ActionMap, type ApiResult } from 'common'
import { submit } from './handlers/submit'

const actions: ActionMap = {
  submit
}

const route = createRouter('vote', actions)

export async function main(event: unknown): Promise<ApiResult<unknown>> {
  return route(event)
}
