/**
 * action 路由（技术方案 §6.2 / §6.3）。
 *
 * 线格式由 `src/api/request.ts` 决定，必须逐字节对上：
 * `{ action: 'login', payload: { ... } }` —— action 是**去掉域名前缀的短名**
 * （request.ts 的 localAction 做了 `action.slice(action.indexOf('.') + 1)`），
 * 业务参数一律包在 payload 里。所以这里的 handler 表用短名做 key。
 *
 * 出口只有一个：永远返回 ApiResult，绝不向运行时抛异常。
 * request.ts 会检查 `typeof result.code !== 'number'` 并判定为「云端返回格式异常」，
 * 抛出未捕获异常会让 callFunction 直接 fail，前端拿不到可分流的错误码。
 */
import { getOpenId } from './auth'
import { initCloud } from './db'
import { BizError, ErrorCode } from './errors'
import { log, shortOpenId } from './logger'
import { assertWriteQuota } from './ratelimit'
import type { ApiResult } from './types'

export interface ActionContext {
  readonly fn: string
  readonly action: string
  /** 只来自 getWXContext，payload 里的 openId 一律忽略 */
  readonly openId: string
  readonly startedAt: number
}

export type ActionRun = (
  payload: Record<string, unknown>,
  ctx: ActionContext
) => Promise<unknown> | unknown

export interface ActionSpec {
  /** write 会走「5 次/10s」限流（§11.3），read 不限流 */
  readonly kind: 'read' | 'write'
  readonly run: ActionRun
}

export type ActionMap = Record<string, ActionSpec>

function result(
  code: number,
  message: string,
  data: unknown,
  serverTime: number
): ApiResult<unknown> {
  return { code, message, data, serverTime }
}

/**
 * 把未知异常翻译成对用户友好的 5000。
 * 原始信息只进日志，不外泄 —— message 里可能含集合名、内部 id、微信接口错误串。
 */
function toFailure(err: unknown): { code: number; message: string; data: unknown } {
  if (err instanceof BizError)
    return { code: err.code, message: err.message, data: err.data ?? null }
  return { code: ErrorCode.SERVER_ERROR, message: '服务开小差了，请稍后重试', data: null }
}

function isDatabaseMissing(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /not exist|不存在|collection iis?name/i.test(message) || message.includes('-502005')
}

export function createRouter(
  fn: string,
  actions: ActionMap
): (event: unknown) => Promise<ApiResult<unknown>> {
  // 每个函数入口只做一次：环境动态解析 + 关掉「读不到文档就抛异常」的默认行为
  initCloud()

  return async function handle(event: unknown): Promise<ApiResult<unknown>> {
    const startedAt = Date.now()
    const openId = getOpenId()
    let action = ''
    let code: number = ErrorCode.SERVER_ERROR
    let message = ''
    let data: unknown = null

    try {
      const body = (event && typeof event === 'object' ? event : {}) as Record<string, unknown>
      action = typeof body.action === 'string' ? body.action : ''
      const raw = body.payload
      const payload: Record<string, unknown> =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {}

      if (!action) throw new BizError(ErrorCode.INVALID_PARAM, '缺少接口动作')
      const spec = actions[action]
      if (!spec) throw new BizError(ErrorCode.NOT_FOUND, `不支持的操作：${fn}.${action}`)
      if (!openId) throw new BizError(ErrorCode.UNAUTHORIZED, '登录状态已失效，请重新进入小程序')

      if (spec.kind === 'write') assertWriteQuota(openId, `${fn}.${action}`, startedAt)

      data = await spec.run(payload, { fn, action, openId, startedAt })
      code = ErrorCode.OK
      message = 'ok'
    } catch (err) {
      const failure = toFailure(err)
      code = failure.code
      message = failure.message
      data = failure.data
      if (code === ErrorCode.SERVER_ERROR) {
        log.error(isDatabaseMissing(err) ? '集合或资源不存在' : '云函数执行异常', {
          fn,
          action,
          openId: shortOpenId(openId),
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        })
      }
    }

    const elapsed = Date.now() - startedAt
    const fields = { fn, action, openId: shortOpenId(openId), code, elapsed }
    if (code === ErrorCode.OK) log.info('云函数调用', fields)
    else if (code < ErrorCode.SERVER_ERROR) log.warn('云函数业务拒绝', fields)

    // 接近 3s 的调用记一条：默认超时就是 3s，这类请求是控制台调参的第一批候选
    if (elapsed > 2000) log.warn('云函数耗时接近超时上限', { ...fields, elapsed })

    return result(code, message, data, Date.now())
  }
}
