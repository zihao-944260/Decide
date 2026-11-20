import type { ActionSheetItem } from '@/components/base/BaseActionSheet/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 全局弹层状态（技术方案 §9.2 的 BaseModal / BaseActionSheet 是受控展示组件）。
 *
 * 为什么状态放 store 而不是命令式挂载：小程序没有 DOM，运行时 createComponent 挂不上，
 * 所以「页面里预先渲染好组件 + store 翻 visible」是唯一可行的命令式反馈形态。
 * 简单反馈仍走 useToast/useModal 的原生 uni API；这里只服务于需要自定义样式的那一层。
 * 由页面 import agent A 的组件并绑定本 store 的状态与 resolve 回调。
 */

export interface DialogState {
  visible: boolean
  title: string
  content: string
  confirmText: string
  cancelText: string
  danger: boolean
}

/**
 * 菜单项类型直接借用渲染它的 `BaseActionSheet` 的契约（type-only import，无运行时依赖）。
 * 之前这里另立了一份 `{ label }`，而组件认的是 `{ text }` —— 两条路永远接不上：
 * 页面把 `state.actions` 绑给 `<BaseActionSheet :actions>` 必然类型报错。单一真相放渲染侧。
 */
export interface SheetState {
  visible: boolean
  title: string
  actions: ActionSheetItem[]
}

export interface DialogRequest {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export interface SheetRequest {
  title?: string
  actions: ActionSheetItem[]
}

const HIDDEN_DIALOG: DialogState = {
  visible: false,
  title: '',
  content: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false
}

const HIDDEN_SHEET: SheetState = { visible: false, title: '', actions: [] }

export const useFeedbackStore = defineStore('feedback', () => {
  const dialog = ref<DialogState>({ ...HIDDEN_DIALOG })
  const sheet = ref<SheetState>({ ...HIDDEN_SHEET })

  // resolve 句柄放闭包而非 state：函数进 state 会被 Vue 响应式代理，且序列化调试时是噪音
  let resolveDialog: ((confirmed: boolean) => void) | null = null
  let resolveSheet: ((index: number) => void) | null = null

  const layerOpen = computed(() => dialog.value.visible || sheet.value.visible)

  function settleDialog(confirmed: boolean): void {
    const resolve = resolveDialog
    resolveDialog = null
    dialog.value = { ...HIDDEN_DIALOG }
    resolve?.(confirmed)
  }

  function settleSheet(index: number): void {
    const resolve = resolveSheet
    resolveSheet = null
    sheet.value = { ...HIDDEN_SHEET }
    resolve?.(index)
  }

  /** 自定义确认框：页面渲染 BaseModal，用户操作后由 confirmDialog/cancelDialog 结掉这个 Promise */
  function openDialog(request: DialogRequest): Promise<boolean> {
    settleSheet(-1)
    dialog.value = {
      visible: true,
      title: request.title ?? '',
      content: request.content,
      confirmText: request.confirmText || '确定',
      cancelText: request.cancelText || '取消',
      danger: Boolean(request.danger)
    }
    return new Promise<boolean>((resolve) => {
      resolveDialog = resolve
    })
  }

  /** index = -1 表示取消/点遮罩关闭 */
  function openSheet(request: SheetRequest): Promise<number> {
    settleDialog(false)
    sheet.value = { visible: true, title: request.title ?? '', actions: request.actions.slice() }
    return new Promise<number>((resolve) => {
      resolveSheet = resolve
    })
  }

  function pickSheet(index: number): void {
    settleSheet(index)
  }

  function closeDialog(): void {
    settleDialog(false)
  }

  function confirmDialog(): void {
    settleDialog(true)
  }

  /** 页面卸载/onUnload 兜底：不让上一个页面留下的 pending Promise 卡住下一次调用 */
  function closeAll(): void {
    settleDialog(false)
    settleSheet(-1)
  }

  return {
    dialog,
    sheet,
    layerOpen,
    openDialog,
    openSheet,
    closeDialog,
    confirmDialog,
    pickSheet,
    closeAll
  }
})
