# EditorBlockList（T4.7）

编辑器唯一的**块容器**：`v-for` over `blocks`，按 `block.type` 分派四个子件，事件原样往上抛。
它自己**没有状态**——不知道上传、不知道 ActionSheet、不生成 id、不排序（技术方案 §11 的受控约束）。

```
src/components/editor/EditorBlockList/index.vue   ← 本目录（容器）
├─ EditorTextBlock        T4.2  text 块：textarea + blockStyle()
├─ EditorQuoteBlock       T4.5  quote 块：左侧色条 + textarea
├─ EditorImageBlock       T4.4  ← H2 拥有，本目录只按跨路契约消费
└─ EditorDividerBlock     T4.5  divider 块：真实节点分割线
```

**没有桶文件**：`src/components/editor/index.ts` 禁止创建（§9 business 桶文件互相覆盖的教训），
外部一律按完整路径 import：

```ts
import EditorBlockList from '@/components/editor/EditorBlockList/index.vue'
import type { EditorBlockLongPressEvent } from '@/components/editor/EditorBlockList/types'
```

## 接线方式（页面层照这段写）

下面是 `pages/plan/edit/index.vue`（T4.11，下一轮）与本组件相关的那一小节，可直接抄：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import BaseActionSheet from '@/components/base/BaseActionSheet/index.vue'
import EditorBlockList from '@/components/editor/EditorBlockList/index.vue'
import type { EditorBlockLongPressEvent } from '@/components/editor/EditorBlockList/types'
import type { ActionSheetItem } from '@/components/base/BaseActionSheet/types'
import { useActionSheet, useEditor } from '@/composables'

// 状态机只有这一个：块 id 的增删、排序、段落样式改写、草稿，全在 useEditor（§8.1）
const editor = useEditor({/* getExtra / openId / onDraftSaved 由页面按 useForm 接 */})
const sheet = useActionSheet()

// 这三个是 setup 顶层的 Ref 绑定，模板会自动解包，直接绑即可
const blocks = editor.blocks
const focusId = editor.focusId
// ★ 直接绑 editor.scrollIntoViewId：setFocus 会把目标写成 `blk-${id}`，
//   与 EditorBlockList 里 blockNodeId() 拼出来的字符串一一对应（见下面「blk- 前缀」一节）
const scrollTarget = editor.scrollIntoViewId
// sheet.state / editor.activeStyle / editor.stylable 是**普通对象里的嵌套 Ref，不解包**，
// 必须各包一层 computed（与 CommentList README 同一条坑）
const sheetState = computed(() => sheet.state.value)
const activeStyle = computed(() => editor.activeStyle.value)
const stylable = computed(() => editor.stylable.value)

function onBlockFocus(id: string): void {
  editor.setFocus(id)
}

/** 失焦必须带守卫：A→B 切换时 mp 的 blur/focus 顺序不保证，无守卫会把刚设好的 focusId 抹掉 */
function onBlockBlur(id: string): void {
  if (focusId.value === id) editor.blur()
}

function onBlockInput(id: string, text: string): void {
  editor.setText(id, text) // 上限截断在 setText 里做（Limit.BLOCK_TEXT_MAX），组件不截
}

/** 图片块上传成功回写（H2 内部选图/进度/重试，容器只透传这一条） */
function onImageUpdate(id: string, next: { fileID: string; w: number; h: number }): void {
  editor.updateImage(id, next)
}

function onBlockRemove(id: string): void {
  editor.removeBlock(id)
}

function blockActions(payload: EditorBlockLongPressEvent): ActionSheetItem[] {
  return [
    { key: 'up', text: '上移', disabled: payload.index <= 0 },
    { key: 'down', text: '下移', disabled: payload.index >= blocks.value.length - 1 },
    { key: 'duplicate', text: '复制这块' },
    { key: 'delete', text: '删除这块', danger: true }
  ]
}

async function onBlockLongPress(payload: EditorBlockLongPressEvent): Promise<void> {
  // 组件不弹层（§11）：长按只抛 { id, index }，ActionSheet 归页面。
  // ActionSheetItem 字段是 text/desc/disabled/danger/key —— 不是 label。
  const actions = blockActions(payload)
  const index = await sheet.open({ title: '内容块', actions })
  const action = actions[index]
  if (index < 0 || !action || action.disabled) return
  if (action.key === 'up') editor.moveBlock(payload.id, -1)
  if (action.key === 'down') editor.moveBlock(payload.id, 1)
  if (action.key === 'duplicate') editor.duplicateBlock(payload.id)
  if (action.key === 'delete') editor.removeBlock(payload.id)
}

// BaseActionSheet 的 select 载荷是 (action, index)，sheet.resolve 只吃 index → 具名方法转发，
// 不要写成 @select="sheet.resolve"（那样第一个参数会变成 ActionSheetItem）
function onSheetSelect(_action: ActionSheetItem, index: number): void {
  sheet.resolve(index)
}

function onSheetCancel(): void {
  sheet.resolve(-1)
}
</script>

<template>
  <view class="plan-edit">
    <BaseNavbar title="发布计划" />

    <!-- 整页唯一的滚动流：页面持有（§11）。编辑器组件内部一律不许再嵌 scroll-view -->
    <scroll-view
      class="plan-edit__scroll"
      type="list"
      :scroll-y="true"
      :scroll-into-view="scrollTarget"
    >
      <EditorBlockList
        :blocks="blocks"
        :focus-id="focusId"
        @focus="onBlockFocus"
        @blur="onBlockBlur"
        @input="onBlockInput"
        @update="onImageUpdate"
        @remove="onBlockRemove"
        @long-press="onBlockLongPress"
      />
    </scroll-view>

    <!--
      工具栏是 H2 的组件，props/emits 与接线以 H2 README 为准。
      这里只留 props：页面把本容器的 @focus/@blur 接进 editor.setFocus/blur，
      editor.activeStyle / editor.stylable 才知道该作用于哪一块 —— 这条线不经过本容器。
    -->
    <EditorToolbar :active-style="activeStyle" :stylable="stylable" />
    <BaseActionSheet
      :visible="sheetState.visible"
      :actions="sheetState.actions"
      :title="sheetState.title"
      @select="onSheetSelect"
      @cancel="onSheetCancel"
    />
  </view>
</template>
```

`EditorToolbar` 是 H2 的组件，上面只绑它的两个 required props（值来自 `useEditor`，不来自本容器），
事件接线以 H2 README 为准——**这条「聚焦块 → 工具栏」的线不经过 EditorBlockList**：
容器只把 `@focus`/`@blur` 交给页面，页面写进 `editor.focusId`，工具栏读的是 `editor.activeStyle`。
不需要 disabled 态时也可以省掉 `<BaseActionSheet>`，改用 `sheet.openNative(['上移','下移','删除'])`
——详情页 T3.11 就是走的这条（native 版没有 disabled 语义，块排序要用得上就得换 `open()`）。

## Props（逐字抄自 ./types.ts）

| prop      | 类型      | 默认 | 说明                                                   |
| --------- | --------- | ---- | ------------------------------------------------------ |
| `blocks`  | `Block[]` | 必填 | 页面 `editor.blocks` 原样传入：不排序、不消毒、不改 id |
| `focusId` | `string?` | `''` | 页面 `editor.focusId`：等值的块进入聚焦视觉态          |

## Emits（逐字抄自 ./types.ts）

| 事件         | 签名                                                           | 来源与去处                                                                                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focus`      | `(id: string)`                                                 | text/quote 的 textarea `@focus`、divider 的 `@tap`、image 的卡片点击 → 页面 `editor.setFocus(id)`                                                                                                                                                                      |
| `blur`       | `(id: string)`                                                 | 仅 text/quote（image/divider 契约里没有 blur）。页面**必须带守卫** `if (focusId === id) editor.blur()`。守卫**不在容器里做**：`props.focusId` 要等一次重渲染才更新，永远比 `editor.focusId` 慢一拍；页面直接读 Ref 才是最新值，A→B 切换时才不会把刚设好的 focusId 抹掉 |
| `input`      | `(id: string, text: string)`                                   | text/quote → 页面 `editor.setText(id, text)`                                                                                                                                                                                                                           |
| `update`     | `(id: string, next: { fileID: string; w: number; h: number })` | image 上传成功 → 页面 `editor.updateImage(id, next)`                                                                                                                                                                                                                   |
| `remove`     | `(id: string)`                                                 | image 自带的删除入口 → 页面 `editor.removeBlock(id)`                                                                                                                                                                                                                   |
| `long-press` | `(payload: { id: string; index: number })`                     | 任意块长按 → 页面弹 ActionSheet。`index` 是**原始 blocks 的下标**，直接喂 `moveBlock` 的边界判断                                                                                                                                                                       |

Slots：无。`defineExpose`：无（组件无状态，页面要的方法全在 `useEditor` 上）。

## `blk-` 前缀是这份契约里最容易静默失效的一环

每个块的**外层包裹节点**：

```vue
<view v-for="item in items" :id="blockNodeId(item.id)" :key="item.id" class="editor-block-list__block">
```

`blockNodeId()` 的实现就是 `` `blk-${id}` ``（EditorBlockList/index.vue）。
页那边 `useEditor.setFocus(id)` 写进 `scrollIntoViewId` 的字符串同样是 `` `blk-${id}` ``
（`src/composables/useEditor.ts:152-155`，`setFocus` 全体）。**两边各拼一次就会「聚焦不滚动」——不报错、不警告、
只在真机上表现为「点下面的块页面不动」**。所以：

- 前缀字面量在本工程只允许出现在这两处，改一处必须改两处；
- 页面绑 `:scroll-into-view="editor.scrollIntoViewId"`，**不要**自己 `` `blk-${focusId}` `` 再拼一遍；
- 目标节点必须是块的外层 wrapper（子件根节点在组件内部，`id` 挂在那里会把契约拆散）。

## 为什么组件里没有 scroll-view

- Skyline 下页面本身不滚动（技术方案 §2.2-2），整页只有一个 `scroll-view type="list"`；
  **嵌套滚动在 Skyline 下未验证**（兼容清单只测了单层 list / nested），§11 直接判死：编辑器组件内部不得再嵌。
- 详情页已按同一条规则验收：评论区在页面 scroll-view 的滚动流里，`CommentList` 只是普通 `view` 容器，
  触底由页面 `@scrolltolower` 调 `loadMore()`（见 `business/CommentList/README.md`）。编辑器同理，
  只是它连分页都没有，`EditorBlockList` 就是 `view` + `v-for`。
- 顺带一条硬约束：容器和四个子件都**不使用** `SelectorQuery` / `boundingClientRect` /
  `createIntersectionObserver`。`scroll-view type="list"` 会虚拟化视口外节点，测它会**永久挂起不回调**
  （兼容清单 §2.3）。定位一律走 `scroll-into-view`，「这一块在哪」在 v1 不需要知道。

## 为什么不做区间样式（段落级）

兼容清单 §2.4 实测：`canIUse('textarea.bindselectionchange')=false`、`selectionchange` 事件流收不到
（`start=-1 end=-1`）、设了 `selection-start/end` **没有任何选区高亮**。也就是 Skyline 下拿不到可靠区间，
「选中部分文字加粗」在这个渲染引擎里**没有实现路径**，不是没做。于是：

- 一个 text 块 = 一个 `<textarea>`，`bold/color/level/align` 整段生效（`Block` 类型里这几个字段就挂在块上）；
- 工具栏（H2 的 `EditorToolbar`）作用于**当前聚焦块**，改的是块字段，不是选区；
- 因此组件里不存在 `selectionStart` 之类的读取，textarea 只挂实测过的属性集
  `auto-height / adjust-position / cursor-spacing / hold-keyboard / disable-default-padding / maxlength`。

## 为什么这里不 `sanitizeBlocks`（与 ContentRenderer 的唯一重大差别）

`ContentRenderer` 在渲染前过一遍 `sanitizeBlocks()`（脏草稿兜底）。`EditorBlockList` **不能**过，三条理由：

1. 消毒会给缺 id 的块 `createBlockId()` 换一个新 id → 组件自己生成了 id，违反受控约束，还会让页面的
   `focusId`/`scrollIntoViewId` 指向一个已经不存在的块；
2. `blocks.ts:202` 对 image 块 `if (!fileID) continue` → 会把**正在上传/刚点「插入图片」落下的空块**丢掉，
   而 H2 契约明确写「空 fileID = 还没选图的占位态，渲染『点击选择图片』卡片」。丢了块就等于上传中块消失；
3. 消毒是「读别人的脏数据」的防线，编辑态的数据源是 `useEditor` 自己写出来的，本来就该干净。

组件只保留一层最小防御：`type` 不在 `['text','image','quote','divider']` 里的块整块跳过（不渲染、不报错），
`blocks` 传成非数组也不崩（`Array.isArray` 兜一层）。空列表照 §8.1 是理论上不可达的
（`initialBlocks()` / `ensureTrailingTextBlock()` 保证至少有一个可输入块），真传空数组时容器渲染零个节点，
「还没有内容」这类引导归页面，不在这里发明 UI。

**页面的义务**：`editor.load()` / `restoreDraft()` 已经过消毒（useEditor 内部做的），直接喂 `editor.blocks` 即可；
提交前那条「在途图片块」的门禁判定见下面上报第 2 条。

## 为什么只有 image 分支写内联事件表达式

`focus / blur / input / remove / long-press` 的载荷都自带块 id，容器一律具名方法**原样转发**。
唯独 H2 的 `EditorImageBlock` 契约里 `update` 的载荷只有 `{fileID,w,h}` 不带 id（契约字面量在 §11，
两侧 prompt 同一段，不许我改），而页面必须知道改的是哪一块，所以容器在这里补 id：

```vue
@update="(next: ImageUpdatePayload) => onImageUpdate(item.id, next)"
```

参数上显式类型标注，不靠推导。其余分支保持零内联表达式——本工程的 mp 事件写法以「具名方法」为准
（PlanList / CommentList / 详情页都是这么写的）。

## 上报（不在本目录自行修）

1. **`EditorImageBlock` 的 `update` 载荷建议带 id**。当前容器用一处内联表达式补（见上一节），
   能跑但破坏「子件事件一律自标识」这条内部一致性；H2 若改签名必须同步本目录。
2. **提交门禁要另判「块内图片在途」**。§11 说的 `!uploading` 只覆盖 `ImageUploader`（计划配图）；
   块内图片在 H2 里也是异步上传，`fileID === ''` 的块一旦被提交，云函数 `planPayload.ts:39` 会以
   `只能使用上传过的图片` 整单失败。建议页面轮把 `blocks.some(b => b.type === 'image' && !b.fileID)`
   并进 `canSubmit`，或在发布前拦一次。
3. **`ImageBlock.caption`（图注）在 v1 没有任何写入口**。`types/models.ts` 有它、
   `blocks.ts` 会消毒保留它、云端还允许 ≤60 字，但 H1/H2 的契约里没有一个事件能写它
   （`update` 只带 `{fileID,w,h}`）。结果：图注只能被加载、不能被编辑。要么下一轮明确「v1 不支持图注」
   并把字段从云端/类型里标注为保留，要么给 `EditorImageBlock` 加一个 caption 写回口子——**这不是本目录能定的**。
4. **两个字数口径并存**（不是 bug，但必须写清）：本容器/`EditorTextBlock` 的块级计数用**原始字符数**
   （与 textarea 原生 `maxlength`、云端 `asString` 截断同源）；页面顶部的总字数若用
   `utils/blocks.ts` 的 `blocksCharCount()`，那是**去空白**的口径。两者相加不相等。
   建议页面 README 里点名，别让用户以为两个数字该一致。
5. **`WARN_LEFT = 100`（「将满」阈值）目前各组件一份** —— **主 agent 验收处置：已统一。**
   原两处（`EditorTextBlock/index.vue`、`EditorQuoteBlock/index.vue` 各自的文件顶部常量）已删，
   现只有 `constants/plan.ts:72` 的 `TextInput.WARN_REMAINING = 100` 一份，消费者是
   `EditorTextBlock/index.vue:40` 与 `EditorQuoteBlock/index.vue:29` 的 `isWarn`。
   命名没按建议的 `BLOCK_TEXT_WARN_LEFT`，而是和 `CURSOR_SPACING` 一起放进新的 `TextInput`：
   两条都是「原生输入组件的观感参数」，同一件事该有同一个容身之处。放不进 `Limit` 是刻意的 ——
   `Limit` 回答「能不能提交」（与云端同源），`WARN_REMAINING` 只回答「什么时候变颜色」。
   也没有为它单开 util（按本条建议的后半）。
6. **blur 守卫的位置与 `docs/多agent协作记录.md` §4.5 记录不一致，请裁决**。那条写的是
   「判断从页面上移进容器：容器 `props.focusId` 就是唯一真相；页面 `@blur="editor.blur"` 不带参数」。
   本实现按 §11 的受控纪律留在页面，理由是容器判不准这个竞态：`props.focusId` 要等一次重渲染才更新，
   而 `editor.focusId` 是 `setFocus` 同步写的——A→B 快速切换时 blur(A) 落在同一次任务里，
   容器读到的是**旧** prop，会把刚设好的 focusId(B) 抹掉。
   若仍要把守卫收进容器，建议改为在 `useEditor` 上加 `blurIf(id: string)`（共享层，本目录无权改），
   页面就能写成 `@blur="editor.blurIf"`，既不用组件读状态也没有慢一帧的问题。

## 待真机/模拟器复核（本组件无法自证）

按兼容清单 §2.8 的规则：清单里没有的条目按**未验证**处理，不当成支持也不当成不支持。

1. **`scroll-into-view` 能否命中自定义组件内部节点的 id**。`blk-${id}` 挂在 `EditorBlockList`
   内部的 wrapper view 上（uni-app 会把这个组件编译成 mp 自定义组件），而详情页已验收的锚点
   `planDetailTail` 是**页面直属节点**——两者不同一层。兼容清单 §2.3 只实测过「跳 list 里的第 100 项」。
   若不命中，表现是「点可视区外的块不滚动」而不是报错。备选：编辑页 scroll-view 换 `type="custom"`
   （同样没有实测条目）或由页面把每块的外层 wrapper 上提到页面里渲染。
2. `scroll-view type="list"` 把 `EditorBlockList` 整体当成**一个 cell**：块再多也在同一回收单元里。
   长文（几十块）时的滚动流畅度、「离屏 cell 被回收后 `scroll-into-view` 是否还找得到目标」需实测。
3. `disable-default-padding=true` 后 textarea 的文字基线是否与 `ContentRenderer` 的 `<text>` 对齐
   （§2.4 只实测了该属性 `canIUse=true`，没测与只读态的观感差）。
4. `textAlign: 'center'`（`blockStyle` 给居中标题用的）在 Skyline 的 textarea 上是否生效。
5. `hold-keyboard=true` 与底部固定工具栏的配合：点工具栏不收起键盘是我们要的，但「点页面空白处键盘也不收回」
   是副作用。若要改成页面控制，本组件加一个 prop 而不是去读页面状态（§11 受控约束）。
6. 未采用的 textarea 能力，理由写在这里免得下一个人当「不支持」引用：
   `focus` / `blur` **属性**（§2.4 无条目；`CommentInput` 用了它，但那是组件内部的 ref 驱动，
   本组件若绑 `:focus="focused"` 会变成「页面一改 focusId 就弹键盘」，风险大于收益）、
   `selection-start/end`（实测无高亮）、`placeholder-class`（无条目，占位色交给原生默认）、
   `show-confirm-bar` / `confirm-type`（编辑器没有「完成」语义）。
   采用的 `value / placeholder / maxlength / @input / @focus / @blur` 与已验收的 `CommentInput` 同组口径。
