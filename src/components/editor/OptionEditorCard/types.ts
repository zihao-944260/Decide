import type { PlanOption } from '@/types/models'

/**
 * OptionEditorCard（T4.10 的子件，技术方案 §8.6 编辑态「单个选项卡片」）的 props / emits。
 *
 * 只做「编辑一条 PlanOption」这件事：名称输入 + 单图 + 上移/下移/删除。
 * 顺序（`order`）**不归它算** —— 它只上报意图（move / remove / rename / image），
 * 由宿主 OptionsSection 重排后带上连续 order 一起回抛给页面。
 */
export interface Props {
  /** 一条 PlanOption；id 是它在你自己卡片里的身份，宿主 v-for 必须按它做 key */
  option: PlanOption
  /** 0 基序号，与详情页展示态 OptionCard 的 index 同口径（徽标显示 pad2(index + 1)） */
  index: number
  /** 选项总数，决定上移/下移的禁用边界 */
  total: number
  /** 只读态（页面给「已截止计划」出只读视图时用，见 README） */
  disabled?: boolean
}

/** 长按 / 「更多」弹出的三个动作，key 与 useActionSheet 回调后的匹配用同一份字面量 */
export type OptionEditorAction = 'up' | 'down' | 'remove'

export type Emits = {
  /** 名称输入（原文，未 trim；trim 与否属校验，归页面） */
  (e: 'rename', name: string): void
  /** 配图变化：上传成功的 fileID，'' = 用户删掉了图。**只在 done 时发，本地临时路径不外泄** */
  (e: 'image', fileID: string): void
  /** 本卡图片是否在途（含失败待重试）。OptionsSection 汇总后转给页面做提交门禁 */
  (e: 'uploading', uploading: boolean): void
  /** -1 上移 / 1 下移，越界由宿主兜 */
  (e: 'move', delta: number): void
  /** 删除本条 */
  (e: 'remove'): void
}
