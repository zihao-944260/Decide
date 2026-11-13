import { bindDispose } from '@/composables/internal'
import { peekNow } from '@/composables/useServerNow'
import {
  countdownLevel,
  countdownPrecision,
  formatCountdown,
  remainingPercent,
  type CountdownLevel,
} from '@/utils/format'
import { logger } from '@/utils/logger'
import { subscribeTick, type TickPrecision } from '@/utils/ticker'
import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

/** 缺省总时长：拿不到 startAt 时按 7 天窗口算剩余占比（详情页会传 createdAt，见下） */
const DEFAULT_SPAN = 7 * 24 * 60 * 60 * 1000

export interface UseCountdownOptions {
  /** 计划创建时间：有它就能算真实剩余占比（环形/比例进度条）；缺省退回 total */
  startAt?: MaybeRefOrGetter<number | undefined>
  /** 无 startAt 时使用的总时长（毫秒） */
  total?: number
  /**
   * 归零回调，同一次归零只触发一次。
   * 前端归零只做视觉置灰 + 禁用投票，真状态由云函数裁决（§8.5），所以这里给页面一个
   * 「顺手 reload 详情/列表项」的钩子，而不是让 composable 自己去猜要刷什么。
   */
  onExpire?: () => void
}

export interface Countdown {
  text: Ref<string>
  level: Ref<CountdownLevel>
  expired: Ref<boolean>
  percent: Ref<number>
  remaining: Ref<number>
  /** 外部（如切换 deadline 编辑值、非 ref 的 getter）主动要求重算 */
  refresh: () => void
}

export function useCountdown(
  deadline: MaybeRefOrGetter<number>,
  options: UseCountdownOptions = {},
): Countdown {
  const text = ref('')
  const level = ref<CountdownLevel>('ended')
  const expired = ref(true)
  const percent = ref(0)
  const remaining = ref(0)

  let precision = -1
  let unsubscribe: (() => void) | null = null
  let expireFired = false

  /**
   * 分级降频的落点：档位变了就换心跳（1s / 60s / 不订阅）。
   * 换的是订阅关系而不是定时器本身 —— 全局始终最多一个 setInterval（utils/ticker）。
   */
  function setPrecision(next: TickPrecision): void {
    if (next === precision) return
    precision = next
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    if (next === 0) return
    const stop = subscribeTick(() => sync(), next)
    // subscribeTick 会同步回调一次 sync：若那一刻档位又被改走，旧订阅必须当场退掉，不然会漏在表里
    if (precision !== next) {
      stop()
      return
    }
    unsubscribe = stop
  }

  function spanOf(dl: number): number {
    const start = toValue(options.startAt)
    if (typeof start === 'number' && start > 0 && dl > start) return dl - start
    return options.total ?? DEFAULT_SPAN
  }

  function sync(): void {
    const dl = toValue(deadline)
    const left = dl > 0 ? dl - peekNow() : 0
    const next = countdownLevel(left)
    remaining.value = left
    level.value = next
    text.value = formatCountdown(left, next)
    expired.value = next === 'ended'
    percent.value = remainingPercent(left, spanOf(dl))
    if (next === 'ended') {
      if (!expireFired) {
        expireFired = true
        try {
          options.onExpire?.()
        } catch (err) {
          logger.warn('useCountdown', 'onExpire error', err)
        }
      }
    } else {
      expireFired = false
    }
    setPrecision(countdownPrecision(next))
  }

  // deadline 传 ref 时（编辑页改截止时间）跟着重算；传普通函数则无依赖可追踪，靠 refresh()
  watch(
    () => toValue(deadline),
    () => sync(),
  )

  sync()
  bindDispose(() => {
    if (unsubscribe) unsubscribe()
    unsubscribe = null
  })

  return { text, level, expired, percent, remaining, refresh: sync }
}
