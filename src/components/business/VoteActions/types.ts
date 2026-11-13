import type { VoteTypeValue } from '@/constants/plan'

/**
 * VoteActions —— 详情页投票操作区（T3.10，技术方案 §8.3）。
 *
 * 状态全部来自 `useVote(planId)`：乐观更新 / 失败回滚 / 3003 纠偏 / 3002 已截止都已在 composable 里，
 * 组件只做「映射到 UI + 防重复点」，不再自己写一份。
 * v1 **没有取消投票**（VoteType 只有 1|2），所以这里不存在取消入口，也不存在 `type: 0` 分支。
 */
export interface Props {
  /** 计划 id（喂给 useVote；用 getter 透传，页面切 planId 时状态自动跟随） */
  planId: string
  /** 已截止（status=2 / 过了 deadline）或软删（status=3）：按钮置灰，点击提示 */
  closed?: boolean
  /** 发起人主态：整块隐藏（v1 禁止自投）。是「不渲染」而不是「禁用」 */
  isAuthor?: boolean
  /**
   * 按钮内计数 + 底部「共 N 人表态 / 我的选择」脚注。
   * 详情页如果已经摆了 `VoteRatioBar`（它自己会显示百分比与计数），这里就保持关闭，
   * 别让同一份票数在上下两处各显示一遍 —— 比例展示的唯一出口是 VoteRatioBar（§8.3）。
   */
  showCount?: boolean
  /** 已截止时的点击提示文案 */
  closedText?: string
  /**
   * 选项表决模式（#60）：整块不渲染 —— 投票入口改由 OptionCardList 的卡片承担，
   * 这里再摆赞同/反对就会出现两个互相矛盾的投票入口。
   */
  optionsEnabled?: boolean
  /** 已投过（简单表决或选项表决皆然）：两颗按钮置灰不可点，但「已选」标记照常显示 */
  locked?: boolean
}

export type Emits = {
  /** 投票成功（服务端权威值已写入 planStore）；页面用它刷新「我参与的」统计 */
  (e: 'voted', myVote: VoteTypeValue): void
  /** 服务端判定已截止 / 已删除；页面应重拉详情把整页置灰 */
  (e: 'closed'): void
}
