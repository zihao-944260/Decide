import { logger } from '@/utils/logger'

/**
 * 全局单例 ticker（技术方案 §8.5）。
 *
 * 为什么只有一个 setInterval：首页/我的页一屏 10+ 张卡片各挂一个 1s 定时器的话，
 * 小程序里 N 个 timer 会各自触发一次 setData 级别的响应式写入，JS 线程被切片刷屏、
 * 滚动掉帧；定时器数量与卡片数解耦是这条链路的唯一瓶颈点。
 *
 * 分级降频怎么做到「一个定时器」：定时器周期 = 所有订阅者里的最小周期（1s/60s 两档），
 * 每次心跳只调用「自己周期到了」的订阅者。于是 60s 档的卡片不会被 1s 档的邻居拖高频率。
 * 无订阅者时定时器自然停止（列表页卸载 → 不再有空转的 interval）。
 */

export const TICK_SECOND = 1000
export const TICK_MINUTE = 60000

export type TickInterval = typeof TICK_SECOND | typeof TICK_MINUTE
/** 0 = 不订阅。倒计时「>7 天静态」「已截止」两档用它，避免为不变化的文案保活定时器 */
export type TickPrecision = TickInterval | 0

export type TickListener = (now: number) => void

interface TickEntry {
  listener: TickListener
  interval: TickInterval
  last: number
}

/**
 * 定时器周期与阈值判断之间存在毫秒级抖动（setInterval 不保证准点），
 * 留 20ms 容差，否则 60s 档会因为 elapsed=59998.x 被顺延整整一个周期。
 */
const DRIFT_TOLERANCE = 20

const entries: TickEntry[] = []
let timer: ReturnType<typeof setInterval> | null = null
let runningInterval = 0
let paused = false

function minInterval(): TickInterval | null {
  let best: TickInterval | null = null
  for (const entry of entries) {
    if (best === null || entry.interval < best) best = entry.interval
  }
  return best
}

function broadcast(force = false): void {
  const now = Date.now()
  // 复制一份再遍历：订阅者回调里可能 unsubscribe / 再 subscribe，直接遍历原数组会漏项或重复调用
  for (const entry of entries.slice()) {
    if (!force && now - entry.last < entry.interval - DRIFT_TOLERANCE) continue
    entry.last = now
    try {
      entry.listener(now)
    } catch (err) {
      // 单个订阅者抛错不得掐断心跳，否则一个坏卡片会让整页倒计时全部冻住
      logger.error('ticker', 'listener error', err)
    }
  }
}

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  runningInterval = 0
}

function reschedule(): void {
  if (paused) {
    stopTimer()
    return
  }
  const next = minInterval()
  if (next === null) {
    stopTimer()
    return
  }
  if (next === runningInterval) return
  // 精度只有 1s/60s 两档，切换发生在跨阈值的那一刻，重建定时器的成本可忽略
  stopTimer()
  runningInterval = next
  timer = setInterval(() => broadcast(), next)
}

/** 订阅心跳，返回取消函数（重复调用安全） */
export function subscribeTick(listener: TickListener, interval: TickInterval): () => void {
  const entry: TickEntry = { listener, interval, last: Date.now() }
  entries.push(entry)
  // 立刻给一次值：卡片首帧就要有文案，不能等第一个心跳（最长 60s 空白）
  try {
    listener(entry.last)
  } catch (err) {
    logger.error('ticker', 'listener error', err)
  }
  reschedule()

  let released = false
  return () => {
    if (released) return
    released = true
    const index = entries.indexOf(entry)
    if (index >= 0) entries.splice(index, 1)
    reschedule()
  }
}

/** 页面 onHide 调用：停表但保留订阅者 */
export function pauseTick(): void {
  paused = true
  stopTimer()
}

/** 页面 onShow 调用：先强制广播一次（补上隐藏期间漏掉的时间），再恢复心跳 */
export function resumeTick(): void {
  if (!paused) return
  paused = false
  broadcast(true)
  reschedule()
}

export function isTickPaused(): boolean {
  return paused
}

/** 供验收/调试：确「只有一个定时器」这条硬约束 */
export function tickerSnapshot(): { subscribers: number; interval: number; paused: boolean } {
  return { subscribers: entries.length, interval: runningInterval, paused }
}

/** 清空所有订阅（仅测试/热重载兜底用，业务代码不要调） */
export function resetTick(): void {
  entries.length = 0
  paused = false
  stopTimer()
}
