import type { Block, ImageBlock, TextBlock } from '@/types/models'
import { cleanInline, createBlockId, hasVisibleText } from '@/utils/blocks'

/**
 * 原生 <editor>（Quill 内核，WebView 渲染页）与冻结契约 blocks 之间的双向桥。
 *
 * 为什么需要桥：线上契约（已部署云函数）仍是段落级 blocks，且云端对 block.text 原样存储、
 * 不消毒；因此把「行内富文本标记」保存在 text 里即可无损往返、无需重新部署。
 * 编辑面是单一 <editor>（真 WYSIWYG），保存时 editorHtmlToBlocks 拆段，加载时 blocksToEditorHtml 还原。
 *
 * 行内样式挂载规则遵循 editor 组件文档：块级样式（text-align）挂在 p/h 上，
 * 行内样式（color/font-weight）必须挂在 span/strong 上，挂在 p 上无效。
 */

const LEVEL_TAG: Record<TextBlock['level'], string> = { 1: 'h1', 2: 'h2', 3: 'p' }

/** blocks → editor 可 setContents 的 HTML */
export function blocksToEditorHtml(blocks: Block[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      const tag = LEVEL_TAG[block.level]
      const align = block.align === 'center' ? ' style="text-align:center"' : ''
      let inner = block.text
      if (block.bold) inner = `<strong>${inner}</strong>`
      if (block.color) inner = `<span style="color:${block.color}">${inner}</span>`
      parts.push(`<${tag}${align}>${inner}</${tag}>`)
    } else if (block.type === 'quote') {
      parts.push(`<blockquote>${block.text}</blockquote>`)
    } else if (block.type === 'divider') {
      parts.push('<hr>')
    } else {
      const size = block.w > 0 && block.h > 0 ? ` width="${block.w}" height="${block.h}"` : ''
      parts.push(`<img src="${block.fileID}"${size}>`)
    }
  }
  return parts.join('')
}

function attr(style: string, name: string): string {
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;"]+)`, 'i').exec(style)
  return m ? m[1].trim() : ''
}

/** blockquote/列表内的 <p>/<li> 折叠成 <br> 行内流 */
function foldInner(inner: string): string {
  return inner
    .replace(/<\/p>\s*<p[^>]*>/gi, '<br>')
    .replace(/<\/li>\s*<li[^>]*>/gi, '<br>')
    .replace(/<\/?(p|li|ul|ol)[^>]*>/gi, '')
}

const IMG_RE = /<img\b[^>]*>/gi

function parseImage(whole: string): ImageBlock | null {
  const src = /src="([^"]*)"/i.exec(whole)?.[1] ?? ''
  if (!src) return null
  const w = Number(/width="([^"]*)"/i.exec(whole)?.[1] ?? 0) || 0
  const h = Number(/height="([^"]*)"/i.exec(whole)?.[1] ?? 0) || 0
  return { id: createBlockId(), type: 'image', fileID: src, w, h }
}

/**
 * Quill 会把 <img> 包进 <p>：按图片切段，文本段非空才成块、图片按原序成 image 块。
 * 不切的话 cleanInline 丢 img，整段变空文本块被云端拒（「正文不能为空」），图也丢。
 */
function splitImages(inner: string, blocks: Block[], emitText: (raw: string) => void): void {
  let cursor = 0
  let im: RegExpExecArray | null
  IMG_RE.lastIndex = 0
  while ((im = IMG_RE.exec(inner))) {
    emitText(inner.slice(cursor, im.index))
    const image = parseImage(im[0])
    if (image) blocks.push(image)
    cursor = IMG_RE.lastIndex
  }
  emitText(inner.slice(cursor))
}

const BLOCK_RE =
  /<(h1|h2|h3|h4|h5|h6|p|blockquote|pre|ul|ol)(\s[^>]*)?>([\s\S]*?)<\/\1>|<hr\s*\/?>|<img\b[^>]*>/gi

/** editor 输出 HTML → blocks（行内标记保留在 text，段落级属性映射到字段） */
export function editorHtmlToBlocks(html: string): Block[] {
  const blocks: Block[] = []
  if (!html || !html.trim()) return blocks
  let last = 0
  let m: RegExpExecArray | null
  BLOCK_RE.lastIndex = 0
  const pushLeading = (text: string): void => {
    const cleaned = cleanInline(text)
    if (hasVisibleText(cleaned)) blocks.push(makeText(cleaned, 3, 'left'))
  }
  while ((m = BLOCK_RE.exec(html))) {
    pushLeading(html.slice(last, m.index))
    last = BLOCK_RE.lastIndex
    const whole = m[0]
    if (/^<img/i.test(whole)) {
      const image = parseImage(whole)
      if (image) blocks.push(image)
      continue
    }
    if (/^<hr/i.test(whole)) {
      blocks.push({ id: createBlockId(), type: 'divider' })
      continue
    }
    const tag = m[1].toLowerCase()
    const attrsStr = m[2] ?? ''
    const style = /style="([^"]*)"/i.exec(attrsStr)?.[1] ?? ''
    const inner = m[3] ?? ''
    // 对齐两种形态都认：WebView editor 输出内联 text-align，Quill 原生也可能给 ql-align-center 类名
    const align: TextBlock['align'] =
      /text-align:\s*center/i.test(style) || /ql-align-center/i.test(attrsStr) ? 'center' : 'left'
    const color = attr(style, 'color')
    if (tag === 'blockquote') {
      splitImages(inner, blocks, (raw) => {
        const text = cleanInline(foldInner(raw))
        if (hasVisibleText(text)) blocks.push({ id: createBlockId(), type: 'quote', text })
      })
      continue
    }
    const level: TextBlock['level'] = tag === 'h1' ? 1 : tag === 'h2' ? 2 : 3
    const fold = tag === 'ul' || tag === 'ol' || tag === 'pre'
    splitImages(inner, blocks, (raw) => {
      let text = cleanInline(fold ? foldInner(raw) : raw)
      if (!hasVisibleText(text)) return
      let bold = false
      const wholeBold = /^<strong>([\s\S]*)<\/strong>$/.exec(text)
      if (wholeBold) {
        bold = true
        text = wholeBold[1]
      }
      blocks.push(makeText(text, level, align, bold, color))
    })
  }
  pushLeading(html.slice(last))
  return blocks
}

function makeText(
  text: string,
  level: TextBlock['level'],
  align: TextBlock['align'],
  bold?: boolean,
  color?: string
): TextBlock {
  const block: TextBlock = { id: createBlockId(), type: 'text', text, level, align }
  if (bold) block.bold = true
  if (color) block.color = color
  return block
}
