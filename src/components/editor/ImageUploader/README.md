# ImageUploader（T4.8）

**计划配图**九宫格（`plans.images`，最多 `Limit.IMAGE_MAX = 3` 张）。它是 §8.1 页面结构里
`EditorBlockList` 之后的那一段，跟正文图片块（`EditorImageBlock`）是两码事：

|                           | 数据落点                 | 状态机                             | 谁触发选图                               |
| ------------------------- | ------------------------ | ---------------------------------- | ---------------------------------------- |
| `ImageUploader`（本组件） | `plans.images: string[]` | 组件内一台 `useUpload({ max: 3 })` | 九宫格的「添加」格                       |
| `EditorImageBlock`        | `blocks[i].fileID`       | 每块一台 `useUpload({ max: 1 })`   | 块自己的空卡；**工具栏只落空块，不上传** |

两者都**不许**自己调 `wx.cloud` / `uni.chooseMedia` / `uni.chooseImage`：上传只有 `useUpload` 一个出口
（`useUpload.ts:7-11` 全工程唯一允许直接碰云存储 SDK 的地方）。

**没有桶文件**：`src/components/editor/index.ts` 禁止创建（§9 business 桶文件互相覆盖的教训），
import 走完整路径：

```ts
import ImageUploader from '@/components/editor/ImageUploader/index.vue'
import type { UploaderChange } from '@/components/editor/ImageUploader/types'
```

## Props / Emits（`types.ts` 原样）

| prop         | 类型       | 默认              | 说明                                                                               |
| ------------ | ---------- | ----------------- | ---------------------------------------------------------------------------------- |
| `modelValue` | `string[]` | `[]`              | v-model：`plans.images`（fileID 数组）。传云端已有值即完成编辑态回填               |
| `max`        | `number`   | `Limit.IMAGE_MAX` | 只在创建 `useUpload` 实例时读一次，**运行中改此值不生效**（要改就换 key 重建组件） |
| `disabled`   | `boolean`  | `false`           | 提交在途时整体禁用；组件**不弹提示**（见下面「提示只有一条」）                     |
| `label`      | `string`   | `'配图'`          | 区块标题；计数 `2/3` 由组件自己拼                                                  |

```ts
export type Emits = {
  (e: 'update:modelValue', fileIDs: string[]): void
  (e: 'change', payload: UploaderChange): void
}

export interface UploaderChange {
  fileIDs: string[]
  uploading: boolean // 有条目非 done（在途/失败）—— 提交门禁用 !uploading
  done: boolean // 至少一张且全部完成 —— 只拿来写「配图已就绪」
  count: number // 格子数（含在途与失败）
  failed: number // 失败条目数
  max: number
}
```

## 页面接线（逐字可抄）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import EditorBlockList from '@/components/editor/EditorBlockList/index.vue'
import EditorToolbar from '@/components/editor/EditorToolbar/index.vue'
import ImageUploader from '@/components/editor/ImageUploader/index.vue'
import type { UploaderChange } from '@/components/editor/ImageUploader/types'
import { showToastMsg, useEditor, useForm, type FormRules } from '@/composables'
import { Limit } from '@/constants/plan'

/**
 * ★ 字段分工的判据只有一条：`EditorExtra = Omit<PlanWritePayload, 'title' | 'blocks'>`
 * （useEditor.ts:46）—— 标题与正文归编辑器草稿整包，**其余**（配图/截止/选项开关/选项）归 useForm 的 model。
 * 这里不放 `title`：草稿恢复走 `editor.restoreDraft()`，回填走 `editor.load()`，
 * model 里再镜像一份就是两处真相，谁后写谁赢。代价：`useForm` 的规则看不见标题，
 * 标题必填只能在下 `validateContent()` 里判、**只 toast 不画红字**。
 */
interface EditModel {
  images: string[]
  deadline: number
}

const editor = useEditor({
  /* getExtra: () => ({ images: model.value.images, deadline: …, optionsEnabled: …, options: … }) —— 见 useEditor.ts:46 EditorExtra */
})
const form = useForm<EditModel>(() => ({ images: [], deadline: 0 }), {
  // 配图不是必填：这里**不能**加 required，否则 0 张图永远发不出去（§8.2 允许空数组）
  images: [{ max: Limit.IMAGE_MAX, message: `配图最多 ${Limit.IMAGE_MAX} 张` }],
  deadline: [{ required: true, message: '请选择截止时间' }]
} satisfies FormRules<EditModel>)

// ★ Ref 解包口径（CommentList/README.md 同一个坑）：form.model / form.submitting / form.valid
//   都是对象里的嵌套 Ref，模板**不解包**，必须在 setup 顶层先取一层。
const model = form.model
const submitting = form.submitting
const valid = form.valid

/** ★ 提交门禁的状态源：只认 uploading，不认 done */
const imagesUploading = ref(false)
const imagesFailed = ref(0)
function onUploaderChange(payload: UploaderChange): void {
  imagesUploading.value = payload.uploading
  imagesFailed.value = payload.failed
}

const canPublish = computed<boolean>(
  () => !submitting.value && !imagesUploading.value && valid.value
)

// 编辑态回填：detail 回来后写 model.images，组件用 addExisting() 落成 done 格子（不重传、不弹相册）
// 标题走 editor、不进 model —— 与上面的字段分工同一条判据
function fillFromDetail(detail: { title: string; images: string[]; deadline: number }): void {
  editor.setTitle(detail.title)
  model.value.images = [...detail.images]
  model.value.deadline = detail.deadline
}

/** 标题/正文的真相在 editor 里，useForm 的规则看不见 → 页面自己判并给一条 toast（编辑页 `pages/plan/edit/index.vue:652-663` 同款） */
function validateContent(): boolean {
  if (editor.title.value.trim() === '') {
    showToastMsg('先给计划起个标题')
    return false
  }
  return true
}

// 调用点在提交里：先 `if (!validateContent()) return`，再 `form.submit(writeAction)`（编辑页 `pages/plan/edit/index.vue:680`）
</script>

<template>
  <scroll-view type="list" class="edit__scroll" :scroll-into-view="scrollTarget">
    <EditorBlockList :blocks="blocks" :focus-id="focusId" />
    <!-- 配图区在滚动流里（§8.1 页面结构），不是吸底层 -->
    <ImageUploader v-model="model.images" :disabled="submitting" @change="onUploaderChange" />
    <text v-if="imagesFailed > 0" class="edit__warn">{{ imagesFailed }} 张配图没传上去</text>
  </scroll-view>
  <EditorToolbar :active-style="activeStyle" :stylable="stylable" />
</template>
```

> `blocks / focusId / scrollTarget / activeStyle / stylable` 同样要在 setup 顶层从 `editor` 里取一层
> （`const blocks = editor.blocks` …），理由与上面那条解包口径一致；
> 完整接线以 `EditorBlockList/README.md` 与 `EditorToolbar/README.md` 为准。

三个容易接错的点：

1. **`v-model` 写 `model.images`**，不要写 `form.model.images` —— 后者传的是 Ref。
2. `@change` 首帧就报一次（组件里那个 `immediate: true` 的 watcher），所以页面 `imagesUploading`
   的初值给 `false` 就行，不需要额外兜底。
3. 组件挂载即按 `modelValue` 回填。**先拿到 detail 再渲染组件**最省事；如果组件先挂载、
   `images` 后到货，也照样工作（`modelValue` 变化会再走一次回填），但会多一次格子重排。

## `done` 与 `!uploading`：门禁只能用后者

`useUpload` 的 `done` 与 `uploading` 两个 computed（useUpload.ts:295-296）：

```ts
done = files.length > 0 && files.every((item) => item.status === 'done') // 至少一张且全部完成
uploading = files.some((item) => item.status !== 'done') // 有任何非 done 条目（含失败）
```

**配图可以为空**（§8.2、云函数 `planPayload.ts:127` 的 `images` 允许空数组），所以
`done === false` 有两种完全不同的含义：「一张都没有」和「有一张还在传」。拿 `done` 当门禁 →
一张图都不配的发布永远按不下去。正解是 `!uploading`：

- 0 张：`files` 空 → `uploading = false` → 放行 ✅
- 2 张传完 + 1 张在途：`uploading = true` → 拦住 ✅
- 有失败条目：`status === 'error'` 也是非 done → 拦住，让用户重试或点 × 移除 ✅（组件不替他决定）

`done` 留给文案（「配图已就绪」），别拿它当门禁。

## `addExisting` 只在编辑态回填时用

组件里唯一调用它的位置是 `syncFromModel()`（由 `watch(() => props.modelValue, …, { immediate: true })` 驱动）。
为什么必须是它、且只能在这个时机：

- **不能走 `pick()`**：`pick()` 会弹相册，还会把云端图重新上传一遍（云端多一份孤儿文件，§8.2 第 4 条）；
- `addExisting(fileID)`（useUpload.ts:211-226）造的是 `status: 'done'` / `progress: 100` /
  `localPath = fileID` 的条目 —— 没有本地临时路径可占位，也不需要进度；
- 它**只在挂载与外部重置时**跑：新选的图走 `pick()`，两条路互不干扰；
- 回填不带 `w/h`：`addExisting(fileID, w, h)` 的后两个参数在这里传不了（`plans.images` 只是 `string[]`，
  云端不存配图尺寸）。九宫格缩略图是**强制 1:1 + `aspectFill`** 的方格，本来就不需要原图比例，
  所以不跳版。正文图块才需要 `w/h`（那是 `ImageBlock` 的字段，见 `EditorImageBlock/README.md`）。

### v-model 的三条回流规则（`syncFromModel`）

| 外部动作                   | 组件行为                                               |
| -------------------------- | ------------------------------------------------------ |
| 传进来本地没有的 fileID    | `addExisting()` 补格子（编辑态回填）                   |
| 把某个 fileID 从数组里去掉 | 跟着摘掉对应的 **done** 格子（发布成功重置、放弃草稿） |
| 数组里出现重复 fileID      | 只补一格（`hasFileID()` 去重）                         |

**在途与失败条目不参与「外部删掉就摘格子」**：它们的 `fileID === ''`，永远匹配不上 `modelValue`，
所以外部数组怎么变都不会打断正在跑的 `uploadFile`。组件自己发完 `update:modelValue` 后
页面回写的同值不会再触发第二轮 diff（比对的是 fileID 集合，不是数组引用）。

## 提示只有一条

`useUpload` 内部已经对「超出上限 / 格式不符 / 体积超限」弹过 toast
（`fail()` → `showToastMsg`，useUpload.ts:110-114）。组件**一律不补第二条**，具体表现：

- 满员时「添加」格**不隐藏、不吞点击**（只降到 45% 透明度），点了照样进 `pick()`，
  由 `useUpload` 说「最多 3 张」。这样格子数恒为 `count + 1`，位置不跳；
- `disabled` 时点击静默 no-op，**不弹提示**：为什么禁用的解释归页面（提交中/无权限），组件瞎弹只会和
  页面自己的提示打架；
- 组件全文件没有一处 `showToastMsg` / `wx.showToast`。

## Skyline 取舍

- 九宫格 = `view` + `flex-direction: row` + `flex-wrap: wrap`。**不用 `grid-view`**（兼容清单 §2.3：渲染 0×0）。
- 格宽与右距写在节点自己的 inline `style` 上（`32% + 2%`，末格 0），因为 Skyline 规范禁后代/子代选择器，
  `:nth-child` 也不在实测清单里 —— 只能把「第几列」这件事算在数据上（`cellStyle(index)`）。
  行距用 scoped 类里的 `$space-2`。
- 缩略图 `aspect-ratio: 1`（`BaseImage` 的 `ratio` prop，语义是**宽/高**，与 `imageBlockRatio` 同单位），
  先撑住方格再上图，加载完不会把下面的 `DeadlinePicker` 顶下去（§11.1 防抖动）。
- 进度条是真实节点 `width: %` + `transition`，不用原生 `<progress>`（兼容清单无其 Skyline 条目）。
- 组件内不嵌 `scroll-view`、不做任何测量（§11 + 兼容清单 §2.3）。
- 云端不删文件：点 × 只 `useUpload.remove()` 摘本地条目，`uploadFile` 产生的对象留给 scheduler 清（§8.2 第 4 条）。

## 已知缺口（上报主 agent，本目录不动手）

1. **`useUpload` 的 `dir` 参数写不出第二个语义**：正文图块与计划配图都落在 `plans/{openId}/` 下
   （`dir` 默认 `'plans'`）。想分开成 `blocks/` 需要页面或组件传 `dir`，本轮组件保持默认，
   因为 §8.2 第 3 条只规定了 `plans/{openId}/{ts}_{rand}.{ext}` 这一条路径，云函数侧的文件ID 前缀校验按环境走。
2. **`failed` 只有条数、没有原因** —— **主 agent 已收口**：`useUpload.ts:149` 不再只把 `err` 写进 logger，
   `UploadItem.message` 现在带 `上传失败：${err.errMsg}`，条目上就有原因可读。
   本 README 原先记的是「message 固定为『上传失败』」，那是改动前的事实。
   仍然保留的现状：对外暴露的 `failed` 是**条数**，页面按条数出汇总文案；要把每条原因铺开显示，得改返回形状，另议。
3. **`max` 改了不生效**：`useUpload({ max })` 在 setup 期取值，运行期换 `max` prop 不会重建实例。
   真要动态上限（比如正文图与配图共用一个数）请让页面 `:key` 重建组件，已在 props 注释里写明。
