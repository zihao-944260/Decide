import type { EditorExtra } from '@/composables'

/**
 * 编辑页（WBS T4.11 / T4.12 / T4.13）的页面私有类型与常量。
 *
 * 只放「这一页」的形状；跨页复用的数据类型一律走冻结契约 `@/types/models`、`@/types/cloud`，
 * 在这里另立一份就是第二份真相（详情页 types.ts 同一条口径）。
 */

/**
 * 路由 query。参数名 `planId` 与首页 ↔ 详情页之间是同一个契约字面量（docs/agent-prompts.md §10），
 * 改名要两头一起改，不许单边兼容。
 *
 * - 有 `planId` → 二次编辑：走 `plan.detail` 回填 + 作者/状态权限校验（T4.12）；
 * - 无 `planId` → 发布新计划：尝试恢复本地草稿（T4.13）。
 *
 * 两种形态共用同一页、同一套组件、同一个提交出口，差别只有 `writeAction` 里调 `createPlan` 还是 `updatePlan`。
 */
export interface EditQuery {
  planId?: string
}

/**
 * 页面四态。`blocked` 是 T4.12 的权限/状态拦停态（非作者、已结束、已删除），
 * 与 `error`（网络/服务端失败，可重试）分开：前者重试一百次也不会变，不该给「重新加载」按钮。
 */
export type LoadPhase = 'loading' | 'ready' | 'error' | 'blocked'

/**
 * 页面表单模型 = `EditorExtra`，即 `PlanWritePayload` 去掉 `title` 与 `blocks`。
 *
 * **为什么这里没有 `title`**：`useEditor` 的草稿包（`PlanDraft`）与序列化都认 `editor.title`，
 * `EditorExtra` 这个类型名本身就是共享层给页面的口径声明 —— 编辑器管 title+blocks，页面管其余四件。
 * 若在 model 里再放一个 title，就有两处真相（谁后写谁赢），标题输入框与草稿恢复迟早对不上。
 * 所以标题 textarea 绑 `editor.title`，提交时读 `editor.title`，`useForm` 只校验 images/deadline。
 */
export type EditModel = EditorExtra

/** 新建/放弃草稿时的空表单。每次调用都给新数组，避免 `useForm.reset()` 与在途引用共用同一个数组实例 */
export function createEditModel(): EditModel {
  return { images: [], deadline: 0, optionsEnabled: false, options: [] }
}

/** 空正文的初始 blocks 由 `useEditor` 内部给（`initialBlocks()`），页面不自己造块，也不自己造块 id */

/**
 * 「只改了 deadline/options/images、正文一个字没动」时补一刀草稿落盘的等待时长 =
 * `DRAFT_DEBOUNCE_MS`（从 `@/composables` 导出，与 `useEditor` 内部那一条**同一个常量**，不是抄的）。
 * 两条 debounce 只要不同值，用户就会看到「改了截止时间后草稿落得比打字慢」。
 */

/**
 * 退出三选一的菜单项。`uni.showActionSheet` 只有 itemList，**取消键天然就是第三项「继续编辑」**，
 * 所以这里只列两项（`useModal.confirm` 只能表达两项，凑不出 §8.1 要求的三态，详见 README「退出确认」）。
 * 下标含义被 `EXIT_SAVE_AND_LEAVE` / `EXIT_DISCARD` 绑死，别在页面里裸写 0 / 1。
 */
export const EXIT_ITEMS = ['保存草稿并离开', '放弃这次改动'] as const

/** iOS 上 native ActionSheet 的标题；Android/微信实现会忽略它，不影响功能 */
export const EXIT_ALERT = '这次改动还没有发布'

/** `EXIT_ITEMS` 的下标。数组顺序改了这里必须跟着改，两处都在同一份文件里就是为了这个 */
export const EXIT_SAVE_AND_LEAVE = 0
export const EXIT_DISCARD = 1

/**
 * 长按块的菜单 key。字段名是 `ActionSheetItem.key`（**不是 label**，docs/agent-prompts.md §11），
 * 这里只声明值域：`sheet.open()` 回的是下标，页面用下标取回 `actions[index].key` 再分支，
 * 免得把中文字面量当判定条件（改文案就断）。
 */
export type BlockActionKey = 'up' | 'down' | 'duplicate' | 'delete'

/**
 * `plan.update` 的 2001/3001/3002 会被 `useForm.submit` 吞成 `false`（它只补非 ApiError 的 toast）。
 * 页面在这些码上要把「你已经不能编辑了」说清楚，所以在这里给一份可复用的判定集合。
 */
export const BLOCKING_WRITE_CODES: readonly number[] = [2001, 3001, 3002]
