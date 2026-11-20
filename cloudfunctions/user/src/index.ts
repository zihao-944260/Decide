/**
 * user 云函数入口（技术方案 §6.1：一个业务域 = 一个云函数，内部按 action 路由）。
 *
 * action 名是去掉域名前缀的短名（login / updateProfile / stats），
 * 与 src/api/request.ts 里 `localAction()` 的输出逐字对应。
 * 导出名必须是 `main`：编译产物 index.js 的 `exports.main` 就是云函数的调用入口。
 */
import { createRouter, type ActionMap, type ApiResult } from 'common'
import { login } from './handlers/login'
import { stats } from './handlers/stats'
import { updateProfile } from './handlers/updateProfile'

const actions: ActionMap = {
  login,
  updateProfile,
  stats
}

const route = createRouter('user', actions)

export async function main(event: unknown): Promise<ApiResult<unknown>> {
  return route(event)
}
