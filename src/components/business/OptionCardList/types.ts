import type { PlanOption } from '@/types/models'

/**
 * OptionCardList —— 详情页选项容器（技术方案 §8.6）。
 *
 * 只做三件事：① 选项数 < 2 时整块不渲染、不占位；② 保持云端数组顺序（不 sort、不 reverse）；
 * ③ 表决态（#60）把「我投的哪一项 / 是否锁定 / 是否截止」翻译成每张卡的 selected/disabled，
 * 并把子卡的 vote 原样上抛。票数与锁定裁决都不在这里：真相是页面的 PlanDetail + planStore。
 */
export interface Props {
  /** PlanDetail.options，顺序即展示顺序 */
  options: PlanOption[]
  /** 配图可点击放大预览（表决态下由 OptionCard 让位给投票点击） */
  previewable?: boolean
  /** 选项表决模式：卡片可点投票 */
  votable?: boolean
  /** 我投的选项 id（'' = 未投）；等于某项 id 时该项高亮 */
  myOption?: string
  /** 已投过即锁定：除我投的那一项外全部禁用（投过不能改票，服务端 3003） */
  locked?: boolean
  /** 已截止/软删：全部禁用，含我投的那一项 */
  closed?: boolean
}

export type Emits = {
  /** 子卡点中；页面据此提交 vote.submit({ optionId }) */
  (e: 'vote', optionId: string): void
}