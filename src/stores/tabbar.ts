import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { tabIndexOf, type TabBarKey } from '@/constants/tabbar'

/**
 * 底部导航的当前项 —— 跨 tab 页共享的一份真相。
 *
 * 为什么状态放 store 而不是各页胶囊自己的 `active` prop：微信的 tab 页是常驻实例，
 * 切 tab 不销毁页面，而每个页面传进来的 `active` 永远等于它自己那一项。
 * 滑块要「从旧位置滑到新位置」，就必须有一处能被「正在离开的页」和「刚出现的页」同时观察到的状态：
 * 离开的那页靠它当场开始滑，刚挂载的那页靠 `prev` 把起点摆回旧格再补跑同一段动画。
 *
 * `prev` 只服务这一件事 —— 首次进入某个 tab 页时它的胶囊是新建的，没有可继承的旧位置。
 */
export const useTabBarStore = defineStore('tabbar', () => {
  const active = ref<TabBarKey>('home')
  const prev = ref<TabBarKey>('home')
  /**
   * 真的换了一项的次数。页面靠它分清两种 onShow：
   * **切 tab 切过来的**（要把列表滚动归零，用户 2026-11-18 口径）与**从详情页返回的**
   * （必须保留滚动位置 —— §7.3 不做「onShow 必刷」就是为了这个）。
   * 点当前项与 setup 期「认领自己」都走不到这里，所以它不会被自己人误加。
   */
  const switchSeq = ref(0)

  const activeIndex = computed(() => tabIndexOf(active.value))
  const prevIndex = computed(() => tabIndexOf(prev.value))

  /**
   * 切到某一项，并把旧项记进 `prev`。同项直接返回：点当前 tab 不该发 switchTab
   * （微信会把它当成一次真实跳转，页面随之重建、列表重头加载）。
   *
   * 胶囊组件在 setup 期也会调它一次「认领自己」：冷启动直达非首页 tab 时，
   * store 还停在默认项，这一步把它掰回真实页，滑块才不会停在别的格子上。
   */
  function go(key: TabBarKey): void {
    if (key === active.value) return
    prev.value = active.value
    active.value = key
    switchSeq.value += 1
  }

  return { active, prev, activeIndex, prevIndex, switchSeq, go }
})
