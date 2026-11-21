/**
 * SwipeDelete —— 列表卡片的「左滑出操作按钮条」容器。
 * 只负责手势与开合，不 import api、不 import store：
 * 点按钮只 emit `action(key)`（不带数据），删哪条 / 执行什么动作归外层
 * （PlanList 带 planId 再上抛，页面走写穿路径）。
 */
/** 按钮条上的一颗按钮：`danger` 控制配色（真删除等破坏性动作红底，其余中性灰） */
export interface SwipeAction {
  /** 稳定 key，emit `action` 时原样带回给外层（外层按 key 分发动作） */
  key: string
  /** 按钮文案 */
  label: string
  /** 破坏性动作：红底（$color-danger）。缺省中性灰底 */
  danger?: boolean
}

export interface Props {
  /**
   * 按钮条内容（行末排 N 颗 140rpx 等宽按钮，展开位移 = N × 140rpx）。
   * 按条目给：外层 PlanList 用「条目 → 动作列表」的函数逐卡计算（如已截止只给删除）。
   */
  actions: SwipeAction[]
}

export type Emits = {
  /** 按钮条上某颗按钮被点（卡片处于展开态），带回那颗按钮的 key */
  (e: 'action', key: string): void
  /**
   * 横向接管开始 true / 手势结束（end、cancel、卸载兜底）false。
   * 外层 PlanList 用它把 scroll-view 的 `scroll-y` 在横滑期间动态切 false——
   * 原生竖向滚动阈值（~18px）在 JS 侧拦不住，这是稳定版基库下唯一能用的冲突解
   * （单键版真机验证有效）。注意：切换会触发外层重渲染，外层必须保证子组件
   * 的 props 引用稳定（新数组流进来会重渲子组件、掐断在途手势，2026-11-21 三键版真机踩过）。
   */
  (e: 'swiping-change', swiping: boolean): void
}
