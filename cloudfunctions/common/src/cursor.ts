/**
 * 游标编解码（技术方案 §6.5）。对前端是不透明 string，只有这里认识它的格式。
 *
 * 格式：`v1:<排序键>:<文档 _id>`，三段，Base64 编码（不暴露 openId / 计数等业务信息）。
 * - 列表：排序键 = createdAt（降序）、次键 _id 降序；
 * - 评论：排序键 = seq（升序）、次键 _id 升序。
 *
 * 为什么带上 _id：同一毫秒/同一 seq 可能有多条（并发写入、计数器竞态），
 * 只用排序键分页会重复或漏数据，必须带唯一次键打破平局。
 * 为什么加 `v1` 前缀：将来改排序键（如改成 deadline）可以双版本兼容老客户端。
 */
import { BizError, ErrorCode } from './errors'

const PREFIX = 'v1'

export interface Cursor {
  /** 排序主键：列表为 createdAt（ms），评论为 seq */
  readonly sort: number
  /** 排序次键：文档 _id */
  readonly id: string
}

export function encodeCursor(sort: number, id: string): string {
  return Buffer.from(`${PREFIX}:${sort}:${id}`, 'utf8').toString('base64')
}

/**
 * 解码失败一律当参数非法（1001）：前端只会回传服务端给的游标，
 * 解不出来说明被篡改或版本不匹配，静默退化成「第一页」反而会掩盖 bug。
 */
export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null
  let text: string
  try {
    text = Buffer.from(raw, 'base64').toString('utf8')
  } catch {
    throw new BizError(ErrorCode.INVALID_PARAM, '分页游标无效')
  }
  const parts = text.split(':')
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    throw new BizError(ErrorCode.INVALID_PARAM, '分页游标无效')
  }
  const sort = Number(parts[1])
  if (!Number.isFinite(sort)) throw new BizError(ErrorCode.INVALID_PARAM, '分页游标无效')
  return { sort, id: parts[2] }
}
