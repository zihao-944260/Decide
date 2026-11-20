/**
 * 底部导航项 —— `BaseTabBar` 自绘胶囊的唯一数据源。
 *
 * 必须与 `src/pages.json` 的 `tabBar.list` 一一对应（同样的项、同样的图标、同样的顺序）：
 * pages.json 那份不能删，它决定「哪些页面是 tab 页」以及 `switchTab` 是否可用，
 * 原生条只是被 `custom: true` + `src/custom-tab-bar/` 空壳整块关掉。
 * 改了 pages.json 没改这里，胶囊就会少一项、多一项或跳错页。
 *
 * 顺序即胶囊上的左右顺序（`Great Ideas` 排在中间就是靠这个数组的下标）。
 * 滑块的位移量按 `1 / TABBAR_ITEMS.length` 等分计算，增删项不需要再改样式。
 */
export const TABBAR_ITEMS = [
  {
    key: 'home',
    text: '首页',
    url: '/pages/home/index',
    icon: '/static/tabbar/home.png',
    activeIcon: '/static/tabbar/home-active.png'
  },
  {
    key: 'ideas',
    text: 'Great Ideas',
    url: '/pages/ideas/index',
    icon: '/static/tabbar/idea.png',
    activeIcon: '/static/tabbar/idea-active.png'
  },
  {
    key: 'mine',
    text: '我的',
    url: '/pages/mine/index',
    icon: '/static/tabbar/user.png',
    activeIcon: '/static/tabbar/user-active.png'
  }
] as const

export type TabBarKey = (typeof TABBAR_ITEMS)[number]['key']

/** 项的等分宽度（%）—— 滑块槽位宽与位移步长共用这一个数，避免两处各算各的 */
export const TABBAR_SLOT_WIDTH = 100 / TABBAR_ITEMS.length

/** 按键取槽位下标；未知 key 落到 0，不让滑块因为一次数据漂移就飞出胶囊外 */
export function tabIndexOf(key: TabBarKey): number {
  const i = TABBAR_ITEMS.findIndex((item) => item.key === key)
  return i < 0 ? 0 : i
}
