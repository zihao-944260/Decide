/**
 * 轻量入参校验（技术方案 §6.3）。规则集刻意很小：
 * 只做「类型 + 长度 + 枚举 + 数量 + fileID 形状」，业务语义校验留在 handler。
 *
 * 每个函数都做 `unknown → 具体类型` 的收窄并直接抛 1001，
 * 这样 handler 拿到的就是可信类型，不必再层层判空。
 */
import { BizError, ErrorCode } from './errors'

function fail(field: string, reason: string): never {
  throw new BizError(ErrorCode.INVALID_PARAM, `${field}${reason}`)
}

/** 必填：非 null/undefined 且非空串 */
export function required(value: unknown, field: string): unknown {
  if (value === null || value === undefined) fail(field, '不能为空')
  if (typeof value === 'string' && value.trim() === '') fail(field, '不能为空')
  if (Array.isArray(value) && value.length === 0) fail(field, '不能为空')
  return value
}

export function maxLen(value: string, field: string, max: number): string {
  // 中文按码点计长：Array.from 展开代理对，避免 emoji 让 40 字上限虚高
  if (Array.from(value).length > max) fail(field, `不能超过 ${max} 字`)
  return value
}

export function inEnum<T>(value: unknown, field: string, allowed: readonly T[]): T {
  const hit = allowed.find((item) => (item as unknown) === value)
  if (hit === undefined) fail(field, '取值不在允许范围内')
  return hit
}

/**
 * 图片必须是云存储 fileID：`cloud://` 开头。
 * 只认 fileID 有两个作用 —— ① 防外链图片绕过内容安全审核；② 保证后续能取临时 URL 送审。
 */
export function isImageFileID(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.startsWith('cloud://') &&
    value.length > 16 &&
    value.length < 512
  )
}

export function arrayMax(value: unknown, field: string, max: number): readonly unknown[] {
  if (!Array.isArray(value)) fail(field, '格式必须是数组')
  if (value.length > max) fail(field, `最多 ${max} 个`)
  return value
}

// === 收窄助手（handler 直接用，保证入参类型可信） ===

export function asString(value: unknown, field: string, max: number): string {
  const raw = required(value, field)
  if (typeof raw !== 'string') fail(field, '格式必须是文本')
  return maxLen(raw.trim(), field, max)
}

export function asOptionalString(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') fail(field, '格式必须是文本')
  return maxLen(value.trim(), field, max)
}

/** 允许 '' —— 头像/配图这类「可空但必须合法」的字段用 */
export function asStringAllowEmpty(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') fail(field, '格式必须是文本')
  return maxLen(value.trim(), field, max)
}

export function asNumber(value: unknown, field: string): number {
  const raw = required(value, field)
  const num = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(num)) fail(field, '格式必须是数字')
  return num
}

export function asBoolean(value: unknown, field: string): boolean {
  const raw = required(value, field)
  if (typeof raw === 'boolean') return raw
  if (raw === 1 || raw === '1') return true
  if (raw === 0 || raw === '0') return false
  fail(field, '格式必须是布尔值')
}

export function asRecord(value: unknown, field: string): Record<string, unknown> {
  const raw = required(value, field)
  if (typeof raw !== 'object' || Array.isArray(raw)) fail(field, '格式必须是对象')
  return raw as Record<string, unknown>
}

export function asArray(value: unknown, field: string, max: number): readonly unknown[] {
  return arrayMax(required(value, field), field, max)
}

/**
 * 图片 fileID 列表。allowEmpty=true 时允许空串占位（选项图可留空），
 * 计划配图则必须 allowEmpty=false —— 空串会让 mediaCheckAsync 拿到无效 URL。
 */
export function asFileIDList(
  value: unknown,
  field: string,
  max: number,
  allowEmpty: boolean
): string[] {
  const list = asArray(value, field, max)
  const out: string[] = []
  for (const item of list) {
    if (typeof item !== 'string') fail(field, '格式必须是文件 ID 列表')
    if (item === '') {
      if (!allowEmpty) fail(field, '不能为空图片')
      out.push('')
      continue
    }
    if (!isImageFileID(item)) fail(field, '只能使用小程序上传的图片')
    out.push(item)
  }
  return out
}

/** pageSize：默认 10、上限 20（§6.5） */
export function asPageSize(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const num = asNumber(value, 'pageSize')
  if (num <= 0) return fallback
  return Math.min(Math.floor(num), max)
}
