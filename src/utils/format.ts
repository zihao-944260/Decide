import { TICK_MINUTE, TICK_SECOND, type TickPrecision } from '@/utils/ticker'

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * 倒计时精度档位，档位名 = 当前文案里最低位的时间单位。
 * 分级降频表（技术方案 §8.5）在这里只描述「文案 + 该档需要的心跳周期」，
 * 定时器复用与降频执行由 utils/ticker.ts 负责，两者不要各处再写一份。
 */
export type CountdownLevel = 'day' | 'hour' | 'minute' | 'second' | 'ended'

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function countdownParts(remaining: number): CountdownParts {
  const left = remaining > 0 ? remaining : 0
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor(left / HOUR) % 24,
    minutes: Math.floor(left / MINUTE) % 60,
    seconds: Math.floor(left / SECOND) % 60
  }
}

export function countdownLevel(remaining: number): CountdownLevel {
  if (remaining <= 0) return 'ended'
  if (remaining < HOUR) return 'second'
  if (remaining < DAY) return 'minute'
  if (remaining <= WEEK) return 'hour'
  return 'day'
}

/** 该档需要的心跳周期；0 表示不用订阅定时器（静态档 / 终态档） */
export function countdownPrecision(level: CountdownLevel): TickPrecision {
  switch (level) {
    case 'second':
      return TICK_SECOND
    case 'hour':
    case 'minute':
      return TICK_MINUTE
    default:
      return 0
  }
}

export function formatCountdown(
  remaining: number,
  level: CountdownLevel = countdownLevel(remaining)
): string {
  const parts = countdownParts(remaining)
  switch (level) {
    case 'ended':
      return '已截止'
    case 'day':
      // 向上取整：还剩 7.2 天说「8 天后截止」比「7 天后」更符合直觉
      return `${Math.ceil(remaining / DAY)} 天后截止`
    case 'hour':
      return `${parts.days}天${parts.hours}小时`
    case 'minute':
      return `${Math.floor(remaining / HOUR)}小时${parts.minutes}分`
    case 'second':
      return `${pad2(Math.floor(remaining / MINUTE) % 60)}:${pad2(parts.seconds)}`
  }
}

/** 剩余占比（0~1），给比例条/环形进度用；span <= 0 时按已截止处理 */
export function remainingPercent(remaining: number, span: number): number {
  if (span <= 0) return remaining <= 0 ? 0 : 1
  const ratio = remaining / span
  return ratio < 0 ? 0 : ratio > 1 ? 1 : ratio
}

/**
 * 票数/数量占比（0~1）：`part / whole`，whole <= 0 一律给 0。
 * 与 remainingPercent 的区别是语义而不是算法 —— 剩余占比在 span 未知时会兜成 1（还没开始就满格），
 * 而 0 票必须算出 0%，否则比例条会出现 100% 的假共识。计数场景一律用这个。
 */
export function ratioPercent(part: number, whole: number): number {
  if (whole <= 0) return 0
  const ratio = part / whole
  return ratio < 0 ? 0 : ratio > 1 ? 1 : ratio
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

export function formatDate(ts: number, withYear = false): string {
  const d = new Date(ts)
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return withYear ? `${d.getFullYear()}-${md}` : md
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return `${formatDate(ts, true)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 相对时间。now 由调用方传入（utils 保持纯函数，时间源统一是 appStore.serverNow()），
 * 不读 Date.now()，避免本地改表导致「N 天前」错乱。
 */
export function relativeTime(ts: number, now: number): string {
  if (!ts || ts <= 0) return ''
  const diff = now - ts
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}小时前`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}天前`
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear()
  return formatDate(ts, !sameYear)
}

/** 数字缩写：列表脚注空间有限，万/亿一级够用（微信生态习惯，不做 k/M） */
export function compactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0'
  if (value < 10000) return String(Math.floor(value))
  if (value < 100000000) return trimZero((value / 10000).toFixed(1)) + '万'
  return trimZero((value / 100000000).toFixed(1)) + '亿'
}

function trimZero(text: string): string {
  return text.endsWith('.0') ? text.slice(0, -2) : text
}

/**
 * **长度上限的单一口径**：码点个数（代理对算 1，emoji 算 1），与云端
 * `common/src/validate.ts` 的 `maxLen()`（`Array.from(value).length`）逐字同语义。
 *
 * 为什么不能用 `textWidth()` 判上限：那个函数是**显示宽度**（ASCII 记 0.5），用来截字合适，
 * 拿来量长度会让 40 字上限实际放行约 80 个 ASCII —— 前端过了校验、云端回 1001，
 * 用户看到的是「我点了发布却说字段太长」。所以：展示截断用 `textWidth`/`truncate`，**限长一律用它**。
 */
export function countChars(text: string): number {
  return Array.from(text).length
}

/**
 * 按**码点**截断到 max 个字符，与 `countChars` 同一口径（限长的读与写必须是一对）。
 *
 * 为什么不能用 `String.prototype.slice`：它按 UTF-16 码元切，索引正好落在代理对中间时
 * 会留下半个 surrogate —— 那半串会跟着 payload 进云端存进库（`validate.ts:24` 用
 * `Array.from` 数码点，看不见这个坏字符），表现为标题里凭空出现一个乱码方块，且删不掉。
 * 顺带修正上限腰斩：`slice(0, 40)` 对全 emoji 标题只留下 20 个字符，而云端允许 40。
 */
export function clipChars(text: string, max: number): string {
  if (max <= 0) return ''
  const list = Array.from(text)
  return list.length <= max ? text : list.slice(0, max).join('')
}

/**
 * 显示宽度（以「一个中文字符 = 1」为单位，ASCII 记 0.5）。
 * Skyline 没有 line-clamp（实测 §2.2），多行截断只能按字宽预算用 JS 截字；
 * 这里刻意不做任何 boundingClientRect 测量 —— scroll-view type="list" 会虚拟化
 * 视口外节点，对视口外节点取矩形会永久挂起（实测 §2.3），列表内更是禁用。
 */
export function textWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    width += code > 0x2e80 ? 1 : 0.5
  }
  return width
}

/** 按显示宽度截断，超长补省略号 */
export function truncate(text: string, maxWidth: number, ellipsis = '…'): string {
  if (!text || maxWidth <= 0) return ''
  if (textWidth(text) <= maxWidth) return text
  const budget = maxWidth - textWidth(ellipsis)
  let acc = 0
  let out = ''
  for (const ch of text) {
    const w = textWidth(ch)
    if (acc + w > budget) break
    acc += w
    out += ch
  }
  return out.trimEnd() + ellipsis
}

/**
 * 多行截断：每行预算 charsPerLine 个中文字宽、共 lines 行。
 * 供摘要/标题在「不用 line-clamp」的前提下稳定占满指定行数。
 */
export function clipLines(
  text: string,
  charsPerLine: number,
  lines: number,
  ellipsis = '…'
): string {
  const max = charsPerLine * Math.max(1, lines)
  return truncate(text, max, ellipsis)
}

/** 换行折叠 + 去首尾空白，摘要/预览文案用 */
export function collapseSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 对象转 query string（分享路径、云函数透传参数用），自动 encodeURIComponent */
export function toQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const key of Object.keys(params)) {
    const value = params[key]
    if (value === undefined || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.join('&')
}

/** query string 解析（onLoad 收到的参数已被解码一次，这里不再解） */
export function parseQuery(query: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(query)) {
    const value = query[key]
    if (value !== undefined) out[key] = value
  }
  return out
}
