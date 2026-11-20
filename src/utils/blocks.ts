import { Limit } from '@/constants/plan'
import type { Block, DividerBlock, ImageBlock, QuoteBlock, TextBlock } from '@/types/models'
import { countChars } from '@/utils/format'

/**
 * 块的解析与样式映射（技术方案 §8.1 / §10「渲染编辑同源」）。
 * 编辑器（EditorBlockList / EditorTextBlock）与详情页 ContentRenderer 必须都从这里取，
 * 两处各写一份必然漂移 —— 编辑时长得跟发布后不一样，是这类自研富文本最常见的回归。
 *
 * 样式是**段落级**的：T0 实测 Skyline 下 textarea 拿不到选区（bindselectionchange
 * canIUse=false、设置 selection-start/end 无高亮，见兼容清单 §2.4），所以没有 marks 区间样式，
 * bold/color/level/align 一律整段生效。
 */

export type BlockStyle = Record<string, string>

/** 段落级样式可改写的字段集合（工具栏的「当前态」也是它） */
export type ParagraphStyle = Partial<Pick<TextBlock, 'bold' | 'color' | 'align' | 'level'>>

const FONT_SIZE: Record<TextBlock['level'], string> = {
  1: '40rpx',
  2: '34rpx',
  3: '30rpx'
}

const LINE_HEIGHT: Record<TextBlock['level'], string> = {
  1: '56rpx',
  2: '50rpx',
  3: '46rpx'
}

const FONT_WEIGHT: Record<TextBlock['level'], string> = {
  1: '600',
  2: '600',
  3: '400'
}

/**
 * 段落的合法 `level` / `align` 取值 —— 与 `sanitizeBlocks` 的白名单是同两行，所以也必须是 UI 的白名单。
 * 导出前它们只有本文件看得见，EditorToolbar 只能自己抄一份档位表；抄的那份一旦和这里错开，
 * 表现是「工具栏能点出一个块里存不下的档位」，而 `sanitize` 会在草稿恢复时静默把它改回默认 —— 用户看到的是设置没生效。
 * 标签文案（标题/小标题/正文）仍留在组件里：那是 UI 措辞，不是数据定义。
 */
export const LEVELS: readonly TextBlock['level'][] = [1, 2, 3]
export const ALIGNS: readonly TextBlock['align'][] = ['left', 'center']
const TYPES: readonly Block['type'][] = ['text', 'image', 'quote', 'divider']

let idSeed = 0

/**
 * 块 id：小程序里没有 crypto，用「自增 + 时间戳 + 随机」三段拼接保证同一会话内唯一。
 * 只作 diff/key 用，不参与云端数据（上传云端的 blocks 也带它，幂等无影响）。
 */
export function createBlockId(prefix = 'b'): string {
  idSeed += 1
  const rand = Math.floor(Math.random() * 1e6).toString(36)
  return `${prefix}${Date.now().toString(36)}${idSeed.toString(36)}${rand}`
}

export function createTextBlock(text = '', level: TextBlock['level'] = 3): TextBlock {
  return { id: createBlockId(), type: 'text', text, level, align: 'left' }
}

export function createQuoteBlock(text = ''): QuoteBlock {
  return { id: createBlockId(), type: 'quote', text }
}

export function createDividerBlock(): DividerBlock {
  return { id: createBlockId(), type: 'divider' }
}

export function createImageBlock(fileID: string, w = 0, h = 0, caption?: string): ImageBlock {
  const block: ImageBlock = { id: createBlockId(), type: 'image', fileID, w, h }
  if (caption) block.caption = caption
  return block
}

/** 新建草稿的初始内容：永远至少有一个可输入块 */
export function initialBlocks(): Block[] {
  return [createTextBlock()]
}

export function blockText(block: Block): string {
  if (block.type === 'text' || block.type === 'quote') return block.text
  if (block.type === 'image') return block.caption ?? ''
  return ''
}

/** 段落级样式只作用于 text 块（quote/divider/image 用固定样式，工具栏置灰） */
export function isStylable(block: Block | undefined): block is TextBlock {
  return block !== undefined && block.type === 'text'
}

/**
 * Block[] → 纯文本。用于摘要截取（Skyline 无 line-clamp，摘要靠字数）与草稿预览。
 * image/divider 不贡献文字；text/quote 的 text 现在可能带内联富文本标记，先 stripTags。
 */
export function blocksToText(blocks: Block[], separator = '\n'): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'quote') {
      const text = stripTags(block.text).trim()
      if (text) parts.push(text)
    }
  }
  return parts.join(separator)
}

/** 全文字数（不含空白），编辑器字数计数与服务端 Limit 校验口径一致；内联标记不计字 */
export function blocksCharCount(blocks: Block[]): number {
  let count = 0
  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'quote')
      count += countChars(stripTags(block.text).replace(/\s/g, ''))
  }
  return count
}

/**
 * 段落样式 → 内联 style 对象。
 * 只输出「用户显式设过的色」，默认色交给 tokens.scss：组件规范禁止硬编码色值（§9.1-5），
 * 换肤时样式层单点生效。
 */
export function blockStyle(block: Block): BlockStyle {
  if (block.type === 'text') {
    const style: BlockStyle = {
      fontSize: FONT_SIZE[block.level],
      lineHeight: LINE_HEIGHT[block.level],
      fontWeight: block.bold ? '700' : FONT_WEIGHT[block.level],
      textAlign: block.align
    }
    if (block.color) style.color = block.color
    return style
  }
  if (block.type === 'quote') {
    return { fontSize: FONT_SIZE[3], lineHeight: LINE_HEIGHT[3], textAlign: 'left' }
  }
  return {}
}

/**
 * 图片块渲染比例：**宽/高**，即 CSS `aspect-ratio` 的语义（§11.1 防图片加载把内容顶跳）。
 * 之所以直接给宽高而不是高宽：唯一的消费方是 `BaseImage` 的 `ratio` prop，
 * 两个名字各自换算一次倒数，早晚会在某一边多乘一次。
 */
export function imageBlockRatio(block: ImageBlock): number {
  return block.w > 0 && block.h > 0 ? block.w / block.h : 0
}

/**
 * 末尾补齐可输入块：编辑器必须永远有一个能聚焦的空块，
 * 否则用户删到最后一个块就没法继续输入。返回新数组，不改入参。
 */
export function ensureTrailingTextBlock(blocks: Block[]): Block[] {
  const next = blocks.slice()
  const last = next[next.length - 1]
  if (!last || last.type !== 'text' || last.text !== '') next.push(createTextBlock())
  return next
}

export function serializeBlocks(blocks: Block[]): string {
  return JSON.stringify(blocks)
}

function asString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function asLevel(value: unknown): TextBlock['level'] {
  return LEVELS.includes(value as TextBlock['level']) ? (value as TextBlock['level']) : 3
}

function asAlign(value: unknown): TextBlock['align'] {
  return ALIGNS.includes(value as TextBlock['align']) ? (value as TextBlock['align']) : 'left'
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

interface RawRecord {
  [key: string]: unknown
}

/**
 * 反序列化消毒：草稿存在 storage 里，可能来自旧版本结构或被手工改坏；
 * 云端返回的 blocks 同理。任何不认识的块/字段一律丢弃或回落到默认值，绝不用 `as Block[]` 蒙。
 */
export function sanitizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return []
  const blocks: Block[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as RawRecord
    if (!TYPES.includes(record.type as Block['type'])) continue
    const id = typeof record.id === 'string' && record.id ? record.id : createBlockId()
    if (record.type === 'text') {
      blocks.push({
        id,
        type: 'text',
        text: asString(record.text, Limit.BLOCK_TEXT_MAX),
        level: asLevel(record.level),
        align: asAlign(record.align),
        ...(record.bold === true ? { bold: true } : {}),
        ...(typeof record.color === 'string' && record.color ? { color: record.color } : {})
      })
    } else if (record.type === 'quote') {
      blocks.push({ id, type: 'quote', text: asString(record.text, Limit.BLOCK_TEXT_MAX) })
    } else if (record.type === 'image') {
      const fileID = asString(record.fileID, 512)
      if (!fileID) continue
      blocks.push({
        id,
        type: 'image',
        fileID,
        w: asNumber(record.w),
        h: asNumber(record.h),
        ...(typeof record.caption === 'string' && record.caption ? { caption: record.caption } : {})
      })
    } else {
      blocks.push({ id, type: 'divider' })
    }
  }
  return blocks
}

export function parseBlocks(json: string): Block[] {
  if (!json) return []
  try {
    return sanitizeBlocks(JSON.parse(json) as unknown)
  } catch {
    return []
  }
}

/** 段落级档位 → HTML 标签：标题两档用语义标签，正文用 p */
const LEVEL_TAG: Record<TextBlock['level'], string> = { 1: 'h2', 2: 'h3', 3: 'p' }

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 只转义尖括号、保留已有实体（&amp; 等），用于内联富文本的文本段 */
function escapeAngle(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 去掉标签与占位实体后还有可见文字：空段落 / 纯 br 不算正文（云端拒收空文本块） */
export function hasVisibleText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&(nbsp|#160);/gi, ' ')
      .trim() !== ''
  )
}

const INLINE_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'ins',
  'del',
  'sub',
  'sup',
  'br',
  'span'
])
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\))$/

/**
 * 内联富文本消毒：只放行 Quill/editor 产出的行内标记白名单，span 仅保留合法 color，
 * 其余标签丢弃（保留其间文本）、script/style/iframe 整段删除、文本段转义尖括号。
 * 云端对 block.text 原样存储不消毒，渲染侧必须自己守住这条白名单（防存储型 XSS/视觉垃圾）。
 */
export function cleanInline(html: string): string {
  if (!html) return ''
  const src = html.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(src))) {
    out += escapeAngle(src.slice(last, m.index))
    last = tagRe.lastIndex
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    const attrs = m[3] || ''
    if (!INLINE_TAGS.has(tag)) continue
    if (tag === 'br') {
      out += '<br>'
      continue
    }
    if (closing) {
      out += `</${tag}>`
      continue
    }
    if (tag === 'span') {
      const color = /color\s*:\s*([^;"']+)/i.exec(attrs)?.[1]?.trim()
      out += color && COLOR_RE.test(color) ? `<span style="color:${color}">` : '<span>'
    } else {
      out += `<${tag}>`
    }
  }
  out += escapeAngle(src.slice(last))
  return out
}

/** 去掉全部标签并还原常见实体，供字数/摘要/纯文本校验使用 */
export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
}

function styleToCss(style: BlockStyle): string {
  return Object.entries(style)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${value}`)
    .join(';')
}

/**
 * Block[] → HTML，喂给 mp-html 渲染（详情页正文唯一出口）。
 * 序列化只做数据映射：段落样式仍全部来自 blockStyle()（渲染编辑同源不变）；
 * 引用块外框/分割线/图片圆角属于容器样式，由 ContentRenderer 的 tag-style 提供；
 * 颜色经 var(--cr-*) 消费 ContentRenderer 挂载的 CSS 变量（tokens 唯一源，Skyline
 * 下 var() 穿组件边界已实测，见兼容清单 §2.6）。
 *
 * 形状由两条平台事实决定：
 * - 内联富文本（strong/em/u/span/br）在 **WebView** 渲染下才能正确行内排布；Skyline 行内流断裂
 *   （mp-html 叶子同样继承，spike 2026-11-12），故编辑页与详情页均配置 renderer=webview，
 *   首页/我的（纯文本摘要）仍走 Skyline。text 不再按行拆标签，<br> 原样保留；
 * - 图片宽高经 width/height 属性传入，mp-html 解析期即可算出占位比例（§11.1 防加载顶跳）；
 *   cloud:// fileID 是 mp-html 显式特判支持的协议，直接透传。
 */
export function blocksToHtml(blocks: Block[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      const tag = LEVEL_TAG[block.level]
      const style = blockStyle(block)
      const color = style.color
      delete style.color
      const css = styleToCss(style)
      let inner = cleanInline(block.text)
      if (color) inner = `<span style="color:${color}">${inner}</span>`
      parts.push(`<${tag} style="${css}">${inner}</${tag}>`)
    } else if (block.type === 'quote') {
      parts.push(`<blockquote>${cleanInline(block.text)}</blockquote>`)
    } else if (block.type === 'image') {
      const size = block.w > 0 && block.h > 0 ? ` width="${block.w}" height="${block.h}"` : ''
      parts.push(`<img src="${escapeHtml(block.fileID)}"${size} />`)
      if (block.caption) {
        parts.push(
          `<p style="font-size:22rpx;line-height:1.5;text-align:center;color:var(--cr-text-3);margin:0 0 16rpx">${escapeHtml(block.caption)}</p>`
        )
      }
    } else {
      parts.push('<hr />')
    }
  }
  return parts.join('')
}
