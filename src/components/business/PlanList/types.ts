import type { PageFetcher } from '@/composables'
import type { PageResult } from '@/types/api'
import type { PlanSummary } from '@/types/models'
import type { SwipeAction } from '@/components/business/SwipeDelete/types'

/**
 * PlanList —— 首页 / 我的页共用的分页列表容器（技术方案 §8.7、§10 / WBS T3.4）。
 * 组件只认 fetcher 与事件，不 import api、不 import store：
 * 取哪一页数据、缓存写到哪里，全部由页面层注入（seed/onPage 是 store 的接线口）。
 */
export interface Props {
  /** 分页取数函数，签名 (cursor, pageSize)。页面包装 api：`(c, s) => fetchPlanList({ cursor: c, pageSize: s })` */
  fetcher: PageFetcher<PlanSummary>
  /** 每页条数，默认 Limit.PAGE_SIZE */
  pageSize?: number
  /** 首屏缓存回填（如 planStore.home / myLists[filter]）；命中则不发请求，切 tab 不重查（§8.7） */
  seed?: () => PageResult<PlanSummary> | null
  /** 每页成功后回吐原始分页数据，页面拿它写 store 缓存 */
  onPage?: (page: PageResult<PlanSummary>, append: boolean) => void
  /** 取数失败透传给页面（toast / 埋点），组件自身只渲染重试态 */
  onError?: (error: unknown) => void
  /** 主键提取，缺省 item.planId；patchItem/removeItem/追加去重都靠它 */
  getId?: (item: PlanSummary) => string
  /** 挂载即自动首屏加载。默认 false —— 生命周期归页面管（onShow 需要重新校准时间/状态） */
  autoLoad?: boolean
  /** 空态主文案 */
  emptyText?: string
  /** 空态操作按钮文案；留空不显示按钮 */
  emptyActionText?: string
  /**
   * 空态按钮的动作归页面：true 时点击**只 emit('empty-action')**，组件不再内部 reload。
   * 用途：「我发起的」空态要的是「去发布」，不是一次注定还是空的重试。
   * 必须与 `@empty-action` 成对给 —— 只给本 prop 会把按钮变成死按钮。
   * 为什么不用「组件自己嗅探页面到底挂没挂监听」：`useAttrs()` 在 mp-weixin 能不能看见事件监听器
   * 属兼容清单零条目（§2.8 清单没写 ≠ 可用），显式开关不欠这个验证。
   */
  emptyActionOwned?: boolean
  /** 卡片比例条动画开关（整屏降级用） */
  animated?: boolean
  /** 触底预加载距离（px，透传 scroll-view lower-threshold） */
  lowerThreshold?: number
  /**
   * 触发竖向滚动所需的最小拖动距离（px，透传 scroll-view min-drag-distance，手势冲突专用）。
   * 默认 18 = 微信原生缺省，不传页面时行为不变；SwipeDelete 开启的桶调大（如 50）：
   * 横滑卡片时手指带的竖向分量不再轻易把列表竖向滚走。
   */
  minDragDistance?: number
  /**
   * 滚动内容尾部垫「底部悬浮层」让位：悬浮胶囊导航 + 页底那颗 pill（首页发布 / 我的退出登录，同款同位）。
   * 让位必须放在**滚动内容里**而不是页面兄弟节点：兄弟节点会压矮 scroll-view 视口，
   * 末卡在视口底被裁、下方却留一条死空间（#45）。
   * 导航改成 fixed 悬浮之后这条更吃紧：视口铺到屏幕底边，末卡不垫就直接永久藏在胶囊下面。
   */
  floatClearance?: boolean
  /**
   * 顶部留白放在滚动内容**内部**（首卡之上垫一格 $card-gap），容器本身不上外边距。
   * 首页用 true（容器顶贴导航、圆角从导航下沿开始）；我的页默认 false（留白走容器 margin-top）。
   */
  innerTopGap?: boolean
  /**
   * 左滑操作按钮条：给「条目 → 按钮列表」的函数，非空时该卡包一层 `SwipeDelete`
   * （左滑出右侧按钮组，点钮 emit `action`）。按钮按条目算：如我的页「我发起的」桶
   * 未截止给 编辑计划/提前截止/删除计划 三颗、已截止只给 删除计划 一颗。
   * 不传（首页）任何卡都不包。
   */
  swipeActions?: (item: PlanSummary) => SwipeAction[]
}

/**
 * 转发给页面的滚动载荷，只保留页面用得上的字段。
 * 自定义组件的原生事件不跨组件边界（父级 `@scroll` 编译成组件标签上的 bindscroll），
 * 所以组件内部必须显式 triggerEvent；这里同时把它声明成组件的对外契约，页面不用再猜形状。
 */
export interface PlanListScrollEvent {
  detail?: {
    scrollTop?: number
  }
}

export type Emits = {
  /** 卡片点击进详情（原样转发 PlanCard 的 planId 与 OpenContainer 实例） */
  (e: 'click', planId: string, openContainer?: unknown): void
  /** 卡片倒计时归零沿，页面可 patchItem 置灰或刷新该条 */
  (e: 'expire', planId: string): void
  /**
   * 左滑按钮条上某颗按钮被点（仅 `swipeActions` 非空时存在）。
   * `key` 是按钮稳定 key（页面按它分发动作），`planId` 口径与 `getId` 一致。
   */
  (e: 'action', key: string, planId: string): void
  /** 空态按钮点击，且 `emptyActionOwned` 为 true（动作完全归页面，组件不并发重试） */
  (e: 'empty-action'): void
  /** 内部 scroll-view 的滚动事件转发（页面做 FAB 收起等滚动响应） */
  (e: 'scroll', event: PlanListScrollEvent): void
}
