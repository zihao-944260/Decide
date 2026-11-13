import { useAppStore } from '@/stores/app'
import { bindDispose } from '@/composables/internal'
import { subscribeTick, TICK_MINUTE, type TickInterval } from '@/utils/ticker'
import { ref, type Ref } from 'vue'

/** 服务端校准时间：唯一时间源是 appStore.serverNow()，禁止业务代码用 Date.now() 算倒计时 */
export function peekNow(): number {
  return useAppStore().serverNow()
}

/**
 * 校准后的当前时间（毫秒）。
 * 默认 60s 档：相对时间文案（「3 分钟前」）的精度就这样，用 1s 心跳纯属白烧 setData。
 * 需要秒级倒计时的地方不要直接用这个，走 useCountdown（它自己按档位选心跳）。
 */
export function useServerNow(interval: TickInterval = TICK_MINUTE): Ref<number> {
  const now = ref(peekNow())
  const dispose = subscribeTick(() => {
    now.value = peekNow()
  }, interval)
  bindDispose(dispose)
  return now
}
