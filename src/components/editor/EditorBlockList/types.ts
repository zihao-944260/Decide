import type { Block } from '@/types/models'

/**
 * EditorBlockList —— 块列表容器（WBS T4.7，技术方案 §8.1 / §9.2「editor」）。
 *
 * 它是**纯渲染容器**：`v-for` over `blocks`，按 `block.type` 分派四个子件，事件原样往上抛。
 * 三件事刻意**不在**组件里做，逐条对应 §11 的受控约束：
 * 1. 不嵌 `scroll-view` —— 整页唯一的滚动流由页面持有（详情页同一条规则已验收），嵌套滚动在 Skyline 下未验证；
 * 2. 不生成/删除块 id、不 reorder、不弹 ActionSheet —— 状态机只有 `useEditor` 一个，归页面；
 * 3. 不做 `sanitizeBlocks` —— 消毒会换 id、还会丢掉「空 fileID 的在途图片块」（H2 契约要求它渲染选图占位卡），
 *    编辑态的 blocks 必须与页面数据一字不差。
 *
 * 对外契约里 `blk-` 这个前缀是最脆的一环：页面的 `scroll-view :scroll-into-view` 目标就是它，
 * 而 `useEditor.setFocus` 写进 `scrollIntoViewId` 的字符串是 `blk-${id}`（src/composables/useEditor.ts:142-145）。
 * 两边各拼一次就会静默失效（不报错、不滚动），所以前缀只在本目录的 `blockNodeId()` 里出现，README 点名。
 */
export interface Props {
  /** 页面 `editor.blocks` 原样传入：不排序、不消毒、不改 id */
  blocks: Block[]
  /** 页面 `editor.focusId`：等值的块进入聚焦视觉态 */
  focusId?: string
}

/** 长按块的定位信息：index 是 **props.blocks 里的下标**（未过滤脏数据前的口径），页面直接喂给 moveBlock 的边界判断 */
export interface EditorBlockLongPressEvent {
  id: string
  index: number
}

/**
 * 图片块写回载荷。形状与跨路契约 `EditorImageBlock` 的 `update` 第二个参数逐字一致
 * （docs/agent-prompts.md §11），也是 `editor.updateImage(id, next)` 的入参。
 */
export interface ImageUpdatePayload {
  fileID: string
  w: number
  h: number
}

/**
 * 块级事件。除 `update`（H2 契约的载荷不带 id，容器必须补）以外全部是子件事件的转发。
 * 页面接线见 README.md。
 */
export type Emits = {
  /** 子件（textarea 聚焦 / 分割线点击）请求聚焦，页面调 `editor.setFocus(id)` */
  (e: 'focus', id: string): void
  /** 子件失焦，带 id。页面必须带守卫：`if (focusId === id) editor.blur()` */
  (e: 'blur', id: string): void
  /** 文本类块（text/quote）内容变更，页面调 `editor.setText(id, text)` */
  (e: 'input', id: string, text: string): void
  /** 图片块上传成功回写，页面调 `editor.updateImage(id, next)` */
  (e: 'update', id: string, next: ImageUpdatePayload): void
  /** 图片块自带的删除入口，页面调 `editor.removeBlock(id)` */
  (e: 'remove', id: string): void
  /** 长按任意块：页面据此弹 ActionSheet（上移/下移/删除/复制/设为标题），组件自己不弹 */
  (e: 'long-press', payload: EditorBlockLongPressEvent): void
}
