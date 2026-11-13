/**
 * 写操作限流：同一 openId + action 在 10 秒窗口内最多 5 次（技术方案 §11.3）。
 *
 * 为什么用进程内存而不是数据库计数：
 * - 计数走 DB 会给每个写请求加 2 次网络往返，3s 超时下代价太大；
 * - 限流只是「挡住顺手连点 / 脚本刷票」的兜底层，权威防重复靠 votes 唯一索引 + 业务查重，
 *   所以允许冷启动后计数清零、允许多实例各自计数（偏松不偏紧）。
 * 需要严格全局限流时（如上线后被刷），再把这里换成 counters 集合的 `_.inc` 版本。
 */
import { ServerLimit } from './constants'
import { BizError, ErrorCode } from './errors'

interface Window {
  count: number
  resetAt: number
}

const buckets = new Map<string, Window>()
const MAX_BUCKETS = 4096

export function assertWriteQuota(openId: string, action: string, now: number): void {
  if (!openId) return
  const key = `${action}:${openId}`
  const hit = buckets.get(key)

  if (!hit || hit.resetAt <= now) {
    // 顺带清理：Map 超过上限说明窗口内并发用户多，直接重建比逐个淘汰更省 CPU
    if (buckets.size >= MAX_BUCKETS) buckets.clear()
    buckets.set(key, { count: 1, resetAt: now + ServerLimit.RATE_WINDOW_MS })
    return
  }

  hit.count += 1
  if (hit.count > ServerLimit.RATE_LIMIT_COUNT) {
    throw new BizError(ErrorCode.RATE_LIMITED, '操作太频繁，请稍后再试')
  }
}
