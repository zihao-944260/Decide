import { peekNow } from '@/composables/useServerNow'
import { onHide, onShow } from '@dcloudio/uni-app'
import type { PageKeyValue } from '@/constants/pages'
import { logger } from '@/utils/logger'
import { pauseTick, resumeTick } from '@/utils/ticker'
import { ref, type Ref } from 'vue'

/**
 * onShow 差异化刷新（技术方案 §7.3）。
 * 为什么不用「onShow 必刷」：从详情页返回列表页时整屏重新请求，既慢又会让滚动位置抖回顶部，
 * 而绝大多数返回根本没改数据。这里两个触发条件：① 别的页面显式 invalidate(key)（发布/编辑/删除后）；
 * ② 数据超过 staleMs 过期。否则 onShow 什么都不做。
 *
 * 顺带管倒计时的心跳：页面隐藏时停全局 ticker（小程序切后台/压栈后没人看倒计时），
 * onShow 立即强制广播一次补齐隐藏期间漏掉的时间（§8.5）。
 * 必须在**页面** setup 里调用，onShow/onHide 是页面级生命周期。
 */

/**
 * 传给 onRefresh 的上下文。
 * `first` 是「这次是不是该页面的首次加载」，页面用它决定要不要用缓存：
 * 首次 → 允许列表组件走 seed（冷启动/切回来秒出，§8.7）；非首次 → 这次进入这里只可能是因为
 * 数据过期或被别的页面 invalidate，此时必须绕过 seed 真请求，否则发布/编辑后的新数据要等用户手拽下拉才出现。
 * 这一层判断放在这里而不是让页面读列表组件的 `loaded`：`loaded` 是**组件实例**的状态，
 * 一个实例服务多个数据桶时（我的页四个 filter 共用一个 PlanList）它分不清「这个桶加载过没有」。
 */
export interface PageRefreshContext {
  first: boolean
}

export interface UsePageRefreshOptions {
  /** 跨页失效用的页面标识，取值只能是 `constants/pages.ts` 的 `PAGE_KEYS`（唯一字面量来源） */
  key?: PageKeyValue
  /** 数据有效期，默认 60s */
  staleMs?: number
  /** 首次 onShow 是否就触发刷新（默认 true，等价于把首屏加载挂在 onShow 上） */
  onShowRefresh?: boolean
  /** 是否在 onShow/onHide 里顺带启停全局 ticker；列表页里有倒计时，默认开 */
  controlsTicker?: boolean
  onRefresh: (ctx: PageRefreshContext) => void | Promise<void>
}

export interface PageRefreshController {
  refreshing: Ref<boolean>
  lastLoadedAt: Ref<number>
  /** 本地刚改过数据（如投完票、删了一条评论），下次 onShow 一定要重拉 */
  markStale: () => void
  /** 页面自己完成一次加载后告诉它「现在是新鲜的」 */
  touch: () => void
  /**
   * 立刻跑一次 `onRefresh`，不等下一次 onShow。
   * 用在「事件发生在页面已经 show 之后」这两条路上：登录成功、资料保存成功 ——
   * 那时 `markStale()` 要等用户离开再回来才生效，等于没生效；页面自己调 `loadPage()` 又绕开了
   * 这里的 `refreshing` 锁，会与正在途中的下拉刷新并发两趟列表请求。
   * **保证「调用之后开始的那一次」用的是事件之后的数据**：撞上在途刷新时先等它结束、再自己跑一趟
   * （那一次是登录前/改昵称前发起的，结果不能用）。
   * 不会 reject：失败由内部记日志，且失败时不盖新鲜度戳 → 下次 onShow 自动重试。
   */
  runNow: () => Promise<void>
}

const DEFAULT_STALE = 60 * 1000

/** 模块级：页面 A 发布成功后 invalidate('home')，回到页面 B 才拿得到这条通知 */
const staleKeys = new Set<string>()

export function invalidatePage(key: PageKeyValue | '*' = '*'): void {
  staleKeys.add(key)
}

export function usePageRefresh(options: UsePageRefreshOptions): PageRefreshController {
  const key = options.key ?? '*'
  const staleMs = options.staleMs ?? DEFAULT_STALE
  const controlsTicker = options.controlsTicker !== false
  const refreshing = ref(false)
  const lastLoadedAt = ref(0)
  let forceNext = false
  let firstShow = true

  async function run(): Promise<boolean> {
    if (refreshing.value) return false
    refreshing.value = true
    try {
      await options.onRefresh({ first: lastLoadedAt.value === 0 })
      lastLoadedAt.value = peekNow()
      forceNext = false
    } catch (err) {
      logger.warn('usePageRefresh', `${key} refresh failed`, err)
    } finally {
      refreshing.value = false
    }
    return true
  }

  onShow(() => {
    if (controlsTicker) resumeTick()
    if (firstShow && options.onShowRefresh === false) {
      firstShow = false
      lastLoadedAt.value = peekNow()
      return
    }
    firstShow = false

    const stale =
      forceNext ||
      staleKeys.has(key) ||
      staleKeys.has('*') ||
      lastLoadedAt.value === 0 ||
      peekNow() - lastLoadedAt.value >= staleMs
    if (!stale) return

    staleKeys.delete(key)
    void run()
  })

  onHide(() => {
    if (controlsTicker) pauseTick()
  })

  return {
    refreshing,
    lastLoadedAt,
    markStale: () => {
      forceNext = true
    },
    touch: () => {
      lastLoadedAt.value = peekNow()
      staleKeys.delete(key)
      forceNext = false
    },
    runNow: async () => {
      // 第一次拿到 false = 共享了别人在途的那一次（发起于本事件之前）→ 等它落地，再跑自己的一次
      if (!(await run())) await run()
    },
  }
}
