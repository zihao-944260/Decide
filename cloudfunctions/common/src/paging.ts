/**
 * 游标分页的统一装配（技术方案 §6.5）。
 *
 * 约定：dao 一律多取一条（limit = pageSize + 1），
 * 靠「是否取满 + 1」判断 hasMore，避免额外的 count 往返（3s 超时下很值）。
 */
import { Limit } from './constants'
import { decodeCursor, encodeCursor, type Cursor } from './cursor'
import { asPageSize } from './validate'
import type { PageResult } from './types'

export interface PageArgs {
  readonly cursor: Cursor | null
  readonly size: number
  /** 交给 dao 的 limit */
  readonly limit: number
}

export function readPageArgs(
  payload: Record<string, unknown>,
  max: number = Limit.PAGE_SIZE_MAX,
  defaultSize: number = Limit.PAGE_SIZE
): PageArgs {
  const size = asPageSize(payload.pageSize, defaultSize, max)
  const raw = typeof payload.cursor === 'string' ? payload.cursor : ''
  return { cursor: decodeCursor(raw), size, limit: size + 1 }
}

/** 行 → 游标锚点：列表用 createdAt，评论用 seq，次键都是 _id */
export type CursorOf<T> = (row: T) => { sort: number; id: string }

export function buildPage<T>(
  fetched: readonly T[],
  args: PageArgs,
  cursorOf: CursorOf<T>
): PageResult<T> {
  const hasMore = fetched.length > args.size
  const list = hasMore ? fetched.slice(0, args.size) : fetched.slice()
  const tail = list.length === 0 ? null : cursorOf(list[list.length - 1])
  return {
    list,
    // 没有更多时返回空串而不是旧游标：前端 usePagingList 以 hasMore 为准，空串能防止复用过期游标
    nextCursor: tail === null ? '' : encodeCursor(tail.sort, tail.id),
    hasMore
  }
}
