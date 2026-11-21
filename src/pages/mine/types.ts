import type { MyFilter } from '@/constants/plan'

/**
 * 「提前截止」写入的目标时间 = 校准时间 + 60s。
 *
 * 为什么不是「立刻」（deadline = now）：云端 `cloudfunctions/common/src/planPayload.ts` 的
 * `resolveDeadline` 只接受两种值 —— 与库里原值完全相同，或 **严格晚于 now**；
 * `deadline <= now` 直接 1001「截止时间必须晚于当前时间」。而 0 在契约里是「不限截止」，
 * 语义正相反（§5.2）。所以云端根本没有「立即截止」这个写入口，v1 只能做到「1 分钟后截止」。
 * 60s 同时覆盖前后端时钟抖动（DeadlinePicker 的自定义档用的是同量级缓冲）。
 */
export const EARLY_CLOSE_GRACE_MS = 60_000

/** 删除确认弹窗里标题的截断宽度（中文字宽，与 `utils/format` 的 textWidth 同口径） */
export const TITLE_PREVIEW_WIDTH = 12

/** 左滑按钮条三颗按钮的文案（按钮条与二次确认弹窗共用，别让两处各写一遍） */
export const MANAGE_LABELS = {
  edit: '编辑计划',
  closeEarly: '提前截止',
  remove: '删除计划'
} as const

/**
 * 两个二次确认弹窗的**确认按钮**文案（原生 showModal，取消按钮固定是「取消」）。
 * 为什么不复用 MANAGE_LABELS：按钮位只有 4 个字的空间，而菜单项需要「删除计划」这种
 * 完整宾语才读得清是哪一条 —— 两处各有最优长度，写成两个常量比共用一个短的清楚。
 */
export const CONFIRM_LABELS = {
  closeEarly: '确定截止',
  remove: '删除',
  logout: '退出'
} as const

/** 左滑按钮条的动作 key（与 MANAGE_LABELS 的键同集；按钮文案取 MANAGE_LABELS） */
export type ManageActionKey = 'edit' | 'closeEarly' | 'remove'

/**
 * 四个 filter 各自的空态文案（喂 PlanList 的 `empty-text`）。
 * 不给 `empty-action-text`：PlanList 的空态按钮语义是**固定**的「reload({force:true})」（组件内部），
 * 挂在「还没有发布过计划」旁边点出来是一次无意义的重取，按钮文案又改不成「去发布」，所以整条不给。
 */
export const EMPTY_TEXTS: Record<MyFilter, string> = {
  created: '还没有发起过计划',
  joined: '还没有参与过表决',
  ongoing: '没有进行中的计划',
  ended: '还没有已截止的计划'
}

/**
 * 空态按钮文案（`PlanList` 的 `emptyActionText`，留空 = 不显示按钮）。
 * 只有 `created` 给动作：它的空是「还没发布过」，重试一次还是空，摆个「重试」是误导；
 * 其余三个空的成因在页面之外（没参与过 / 时间还没走到），任何按钮都只会让用户多等一次请求。
 */
export const EMPTY_ACTION_TEXTS: Record<MyFilter, string> = {
  created: '去发布第一条',
  joined: '',
  ongoing: '',
  ended: ''
}

/** 编辑页路由（`src/pages.json` 已注册）。query 参数名固定 `planId`，与详情页同口径 */
export const EDIT_PAGE_URL = '/pages/plan/edit/index'

/** 详情页路由 + query 参数名 */
export const DETAIL_PAGE_URL = '/pages/plan/detail/index'
