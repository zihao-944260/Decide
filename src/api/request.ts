import { ErrorCode } from '@/constants/error-code'
import { useAppStore } from '@/stores/app'
import type { ApiResult } from '@/types/api'
import {
  functionNameOf,
  IDEMPOTENT_ACTIONS,
  type CloudAction,
  type CloudContract,
  type CloudEvent,
} from '@/types/cloud'
import { logger } from '@/utils/logger'

const TIMEOUT = 8000
const TAG = 'api'

export interface RequestOptions {
  /** 不自动 toast，错误交调用方处理（乐观更新回滚场景） */
  silent?: boolean
  /** 不做并发去重（同一 action 需要并发多次调用时） */
  noDedupe?: boolean
}

export class ApiError extends Error {
  readonly code: number
  readonly action: string
  /**
   * 传输层原文（`wx.cloud.callFunction` 的 errMsg、被抛出的非 ApiError 值）。
   * 里面有 callId / trace / 文档链接，长度和措辞都不适合上屏，只供日志与排查；
   * `message` 才是可以给用户看的那句。
   */
  readonly detail: string

  constructor(code: number, message: string, action: string, detail = '') {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.action = action
    this.detail = detail
  }
}

type UnauthorizedHandler = () => Promise<void>
type ErrorReporter = (error: ApiError) => void

let unauthorizedHandler: UnauthorizedHandler | null = null
let errorReporter: ErrorReporter | null = null
const inflight = new Map<string, Promise<never>>()

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler
}

export function setErrorReporter(reporter: ErrorReporter): void {
  errorReporter = reporter
}

function toast(message: string): void {
  uni.showToast({ title: message, icon: 'none', duration: 2000 })
}

function localAction(action: CloudAction): string {
  return action.slice(action.indexOf('.') + 1)
}

type CallFunctionParam = Parameters<typeof wx.cloud.callFunction>[0]

function rawCall<A extends CloudAction>(
  action: A,
  data: CloudContract[A]['req'],
): Promise<ApiResult<CloudContract[A]['res']>> {
  return new Promise((resolve, reject) => {
    const event: CloudEvent<CloudContract[A]['req']> = { action: localAction(action), payload: data }
    // miniprogram-api-typings 没有声明 callFunction 的 timeout（运行时支持），按真实字段收敛一次
    const param = {
      name: functionNameOf(action),
      data: event as unknown as Record<string, unknown>,
      timeout: TIMEOUT,
      success: (res: { result?: unknown }) => {
        const result = res.result as ApiResult<CloudContract[A]['res']> | undefined
        if (!result || typeof result.code !== 'number') {
          reject(new ApiError(ErrorCode.SERVER_ERROR, '云端返回格式异常', action))
          return
        }
        resolve(result)
      },
      fail: (err: { errMsg?: string }) => {
        const detail = err.errMsg || ''
        // 原文进日志，页面上只给这一句：否则用户会在重试态里读到 callId 和 trace
        logger.error(TAG, `${action} 传输失败`, detail)
        reject(new ApiError(ErrorCode.SERVER_ERROR, '网络异常，请稍后重试', action, detail))
      },
    }
    wx.cloud.callFunction(param as unknown as CallFunctionParam)
  })
}

function syncTime(serverTime: number): void {
  if (typeof serverTime === 'number' && serverTime > 0) {
    useAppStore().timeOffset = serverTime - Date.now()
  }
}

async function callOnce<A extends CloudAction>(
  action: A,
  data: CloudContract[A]['req'],
  options: RequestOptions,
  allowUnauthorizedRetry: boolean,
  allowTimeoutRetry: boolean,
): Promise<CloudContract[A]['res']> {
  const startedAt = Date.now()
  try {
    const result = await rawCall(action, data)
    syncTime(result.serverTime)
    logger.debug(TAG, action, `${Date.now() - startedAt}ms`, result.code)

    if (result.code === ErrorCode.OK) return result.data

    const error = new ApiError(result.code, result.message || '请求失败', action)

    if (result.code === ErrorCode.UNAUTHORIZED) {
      if (allowUnauthorizedRetry && unauthorizedHandler) {
        await unauthorizedHandler()
        return callOnce(action, data, options, false, allowTimeoutRetry)
      }
      throw error
    }

    if (result.code === ErrorCode.DUPLICATED) throw error

    if (result.code >= ErrorCode.SERVER_ERROR) {
      logger.error(TAG, action, result.message)
      errorReporter?.(error)
    }

    if (!options.silent) toast(error.message)
    throw error
  } catch (err) {
    const apiError =
      err instanceof ApiError
        ? err
        : new ApiError(ErrorCode.SERVER_ERROR, '网络异常，请稍后重试', action, String(err))
    const retriable =
      apiError.code === ErrorCode.SERVER_ERROR && allowTimeoutRetry && IDEMPOTENT_ACTIONS.includes(action)
    if (retriable) {
      logger.warn(TAG, `${action} 重试一次`)
      return callOnce(action, data, options, allowUnauthorizedRetry, false)
    }
    if (!(err instanceof ApiError) && !options.silent) toast(apiError.message)
    throw apiError
  }
}

/**
 * 唯一云端出口（技术方案 §7.1）。页面与组件不直接调 wx.cloud，也不感知 action 字符串。
 */
export function request<A extends CloudAction>(
  action: A,
  data: CloudContract[A]['req'],
  options: RequestOptions = {},
): Promise<CloudContract[A]['res']> {
  const task = () => callOnce(action, data, options, true, true)

  if (options.noDedupe) return task()

  const key = `${action}:${JSON.stringify(data ?? {})}`
  const flying = inflight.get(key)
  if (flying) return flying as Promise<CloudContract[A]['res']>

  const promise = task().finally(() => inflight.delete(key)) as unknown as Promise<never>
  inflight.set(key, promise)
  return promise as unknown as Promise<CloudContract[A]['res']>
}
