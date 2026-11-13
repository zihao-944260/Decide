import { Limit } from '@/constants/plan'
import { bindDispose } from '@/composables/internal'
import { peekNow } from '@/composables/useServerNow'
import { useUserStore } from '@/stores/user'
import type { PlanWritePayload } from '@/types/cloud'
import type { Block, TextBlock } from '@/types/models'
import {
  blocksCharCount,
  blocksToText,
  createBlockId,
  createDividerBlock,
  createImageBlock,
  createQuoteBlock,
  createTextBlock,
  ensureTrailingTextBlock,
  initialBlocks,
  isStylable,
  sanitizeBlocks,
  serializeBlocks,
  type ParagraphStyle,
} from '@/utils/blocks'
import { clipChars, countChars } from '@/utils/format'
import { hasStorage, readJson, removeStorage, writeJson } from '@/utils/storage'
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

/**
 * 块编辑器状态机（技术方案 §8.1）。段落级样式：Skyline 下 textarea 取不到选区（兼容清单 §2.4），
 * 所以 bold/color/align/level 一律作用于「当前聚焦块」整段，不做区间 marks。
 *
 * 定位/滚动一律用 scroll-into-view + 块 id，不做任何 boundingClientRect 测量：
 * 编辑区在 scroll-view type="list" 里，视口外节点被虚拟化，测它会永久挂起（兼容清单 §2.3）。
 * 这也是 setFocus 只写 scrollIntoViewId、不算滚动偏移量的原因。
 */

const DRAFT_PREFIX = 'plan_draft_'

/**
 * 草稿 debounce 的唯一节拍（ms）。**导出**是给页面用的：编辑页在「只改了 deadline/options/配图、
 * 正文一个字没动」时要自己补一刀 force 落盘，等待时长必须与这里同一个数 ——
 * 两条 debounce 一旦不同值，用户就会看到「改了截止时间后草稿落得比打字慢」。
 * 页面此前自带一份 1500 就是缺这个出口（已收口，勿再抄第二份）。
 */
export const DRAFT_DEBOUNCE_MS = 1500

/** 截止时间/选项/配图这些字段的生命周期在页面（useForm），草稿要整包存，所以由页面「借读」给编辑器 */
export type EditorExtra = Omit<PlanWritePayload, 'title' | 'blocks'>

export interface PlanDraft extends PlanWritePayload {
  savedAt: number
}

export interface UseEditorOptions {
  getExtra?: () => EditorExtra
  /** 未登录时的草稿也要能存，缺省取 userStore 的 openId */
  openId?: string
  debounceMs?: number
  /** 草稿落盘结果回调，页面据此显示「已自动保存」角标 */
  onDraftSaved?: (savedAt: number) => void
}

export interface EditorController {
  blocks: Ref<Block[]>
  title: Ref<string>
  focusId: Ref<string>
  /** 绑给 scroll-view 的 scroll-into-view；不测高度，只给 id */
  scrollIntoViewId: Ref<string>
  isDirty: ComputedRef<boolean>
  charCount: ComputedRef<number>
  plainText: ComputedRef<string>
  activeStyle: ComputedRef<ParagraphStyle | null>
  stylable: ComputedRef<boolean>
  draftKey: ComputedRef<string>
  setFocus: (id: string) => void
  blur: () => void
  blurIf: (id: string) => void
  setText: (id: string, text: string) => void
  setTitle: (text: string) => void
  /** 整包替换 blocks（native editor 同步用）：不重置脏基线，watch 会自动排草稿 */
  replaceBlocks: (list: Block[]) => void
  addTextBlock: (afterId?: string) => string
  insertBlock: (block: Block, afterId?: string) => string
  insertQuote: (afterId?: string) => string
  insertDivider: (afterId?: string) => string
  insertImage: (fileID: string, w: number, h: number, afterId?: string) => string
  updateImage: (id: string, next: { fileID: string; w: number; h: number }) => void
  removeBlock: (id: string) => void
  moveBlock: (id: string, delta: number) => void
  duplicateBlock: (id: string) => string | null
  applyStyle: (patch: ParagraphStyle) => void
  applyStyleTo: (id: string, patch: ParagraphStyle) => void
  toggleBold: () => void
  indexOf: (id: string) => number
  serialize: () => string
  load: (nextTitle: string, nextBlocks: Block[]) => void
  markClean: () => void
  hasDraft: () => boolean
  saveDraft: (force?: boolean) => boolean
  restoreDraft: () => PlanDraft | null
  clearDraft: () => void
  scheduleDraft: () => void
  flushDraft: () => void
}

function emptyExtra(): EditorExtra {
  return { images: [], deadline: 0, optionsEnabled: false, options: [] }
}

export function useEditor(options: UseEditorOptions = {}): EditorController {
  const userStore = useUserStore()
  const debounceMs = options.debounceMs ?? DRAFT_DEBOUNCE_MS

  const blocks = ref<Block[]>(initialBlocks())
  const title = ref('')
  const focusId = ref('')
  const scrollIntoViewId = ref('')
  /** 脏检查基线：跟快照字符串比，而不是「改过就 true」—— 用户删了又打回来不该算脏 */
  let baseline = ''
  let timer: ReturnType<typeof setTimeout> | null = null

  const owner = () => options.openId || userStore.userInfo?.openId || 'guest'
  const draftKey = computed(() => `${DRAFT_PREFIX}${owner()}`)

  function snapshot(): string {
    return JSON.stringify([title.value, blocks.value])
  }

  const isDirty = computed(() => snapshot() !== baseline)
  const charCount = computed(() => blocksCharCount(blocks.value) + countChars(title.value))
  const plainText = computed(() => blocksToText(blocks.value))
  const stylable = computed(() => isStylable(focusedBlock()))

  function indexOf(id: string): number {
    return blocks.value.findIndex((block) => block.id === id)
  }

  function focusedBlock(): Block | undefined {
    if (!focusId.value) return undefined
    const index = indexOf(focusId.value)
    return index < 0 ? undefined : blocks.value[index]
  }

  const activeStyle = computed<ParagraphStyle | null>(() => {
    const block = focusedBlock()
    if (!isStylable(block)) return null
    return { level: block.level, align: block.align, bold: Boolean(block.bold), color: block.color ?? '' }
  })

  function replaceAt(index: number, next: Block): void {
    const list = blocks.value.slice()
    list[index] = next
    blocks.value = list
  }

  function setFocus(id: string): void {
    focusId.value = id
    scrollIntoViewId.value = id ? `blk-${id}` : ''
  }

  function blur(): void {
    focusId.value = ''
  }

  /**
   * **只有** `id` 仍是当前聚焦块时才清焦点，给页面的 `@blur="editor.blurIf"` 用。
   *
   * 为什么需要它而不是页面写 `if (editor.focusId.value === id) editor.blur()`：A→B 快速切换时，
   * B 的 focus 已经同步写进 `focusId`，A 的 blur 事件才到达（子件事件慢一拍）。无条件 blur 会把
   * 刚设好的 focusId(B) 抹掉，表现是「点了下一个块，工具栏整排变灰」。这条竞态判定和 `setFocus`
   * 写的是同一个字段，放两个地方早晚会对不上，所以收进共享层。
   */
  function blurIf(id: string): void {
    if (focusId.value === id) focusId.value = ''
  }

  function setTitle(text: string): void {
    title.value = clipChars(text, Limit.TITLE_MAX)
  }

  function replaceBlocks(list: Block[]): void {
    blocks.value = ensureTrailingTextBlock(list.length ? list : initialBlocks())
  }

  function setText(id: string, text: string): void {
    const index = indexOf(id)
    if (index < 0) return
    const block = blocks.value[index]
    // 只认文本类块，图片/分割线块的 input 事件不该走到这里
    if (block.type !== 'text' && block.type !== 'quote') return
    replaceAt(index, { ...block, text: clipChars(text, Limit.BLOCK_TEXT_MAX) })
  }

  /** 插入位置：afterId 之后；没给就插在「末尾占位块」之前，保证空块始终垫在最后 */
  function insertBlock(block: Block, afterId?: string): string {
    const list = blocks.value.slice()
    const anchor = afterId ? list.findIndex((item) => item.id === afterId) : -1
    const at = anchor >= 0 ? anchor + 1 : Math.max(0, list.length - 1)
    list.splice(at, 0, block)
    blocks.value = ensureTrailingTextBlock(list)
    return block.id
  }

  function addTextBlock(afterId?: string): string {
    return insertBlock(createTextBlock(), afterId)
  }

  function insertQuote(afterId?: string): string {
    return insertBlock(createQuoteBlock(), afterId)
  }

  function insertDivider(afterId?: string): string {
    return insertBlock(createDividerBlock(), afterId)
  }

  function insertImage(fileID: string, w: number, h: number, afterId?: string): string {
    return insertBlock(createImageBlock(fileID, w, h), afterId)
  }

  /**
   * 写回图片块。图块先以空 fileID 落进列表（组件选图/上传中），成功后由组件把
   * `{fileID,w,h}` 交回这里 —— blocks 里只有 fileID 一个字段承载图源，本地临时路径不进数据。
   * 非 image 块或 id 已不存在一律静默忽略：上传是异步回调，踩到用户中途删掉的块是常态。
   * 注意空 fileID 的块不会被草稿恢复保留（`sanitizeBlocks` 丢弃它），上传中断就是整块消失，符合预期。
   */
  function updateImage(id: string, next: { fileID: string; w: number; h: number }): void {
    const index = indexOf(id)
    const block = blocks.value[index]
    if (!block || block.type !== 'image') return
    replaceAt(index, { ...block, fileID: next.fileID, w: next.w, h: next.h })
  }

  function removeBlock(id: string): void {
    const index = indexOf(id)
    if (index < 0) return
    const list = blocks.value.filter((block) => block.id !== id)
    blocks.value = ensureTrailingTextBlock(list.length ? list : initialBlocks())
    if (focusId.value === id) {
      const neighbor = blocks.value[Math.min(index, blocks.value.length - 1)]
      setFocus(neighbor ? neighbor.id : '')
    }
  }

  function moveBlock(id: string, delta: number): void {
    const from = indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= blocks.value.length) return
    const list = blocks.value.slice()
    const moved = list[from]
    list.splice(from, 1)
    list.splice(to, 0, moved)
    blocks.value = list
  }

  /** 复制块：必须换 id，否则两份同 id 的块会让 v-for key 撞车、后续删除/移动全错位 */
  function duplicateBlock(id: string): string | null {
    const index = indexOf(id)
    if (index < 0) return null
    const clone = sanitizeBlocks([Object.assign({}, blocks.value[index], { id: createBlockId() })])[0]
    if (!clone) return null
    return insertBlock(clone, id)
  }

  function applyStyle(patch: ParagraphStyle): void {
    const block = focusedBlock()
    if (!block) return
    applyStyleTo(block.id, patch)
  }

  /**
   * 按 id 施加段落样式。`applyStyle` 只认焦点块，而长按菜单的动作作用在**被长按的那一块**上
   * （它不一定是当前焦点块），所以页面需要这个显式目标的出口。
   * 与 `setText`/`updateImage` 同形：id 不存在或不是段落块一律静默忽略。
   */
  function applyStyleTo(id: string, patch: ParagraphStyle): void {
    const index = indexOf(id)
    const block = blocks.value[index]
    if (!isStylable(block)) return
    const next: TextBlock = Object.assign({}, block, patch)
    // 关掉加粗就别留个 bold:false 在数据里，序列化出来的 blocks 越干净越好
    if (!next.bold) delete next.bold
    if (!next.color) delete next.color
    replaceAt(index, next)
  }

  function toggleBold(): void {
    const block = focusedBlock()
    if (!isStylable(block)) return
    applyStyle({ bold: !block.bold })
  }

  function serialize(): string {
    return serializeBlocks(blocks.value)
  }

  function markClean(): void {
    baseline = snapshot()
  }

  function load(nextTitle: string, nextBlocks: Block[]): void {
    const list = nextBlocks.length ? nextBlocks : initialBlocks()
    blocks.value = ensureTrailingTextBlock(list)
    title.value = clipChars(nextTitle, Limit.TITLE_MAX)
    focusId.value = ''
    markClean()
  }

  function buildDraft(): PlanDraft {
    const extra = options.getExtra ? options.getExtra() : emptyExtra()
    return {
      title: title.value,
      blocks: blocks.value,
      images: extra.images,
      deadline: extra.deadline,
      optionsEnabled: extra.optionsEnabled,
      options: extra.options,
      savedAt: peekNow(),
    }
  }

  function saveDraft(force = false): boolean {
    if (!force && !isDirty.value) return false
    const savedAt = buildDraft().savedAt
    const ok = writeJson(draftKey.value, buildDraft())
    if (ok) options.onDraftSaved?.(savedAt)
    return ok
  }

  /** debounce 1.5s：每次按键都写 storage 会在真机上把 JS 线程拖住（storage 是同步 API） */
  function scheduleDraft(): void {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      // saveDraft 内部已判 isDirty：清空后回写没有意义
      saveDraft()
    }, debounceMs)
  }

  function flushDraft(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    saveDraft()
  }

  function hasDraft(): boolean {
    return hasStorage(draftKey.value)
  }

  function restoreDraft(): PlanDraft | null {
    const draft = readJson<PlanDraft>(draftKey.value)
    if (!draft || !Array.isArray(draft.blocks)) return null
    load(draft.title ?? '', sanitizeBlocks(draft.blocks))
    return draft
  }

  function clearDraft(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    removeStorage(draftKey.value)
  }

  watch([title, blocks], () => scheduleDraft(), { deep: true })

  markClean()

  bindDispose(() => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  })

  return {
    blocks,
    title,
    focusId,
    scrollIntoViewId,
    isDirty,
    charCount,
    plainText,
    activeStyle,
    stylable,
    draftKey,
    setFocus,
    blur,
    blurIf,
    setText,
    setTitle,
    replaceBlocks,
    addTextBlock,
    insertBlock,
    insertQuote,
    insertDivider,
    insertImage,
    updateImage,
    removeBlock,
    moveBlock,
    duplicateBlock,
    applyStyle,
    applyStyleTo,
    toggleBold,
    indexOf,
    serialize,
    load,
    markClean,
    hasDraft,
    saveDraft,
    restoreDraft,
    clearDraft,
    scheduleDraft,
    flushDraft,
  }
}
