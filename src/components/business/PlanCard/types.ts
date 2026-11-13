import type { PlanSummary } from '@/types/models'

export interface Props {
  /** 列表契约的单条数据（< 1KB，不含 blocks/images/options），见技术方案 §8.5 */
  summary: PlanSummary
  /**
   * 外层已知的状态覆盖（PlanStatus 值：0 草稿 / 1 进行中 / 2 已截止 / 3 已删除）。
   * 软删、截止都由云端裁决后传进来，组件只据此置灰，自己不判真实状态（§8.5）。
   * 缺省用 summary.status。
   */
  status?: number
  /** 比例条宽度过渡开关，页面滚动卡顿时可整屏关掉 */
  animated?: boolean
}

export type Emits = {
  /** 点击卡片进详情，页面按 planId 跳转 */
  (e: 'click', planId: string): void
  /** 长按：页面挂 ActionSheet（删除/收藏等），组件内不做任何菜单 */
  (e: 'long-press', planId: string): void
  /** 倒计时归零沿（挂载时已截止不触发），页面可顺手 patch/刷新该条 */
  (e: 'expire', planId: string): void
}
