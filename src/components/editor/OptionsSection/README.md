# OptionsSection + OptionEditorCard（T4.10）

「添加选项」开关 + 选项卡片编辑区（技术方案 §8.6 编辑态）。两个目录一套契约：`OptionsSection` 对页面，`OptionEditorCard` 对 `OptionsSection`。

页面只需要认 `OptionsSection` 一个组件；`OptionEditorCard` 是它的内部实现，页面不直接 import（除了想自己排卡片的情况，不建议）。

## 接线示例（页面照这段抄）

```vue
<script setup lang="ts">
import BaseActionSheet from '@/components/base/BaseActionSheet/index.vue'
import type { ActionSheetItem } from '@/components/base/BaseActionSheet/types'
import OptionsSection from '@/components/editor/OptionsSection/index.vue'
import {
  firstInvalidOptionIndex,
  optionCardId,
  optionsProblem
} from '@/components/editor/OptionsSection/types'
import { showToastMsg, useActionSheet } from '@/composables'
import type { PlanOption } from '@/types/models'
import { computed, ref } from 'vue'

// ---- 1. 三个事件三个 handler（model 假设是 useForm 的 EditModel，含 optionsEnabled / options）----
function onOptionsToggle(enabled: boolean): void {
  form.model.value.optionsEnabled = enabled
  // 注意：**这里不清空 options**。§8.6 要求关闭只折叠、数据保留，页面也别顺手加一行 `= []`
}

function onOptionsChange(next: PlanOption[]): void {
  form.model.value.options = next // 组件交出来的数组已经带连续 order，页面不要再补
}

// ---- 2. 提交门禁：选项配图在途时不许发布 ----
const optionsUploading = ref(false)
function onOptionsUploading(value: boolean): void {
  optionsUploading.value = value
}
// 开关关着时根本没有要提交的选项，门禁也应该跟着放行
const canSubmit = computed(() => !form.model.value.optionsEnabled || !optionsUploading.value)

// ---- 3. 提交校验：判据由本目录给全，页面只负责调 ----
const scrollTarget = ref('')
function validateOptions(): boolean {
  const problem = optionsProblem(form.model.value.options, form.model.value.optionsEnabled)
  if (!problem) return true
  showToastMsg(problem)
  const bad = firstInvalidOptionIndex(form.model.value.options)
  const target = bad >= 0 ? form.model.value.options[bad] : undefined
  // §8.6「定位到第一个错误卡片」：目标 id 只能由 optionCardId 生成，别自己拼字符串
  if (target) scrollTarget.value = optionCardId(target.id)
  return false
}

// ---- 4. ActionSheet 的宿主节点（**必须渲染，否则「更多」菜单点了没反应**）----
const sheet = useActionSheet()
const sheetState = computed(() => sheet.state.value) // 嵌套 Ref 不解包，这层 computed 就是解包点
function onSheetSelect(_action: ActionSheetItem, index: number): void {
  sheet.resolve(index)
}
function onSheetVisible(value: boolean): void {
  if (!value) sheet.close() // 取消 / 点遮罩 → Promise 收到 -1，卡片那边不动任何数据
}
</script>

<template>
  <scroll-view type="list" class="edit__scroll" :scroll-into-view="scrollTarget">
    <!-- 5. 组件本体：整页唯一的 scroll-view 由页面持有，OptionsSection 内部不再嵌滚动容器 -->
    <OptionsSection
      :enabled="form.model.value.optionsEnabled"
      :options="form.model.value.options"
      @toggle="onOptionsToggle"
      @change="onOptionsChange"
      @uploading="onOptionsUploading"
    />
  </scroll-view>

  <!-- 菜单节点在 scroll-view 之外（page-container 是页面级容器，不放虚拟列表里） -->
  <BaseActionSheet
    :visible="sheetState.visible"
    :title="sheetState.title"
    :actions="sheetState.actions"
    @update:visible="onSheetVisible"
    @select="onSheetSelect"
  />
</template>
```

`form` / `scrollTarget` 之外的部分照抄即可。`form` 是页面 T4.11 的 `useForm<EditModel>`，见 DeadlinePicker/README.md 的 model 形状。

## Props / Emits（与 `types.ts` 逐字一致）

### OptionsSection

| prop       | 类型           | 默认    | 说明                                                                                   |
| ---------- | -------------- | ------- | -------------------------------------------------------------------------------------- |
| `enabled`  | `boolean`      | 必填    | 「添加选项」开关。页面初始值给 `false`（§8.6 默认关闭）                                |
| `options`  | `PlanOption[]` | 必填    | 选项列表；组件输出的每一项都带连续 `order`                                             |
| `disabled` | `boolean?`     | `false` | 只读态，开关/添加/卡片输入一起冻住（页面给「已截止计划」出只读视图时用；不需要就别传） |

| 事件        | 载荷                      | 说明                                                             |
| ----------- | ------------------------- | ---------------------------------------------------------------- |
| `toggle`    | `(enabled: boolean)`      | 开关点击，**取反后的值**。组件不改自己的 props，也不清 `options` |
| `change`    | `(options: PlanOption[])` | 增 / 删 / 排序 / 改名 / 换图后的**整包新数组**                   |
| `uploading` | `(uploading: boolean)`    | 任一选项配图在途（含失败待重试）。页面提交门禁用它               |

**只有这一套事件**（`toggle` + `change`）。另一条路（`update` / `remove` / `move` 逐字段）刻意没有做：逐字段事件会让页面自己去重排 `order`，同一个不变量两处实现必然漂移。选整包 `change` 的代价是页面每次拿整包替换，收益是 `order` 只有一个写入点。

### OptionEditorCard（`OptionsSection` 的子件，页面一般不直接用）

| prop       | 类型         | 说明                                                           |
| ---------- | ------------ | -------------------------------------------------------------- |
| `option`   | `PlanOption` | 一条选项；宿主 `v-for` 必须 `:key="option.id"`                 |
| `index`    | `number`     | 0 基序号（徽标 `pad2(index + 1)`，与展示态 OptionCard 同口径） |
| `total`    | `number`     | 总数，决定上移/下移的禁用边界                                  |
| `disabled` | `boolean?`   | 只读态                                                         |

| 事件        | 载荷                                   |
| ----------- | -------------------------------------- |
| `rename`    | `(name: string)` 原文，未 trim         |
| `image`     | `(fileID: string)`，`''` = 删掉配图    |
| `uploading` | `(uploading: boolean)`                 |
| `move`      | `(delta: number)` `-1` 上移 / `1` 下移 |
| `remove`    | `()`                                   |

## 折叠为什么用 `v-show`，为什么绝不清空

§8.6 原文：「关闭时：下方区域折叠（**Skyline 下用 worklet 高度动画或直接 `display: none`**），已配置数据保留不清空（避免误触丢失）」。

- **worklet 那条已经否决**：T0 实测 SharedValue 无法经 Vue 模板承载（拼出 `translateX([object Object]px)`，兼容清单 §2.5），要走 worklet 就得为这一个折叠封一个 `wxcomponents` 原生组件。为一个开关不值。
- 所以走 `display: none`，实现成 **`v-show`** 而不是 `v-if`。这不只是「一样能藏」：卡片里那台 `useUpload` 的**本地临时路径只活在组件实例上**（云端只有 `fileID`，`PlanOption` 里没地方存本地路径）。用 `v-if` 关掉时实例被销毁，重新打开就出现「文字都还在、正在传的那张图没了」。`v-show` 保住实例，也就保住了在途上传。
- **清空动作在组件里根本不存在**：`onToggle` 只 `emit('toggle', !enabled)`，函数体里没有一行碰 `options`。误触丢失数据是验收级 bug，所以这条写死在实现里而不是文档里。页面侧也别「贴心地」在 `toggle(false)` 时把 `options` 置空 —— 云端 `validateOptions(raw, false)` 已经返回 `[]`，落库不会残留，本地留着只为了再次打开时还在。

## `order` 由谁维护

**由 `OptionsSection` 维护，且只有一个出口** —— 组件里的 `commit(list)`：

```ts
function commit(list: PlanOption[]): void {
  emit(
    'change',
    list.map((option, index) => ({ ...option, order: index }))
  )
}
```

增、删、移动、改名、换图全部经过它，所以**交出去的数组永远满足 `order === 下标`（0 基连续）**。为什么这是硬要求：

- 云函数 `planPayload.ts` 只在 `order` 缺失时才用 `i` 兜，传了就原样落库 —— 组件传错就是往库里写错；
- 详情页 `OptionCardList` 按云端数组**原样渲染，不 `sort()` 不本地重排**（T3.7 的验收项），所以展示顺序完全由写入时的 `order` 与数组顺序决定。

0 基与云端的 `i` 兜底同口径（`validateOptions` 里 `order: rec.order === undefined ? i : ...`）。

`id` 走 `types.ts` 的 `createEmptyOption()`，它里面是 `utils/blocks.ts` 的 `createBlockId('o')`（与正文块、上传条目同一个 id 出口）；编辑态回填/草稿恢复时保留云端原 id —— 云端对重复 id 直接抛 `3003 选项标识重复`。

## 「开启时至少 2 个且每个 name 非空」——组件不做，页面用这套判据

规则属页面（T4.11 `useForm`），但判据的字面量在本目录 `types.ts` 里给全，页面 import 即用，**不要再抄一份**：

| 出口                            | 用途                                                                                                                                                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPTION_MIN_COUNT`（= 2）       | §8.6 的下界字面量                                                                                                                                                                                                                                  |
| `optionsProblem(list, enabled)` | 返回 `''` = 通过；否则是可直接 toast 的文案。`enabled=false` 一律放行（云端 `validateOptions(raw,false)` 直接 `return []`，开关关了还去数数量就是凭空拦截）                                                                                        |
| `firstInvalidOptionIndex(list)` | 第一个 `name.trim() === ''` 的下标，`-1` = 都填了                                                                                                                                                                                                  |
| `optionCardId(id)`              | §8.6「定位到第一个错误卡片」的 `scroll-into-view` 目标 id。**组件模板里挂的就是这个 id，页面必须用同一个函数生成**，两处各写一遍就一定跳不过去                                                                                                     |
| `createEmptyOption()`           | 空选项工厂，`id` 前缀（`createBlockId('o')`）的唯一来源。组件内部「添加选项」用的就是它；页面如果想「一打开开关就补两个空卡」（少一次点击，但会静默改 model，属产品决策）**也调它**，别自己写 `Date.now()` —— 云端对重复 id 抛 `3003 选项标识重复` |

判 `name.trim()` 而不是 `name`：云函数 `asString` 走 `required()`（`trim()` 后判空）再 `maxLen`，前端不 trim 就会放过全空格、被云端 `1001` 拒。

长度上限不用页面再判：`OptionEditorCard` 的 `textarea maxlength = Limit.OPTION_NAME_MAX`，输入侧已经硬闸在 20 个码点，云端 `Array.from(value).length > 20` 这条不可能触发。

## 图片：只有一个出口是 `fileID`

- 卡片内 `useUpload({ max: Limit.OPTION_IMAGE_MAX })`（§11 点名的唯一例外：上传状态机长在组件里）。
- **`emit('image', …)` 只在 `status === 'done'` 时发生**，值一定是 `cloud://` 开头的 fileID。原因写在云函数里：`validateOptions` 对非空 `image` 强判 `/^cloud:\/\//`，本地临时路径（`http://usr/…`、`http://tmp/…`）会被 `1001 选项图片只能使用上传过的图片` 拒掉。
- 在途/失败期间缩略图显示**本地临时路径**（T0.7：小程序端 `downloadFile` 只有 `tempFilePath`、没有 `fileContent`，「本地路径 → fileID」是唯一不闪的路线），但页面拿到的值这段时间仍是旧 fileID —— 所以**提交门禁必须看 `uploading`**，否则用户「刚选完就点发布」会把图片静默丢掉。
- 失败态：遮罩文案「上传失败 / 点击重试」，重试走 `useUpload.retry`（不再选一次图）。
- 「换一张」= 先摘掉本卡条目再 `pick()`；**用户取消选图会把原 fileID 塞回去且不 emit**，所以取消时页面的值一字未动。
- 单图上角的 ✕ 只有 48rpx，比 §9.1-8 的 88rpx 小 —— 它不是唯一入口（长按卡片出的菜单也在同一张卡上），刻意做小以免压掉缩略图。
- 上传目录沿用 `useUpload` 缺省的 `plans/`（§8.2 的路径口径 `plans/{openId}/{ts}_{rand}.ext`），选项图不另立前缀。

## 上限 10 的行为

`Limit.OPTION_MAX`。到达上限后「添加选项」按钮 `disabled`（BaseButton 内部不响应点击），下面那行提示同步变成红色文案「已达 10 个上限，删掉一个才能继续添加」——**禁用要给原因**，否则用户只知道点不动。`onAdd` 里还留了一道 toast 兜底，防有人绕过按钮直接调函数。

## v1 没有计票（不是缺口）

§8.6 已裁决 v1 选项仅展示：冻结契约里 `PlanOption` 只有 `{ id, name, image, order }`，`vote.submit` 的 req 只有 `{ planId, type }`，`VoteTypeValue` 只有 `1|2`，**云端没有任何按选项计票的通道**。所以编辑卡里没有票数、没有计票开关、没有预留字段 —— 别在这里加「设为默认选项」之类看起来无害的入口，它没有落点。

## Skyline 约束落地

- 无 `list-view` / `grid-view` / `sticky-*`（实测渲染 0×0）；组件内部**不嵌 `scroll-view`**（§11：整页唯一滚动容器归页面，嵌套滚动未验证）。
- 折叠用 `display:none`（v-show），**不用 worklet**（T0 结论）。
- 开关是自绘的 `view` + `transform: translateX` + `transition: transform` —— 两个都是实测项（§2.2 / §2.5）。
  **为什么不用原生 `<switch>`**：兼容清单 §2.3 把 Skyline 组件逐个列了可用/不可用，但对 `switch` **没有任何条目**，按本轮纪律（§11：无条目 = 未验证，不能当既成事实写进代码）不自赌。真机如果验通了，换回原生 `<switch>` 只动 `__track` / `__knob` 这两段 markup 和 `onToggle`，**对外 props/emits 一字不改**。
- 无 `inline-block`、无 `-webkit-line-clamp`、无伪元素、无后代/子代选择器（选中色/满字色都靠子节点自己挂修饰类）、无 `:last-child` 之类伪类（§1.4：Skyline 只认 class / ID / 标签）。
- `textarea` 只用实测过的属性集：`value / placeholder / disabled / maxlength / auto-height / adjust-position / cursor-spacing / disable-default-padding` + `@input`（§2.4）。**没有选区**，所以没有任何「选中部分加粗」的路线。
- 长按用 `@longpress`（与已验收的 `CommentItem` / `EditorTextBlock` 同一个事件名）。
- 所有文字包 `<text>`；可点击节点 `min-height/height: $tap-min-height`；禁用态置灰不隐藏（隐藏会让一行少一块、位置跳）。
- 色值/间距/圆角/字号全走 tokens，零硬编码；尺寸用 token 算术（`$space-5 + $space-2` 等），不写裸 rpx。

## 待真机复核（模拟器过 ≠ 真机过）

1. **`page-container` 菜单宿主 + 编辑器卡片长按**：详情页的长按菜单走的是 `uni.showActionSheet`（原生），本页走的是 `BaseActionSheet`（feedback store）。清单没验过「在 Skyline 编辑页里由子组件触发 store、由页面渲染 page-container」这条链路。**若页面没有渲染 `<BaseActionSheet>`，`open()` 的 Promise 永不 resolve，表现是「点⋯没反应且不报错」** —— 这是接线漏项，不是组件 bug，验收时先查页面有没有那个节点。
2. **选项卡内 `textarea` 聚焦时的键盘避让**：卡片在页面 `scroll-view type="list"` 里，`adjust-position` + `cursor-spacing` 实测可用（§2.4 是独立 spike 页），但**在虚拟列表内 + 底部还有 fixed 工具栏**的组合下没测过。关注：键盘收起后卡片位置是否复位、最后一个选项聚焦时会不会被工具栏盖住。
3. **长按 `textarea` 会不会同时出系统文本菜单和我们的 ActionSheet**：卡片根节点挂 `@longpress`（与同轮 H1 的 `EditorTextBlock` 完全同一个形状），输入框在卡片里，长按输入框有概率两个菜单一起弹。兜底就是右侧「⋯」按钮，它不依赖长按；真机如果确认冲突，删掉根节点的 `@longpress` 即可，不动任何其他代码。
4. **`uni.chooseMedia` 真机选图**（清单 §3.4 明确留真机）+ 上传失败重试。
5. **`v-show` 折叠后重新打开**：在途上传是否还在（`v-show` 语义下应该继续），以及折叠期间的 `uploading` 事件是否仍如实上报。
6. **自绘开关滑块位移 24rpx 的实际观感**（矮屏/放大字体下不过界）。

## 上报的共享层缺口（本目录未动，见报告正文）

- `Limit` 没有「选项最少几个」的键（只有 `OPTION_MAX`），所以 `OPTION_MIN_COUNT = 2` 放在本目录 `types.ts`。若页面也要用它，从这里的 import 取。
- `utils/format.ts` 无「码点计数」出口，卡片字数用本地 `Array.from(name).length`（与云函数 `maxLen` 同口径）。`useForm` 的 `max` 走的是 `textWidth`（中文 1 / ASCII 0.5），与服务端的码点口径不一致：纯 ASCII 名称下 `useForm` 更宽松，靠 `maxlength` 硬闸兜住。
- 无「只读/禁用」的通用容器能力，`disabled` 只能逐层 props 往下传。
