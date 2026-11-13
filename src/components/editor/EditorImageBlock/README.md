# EditorImageBlock（T4.4）

正文里的**一个图片块**。它是本轮四路之间唯一的跨路接口：H1 的 `EditorBlockList` 在 `type === 'image'`
分支渲染本组件，两侧的 `types.ts` 字面量必须一字不差（`docs/agent-prompts.md` §11）。

```
块数据（props.block） ──► 本组件：选图 / 进度 / 重试 / 删除（useUpload 状态机长在组件内）
                          │
上传成功 emit('update', { fileID, w, h }) ──► 宿主透传 ──► 页面 editor.updateImage(block.id, $event)
```

**没有桶文件**：`src/components/editor/index.ts` 禁止创建，外部一律完整路径 import：

```ts
import EditorImageBlock from '@/components/editor/EditorImageBlock/index.vue'
```

## 契约（`types.ts` 原样，勿改）

```ts
import type { ImageBlock } from '@/types/models'

export interface Props {
  /** 空 fileID = 还没选图的占位态，渲染「点击选择图片」卡片 */
  block: ImageBlock
  focused: boolean
}
export type Emits = {
  (e: 'focus', id: string): void
  (e: 'update', next: { fileID: string; w: number; h: number }): void
  (e: 'remove', id: string): void
  (e: 'long-press', id: string): void
}
```

两个 props 都是必填，所以组件里是 `defineProps<Props>()`（没有可选值可兜，`withDefaults` 无处可用）。
事件载荷**不带块 id**：一个实例只服务一个块，id 由 `props.block.id` 与宿主的透传补齐
（H1 那边是 `@update="(next) => onImageUpdate(item.id, next)"`）。

| 事件 | 什么时候发 | 页面做什么 |
| --- | --- | --- |
| `focus` | 点块任意位置（含空卡、进度遮罩、重试）→ 冒泡到根节点 | `editor.setFocus(id)`：图片块不是 text 块，`stylable` 随之变 false，工具栏样式项自动置灰 |
| `update` | `useUpload` 的条目进入 `done` 且有 fileID 时**发一次** | `editor.updateImage(id, next)`（useEditor.ts:224） |
| `remove` | 点右上角 × | `editor.removeBlock(id)`；组件顺手 `clear()` 掉本地上传条目 |
| `long-press` | 长按块 | 页面弹 ActionSheet（上移/下移/删除/复制），组件自己不弹（§11） |

## 页面接线（逐字可抄）

图片块的宿主是 `EditorBlockList`，页面只跟容器打交道 + 处理工具栏的「插入图片」。三段一起抄：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import EditorBlockList from '@/components/editor/EditorBlockList/index.vue'
import EditorToolbar from '@/components/editor/EditorToolbar/index.vue'
import ImageUploader from '@/components/editor/ImageUploader/index.vue'
import type { ImageUpdatePayload } from '@/components/editor/EditorBlockList/types'
import { useEditor } from '@/composables'
import type { Block } from '@/types/models'

const editor = useEditor({ /* getExtra / openId / onDraftSaved */ })

// ① 图片块回写：容器补 id，页面落到 useEditor 唯一的写入口
function onImageUpdate(id: string, next: ImageUpdatePayload): void {
  editor.updateImage(id, next)
}

// ② 工具栏「插入图片」：**只落一个空 fileID 的块，不在工具栏里上传**（§11 的分工）
//    用户在新块里点「点击选择图片」才真正走 chooseMedia → uploadFile。
function onInsertImage(): void {
  editor.insertImage('', 0, 0, editor.focusId || undefined)
}

// ③ 提交门禁（正文图这一侧的口径）：
//    空 fileID 的 image 块 = 用户还没选 / 正在传 / 传失败了。
//    它既过不了云端校验（planPayload.ts:37-41「只能使用上传过的图片」），
//    也会在下次草稿恢复时被 sanitizeBlocks 丢掉，所以发布前必须拦。
const hasPendingImageBlock = computed<boolean>(() =>
  editor.blocks.value.some((block: Block) => block.type === 'image' && !block.fileID),
)
const canPublish = computed<boolean>(() => !hasPendingImageBlock.value /* && !配图在途，见 ImageUploader README */)

// onBlockLongPress（长按弹 ActionSheet）见 EditorBlockList/README.md 的接线一节，本例省略
</script>

<template>
  <scroll-view type="list" class="edit__scroll" :scroll-into-view="editor.scrollIntoViewId">
    <EditorBlockList
      :blocks="editor.blocks"
      :focus-id="editor.focusId"
      @focus="editor.setFocus"
      @update="(id: string, next: ImageUpdatePayload) => onImageUpdate(id, next)"
      @remove="editor.removeBlock"
      @long-press="onBlockLongPress"
    />
    <ImageUploader v-model="images" @change="onUploaderChange" />
  </scroll-view>
  <EditorToolbar
    :active-style="editor.activeStyle"
    :stylable="editor.stylable"
    @insert-image="onInsertImage"
  />
</template>
```

> Ref / ComputedRef 在模板里的解包只对 setup 顶层绑定生效：`editor.blocks` 是 `Ref<Block[]>`，
> 挂在对象上**不会**自动解包，页面要按 `EditorBlockList/README.md` 的写法先取一层
> （`const blocks = editor.blocks` 再 `:blocks="blocks"`）。这里为了把跨路关系写清楚直接引了 `editor.*`，
> 真正落页面时请按 H1 README 的解包口径来。

## 四态

| state | 条件 | 渲染 |
| --- | --- | --- |
| `empty` | 无本地条目且 `block.fileID === ''` | 「点击选择图片」卡片（`+` 由两个真实节点拼，Skyline 无伪元素） |
| `uploading` | 本地条目 `pending` / `uploading` | 本地临时路径占位 + 半透明遮罩 + 自绘进度条（`width: %`，不用未实测的原生 `progress`） |
| `error` | 本地条目 `error` | 本地图保留 + 遮罩「上传失败 / 点击重试」，整块可点重试（天然满足 88rpx 最小可点尺寸） |
| `ready` | `block.fileID` 非空（或宿主漏接 `update` 时兜本地条目的 fileID） | `BaseImage` 出图 |

`ready` 态的兜底值得记一笔：**即使页面忘了接 `@update`，图也不会消失**（`src` 取 `block.fileID || 条目.fileID`）。
但数据里仍然是空 fileID，草稿/发布都会丢图 —— 门禁必须照上面第 ③ 段写。

## 为什么不在 `onMounted` 自动弹选图

空 fileID 的块有两种来路，自动弹选图两种都会误触发：

1. **插入时**：工具栏「插入图片」落的就是空块（`editor.insertImage('', 0, 0)`），用户可能只是先把位置占上；
2. **回填时**：编辑态 `plan.detail` / 草稿恢复都会重建块列表，自动弹等于一进页面就糊一脸相册。

所以选图只能由用户点空卡发起。

## 为什么空 fileID 的块不会被草稿恢复保留

`utils/blocks.ts:200-202`：

```ts
const fileID = asString(record.fileID, 512)
if (!fileID) continue // ← 空 fileID 的图片块直接被丢弃
```

草稿写盘存的是整包 `blocks`（含空 fileID 的在途块），但 `restoreDraft()` 会 `sanitizeBlocks()` 洗一遍，
在途块就没了；`useEditor.updateImage` 的注释（useEditor.ts:190-195）把这条口径写死了：
**上传中断就是整块消失，符合预期**——本组件不在挂载时把本地条目「复活」，
`useUpload` 的实例也随组件销毁（它只活在当前组件实例里）。要恢复只能重选一张。

## `done` 与 `!uploading` 的语义差别（本轮三处都要用对）

`useUpload` 的 `done` 与 `uploading` 两个 computed（useUpload.ts:295-296）：

- `done` = **至少一张**且全部完成 → 配图可以为空，所以它**不能**当提交门禁；
- `uploading` = 存在任何非 `done` 的条目 → **页面门禁用它**（`!uploading`）。

本组件的 `max: 1` 实例只服务当前块，`done` 在这里没有任何全局含义，组件也不往外抛门禁值：
**块级门禁就是 `block.fileID` 非空**（上面接线第 ③ 段）。全局门禁 = 所有 image 块 fileID 非空 ∧ `!uploading`（配图，见 ImageUploader README）。

## 为什么这里不用 `addExisting`

`addExisting()`（useUpload.ts:211）是「没有本地路径、直接落 done 条目」的编辑态回填入口，
它的产物是**上传队列里的一项**。而本组件的真相在 `props.block.fileID`：
回填的块本来就该由 `EditorBlockList` 用 `block.fileID` 渲染，塞一份进上传队列只会造出第二个状态源。
所以本组件只在 `pick()` 之后才有本地条目，`ready` 态根本不查上传状态机。

## 比例只有一个来源

`ratio` 只从 `utils/blocks.imageBlockRatio()` 出来，语义是**宽/高**（CSS `aspect-ratio`），
与 `BaseImage` 的 `ratio` prop 同单位（谁也别再换算倒数）。上传中 `w/h` 还留在本地条目里，
组件用 `imageBlockRatio({ ...props.block, w: 条目.width || block.w, h: 条目.height || block.h })`
按**同一个函数**算，不另写倒数公式。`ratio === 0` 时 `mode` 退成 `widthFix` 让图自撑，与详情页
`ContentRenderer` 完全一致——这是「编辑时长得跟发布后一样」的落点（§10 渲染/编辑同源）。

## Skyline 取舍

- 组件内**不嵌 `scroll-view`**、不做任何 `boundingClientRect`/`SelectorQuery`（§11 + 兼容清单 §2.3 视口外节点被虚拟化，测它会永久挂起）。
- 进度条 = 真实节点 `width: %` + `transition`（兼容清单 §2.2 实测可用），不用原生 `progress`（清单里没有它的 Skyline 条目）。
- 不预览大图：`BaseImage` 的 `preview` 走 `uni.previewImage({ urls: [src] })`，而 fileID 直传 previewImage 未实测、
  换临时 URL 又要拉 `getTempFileURL`（§8.2），编辑态价值低 → `preview` 关掉，点块只做聚焦。列入 v2。
- 不硬编码色值（§9.1-5）；聚焦态用**常驻 2rpx 透明描边换颜色**，不加边框宽度，避免块被顶宽。

## 已知缺口（上报主 agent，本目录不动手）

1. **正文图片块没有数量上限**：`Limit.IMAGE_MAX` 是「计划配图」的上限，正文块只受云端 `ServerLimit.BLOCK_MAX(100)` 兜底。
   若产品要限正文 3 张，得先有契约位（`constants/plan.ts` 加一个 key 或页面自己数），组件这边是无条件允许插入的。
2. ~~**空卡的提示文案与 `useUpload` 默认值是两份字面量**~~ —— **主 agent 已收口**：
   `useUpload.ts:50` `MAX_SIZE`、`:52` `DEFAULT_ACCEPT` 现已导出，并在 `:59` 组了一条
   `UPLOAD_HINT`（「支持 jpg / jpeg / png / webp，单张不超过 5MB」）。本组件与 `ImageUploader`
   都改成 import 它，不再自己写数字 —— 这条上报里「改返回值形状本轮禁做」的顾虑不成立，
   导出两个常量就够了，所以走的是导出这条路。
3. **`useUpload` 内部读 `useUserStore().userInfo?.openId` 拼 cloudPath**：组件因此间接依赖 store 已初始化。
   §11 把「上传状态机可以长在组件里」列为例外，这条按例外理解，不算越层（组件没有直接 import store）。
