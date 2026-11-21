<script setup lang="ts">
/**
 * 发布 / 二次编辑页。正文为**单一原生 <editor> 富文本编辑面**（Quill 内核，WebView 渲染页），
 * 不再是多个 textarea 拼块。工具栏直接驱动 EditorContext，statuschange 提供选区样式实时点亮。
 *
 * 线上契约仍是 blocks（已部署云函数对 block.text 原样存储），故用 utils/richhtml 双向桥：
 * 加载 blocksToEditorHtml → setContents；输入 editorHtmlToBlocks → useEditor.replaceBlocks（草稿/计数/提交沿用）。
 * 行内标记（strong/em/u/span/br）保存在 block.text，渲染侧 cleanInline 消毒，编辑=发布一致。
 *
 * 编排红线沿用：整页文档级滚动（page-meta 在弹层打开时锁滚动，#78/#79）；提示只有一条（request.ts 统一弹）；提交出口只有 writeAction。
 */
import { onBackPress, onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import BaseActionSheet from '@/components/base/BaseActionSheet/index.vue'
import BaseButton from '@/components/base/BaseButton/index.vue'
import BaseEmpty from '@/components/base/BaseEmpty/index.vue'
import BaseNavbar from '@/components/base/BaseNavbar/index.vue'
import BaseSkeleton from '@/components/base/BaseSkeleton/index.vue'
import DeadlinePicker from '@/components/editor/DeadlinePicker/index.vue'
import OptionsSection from '@/components/editor/OptionsSection/index.vue'
import type { ActionSheetItem } from '@/components/base/BaseActionSheet/types'
import {
  firstInvalidOptionIndex,
  optionCardId,
  optionsProblem
} from '@/components/editor/OptionsSection/types'
import { createPlan, fetchPlanDetail, updatePlan } from '@/api/plan'
import { ApiError } from '@/api/request'
import { Limit, PlanStatus, TextInput } from '@/constants/plan'
import { PAGE_KEYS } from '@/constants/pages'
import {
  DRAFT_DEBOUNCE_MS,
  invalidatePage,
  peekNow,
  resolveTempUrls,
  showToastMsg,
  uploadInlineImage,
  useActionSheet,
  useEditor,
  useForm,
  useModal,
  type FormRules
} from '@/composables'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import type { PlanWritePayload } from '@/types/cloud'
import type { Block, PlanDetail, PlanOption } from '@/types/models'
import { hasVisibleText, sanitizeBlocks } from '@/utils/blocks'
import { readInputValue } from '@/utils/event'
import { countChars } from '@/utils/format'
import { logger } from '@/utils/logger'
import { blocksToEditorHtml, editorHtmlToBlocks } from '@/utils/richhtml'
import type { EditModel, EditQuery, LoadPhase } from './types'
import {
  BLOCKING_WRITE_CODES,
  createEditModel,
  EXIT_ALERT,
  EXIT_DISCARD,
  EXIT_ITEMS,
  EXIT_SAVE_AND_LEAVE
} from './types'

/** EditorContext 的最小结构化类型（避免依赖 DOM lib） */
interface EditorCtx {
  format: (name: string, value?: unknown) => void
  insertDivider: () => void
  insertImage: (obj: { src: string; width?: string }) => void
  removeFormat: () => void
  setContents: (obj: { html: string }) => void
  getContents: (obj: { success: (res: { html: string }) => void }) => void
  blur: () => void
  undo: () => void
  redo: () => void
  clear: () => void
}
interface ToolbarTapEvent {
  currentTarget: { dataset: Record<string, string | undefined> }
}

const userStore = useUserStore()
const appStore = useAppStore()
const sheet = useActionSheet()
const modal = useModal()

/** fixed 导航的等高占位（px）：文档流里顶开导航栏高度，内容不被盖住（#79） */
const navSpaceStyle = computed(() => `height: ${appStore.navBarHeight}px;`)

/* ------------------------------------------------------------------ 表单（页面管的四件） */

const form = useForm<EditModel>(createEditModel, {
  deadline: [
    { validator: (value: number) => value > 0 && value > peekNow(), message: '请选择截止时间' }
  ]
} satisfies FormRules<EditModel>)

const model = form.model
const errors = form.errors
const submitting = form.submitting

/* ------------------------------------------------------------------ 编辑器状态机（标题/草稿/extra 沿用） */

const editor = useEditor({
  getExtra: () => ({
    images: [...model.value.images],
    deadline: model.value.deadline,
    optionsEnabled: model.value.optionsEnabled,
    options: model.value.options.map((item) => ({ ...item }))
  }),
  onDraftSaved: (savedAt) => {
    draftSavedAt.value = savedAt
  }
})

const blocks = editor.blocks
const titleText = editor.title
const charCount = editor.charCount
const plainText = editor.plainText

/* ------------------------------------------------------------------ 原生 editor 上下文与工具栏态 */

const editorCtx = shallowRef<EditorCtx | null>(null)
const formats = ref<Record<string, unknown>>({})
/** tempURL → cloud fileID。编辑面显示临时链，blocks/草稿/提交一律存 fileID */
const imgMap = new Map<string, string>()
const inlineUploading = ref(false)

/* ------------------------------------------------------------------ 页面状态 */

const planId = ref('')
const detail = ref<PlanDetail | null>(null)
const loadState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const loadError = ref('')
const writeBlocked = ref('')
const createdId = ref('')
const draftSavedAt = ref(0)
let hydrated = false
/** 发布成功沿：editor 失焦还会补发 input，桥接层每次重建块 id → isDirty 假阳，
 *  不拦的话 onUnload 的落盘会把刚删掉的草稿又写回 storage（#41） */
let published = false
const touchedExtra = ref(false)
let extraTimer: ReturnType<typeof setTimeout> | null = null

const optionsUploading = ref(false)
/** 时间选择弹层开合（DeadlinePicker @sheet）；与 ActionSheet 一起决定 page-meta 锁滚动 */
const pickerOpen = ref(false)

/* ------------------------------------------------------------------ 派生视图 */

const isEditing = computed(() => planId.value !== '')
const myOpenId = computed(() => userStore.userInfo?.openId ?? '')
const authorOpenId = computed(() => detail.value?.author.openId ?? '')
const isAuthor = computed(() => !!myOpenId.value && myOpenId.value === authorOpenId.value)
const updatable = computed(() => {
  const status = detail.value?.status
  return status === PlanStatus.Draft || status === PlanStatus.Ongoing
})

const phase = computed<LoadPhase>(() => {
  if (writeBlocked.value) return 'blocked'
  if (loadState.value === 'error') return 'error'
  if (!isEditing.value) return 'ready'
  if (loadState.value !== 'done' || !detail.value) return 'loading'
  if (!myOpenId.value) return 'loading'
  if (!isAuthor.value || !updatable.value) return 'blocked'
  return 'ready'
})

const ready = computed(() => phase.value === 'ready')
const navTitle = computed(() => (isEditing.value ? '编辑计划' : '发布计划'))
const submitText = computed(() => (isEditing.value ? '更新' : '发布'))

const blockedText = computed(() => {
  if (writeBlocked.value) return writeBlocked.value
  if (detail.value && !isAuthor.value) return '只有发起人可以编辑这个计划'
  return '这个计划已经结束，不能再编辑'
})
const blockedActionText = computed(() => (detail.value && isAuthor.value ? '看计划' : '返回'))

const titleLength = computed(() => countChars(titleText.value))
const creatorName = computed(() => {
  if (isEditing.value) return detail.value?.author.nickName || '我'
  return userStore.userInfo?.nickName || '我'
})

const gateProblem = computed<string>(() => {
  if (optionsUploading.value) return '选项配图还在上传，稍等一下再发布'
  if (inlineUploading.value) return '正文图片还在上传，稍等一下再发布'
  return ''
})

const canSubmit = computed(() => ready.value && !submitting.value && gateProblem.value === '')

const sheetState = computed(() => sheet.state.value)
const deadlineValue = computed(() => model.value.deadline)

/** 弹层打开期间锁住文档滚动（#78 防穿透）：弹层内两列 scroll-view 不受影响 */
const pageLockStyle = computed(() =>
  pickerOpen.value || sheetState.value.visible ? 'overflow:hidden;' : ''
)

function onPickerSheet(open: boolean): void {
  pickerOpen.value = open
}

/* ------------------------------------------------------------------ 进入本页：回填 / 草稿 */

onLoad((query) => {
  const { planId: fromQuery } = (query ?? {}) as EditQuery
  const id = typeof fromQuery === 'string' ? fromQuery.trim() : ''
  if (!id) {
    void enterAsNew()
    return
  }
  planId.value = id
  void loadForEdit()
})

async function enterAsNew(): Promise<void> {
  if (editor.hasDraft()) {
    const draft = editor.restoreDraft()
    if (draft) {
      applyExtra(draft)
      editor.markClean()
      draftSavedAt.value = draft.savedAt
    }
  }
  finishHydration()
  if (!hasDraftContent()) return
  const keep = await modal.confirm({
    title: '发现未发布的草稿',
    content: '上次写到一半的内容已经恢复了。要从空白重新开始吗？',
    confirmText: '继续编辑',
    // 微信 showModal 的 cancelText 上限 4 个汉字：超字会 fail，而 fail 被当「取消」→ 静默丢草稿
    cancelText: '空白开始'
  })
  if (!keep) discardDraft()
  if (pendingFlip) {
    pendingFlip = false
    replayForNewDraftKey()
  }
}

async function loadForEdit(): Promise<void> {
  loadState.value = 'loading'
  loadError.value = ''
  try {
    const data = await fetchPlanDetail(planId.value, { silent: true })
    detail.value = data
    loadState.value = 'done'
    hydrated = false
    editor.load(data.title, sanitizeBlocks(data.blocks))
    applyExtra(data)
    editor.markClean()
    finishHydration()
    void pushInitialContent()
  } catch (err) {
    logger.warn('plan-edit', 'detail failed', err)
    loadError.value =
      err instanceof ApiError && err.message ? err.message : '加载失败，请检查网络后重试'
    loadState.value = 'error'
  }
}

function retry(): void {
  void loadForEdit()
}

function applyExtra(src: EditModel | PlanDraftLike): void {
  model.value.images = Array.isArray(src.images) ? [...src.images] : []
  model.value.deadline = typeof src.deadline === 'number' ? src.deadline : 0
  model.value.optionsEnabled = Boolean(src.optionsEnabled)
  model.value.options = Array.isArray(src.options)
    ? src.options.map((item, index) => ({ ...item, order: index }))
    : []
}

interface PlanDraftLike {
  images: string[]
  deadline: number
  optionsEnabled: boolean
  options: PlanOption[]
}

function finishHydration(): void {
  void nextTick(() => {
    hydrated = true
  })
}

function hasDraftContent(): boolean {
  return (
    titleText.value.trim() !== '' ||
    plainText.value.trim() !== '' ||
    model.value.images.length > 0 ||
    model.value.options.length > 0
  )
}

function discardDraft(): void {
  editor.clearDraft()
  editor.load('', [])
  hydrated = false
  applyExtra(createEditModel())
  editor.markClean()
  draftSavedAt.value = 0
  touchedExtra.value = false
  clearExtraTimer()
  finishHydration()
  void pushInitialContent()
}

/* ------------------------------------------------------------------ 草稿键翻转 */

let pendingFlip = false
let draftOfferOpen = false

watch(
  () => editor.draftKey.value,
  (next, prev) => {
    if (!next || next === prev) return
    if (isEditing.value) return
    if (editor.isDirty.value) return
    if (draftOfferOpen) {
      pendingFlip = true
      return
    }
    replayForNewDraftKey()
  }
)

function replayForNewDraftKey(): void {
  const draft = editor.restoreDraft()
  if (draft) {
    hydrated = false
    applyExtra(draft)
    editor.markClean()
    draftSavedAt.value = draft.savedAt
    finishHydration()
    void pushInitialContent()
    return
  }
  if (hasDraftContent()) editor.saveDraft(true)
}

watch(
  model,
  () => {
    if (!hydrated) return
    touchedExtra.value = true
    editor.scheduleDraft()
    clearExtraTimer()
    extraTimer = setTimeout(() => {
      extraTimer = null
      if (!editor.isDirty.value) editor.saveDraft(true)
    }, DRAFT_DEBOUNCE_MS)
  },
  { deep: true }
)

function clearExtraTimer(): void {
  if (extraTimer !== null) {
    clearTimeout(extraTimer)
    extraTimer = null
  }
}

function persistBeforeLeave(): void {
  if (submitting.value || published) return
  clearExtraTimer()
  if (touchedExtra.value && !editor.isDirty.value) editor.saveDraft(true)
  else editor.flushDraft()
  touchedExtra.value = false
}

onUnload(() => {
  clearExtraTimer()
  persistBeforeLeave()
})

/* ------------------------------------------------------------------ 退出确认 */

onBackPress(() => {
  if (!needsExitGuard()) return false
  void guardedExit()
  return true
})

function needsExitGuard(): boolean {
  return ready.value && (editor.isDirty.value || touchedExtra.value)
}

function onNavBack(): void {
  if (!needsExitGuard()) {
    leave()
    return
  }
  void guardedExit()
}

let exitOpen = false

async function guardedExit(): Promise<void> {
  if (exitOpen) return
  exitOpen = true
  const index = await sheet.openNative([...EXIT_ITEMS], EXIT_ALERT)
  exitOpen = false
  if (index < 0) return
  if (index === EXIT_SAVE_AND_LEAVE) {
    persistBeforeLeave()
    leave()
    return
  }
  if (index === EXIT_DISCARD) {
    editor.clearDraft()
    clearExtraTimer()
    touchedExtra.value = false
    leave()
  }
}

function leave(): void {
  if (getCurrentPages().length > 1) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.switchTab({ url: '/pages/home/index' })
}

function onBlockedAction(): void {
  const id = planId.value
  if (detail.value && isAuthor.value && id) {
    uni.redirectTo({ url: `/pages/plan/detail/index?planId=${id}` })
    return
  }
  leave()
}

/* ------------------------------------------------------------------ 标题 */

function onTitleInput(event: unknown): void {
  editor.setTitle(readInputValue(event))
}

function onTitleFocus(): void {
  editorCtx.value?.blur()
}

/* ------------------------------------------------------------------ 原生 editor：初始化 / 输入 / 工具栏 */

function onEditorReady(): void {
  uni
    .createSelectorQuery()
    .select('#rich-editor')
    .context((res) => {
      editorCtx.value = (res as unknown as { context: EditorCtx }).context
      void pushInitialContent()
    })
    .exec()
}

/** blocks → editor HTML；cloud 图换成临时链供编辑面显示，并登记 temp→fileID */
async function pushInitialContent(): Promise<void> {
  const ctx = editorCtx.value
  if (!ctx) return
  let html = blocksToEditorHtml(blocks.value)
  const fileIDs = blocks.value
    .filter(
      (b): b is Extract<Block, { type: 'image' }> =>
        b.type === 'image' && b.fileID.startsWith('cloud://')
    )
    .map((b) => b.fileID)
  if (fileIDs.length) {
    const temp = await resolveTempUrls(fileIDs)
    for (const [cloud, url] of temp) {
      imgMap.set(url, cloud)
      html = html.split(cloud).join(url)
    }
  }
  ctx.setContents({ html })
}

/** 把 html 里 img 的临时链替换回 fileID（blocks/草稿/提交只认 fileID） */
function withCloudSrc(html: string): string {
  return html.replace(/<img\b[^>]*src="([^"]*)"[^>]*>/gi, (tag, src: string) => {
    // Quill 序列化会把 src 里的 & 转义成 &amp;（临时链带 sign query），不解转义 imgMap 查不中
    const cloud = imgMap.get(src.replace(/&amp;/g, '&'))
    return cloud ? tag.split(src).join(cloud) : tag
  })
}

function onEditorInput(event: { detail?: { html?: string } }): void {
  if (published) return
  const html = event.detail?.html ?? ''
  editor.replaceBlocks(editorHtmlToBlocks(withCloudSrc(html)))
}

function onStatusChange(event: { detail?: Record<string, unknown> }): void {
  formats.value = event.detail ?? {}
}

function isOn(name: string, value?: string): boolean {
  const f = formats.value
  if (name === 'header') return String(f.header ?? '') === (value ?? '')
  if (name === 'align') return String(f.align ?? '') === value
  if (name === 'color') return String(f.color ?? '') === (value ?? '')
  return Boolean(f[name])
}

function tbClass(name: string, value?: string): string {
  return isOn(name, value) ? 'plan-edit__tb-item plan-edit__tb-item--on' : 'plan-edit__tb-item'
}

function alignIcon(value: string): string {
  return `/static/editor/align-${value}${isOn('align', value) ? '-on' : ''}.png`
}

async function clearEditor(): Promise<void> {
  const ctx = editorCtx.value
  if (!ctx) return
  const ok = await modal.confirm({
    title: '清空正文',
    content: '将删除编辑面里的全部正文，确定吗？',
    confirmText: '清空'
  })
  if (ok) ctx.clear()
}

/** 工具栏统一入口：data-name/value 走 format，data-action 走撤销/缩进/插图/清空。touchend.stop 保住选区 */
function onFormatTap(event: unknown): void {
  const ctx = editorCtx.value
  if (!ctx || submitting.value) return
  const ds = (event as ToolbarTapEvent).currentTarget.dataset
  if (ds.action === 'undo') {
    ctx.undo()
    return
  }
  if (ds.action === 'redo') {
    ctx.redo()
    return
  }
  if (ds.action === 'indent') {
    ctx.format('indent', ds.value)
    return
  }
  if (ds.action === 'image') {
    void insertInlineImage()
    return
  }
  if (ds.action === 'trash') {
    void clearEditor()
    return
  }
  const name = ds.name
  if (!name) return
  let value: unknown
  if (name === 'header') value = ds.value ? Number(ds.value) : false
  else if (name === 'color') value = ds.value ?? ''
  else if (name === 'bold' || name === 'italic' || name === 'underline' || name === 'strike') {
    // 显式翻转：跟工具栏点亮态一致，不依赖 editor 对「省略 value」的隐式 toggle（跨基础库版本更稳）
    value = !isOn(name)
  } else value = ds.value === undefined || ds.value === '' ? undefined : ds.value
  ctx.format(name, value)
}

/** 正文插图：选图→上传云存储→临时链插入编辑面，登记 temp→fileID */
async function insertInlineImage(): Promise<void> {
  const ctx = editorCtx.value
  if (!ctx || inlineUploading.value) return
  uni.chooseImage({
    count: 1,
    success: (res) => {
      const path = res.tempFilePaths[0]
      if (!path) return
      void (async () => {
        inlineUploading.value = true
        try {
          const { fileID, tempURL } = await uploadInlineImage(path)
          if (!tempURL) throw new Error('no temp url')
          imgMap.set(tempURL, fileID)
          ctx.insertImage({ src: tempURL, width: '100%' })
        } catch (err) {
          logger.warn('plan-edit', 'inline image failed', err)
          showToastMsg('图片上传失败，请重试')
        } finally {
          inlineUploading.value = false
        }
      })()
    }
  })
}

/** 提交前把编辑面最新内容收进 blocks（getContents 异步） */
function syncEditor(): Promise<void> {
  return new Promise((resolve) => {
    const ctx = editorCtx.value
    if (!ctx) {
      resolve()
      return
    }
    ctx.getContents({
      success: (res) => {
        editor.replaceBlocks(editorHtmlToBlocks(withCloudSrc(res.html)))
        resolve()
      }
    })
  })
}

/* ------------------------------------------------------------------ ActionSheet 宿主转发 */

function onSheetSelect(_action: ActionSheetItem, index: number): void {
  sheet.resolve(index)
}

function onSheetCancel(): void {
  sheet.resolve(-1)
}

function onSheetVisible(value: boolean): void {
  if (!value) sheet.close()
}

/* ------------------------------------------------------------------ 截止 / 选项 */

function onDeadlineChange(value: number): void {
  model.value.deadline = value
  form.clearError('deadline')
}

function onOptionsToggle(enabled: boolean): void {
  model.value.optionsEnabled = enabled
}

function onOptionsChange(next: PlanOption[]): void {
  model.value.options = next
}

function onOptionsUploading(value: boolean): void {
  optionsUploading.value = value
}

function validateOptions(): boolean {
  const problem = optionsProblem(model.value.options, model.value.optionsEnabled)
  if (!problem) return true
  showToastMsg(problem)
  const bad = firstInvalidOptionIndex(model.value.options)
  const target = bad >= 0 ? model.value.options[bad] : undefined
  if (target) scrollToNode(optionCardId(target.id))
  return false
}

/** 文档级滚动定位（#79）：选项校验失败滚到问题卡片，替代 scroll-into-view */
function scrollToNode(id: string): void {
  uni.pageScrollTo({ selector: `#${id}`, duration: 200 })
}

function validateContent(): boolean {
  if (titleText.value.trim() === '') {
    showToastMsg('先给计划起个标题')
    return false
  }
  if (plainText.value.trim() === '') {
    showToastMsg('正文还是空的，写两句再发布')
    return false
  }
  return true
}

/* ------------------------------------------------------------------ 提交 */

async function onSubmit(): Promise<void> {
  if (!ready.value || submitting.value) return
  const problem = gateProblem.value
  if (problem) {
    showToastMsg(problem)
    return
  }
  await syncEditor()
  if (!validateOptions()) return
  if (!validateContent()) return
  const ok = await form.submit(writeAction)
  if (!ok) return
  afterWritten()
}

async function writeAction(payloadModel: EditModel): Promise<void> {
  const payload: PlanWritePayload = {
    title: titleText.value.trim(),
    // 末尾空文本段是 ensureTrailingTextBlock 给光标垫的占位，云端拒收空正文，提交前滤掉
    blocks: cloneBlocks(blocks.value).filter(
      (b) => b.type === 'image' || b.type === 'divider' || hasVisibleText(b.text)
    ),
    images: [...payloadModel.images],
    deadline: payloadModel.deadline,
    optionsEnabled: payloadModel.optionsEnabled,
    options: payloadModel.options.map((item) => ({ ...item }))
  }
  const id = planId.value
  try {
    if (id) {
      await updatePlan({ planId: id, ...payload })
      return
    }
    const res = await createPlan(payload)
    createdId.value = res.planId
  } catch (err) {
    if (err instanceof ApiError && BLOCKING_WRITE_CODES.includes(err.code)) {
      writeBlocked.value = err.message || '这个计划已经不能编辑了'
    }
    throw err
  }
}

function cloneBlocks(list: Block[]): Block[] {
  return list.map((block) => ({ ...block }))
}

function afterWritten(): void {
  published = true
  editor.clearDraft()
  editor.markClean()
  clearExtraTimer()
  draftSavedAt.value = 0
  touchedExtra.value = false
  optionsUploading.value = false
  invalidatePage(PAGE_KEYS.home)
  invalidatePage(PAGE_KEYS.mine)
  if (isEditing.value) invalidatePage(PAGE_KEYS.planDetail)
  if (isEditing.value) {
    leave()
    return
  }
  const created = createdId.value
  if (created) {
    uni.redirectTo({ url: `/pages/plan/detail/index?planId=${created}` })
    return
  }
  leave()
}

const toolbarDisabled = computed(() => submitting.value || !ready.value)
</script>

<template>
  <!-- page-meta 必须是模板首节点：弹层打开时锁文档滚动（#78 防穿透） -->
  <page-meta :page-style="pageLockStyle" />
  <view class="plan-edit">
    <BaseNavbar :title="navTitle" :guard-back="true" fixed @back="onNavBack" />
    <view class="plan-edit__nav-space" :style="navSpaceStyle" />

    <view class="plan-edit__flow">
      <view v-if="phase === 'loading'" class="plan-edit__state">
        <BaseSkeleton type="detail" :rows="6" :avatar="false" />
      </view>

      <view v-if="phase === 'error'" class="plan-edit__state">
        <BaseEmpty :text="loadError" action-text="重新加载" @action="retry" />
      </view>

      <view v-if="phase === 'blocked'" class="plan-edit__state">
        <BaseEmpty :text="blockedText" :action-text="blockedActionText" @action="onBlockedAction" />
      </view>

      <!-- 标题 / 创建人 / 详情 同卡三段；详情 = 单一原生富文本编辑面 -->
      <view v-if="ready" class="plan-edit__card">
        <view class="plan-edit__section-head">
          <text class="plan-edit__section-title">标题</text>
          <text
            :class="
              titleLength >= Limit.TITLE_MAX
                ? 'plan-edit__counter plan-edit__counter--full'
                : 'plan-edit__counter'
            "
          >
            {{ titleLength }}/{{ Limit.TITLE_MAX }}
          </text>
        </view>
        <textarea
          class="plan-edit__title"
          :value="titleText"
          placeholder="一句话说清这次要议什么"
          :maxlength="Limit.TITLE_MAX"
          :auto-height="true"
          :adjust-position="true"
          :cursor-spacing="TextInput.CURSOR_SPACING"
          :hold-keyboard="true"
          :disable-default-padding="true"
          @focus="onTitleFocus"
          @input="onTitleInput"
        />

        <view class="plan-edit__creator">
          <text class="plan-edit__field-label">创建人</text>
          <text class="plan-edit__creator-name">{{ creatorName }}</text>
        </view>

        <view class="plan-edit__field-head plan-edit__field-head--detail">
          <text class="plan-edit__field-label">详情</text>
        </view>

        <!-- 参考图工具栏：详情标签下、编辑面上方的圆角灰卡，两行图标。touchend.stop 保住选区 -->
        <view
          :class="
            toolbarDisabled ? 'plan-edit__toolbar plan-edit__toolbar--off' : 'plan-edit__toolbar'
          "
        >
          <view class="plan-edit__tb-row">
            <view :class="tbClass('bold')" data-name="bold" @touchend.stop="onFormatTap"
              ><text class="plan-edit__tb-b">B</text></view
            >
            <view :class="tbClass('italic')" data-name="italic" @touchend.stop="onFormatTap"
              ><text class="plan-edit__tb-i">I</text></view
            >
            <view :class="tbClass('underline')" data-name="underline" @touchend.stop="onFormatTap"
              ><text class="plan-edit__tb-u">U</text></view
            >
            <view
              :class="tbClass('align', 'left')"
              data-name="align"
              data-value="left"
              @touchend.stop="onFormatTap"
            >
              <image class="plan-edit__tb-icon" :src="alignIcon('left')" mode="aspectFit" />
            </view>
            <view
              :class="tbClass('align', 'center')"
              data-name="align"
              data-value="center"
              @touchend.stop="onFormatTap"
            >
              <image class="plan-edit__tb-icon" :src="alignIcon('center')" mode="aspectFit" />
            </view>
            <view
              :class="tbClass('align', 'right')"
              data-name="align"
              data-value="right"
              @touchend.stop="onFormatTap"
            >
              <image class="plan-edit__tb-icon" :src="alignIcon('right')" mode="aspectFit" />
            </view>
            <view
              :class="tbClass('align', 'justify')"
              data-name="align"
              data-value="justify"
              @touchend.stop="onFormatTap"
            >
              <image class="plan-edit__tb-icon" :src="alignIcon('justify')" mode="aspectFit" />
            </view>
          </view>
          <view class="plan-edit__tb-row">
            <view class="plan-edit__tb-item" data-action="undo" @touchend.stop="onFormatTap">
              <image class="plan-edit__tb-icon" src="/static/editor/undo.png" mode="aspectFit" />
            </view>
            <view class="plan-edit__tb-item" data-action="redo" @touchend.stop="onFormatTap">
              <image class="plan-edit__tb-icon" src="/static/editor/redo.png" mode="aspectFit" />
            </view>
            <view
              class="plan-edit__tb-item"
              data-action="indent"
              data-value="-1"
              @touchend.stop="onFormatTap"
            >
              <image
                class="plan-edit__tb-icon"
                src="/static/editor/indent-out.png"
                mode="aspectFit"
              />
            </view>
            <view
              class="plan-edit__tb-item"
              data-action="indent"
              data-value="+1"
              @touchend.stop="onFormatTap"
            >
              <image
                class="plan-edit__tb-icon"
                src="/static/editor/indent-in.png"
                mode="aspectFit"
              />
            </view>
            <view
              :class="tbClass('header', '1')"
              data-name="header"
              data-value="1"
              @touchend.stop="onFormatTap"
              ><text class="plan-edit__tb-h1">H1</text></view
            >
            <view class="plan-edit__tb-item" data-action="image" @touchend.stop="onFormatTap">
              <image class="plan-edit__tb-icon" src="/static/editor/image.png" mode="aspectFit" />
            </view>
            <view class="plan-edit__tb-item" data-action="trash" @touchend.stop="onFormatTap">
              <image class="plan-edit__tb-icon" src="/static/editor/trash.png" mode="aspectFit" />
            </view>
          </view>
        </view>

        <editor
          id="rich-editor"
          class="plan-edit__editor"
          placeholder="写点什么，支持加粗 / 斜体 / 标题 / 对齐 / 插图…"
          @ready="onEditorReady"
          @input="onEditorInput"
          @statuschange="onStatusChange"
        />
      </view>

      <view v-if="ready" class="plan-edit__section">
        <DeadlinePicker
          :deadline="deadlineValue"
          @change="onDeadlineChange"
          @sheet="onPickerSheet"
        />
        <text v-if="errors.deadline" class="plan-edit__error plan-edit__error--inset">{{
          errors.deadline
        }}</text>
      </view>

      <view v-if="ready" class="plan-edit__section">
        <OptionsSection
          :enabled="model.optionsEnabled"
          :options="model.options"
          @toggle="onOptionsToggle"
          @change="onOptionsChange"
          @uploading="onOptionsUploading"
        />
      </view>

      <view v-if="ready" class="plan-edit__tail" />
    </view>

    <!-- 状态行 + 发布栏：fixed 置底栈（#79），tail 占位高度与之对账 -->
    <view v-if="ready" class="plan-edit__bottom">
      <!-- 状态行：底栏透明之后，靠灰底挡住内容才可读这条路没了 —— 它改成一颗胶囊，
           与首页发布 pill、底部导航胶囊同一语言（浮层控件不透明，带子本身不画背景） -->
      <view class="plan-edit__status">
        <view class="plan-edit__status-pill">
          <text class="plan-edit__status-hint">{{
            draftSavedAt > 0 ? '草稿已自动保存' : '内容改动会自动存到本机'
          }}</text>
          <text class="plan-edit__status-count">{{ charCount }} 字</text>
        </view>
      </view>

      <!-- 发布按钮置底（用户裁定 2026-11-13）：导航栏只留居中标题 -->
      <view class="plan-edit__footer">
        <BaseButton
          type="primary"
          size="lg"
          block
          :disabled="!canSubmit"
          :loading="submitting"
          @click="onSubmit"
        >
          <text class="plan-edit__footer-text">{{ submitting ? '提交中' : submitText }}</text>
        </BaseButton>
      </view>
    </view>

    <BaseActionSheet
      :visible="sheetState.visible"
      :title="sheetState.title"
      :actions="sheetState.actions"
      @update:visible="onSheetVisible"
      @select="onSheetSelect"
      @cancel="onSheetCancel"
    />
  </view>
</template>

<style lang="scss" scoped>
.plan-edit {
  @include page-root-doc;
  background-color: $color-bg-page;
}

.plan-edit__nav-space {
  width: 100%;
  flex-shrink: 0;
}

.plan-edit__flow {
  width: 100%;
}

.plan-edit__card {
  @include card;
  margin: $card-gap $space-3 0;
  padding: $space-3;
}

.plan-edit__section {
  @include card;
  margin: $card-gap $space-3 0;
}

.plan-edit__state {
  @include card;
  margin: $card-gap $space-3 0;
}

.plan-edit__section-head {
  @include section-head;
}

.plan-edit__section-title {
  @include section-title;
}

.plan-edit__field-head {
  @include flex-between;
  width: 100%;
}

.plan-edit__field-head--detail {
  margin-top: $space-4;
  margin-bottom: $space-2;
}

.plan-edit__creator {
  @include flex-between;
  width: 100%;
  margin-top: $space-3;
}

.plan-edit__creator-name {
  font-size: $font-sm;
  color: $color-text-2;
  @include ellipsis-1;
}

.plan-edit__field-label {
  font-size: $font-sm;
  color: $color-text-2;
}

.plan-edit__counter {
  font-size: $font-sm;
  color: $color-text-3;
}

.plan-edit__counter--full {
  color: $color-danger;
}

.plan-edit__title {
  width: 100%;
  min-height: $tap-min-height;
  margin-top: 0;
  font-size: $font-lg;
  font-weight: $font-weight-semibold;
  line-height: $line-tight;
  color: $color-text-1;
  background-color: transparent;
  border: 0;
  padding: 0;
}

// 单一富文本编辑面：原生 editor 自带 Quill 排版，这里只给最小高度/字号/留白
.plan-edit__editor {
  width: 100%;
  min-height: 480rpx;
  margin-top: $space-3;
  font-size: $font-md;
  line-height: 1.7;
  color: $color-text-1;
}

.plan-edit__error {
  width: 100%;
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-danger;
}

.plan-edit__error--inset {
  padding-bottom: $space-2;
}

// 尾部占位 = fixed 底栏真实高度，逐项对上：
//   状态行 = 行内距 $space-1*2 + 胶囊自身内距 $space-1*2 + 文本行高 $font-xs*$line-normal
//   发布栏 = $space-2*3 + 按钮高 + 安全区
// 再加 $space-3 余量兜住取整误差，滚到底时最后一张卡不被盖住（#79）。
// 底栏透明之后这一条更要留着：以前内容滚进不透明底栏是「看不见」，现在是「压在按钮底下」，
// 让位只能靠占位，不能靠背景遮。
.plan-edit__tail {
  width: 100%;
  height: calc(
    #{$space-1 * 4 + $font-xs * $line-normal + $space-2 * 3 + $button-height-lg + $space-3} +
      env(safe-area-inset-bottom)
  );
}

// 状态行 + 发布栏的 fixed 置底栈（#79）：不占文档流，尾部占位与它对账。
// 2026-11-18 用户口径：与底部导航同款 —— 底栏自己不画背景，内容从按钮四周透出来。
// 于是这一层只剩「定位 + 让位」，看得见的只有那颗主色按钮。
.plan-edit__bottom {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: $z-navbar;
}

// 状态行：整行只负责居中，不画背景；可读性由那颗胶囊自己负责（白底 + 近影，与首页 pill 同款）
.plan-edit__status {
  width: 100%;
  padding: $space-1 $space-3;
  @include flex-center;
}

.plan-edit__status-pill {
  display: flex;
  flex-direction: row;
  align-items: center;
  max-width: 100%;
  padding: $space-1 $space-3;
  background-color: $color-bg-card;
  border-radius: $radius-round;
  box-shadow: $shadow-popup;
}

.plan-edit__status-hint {
  min-width: 0;
  font-size: $font-xs;
  color: $color-text-3;
}

.plan-edit__status-count {
  margin-left: $space-2;
  font-size: $font-xs;
  color: $color-text-3;
}

// 参考图工具栏：详情标签下、编辑面上方的圆角灰卡，两行图标
.plan-edit__toolbar {
  width: 100%;
  margin-top: $space-3;
  padding: $space-2 $space-2;
  background-color: $color-fill-light;
  border-radius: $radius-md;
}

.plan-edit__toolbar--off {
  opacity: 0.5;
}

.plan-edit__tb-row {
  @include flex-center;
  justify-content: space-between;
  width: 100%;
  min-height: 72rpx;
}

.plan-edit__tb-item {
  @include flex-center;
  min-width: 56rpx;
  height: 56rpx;
  border-radius: $radius-sm;
  font-size: $font-md;
  color: $color-text-1;
}

.plan-edit__tb-item--on {
  color: $color-primary;
  background-color: $color-bg-card;
}

.plan-edit__tb-icon {
  width: 40rpx;
  height: 40rpx;
}

.plan-edit__tb-b {
  font-weight: 700;
}

.plan-edit__tb-i {
  font-style: italic;
}

.plan-edit__tb-u {
  text-decoration: underline;
}

.plan-edit__tb-h1 {
  font-size: $font-xs;
  font-weight: 600;
}

// 置底发布栏：只剩安全区与内距。背景与顶部细线一起去掉（2026-11-18 用户口径，与底部导航同款）——
// 底栏透明之后，那条细线就成了浮在内容上的一道孤线，不再分隔任何东西。
// 按钮保持主色实心：它是这一层唯一的前景，透明的是「栏」，不是「按钮」。
.plan-edit__footer {
  width: 100%;
  padding: $space-2 $space-3;
  @include safe-area-bottom($space-2);
}

.plan-edit__footer-text {
  font-size: $font-lg;
  font-weight: $font-weight-semibold;
  color: $color-text-inverse;
}
</style>

<style lang="scss">
// 文档级滚动（#79）：覆盖 app.wxss 的 page{height:100%;overflow:hidden}。
// 必须非 scoped：scoped 会给选择器加属性限定，page 标签选择器直接失效；
// 页面级 wxss 晚于 app.wxss 加载，同优先级下这里的规则生效。
page {
  height: auto;
  overflow: visible;
}
</style>
