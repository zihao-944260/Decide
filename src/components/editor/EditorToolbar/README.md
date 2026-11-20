# EditorToolbar（T4.6）

编辑器的**受控**工具栏，形制对齐用户指定的参考编辑器：两行扁平图标条。
项 = 加粗 B、左/中对齐（CSS 横条图标）、档位 H1/H2/正文（字形）、色板（`TEXT_COLORS`）、插入引用 / 分割线 / 图片、删除聚焦块。
它不认识 `useEditor`，点击只 emit，八个事件与 `EditorController` 的方法一一对应。

**没有桶文件**：`src/components/editor/index.ts` 禁止创建，import 走完整路径：

```ts
import EditorToolbar from '@/components/editor/EditorToolbar/index.vue'
```

## Props / Emits（`types.ts` 原样）

| prop          | 类型                     | 默认    | 说明                                                                                   |
| ------------- | ------------------------ | ------- | -------------------------------------------------------------------------------------- |
| `activeStyle` | `ParagraphStyle \| null` | 必填    | 直接喂 `editor.activeStyle`（`useEditor.ts:142`）。null = 没聚焦块或聚焦在非 text 块上 |
| `stylable`    | `boolean`                | 必填    | 直接喂 `editor.stylable`（= `isStylable(聚焦块)`，只对 text 块为真）                   |
| `disabled`    | `boolean`                | `false` | 整条禁用（发布在途等），插入项也一起置灰                                               |
| `canRemove`   | `boolean`                | `false` | 有聚焦块时才为真（页面喂 `!!focusId`）；删除项只看它，不看 stylable                    |

```ts
export type Emits = {
  (e: 'set-level', level: TextBlock['level']): void
  (e: 'toggle-bold'): void
  (e: 'set-color', color: string): void
  (e: 'set-align', align: TextBlock['align']): void
  (e: 'insert-quote'): void
  (e: 'insert-divider'): void
  (e: 'insert-image'): void
  (e: 'remove'): void
}
```

## 页面接线（逐字可抄）

```ts
import EditorToolbar from '@/components/editor/EditorToolbar/index.vue'
import { TEXT_COLORS } from '@/constants/plan'
import { useEditor } from '@/composables'
import type { TextBlock } from '@/types/models'

const editor = useEditor({/* … */})
// 模板不解包嵌套 Ref：先取一层（同 CommentList/README.md 的口径）
const activeStyle = editor.activeStyle
const stylable = editor.stylable

function setLevel(level: TextBlock['level']): void {
  editor.applyStyle({ level })
}
function setColor(color: string): void {
  editor.applyStyle({ color }) // '' 会在 applyStyle 里 delete color 字段（useEditor.ts:255）
}
function setAlign(align: TextBlock['align']): void {
  editor.applyStyle({ align })
}
// afterId 传 focusId：插在「当前块之后」；没聚焦块时传 undefined，
// 由 insertBlock 落到「末尾占位空块之前」（useEditor.ts:187-194），不会把空块甩到最后
// ★ 必须写 `.value`：`focusId` 是 `Ref<string>`，不写就 ① 恒为真值 ② 传进去的是 Ref 对象，
//   `insertBlock` 里 `item.id === afterId` 永远匹配不上 → **所有插入都落到末尾**，
//   「插在当前块之后」这条语义静默丢掉（不报错、不警告）。页面侧更干净的写法是取一个
//   `afterFocusId(): string | undefined` 具名函数，三个插入共用一处解包。
function insertQuote(): void {
  editor.insertQuote(editor.focusId.value || undefined)
}
function insertDivider(): void {
  editor.insertDivider(editor.focusId.value || undefined)
}
/**
 * ★ 插入图片 = 只落一个空 fileID 的块，**工具栏不上传**。
 * 用户在新块的「点击选择图片」卡上点了之后，才由 EditorImageBlock 内部的 useUpload 走
 * chooseMedia → uploadFile，完成后 emit('update') 回到 editor.updateImage()。
 * 这样上传入口只有一处（图片块里），工具栏保持零状态，也不会出现
 * 「点了工具栏就弹相册、取消后留个空块不知道怎么回事」的路径。
 */
function insertImage(): void {
  editor.insertImage('', 0, 0, editor.focusId.value || undefined)
}
/** 工具栏「删除」= 删当前聚焦块；焦点转移到邻居块由 removeBlock 自带，无需再补 blur */
function onToolbarRemove(): void {
  const id = editor.focusId.value
  if (id) editor.removeBlock(id)
}
```

```html
<!-- 页面根节点 flex 纵向；工具栏是 scroll-view 的**兄弟节点** -->
<scroll-view type="list" class="edit__scroll" :scroll-into-view="scrollTarget">
  <EditorBlockList :blocks="blocks" :focus-id="focusId" … />
  <ImageUploader v-model="model.images" @change="onUploaderChange" />
</scroll-view>
<EditorToolbar
  :active-style="activeStyle"
  :stylable="stylable"
  :disabled="submitting"
  :can-remove="focusId !== ''"
  @set-level="setLevel"
  @toggle-bold="editor.toggleBold()"
  @set-color="setColor"
  @set-align="setAlign"
  @insert-quote="insertQuote"
  @insert-divider="insertDivider"
  @insert-image="insertImage"
  @remove="onToolbarRemove"
/>
```

## 置灰而不是隐藏（验收项）

`stylable === false`（没聚焦块、或聚焦在图片/引用/分割线块上）时：

- 六个样式项（加粗、对齐×2、档位×3）与四个色板项 → `opacity: .35` + 点击 no-op，**位置与宽度一字不动**；
- 三个插入项照常可点（它们作用于「插入位置」，与当前块能不能设样式无关），只吃 `disabled`；
- 「删除」项只吃 `canRemove && !disabled`：没聚焦块时置灰，聚焦在图片/引用/分割线块上时同样可删；
- 隐藏实现会让整排在「点到 text 块 ↔ 点到图片块」之间宽度跳一下，这是本轮明确的反例。

`activeStyle === null` 时也不高亮任何样式项（`levelOn/alignOn/colorOn` 三个函数统一判 null）。

## 色板只有一个来源

`import { TEXT_COLORS } from '@/constants/plan'`，组件内没有任何字面色值（§9.1-5）。四项里的
`{ label: '默认', value: '' }` 是**复位项**不是第五种颜色：渲染成空心圈（`.editor-toolbar__swatch--reset`），
点它 emit `('set-color', '')`，`applyStyleTo` 里 `delete next.color`（useEditor.ts:267-276），
`blockStyle()` 也就不再输出 `color` 内联样式，回落 tokens 的 `$color-text-1`。

## 段落级样式，没有选区

兼容清单 §2.4 实测：`textarea` 的 `bindselectionchange` `canIUse=false`、设 `selection-start/end` 无高亮
→ 拿不到可靠区间，所以 §8.1 定死**段落级**：加粗/颜色/对齐/级别作用于当前聚焦块整段。
本组件不提供「选中部分加粗」，也不显示任何选区相关 UI。

## 吸底与键盘避让：都不在组件里

组件根节点是普通块（`width: 100%` + `hairline-top` + `safe-area-bottom`），**自己不写 `position: fixed`**。
理由与详情页 `CommentInput` 的接法一致（那个组件是 fixed 的，但它内部还兼了键盘避让，两件事不必混在一起）：

- Skyline 下页面根节点是 `flex-direction: column` + 唯一 `scroll-view` 占 `flex: 1`，
  工具栏作为兄弟节点天然钉在底部，**不需要 fixed**（`@include page-root`）；
- 若页面选择 `position: fixed`（`spike` 实测 fixed 可用，兼容清单 §2.2），由页面加类，别塞进组件；
- **键盘避让同样归页面**，但本轮**没有键盘高度的数据源**：`EditorTextBlock` 的 emits 只有
  `focus / blur / input / long-press`（H1 契约），textarea 的 `adjust-position=true` + `cursor-spacing`
  是原生避让（§11.2，实测可用），组件拿不到 `keyboardheightchange` 的高度。
  也就是说「工具栏随键盘抬起」目前页面做不了 —— 已作为缺口上报主 agent（见下面第 3 条），不要在下轮接线时
  以为页面能算出来。
  组件里也没有 `bottomOffset` 这类 prop —— 契约（§11）只给了三个 props，多加一个就是改接口。

## 尺寸与可点区

两行布局：第一行 6 个样式项 `flex: 1; min-width: 0`（等分，换机型不挤不隐藏）；
第二行 = 4 个 88rpx 色板格 + 分隔线 + 4 个插入项（引用/分割线/图片/删除）。所有可点节点 `min-height: $tap-min-height`（88rpx，§9.1-8）。
分隔线、圆点、对齐图标的三条横条都是真实节点（Skyline 无伪元素布局；`image` 组件不支持 SVG，图标只能拼）。

## 已知缺口（上报主 agent，本目录不动手）

1. ~~**档位/对齐标签是组件里的第二份字面量**~~ —— **主 agent 已收口（一半）**：
   `utils/blocks.ts:44-45` 的 `LEVELS` / `ALIGNS` 已导出，本组件的 `LEVEL_ITEMS` / `ALIGN_ITEMS`
   改成 `LEVELS.map(...)` / `ALIGNS.map(...)` 生成，**档位数字与对齐取值不再有第二份**（扩容只改 blocks.ts）。
   留在组件里的是中文标签本身（「标题 1」「居中」），那是渲染侧文案，不该塞进数据层 —— 这半条按现状保留。
2. **`applyStyle({ level })` 之类的调用约定只写在 README** —— **主 agent 裁决：按现状保留，不加三个语义方法。**
   `EditorController.applyStyle` 接受 `ParagraphStyle` 补丁，工具栏只抛单项事件，拼装责任在页面。
   不补 `setLevel/setAlign/setColor` 的理由：那会让同一件事有两条路径（`applyStyle({level})` 与 `setLevel()`），
   而补丁形状本身就是这条契约的价值所在 —— 组合样式（同时改 level+align）只有一次 `replaceAt`，
   拆成三个方法反而逼页面连调三次、产生三份中间块对象。页面侧三个小函数是**接线**，不是共享层缺口。
   注：本 README 原先给页面的抄例把 `editor.focusId || undefined` 少写了 `.value`（会让所有插入落到末尾），
   已按编辑页 README §2.3 的口径修正，抄例现在带 `.value`。
3. **键盘避让缺数据源**（见上一节）：需要 `EditorTextBlock` 补一个 `keyboard-height` 事件，
   或页面实测 `adjust-position` 是否连带抬起 fixed 底部条。§11.2 那条「编辑器工具栏正确避让」现在还没有接口，
   属于阶段 4 验收前必须裁决的事，**别默认它已经通了**。
