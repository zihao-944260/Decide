import type { MyFilter } from '@/constants/plan'

export interface Props {
  /**
   * 当前选中的 filter。**唯一真相在页面**（与 `StatCards` 的 `active` 读同一个 ref），
   * 组件不持有选中态、不缓存、不发请求 —— 纯受控（props in / emits out）。
   */
  active: MyFilter
  /** 渲染哪几项、什么顺序。默认 `MY_FILTERS` 四项全给 */
  filters?: readonly MyFilter[]
  /** 整条禁用（页面在切 tab 的请求在途时防连点）；只拦点击，不改选中态显示 */
  disabled?: boolean
}

export type Emits = {
  /**
   * 点击**未选中**的项才发；点已选中的项不发（页面因此不用再自己判重，
   * 也不会因为重复点同一个 tab 触发第二次 reload）。
   */
  (e: 'change', filter: MyFilter): void
}
