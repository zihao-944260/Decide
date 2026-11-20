/**
 * 错误码：数值与 `src/constants/error-code.ts` 完全一致（前端 request.ts 按这些数值分支）。
 * 语义见技术方案 §6.2 表格。
 */
export const ErrorCode = {
  OK: 0,
  INVALID_PARAM: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 2001,
  NOT_FOUND: 3001,
  PLAN_CLOSED: 3002,
  DUPLICATED: 3003,
  RATE_LIMITED: 4001,
  SERVER_ERROR: 5000
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * 业务异常：router 捕获后转成 ApiResult（code 非 0 + 可直接 toast 的中文 message）。
 * data 可选 —— 例如重复投票（3003）也要把权威计数带回前端纠偏。
 */
export class BizError extends Error {
  readonly code: ErrorCodeValue | number
  readonly data: unknown

  constructor(code: ErrorCodeValue | number, message: string, data?: unknown) {
    super(message)
    this.name = 'BizError'
    this.code = code
    this.data = data
  }
}

export function isBizError(err: unknown): err is BizError {
  return err instanceof BizError
}
