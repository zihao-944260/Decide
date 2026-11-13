import { formatDateTime } from '@/utils/format'

/**
 * DeadlinePicker（T4.9，技术方案 §8.1 页面结构 / §12 T4.9）的 props / emits 与档位单元类型。
 *
 * 这里刻意放两个「结构类型」而不是只放 Props：日期列的每个单元格要携带「这一天可选的时间档位」，
 * 组件内 computed 出来、模板 v-for 用到，写出来是为了 README 能给出真实形状，也方便页面做单测时按类型构造。
 */

/** 时间列的一格：30 分钟一档。`ts` = 本地时区该档起点的毫秒 */
export interface DeadlineSlot {
  ts: number
  /** HH:mm，由 utils/format.ts 的 pad2 拼，不在组件里另写一套补零 */
  label: string
}

/** 日期列的一格：一天。`slots` 是「选中这一天时时间列出现的档位」，已过期的档位不在里面 */
export interface DeadlineDay {
  /** 当天 00:00 的毫秒 */
  dayStart: number
  /** 主文案 MM-DD，一律走 utils/format.ts 的 formatDate */
  date: string
  /** 副文案：今天 / 明天 / 周X */
  week: string
  slots: DeadlineSlot[]
}

export interface Props {
  /** 当前截止时间（ms，0 = 未设置）。唯一真相在页面表单，本组件不缓存副本 */
  deadline: number
  /** 行标题，页面可改成「截止日期」之类 */
  label?: string
}

export type Emits = {
  /** 选择结果（ms）。快捷项与弹层确认都只发这一个事件 */
  (e: 'change', deadline: number): void
  /** 弹层开/关。WebView 页据此用 page-meta 锁文档滚动，防滚动穿透（#78） */
  (e: 'sheet', open: boolean): void
}

/** deadline = 0 在冻结契约里是合法值（云端 resolveDeadline 对 0 直接放行 = 不限截止），所以文案要能表达它 */
export const DEADLINE_UNSET_TEXT = '未设置'

/**
 * 人类可读文案。组件自己在行内就用它，页面**不需要**再订阅事件拿文案；
 * 导出的目的是让页面在别处（草稿摘要、提交确认弹窗、埋点日志）复用同一份拼法 ——
 * 年月日只在 utils/format.ts 拼一次，两处各写一遍必然漂移。
 */
export function deadlineText(ts: number): string {
  return ts > 0 ? formatDateTime(ts) : DEADLINE_UNSET_TEXT
}
