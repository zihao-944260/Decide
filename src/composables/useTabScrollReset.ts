import { onShow } from '@dcloudio/uni-app'
import { useTabBarStore } from '@/stores/tabbar'

/**
 * 切 tab 回到本页时把列表滚动归零（用户 2026-11-18 口径）。
 * 生命周期钩子归 composable，页面不自己写 onShow —— 与 `usePageRefresh` 同一条接法（§7.3）。
 *
 * **为什么按 `switchSeq` 而不是「onShow 就归零」**：onShow 同时覆盖「从详情页返回」那一次，
 * 而返回时必须停在原来读到的位置（§7.3 不做「onShow 必刷」正是为这个，滚动位置同理）。
 * `switchSeq` 只在真的换了一个 tab 时递增，点当前项和组件 setup 期「认领自己」都不加，
 * 所以两种 onShow 分得开。
 */
export function useTabScrollReset(reset: () => void): void {
  const tabBar = useTabBarStore()
  let seenSeq = tabBar.switchSeq

  onShow(() => {
    if (tabBar.switchSeq === seenSeq) return
    seenSeq = tabBar.switchSeq
    reset()
  })
}
