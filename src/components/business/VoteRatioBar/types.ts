import type { VoteTypeValue } from '@/constants/plan'
import type { PlanOption, VoteCounts } from '@/types/models'

export type VoteRatioBarSize = 'sm' | 'md' | 'lg'

export interface Props {
  /**
   * 赞同 / 反对计数。来源由调用方决定：列表卡片传 `planStore.voteCounts[planId] ?? summary.votes`，
   * 详情页直接传 useVote 的 counts（同为 store 派生）。本组件不认识 store，纯展示。
   * `options.length >= 2` 时走逐选项行，本字段不参与渲染。
   */
  votes: VoteCounts
  /** 我的投票（VoteType.Agree=1 / Disagree=2）；undefined 表示未投票，不画标记 */
  myVote?: VoteTypeValue
  /**
   * 逐选项票数（#61）。`length >= 2` 即选项表决模式：每选项一行「名称 + 进度条 + 占比/人数」，
   * 不再画赞同/反对双色条；`< 2` 时保持原有双色条渲染。
   */
  options?: PlanOption[]
  /** 我投的选项 id（'' = 未投）；命中的那一行名称/进度/占比走主色加粗 */
  myOption?: string
  /** 百分比后是否附绝对人数（卡片里通常关掉，底部统计行已有数字） */
  showCount?: boolean
  /** 宽度过渡动画；false 时整条不做 transition（低端机 / 首屏批量渲染降级） */
  animated?: boolean
  /** sm=列表卡片、md=详情页、lg=需要强调的场景 */
  size?: VoteRatioBarSize
  /** 0 票空态文案 */
  emptyText?: string
}

/** 纯展示组件，无事件；投票交互是 VoteActions / OptionCardList 的职责 */