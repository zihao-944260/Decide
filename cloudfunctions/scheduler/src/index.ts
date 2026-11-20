/**
 * scheduler 定时触发器入口（技术方案 §6.7）。
 *
 * 为什么不走 common 的 createRouter：router 的前置条件是 `getWXContext().OPENID`，
 * 定时器事件没有 openId，套 router 会 100% 返回 1002；而且定时任务的消费方是控制台日志，
 * 需要的是「这轮处理了多少条」这种统计形状，不是前端的 ApiResult。
 * 所以这里自己做一个极薄的分发：定时器 TriggerName → job，控制台手动测试再用 `{ action }`。
 *
 * 超时前提：默认 3s（config.json 的 timeout 经 CLI 部署不生效，只能控制台改），
 * 因此两个 job 都必须在 ServerLimit.TIME_BUDGET_MS(2200ms) 内主动收工，
 * 并把「没做完的部分」留到下一轮 —— 两边都是幂等状态机，重复执行不会算错。
 */
import { initCloud, isCollectionMissing, log } from 'common'
import { expirePlans } from './handlers/expirePlans'
import { reconcileCounts } from './handlers/reconcileCounts'

type JobName = 'expire' | 'reconcile'

/** config.json 里的 triggers.name → job；改触发器名要同时改这张表，否则定时器会静默落到默认分支 */
const JOB_BY_TRIGGER: Record<string, JobName> = {
  expirePlans: 'expire',
  reconcileCounts: 'reconcile'
}

const JOBS: Record<JobName, (startedAt: number) => Promise<Record<string, unknown>>> = {
  expire: expirePlans,
  reconcile: reconcileCounts
}

/**
 * 触发器名识别失败时默认走 expire：
 * 它是每分钟那条、也是最不能停的一条；把未知事件误判成 reconcile 反而可能占满时间片。
 */
function resolveJob(body: Record<string, unknown>): JobName {
  const trigger = typeof body.TriggerName === 'string' ? body.TriggerName : ''
  const mapped = trigger ? JOB_BY_TRIGGER[trigger] : undefined
  if (mapped) return mapped

  const action = typeof body.action === 'string' ? body.action : ''
  if (action === 'reconcile' || action === 'expire') return action
  if (action) log.warn('scheduler 收到未知 action，按 expire 处理', { action })
  return 'expire'
}

initCloud()

export async function main(event: unknown): Promise<Record<string, unknown>> {
  const startedAt = Date.now()
  const body = (event && typeof event === 'object' ? event : {}) as Record<string, unknown>
  const job = resolveJob(body)
  try {
    const summary = await JOBS[job](startedAt)
    log.info('scheduler 执行完成', { job, ...summary, elapsedMs: Date.now() - startedAt })
    return { ok: true, job, ...summary }
  } catch (err) {
    // 不把异常抛给运行时：抛错会让控制台把这次调用记成失败并触发重试，
    // 而这里失败的都是「本轮没做完」，下一分钟的正常触发会自己接上。
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    if (isCollectionMissing(err)) {
      log.error('scheduler 跳过：集合尚未创建（T2.1 控制台建表）', { job, error: message })
    } else {
      log.error('scheduler 执行异常', { job, error: message })
    }
    return { ok: false, job, error: message, elapsedMs: Date.now() - startedAt }
  }
}
