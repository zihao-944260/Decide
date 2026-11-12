import type { ErrorCodeValue } from '@/constants/error-code'

export interface ApiResult<T = unknown> {
  code: ErrorCodeValue | number
  message: string
  data: T
  serverTime: number
}

export interface PageResult<T> {
  list: T[]
  nextCursor: string
  hasMore: boolean
}

export interface PageQuery {
  cursor?: string
  pageSize?: number
}
