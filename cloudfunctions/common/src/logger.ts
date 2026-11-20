/**
 * 统一日志（技术方案 §11.3 最后一条：打印 openId / action / 耗时 / code）。
 * 云函数日志是线上唯一可观测入口，字段名保持稳定便于控制台检索。
 */
import * as cloud from 'wx-server-sdk'

interface StructuredLogger {
  info(object: Record<string, unknown>): void
  warn(object: Record<string, unknown>): void
  error(object: Record<string, unknown>): void
}

let cached: StructuredLogger | null = null

function structured(): StructuredLogger | null {
  if (cached) return cached
  try {
    // logger() 在本地 cli 直调 / 非云环境时可能抛，退化成 console 即可
    cached = cloud.logger() as unknown as StructuredLogger
  } catch {
    cached = null
  }
  return cached
}

function emit(
  level: 'info' | 'warn' | 'error',
  message: string,
  extra: Record<string, unknown>
): void {
  const line = { level, message, ...extra }
  const logger = structured()
  if (logger) logger[level](line)
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  sink(`[${level}] ${message}`, extra)
}

export const log = {
  info: (message: string, extra: Record<string, unknown> = {}): void =>
    emit('info', message, extra),
  warn: (message: string, extra: Record<string, unknown> = {}): void =>
    emit('warn', message, extra),
  error: (message: string, extra: Record<string, unknown> = {}): void =>
    emit('error', message, extra)
}

/** openId 是排查必需，但全文落日志会放大泄露面，取前 8 位足够定位同一用户 */
export function shortOpenId(openId: string): string {
  return openId.length <= 8 ? openId : `${openId.slice(0, 8)}…`
}
