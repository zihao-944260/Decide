import type { TabBarKey } from '@/constants/tabbar'

export interface Props {
  /**
   * 本页是哪一项（首页传 home、Great Ideas 页传 ideas、我的页传 mine）。
   *
   * 它不再等于「高亮哪一项」—— 高亮（滑块位置、图标与文字选中态）读的是 `stores/tabbar.ts` 的
   * `active`：tab 页常驻不重建，各页胶囊只拿自己那一项当身份，滑块才有「从旧格滑到新格」可言。
   * 本 prop 的两个用途：挂载时向 store 认领当前 tab（冷启动直达非首页时靠它掰正 store），
   * 以及让「点自己这一项」成为空操作（不发多余的 `switchTab`）。
   */
  active: TabBarKey
}
