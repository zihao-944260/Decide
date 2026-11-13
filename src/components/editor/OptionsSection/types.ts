import { Limit } from '@/constants/plan'
import { createBlockId } from '@/utils/blocks'
import type { PlanOption } from '@/types/models'

/**
 * OptionsSection（T4.10，技术方案 §8.6 编辑态）的 props / emits 与给页面的现成判据。
 *
 * 组件不做提交校验（校验归页面 T4.11 的 useForm），但**判据的字面量在这里给出去**：
 * 「至少 2 个」「名称非空」「上限 10」「定位第一个错误卡片」这四条如果页面各写一遍，
 * 就会和组件里的上限文案漂移。纯函数、零依赖组件状态，页面直接 import。
 */

/** §8.6 提交校验的下界：开启选项时至少 2 个 */
export const OPTION_MIN_COUNT = 2

/**
 * 新建一条空选项。`order` 在这里给 0 就够 —— OptionsSection 的 `commit()` 交出去前一定重排成连续值。
 * 导出的目的是 **id 前缀只有一个字面量来源**：页面如果想「一打开开关就补两个空卡」（§8.6 的下界体验），
 * 或者从草稿恢复时补齐缺 id 的脏数据，都调这个，不要自己写 `Date.now()` —— 云函数对重复 id 抛 `3003`。
 */
export function createEmptyOption(): PlanOption {
  return { id: createBlockId('o'), name: '', image: '', order: 0, count: 0 }
}

export interface Props {
  /** 「添加选项」开关。唯一真相在页面表单，关不关都不影响 options 的内容 */
  enabled: boolean
  /** 选项列表，顺序即展示顺序；组件输出的数组一定带连续 order */
  options: PlanOption[]
  /** 只读态：页面给「已截止计划」出只读视图时传（开关、添加、卡片输入一起冻住） */
  disabled?: boolean
}

export type Emits = {
  /** 开关点击。组件**只发这一件事**，不去清 options、也不替页面决定能不能关 */
  (e: 'toggle', enabled: boolean): void
  /** 任何增 / 删 / 排序 / 改名 / 换图后的**整包新数组**，每项都带连续 order（0 基） */
  (e: 'change', options: PlanOption[]): void
  /** 任一选项配图在途（含失败待重试）。页面的提交门禁要用它，别假设自己看得见卡片内的 useUpload */
  (e: 'uploading', uploading: boolean): void
}

/**
 * 卡片节点 id。§8.6 要求校验失败时「定位到第一个错误卡片」，页面的 `scroll-into-view` 目标
 * 必须和这里写的是同一个字符串 —— 两处各写一遍就一定跳不过去（同 §10 的 planId 教训）。
 */
export function optionCardId(id: string): string {
  return `option-${id}`
}

/** 第一个「名称为空（含全空格）」的下标，-1 = 都填了。云端 asString 会 trim 后判空，口径一致 */
export function firstInvalidOptionIndex(list: PlanOption[]): number {
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]
    if (!item || item.name.trim() === '') return i
  }
  return -1
}

/**
 * 页面用的整包判据：返回 '' 表示通过，否则是可直接 toast 的文案。
 * `enabled === false` 时一律通过 —— 云端 validateOptions(raw,false) 直接 return []，
 * 开关关了还去数选项数量，就会凭空拦下一次发布。
 */
export function optionsProblem(list: PlanOption[], enabled: boolean): string {
  if (!enabled) return ''
  if (list.length < OPTION_MIN_COUNT) return `添加选项后至少填 ${OPTION_MIN_COUNT} 个`
  if (list.length > Limit.OPTION_MAX) return `选项最多 ${Limit.OPTION_MAX} 个`
  const bad = firstInvalidOptionIndex(list)
  if (bad >= 0) return `第 ${bad + 1} 个选项还没有名称`
  return ''
}
