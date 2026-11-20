# EditorTextBlock（T4.2）

单个 text 块的编辑态：一个 `<textarea>` + `blockStyle()` 给的全部段落样式。
`EditorQuoteBlock` / `EditorDividerBlock` 是它的两个同纪律小件（T4.5），本 README 的口径对三者都成立，
差异写在最后一节。

## 接线方式（一般不直接接，走 EditorBlockList）

容器按 `type` 分派时用的就是下面这几行（`src/components/editor/EditorBlockList/index.vue`）：

```vue
<script setup lang="ts">
import EditorTextBlock from '@/components/editor/EditorTextBlock/index.vue'
import { useEditor } from '@/composables'
import type { TextBlock } from '@/types/models'

// 演示用：真实工程里 props 一律走 `defineProps<Props>()`（Props 从 ./types.ts 抄），
// 这里为了自包含写成行内字面量
const props = defineProps<{ block: TextBlock; focusId: string }>()
const editor = useEditor() // 页面持有的那一个状态机（容器不碰它，§11 受控约束）

function onTextBlockInput(id: string, text: string): void {
  editor.setText(id, text) // 截断到 Limit.BLOCK_TEXT_MAX 在这里做，组件不截
}
function onTextBlockFocus(id: string): void {
  editor.setFocus(id) // 同时写 scrollIntoViewId = `blk-${id}`
}
/** A→B 切换时 mp 的 blur/focus 到达顺序不保证，无守卫会把刚设好的 focusId 抹掉 */
function onTextBlockBlur(id: string): void {
  if (editor.focusId.value === id) editor.blur()
}
function onTextBlockLongPress(id: string): void {
  void openBlockSheet(id) // ActionSheet 归页面（openBlockSheet 由页面自己实现）
}
</script>

<template>
  <EditorTextBlock
    :block="props.block"
    :focused="props.focusId === props.block.id"
    @focus="onTextBlockFocus"
    @blur="onTextBlockBlur"
    @input="onTextBlockInput"
    @long-press="onTextBlockLongPress"
  />
</template>
```

页面的正常接法是接 `EditorBlockList`（它的 README 有整段可抄示例），上面这段只用于
「跳过容器直接放一个块」的调试场景。**`@input` 必须接到 `editor.setText`**：
`:value="block.text"` 是唯一真相源，页面不写回去，textarea 显示的内容就会和 `editor.blocks`
分叉（发布时用的是后者）。

## Props（逐字抄自 ./types.ts）

| prop          | 类型        | 默认                           | 说明                                                                                                       |
| ------------- | ----------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `block`       | `TextBlock` | 必填                           | 当前块。level/bold/align/color 经 `utils/blocks.ts` 的 `blockStyle()` 变成内联样式                         |
| `focused`     | `boolean`   | 必填（无默认）                 | 页面 `editor.focusId === block.id` 的结果。**只驱动视觉态**（聚焦底色、计数可见），不驱动原生 `focus` 属性 |
| `maxlength`   | `number?`   | `Limit.BLOCK_TEXT_MAX`（2000） | 与云函数 `planPayload.ts` 的截断值同源（§11.3）                                                            |
| `placeholder` | `string?`   | `'写点什么…'`                  | 空块占位文案                                                                                               |

## Emits（逐字抄自 ./types.ts）

| 事件         | 签名                         | 去处                                                                                                                                                                                  |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focus`      | `(id: string)`               | `editor.setFocus(id)`                                                                                                                                                                 |
| `blur`       | `(id: string)`               | `if (focusId === id) editor.blur()`（守卫必带，且**只能在页面做**：`props.focusId` 比 `editor.focusId` 慢一帧重渲染，容器里判不准。理由详见 `EditorBlockList/README.md` 的 Emits 表） |
| `input`      | `(id: string, text: string)` | `editor.setText(id, text)`                                                                                                                                                            |
| `long-press` | `(id: string)`               | 页面弹 ActionSheet（上移/下移/删除/复制/设为标题）                                                                                                                                    |

Slots：无。`defineExpose`：无。

## 字号为什么一行都不许写在组件里（渲染/编辑同源）

`blockStyle(block)` 是 `level → 字号/行高/字重`、`bold → 700`、`align → textAlign`、`color → color`
的**唯一**映射来源，详情页 `ContentRenderer` 用的就是同一个函数（§10「渲染编辑同源」）。
所以：

- 本组件的 `<style>` 里**没有任何 level 1/2/3 分支**，也没有 `font-size` 与 `blockStyle` 打架；
- 组件里的 `font-size` 只出现在计数条（`$font-xs`），那是控件自身的装饰，不属于正文；
- 默认正文色写的是 `$color-text-1`：`blockStyle` 只在用户**显式设过色**时才输出 `color`，
  没设过时交给类选择器兜底 —— 换肤只改 `tokens.scss`，不动 `blocks.ts`；
- 改字号/加一档 level 的唯一正确位置是 `src/utils/blocks.ts`（本目录无权改，也绝不在组件里覆盖）。

## 为什么样式是段落级，没有「选中加粗」

兼容清单 §2.4 实测：`canIUse('textarea.bindselectionchange')=false`、`selectionchange` 事件流收不到
（`start=-1 end=-1`）、设 `selection-start/end` 后**没有任何选区高亮**。Skyline 下拿不到可靠区间，
所以「选中部分文字加粗」不是没做，是**没有实现路径**（技术方案 §8.1 已据此定稿段落级）。落到代码上：

- 一个 text 块 = 一个 `<textarea>`，不存在 mark 分片；
- 组件不读 `selectionStart/End`、不 import 任何选区 API；
- 工具栏（H2 `EditorToolbar`）改的是**当前聚焦块**的 `bold/color/align/level` 字段，走 `editor.applyStyle()`。

## textarea 属性：只用实测白名单

§2.4 逐条 ✅ 的那几个才挂上去了：

| 属性                      | 值                     | 为什么                                                                         |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `auto-height`             | `true`                 | 长文撑开（实测 2000 字 → 6 行正常），Skyline 下无 line-clamp 也不需要          |
| `adjust-position`         | `true`                 | 键盘避让（§11.2）                                                              |
| `cursor-spacing`          | `16`（px）             | 光标与键盘的呼吸间距，与已验收 `CommentInput` 同口径；属交互量，不是设计 token |
| `hold-keyboard`           | `true`                 | 点底部工具栏不收起键盘（工具栏与块是兄弟组件，默认行为会把键盘打掉）           |
| `disable-default-padding` | `true`                 | 去掉原生内边距，让编辑态的文字位置贴住 `ContentRenderer` 的 `<text>`           |
| `maxlength`               | `Limit.BLOCK_TEXT_MAX` | 与服务端同源                                                                   |

刻意**没有**用：`focus`/`blur` **属性**（绑 `:focus="focused"` 会变成「页面改 focusId 就弹键盘」，
滚动定位改用 `scroll-into-view` 就够了）、`selection-start/end`（无高亮）、`placeholder-class`、
`show-confirm-bar`、`confirm-type`。理由与真机复核项一起写在 `EditorBlockList/README.md` 末节。

## 计数与「超出前」的提示态

- `length = block.text.length`（**原始字符数**）：与 textarea 原生 `maxlength`、云端 `asString` 截断同口径。
  注意页面顶部的总字数若用 `blocksCharCount()`（去空白），两个数字不该相等。
- 可见条件：`focused || length > 0`（空块不聚焦时不摆 0/2000 噪音）。
- 三档修饰类：默认 `$color-text-3` → 距上限 ≤100 字 `--warn`（`$color-text-2`，色板里没有 warning 色，
  只能取「深一档中性」，不新造色值）→ 达上限 `--full`（`$color-danger`）。
- **不弹 toast**：到上限时原生键盘只是不再吞新字符，逐键弹层是骚扰；`showToastMsg` 在本目录一次都没用。
  页面若要提示「这一段落到 2000 字了」，请在 `editor.setText` 侧一次性提示。

## 聚焦态为什么是一个 modifier 类而不是父级选择器

`.editor-text-block--focused .editor-text-block__input` 这种写法在 Skyline 规范里是禁的
（兼容清单 §1.5：后代/子代/伪元素模拟器可用、官方声明不支持，规范按不支持执行），
所以聚焦样式直接绑在节点上：

```vue
:class="{ 'editor-text-block__input--focused': focused }"
```

`scoped` 编译成 `.editor-text-block__input--focused.data-v-xxx`（§1.4 已验），复合类选择器不属于禁用项。

`min-height: $tap-min-height`（88rpx）是给 textarea 的：单行标题块原生高度只有 1~2 个行高，
空块难点中；下限不影响 `auto-height` 向上撑开。代价是空块在编辑态比只读态高一点，
两页不重叠，不会观感跳变。

## EditorQuoteBlock / EditorDividerBlock 与本页的差异

|          | EditorQuoteBlock                                                                                                                                                                                          | EditorDividerBlock                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 数据     | 只有 `text`，`isStylable()` 为 false → 工具栏样式项置灰                                                                                                                                                   | 没有可写字段，`block` 只带 id                                                 |
| 样式来源 | 同样走 `blockStyle()`（quote 分支 = level 3 字号 + 左对齐）                                                                                                                                               | 无文字样式                                                                    |
| 外观     | 与 `ContentRenderer` 的只读引用块逐条对齐：`padding $space-2 $space-3` / `background $color-fill` / `border-left $border-width-thick solid $color-primary` / `radius $radius-sm` / 正文色 `$color-text-2` | 与只读态同一个 `@include hairline-top`，外层套 `$tap-min-height` 容器承担点击 |
| 色条实现 | `border-left` 真实节点，不再摆 `__bar` 节点（多一个节点多一套宽度口径），也**不是伪元素**                                                                                                                 | 线本身 1px，选中时换成 `$border-width-thick solid $color-primary` 加粗高亮    |
| 事件     | `focus / blur / input / long-press`（同本件）                                                                                                                                                             | 只有 `focus`（`@tap` 即选中）与 `long-press`，没有 blur                       |

两个小件都没有 README 也是有意的：契约就在各自 `types.ts` 的注释里，接法与上面一致；
`scroll-into-view`、`blk-` 前缀、不 sanitize 这三条容易踩的坑统一写在
`EditorBlockList/README.md`，不在三份文档里各写一遍再漂移。
