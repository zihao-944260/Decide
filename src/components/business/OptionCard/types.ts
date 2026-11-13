import type { PlanOption } from '@/types/models'

/**
 * OptionCard —— 详情页单个选项卡（技术方案 §8.6）。
 *
 * 两态共用一张卡：`votable=false` 是展示态（唯一交互是配图预览）；
 * `votable=true` 是选项表决态（#60），整卡可点、点中即投这一项，票数与「我的选择」
 * 由 `VoteRatioBar` 的逐选项行展示，卡片自己不算票、不持状态。
 */
export interface Props {
  /** PlanDetail.options[i]，顺序即展示顺序，组件不排序 */
  option: PlanOption
  /** 序号（0 基）；徽标显示 pad2(index + 1) */
  index: number
  /** 配图可点击放大预览（uni.previewImage）；表决态下让位给投票点击 */
  previewable?: boolean
  /** 选项表决模式：整卡可点，点中 emit vote(option.id) */
  votable?: boolean
  /** 我投的就是这一项：主色高亮，锁定后依旧保持（不被 disabled 置灰盖掉） */
  selected?: boolean
  /** 不可点：已截止，或已投别的项而锁定 */
  disabled?: boolean
}

export type Emits = {
  /** 点中本卡（仅 votable && !disabled 时发）；提交与锁定由页面/composable 裁决 */
  (e: 'vote', optionId: string): void
}