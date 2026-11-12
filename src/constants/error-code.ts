export const ErrorCode = {
  OK: 0,
  INVALID_PARAM: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 2001,
  NOT_FOUND: 3001,
  PLAN_CLOSED: 3002,
  DUPLICATED: 3003,
  RATE_LIMITED: 4001,
  SERVER_ERROR: 5000,
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]
