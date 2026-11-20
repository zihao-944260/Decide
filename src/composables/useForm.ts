import { ApiError } from '@/api/request'
import { showToastMsg } from '@/composables/useToast'
import { logger } from '@/utils/logger'
import { countChars } from '@/utils/format'
import { readJson, removeStorage, writeJson } from '@/utils/storage'
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

/**
 * 表单三件套：校验 + 提交锁 + 草稿缓存。
 * 提交锁解决的是「网络慢时用户连点两次 → 建出两条计划」，这条比校验更重要，
 * 因为云函数侧限流只按 10s 窗口兜底，文案还是错误码那套，体验很差。
 */

export interface FieldRule<V> {
  required?: boolean
  /**
   * 长度上限：string 按显示宽度（一个中文算 1、ASCII 算 0.5，与服务端「20 字选项名」口径一致），
   * 数组按项数，number 按数值本身。
   */
  max?: number
  min?: number
  pattern?: RegExp
  validator?: (value: V) => boolean
  message: string
}

export type FormRules<M> = { [K in keyof M]?: FieldRule<M[K]>[] }
export type FormErrors<M> = { [K in keyof M]?: string }

export interface UseFormOptions<M> {
  /** 给了就自动 debounce 写草稿（key 会加 decide: 前缀） */
  draftKey?: string
  debounceMs?: number
  /** 提交时校验失败的第一个错是否自动 toast（默认 true） */
  toastInvalid?: boolean
  onDraftSaved?: (model: M) => void
}

export interface FormController<M> {
  model: Ref<M>
  errors: Ref<FormErrors<M>>
  valid: ComputedRef<boolean>
  submitting: Ref<boolean>
  validate: () => boolean
  validateField: (key: keyof M) => boolean
  clearError: (key: keyof M) => void
  reset: () => void
  submit: (action: (model: M) => Promise<unknown>) => Promise<boolean>
  saveDraft: () => boolean
  restoreDraft: () => boolean
  clearDraft: () => void
  flushDraft: () => void
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function sizeOf(value: unknown): number {
  // 限长一律用码点计数（与云端 validate.ts 的 maxLen 同口径）；textWidth 是显示宽度，
  // 用它判 max 会让 40 字上限放行 ~80 个 ASCII，前端过了云端回 1001。
  if (typeof value === 'string') return countChars(value)
  if (Array.isArray(value)) return value.length
  if (typeof value === 'number') return value
  if (value === undefined || value === null) return 0
  return 1
}

export function useForm<M extends object>(
  createModel: () => M,
  rules: FormRules<M> = {},
  options: UseFormOptions<M> = {}
): FormController<M> {
  const initial = createModel()
  const model = ref(createModel()) as Ref<M>
  const errors = ref({}) as Ref<FormErrors<M>>
  const submitting = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function validateField(key: keyof M): boolean {
    const list = rules[key]
    if (!list || !list.length) {
      delete errors.value[key]
      return true
    }
    const value = model.value[key]
    let message = ''
    for (const rule of list) {
      if (rule.required && isEmpty(value)) {
        message = rule.message
        break
      }
      if (isEmpty(value)) continue
      const size = sizeOf(value)
      if (rule.max !== undefined && size > rule.max) {
        message = rule.message
        break
      }
      if (rule.min !== undefined && size < rule.min) {
        message = rule.message
        break
      }
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        message = rule.message
        break
      }
      if (rule.validator && !rule.validator(value)) {
        message = rule.message
        break
      }
    }
    if (message) errors.value[key] = message
    else delete errors.value[key]
    return !message
  }

  function validate(): boolean {
    const keys = Object.keys(rules) as (keyof M)[]
    let ok = true
    for (const key of keys) {
      if (!validateField(key)) ok = false
    }
    return ok
  }

  const valid = computed(() => {
    const keys = Object.keys(rules) as (keyof M)[]
    return keys.every((key) => !errors.value[key])
  })

  function firstError(): string {
    for (const key of Object.keys(errors.value) as (keyof M)[]) {
      const message = errors.value[key]
      if (message) return message
    }
    return ''
  }

  function clearError(key: keyof M): void {
    delete errors.value[key]
  }

  function reset(): void {
    model.value = Object.assign({}, initial) as M
    errors.value = {}
  }

  async function submit(action: (model: M) => Promise<unknown>): Promise<boolean> {
    if (submitting.value) return false
    if (!validate()) {
      const message = firstError()
      if (message && options.toastInvalid !== false) showToastMsg(message)
      return false
    }
    submitting.value = true
    try {
      await action(model.value)
      return true
    } catch (err) {
      // request.ts 已经 toast 过 ApiError；这里只兜住非预期异常，避免点提交后「什么也没发生」
      logger.warn('useForm', 'submit failed', err)
      if (!(err instanceof ApiError)) showToastMsg('操作失败，请重试')
      return false
    } finally {
      submitting.value = false
    }
  }

  function saveDraft(): boolean {
    if (!options.draftKey) return false
    const ok = writeJson(options.draftKey, model.value)
    if (ok) options.onDraftSaved?.(model.value)
    return ok
  }

  function restoreDraft(): boolean {
    if (!options.draftKey) return false
    const cached = readJson<Partial<M>>(options.draftKey)
    if (!cached || typeof cached !== 'object') return false
    model.value = Object.assign({}, model.value, cached) as M
    return true
  }

  function clearDraft(): void {
    if (options.draftKey) removeStorage(options.draftKey)
  }

  function flushDraft(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    saveDraft()
  }

  if (options.draftKey) {
    watch(
      model,
      () => {
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          saveDraft()
        }, options.debounceMs ?? 1500)
      },
      { deep: true }
    )
  }

  return {
    model,
    errors,
    valid,
    submitting,
    validate,
    validateField,
    clearError,
    reset,
    submit,
    saveDraft,
    restoreDraft,
    clearDraft,
    flushDraft
  }
}
