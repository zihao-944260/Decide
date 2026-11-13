# 编辑页（单一原生富文本编辑面 · WebView 渲染）

`src/pages/plan/edit/**`，路由 `pages/plan/edit/index`（`src/pages.json`，`navigationStyle: custom`，
**`renderer: "webview"`**）。发布新计划与二次编辑**同一页**，靠 `?planId=` 区分：首页 FAB 走无参那条，
我的页「编辑」走带参那条。

> 本文件在「多 textarea 拼块」旧版被整体替换后重写。旧版的 `EditorBlockList` / `EditorToolbar` /
> 块长按菜单 / `scroll-into-view` 定位**已全部不在本页**；那些组件文件仍留在 `src/components/editor/`
> 但本页不再引用。下一轮复核以本文件 + 源码为准。

---

## 1. 为什么是单一 `<editor>` + WebView

用户要求「真正的富文本编辑框，单一编辑面，用成熟方案，不要多个输入框拼」。落地选型：

- 正文是微信原生 `<editor id="rich-editor">`（Quill 内核，真 WYSIWYG），**不是**多个 textarea。
- 原生 `<editor>` 只在 **WebView 渲染页**可用，Skyline 下不支持；故本页与详情页都配 `renderer: "webview"`，
  全局仍是 Skyline（首页/我的走纯文本摘要，不受影响）。
- 详情页同改 WebView 的原因：Skyline 行内流断裂（`<strong>/<span>` 会被拆成独立叶子行，spike 2026-11-12），
  行内富文本必须在 WebView 才能正确排布。详见 `docs/Skyline兼容清单.md`。

## 2. 线上契约不变：blocks + 行内标记存在 text 里（无需重新部署）

已部署云函数对 `block.text` **原样存储、不消毒**（`cloudfunctions/common/src/planPayload.ts` 的
`validateBlock` 用 `asString`）。因此把行内富文本标记（`<strong>/<em>/<u>/<span style=color>/<br>`）
直接保存在 `text` 字段即可无损往返，**契约仍是段落级 blocks，不需要重新部署云函数**。

双向桥在 `src/utils/richhtml.ts`：

- `blocksToEditorHtml(blocks)`：text→`h1/h2/p`（`text-align` 挂标签上，`bold`→`<strong>`，`color`→`<span>`），
  quote→`<blockquote>`，divider→`<hr>`，image→`<img src=fileID width height>`。
- `editorHtmlToBlocks(html)`：扫 `h1-h6/p/blockquote/pre/ul/ol/hr/img`，映射 level/align/整段 bold/color，
  列表/多段折叠成 `<br>` 行内流；对齐同时认内联 `text-align:center` 与 Quill 的 `ql-align-center` 类名。

渲染侧消毒在 `src/utils/blocks.ts` 的 `cleanInline`：只放行行内标签白名单，`span` 仅保留合法 color
（hex 或 `rgb()/rgba()`，Quill 输出的是 rgb），`script/style/iframe` 整段删除，文本段转义尖括号。
详情正文唯一出口 `blocksToHtml` 复用它，编辑=发布同源。

> 行内样式挂载规则（editor 组件文档）：块级样式（text-align）挂 p/h，行内样式（color/font-weight）
> 必须挂 span/strong，挂 p 上无效。桥与渲染都遵守这条。

## 3. 页面编排（脚本 / 模板 / 样式都在 index.vue）

```
plan-edit（@include page-root：flex 纵向，页面本身不滚动）
├─ BaseNavbar  居中标题（发布/更新 已置底，导航栏不再放按钮；真居中见 BaseNavbar README）
├─ scroll-view  plan-edit__scroll  flex:1 + min-height:0  :scroll-into-view="scrollTarget"（仅选项校验定位用）
│  ├─ [loading] BaseSkeleton / [error] BaseEmpty 重试 / [blocked] BaseEmpty 权限/截止拦停
│  ├─ 标题卡：标题 textarea + 创建人 + 「详情」标签 + 两行图标工具栏 + 单一 <editor>
│  ├─ ImageUploader（计划配图，v-model="model.images"）
│  ├─ DeadlinePicker（截止快捷三项 + 自定义弹层）
│  ├─ OptionsSection（选项开关 + 选项卡）
│  └─ plan-edit__tail 留白
├─ plan-edit__status  草稿角标 + 字数
├─ plan-edit__footer  发布/更新 置底（BaseButton primary/lg/block；canSubmit disabled；safe-area-bottom + hairline-top）
└─ BaseActionSheet    菜单宿主（退出确认用；缺了它 open() 的 Promise 永不 resolve）
```

逻辑分层沿用旧版裁决：标题/草稿/extra 在 `useEditor`，四件表单（images/deadline/optionsEnabled/options）
在 `useForm`，菜单/弹窗在 `useActionSheet`/`useModal`，配图上传在组件内的 `useUpload`。
页面里**没有** action 字面量、没有 `setInterval`、没有节点测量。提交唯一出口 `writeAction`，
提示只有一条（`api/request.ts` 统一弹）。

## 4. 原生 editor 上下文与工具栏

- `@ready` → `onEditorReady`：`uni.createSelectorQuery().select('#rich-editor').context(res => …)` 拿到
  `EditorContext`（最小结构化类型 `EditorCtx`，不依赖 DOM lib），随后 `pushInitialContent` 把 blocks 灌进编辑面。
- `@input` → `onEditorInput`：`editor.replaceBlocks(editorHtmlToBlocks(withCloudSrc(html)))`，草稿/字数/提交沿用 blocks。
  注意 `setContents` **不触发** `@input`（程序化写入），所以加载回填不会把已 load 的 blocks 二次转换；
  用户键入 / `insertText` 才触发，字数随之更新（实测 insertText 后字数 7）。
- `@statuschange` → `onStatusChange`：选区样式写进 `formats`，工具栏 `isOn()` 据此实时点亮。
- 工具栏**位置按用户参考图**：在「详情」标签之下、`<editor>` 之上，一块圆角浅灰卡（`$color-fill-light` + `$radius-md`），
  随内容滚动、首屏可见（旧版吸底导致首屏看不到工具栏，被用户否决）。两行图标：
  - 行1：`B` / `I` / `U`（字形文本）+ 左/中/右/justify 四个对齐（PNG 线性图标）。
  - 行2：撤销 / 重做 / 缩进减 / 缩进加 / `H1` / 图片 / 删除（PNG 线性图标，`src/static/editor/*.png`，
    PIL 4× 超采样 + LANCZOS，角落 alpha=0 真透明；对齐另有 `-on` 蓝色激活态）。
- 工具栏按钮用 `@touchend.stop`（编译为 `catchtouchend`）——微信官方 editor 工具栏保住选区的写法。
  **WebView 渲染页里 automator 的 `page.$()` 元素句柄拿不到整页 DOM**（返回 null / `$$` 挂起），
  故运行时验收改走 `mp.evaluate()` 内 `wx.createSelectorQuery().select('#rich-editor').context()` 直驱同一 EditorContext API。
- `onFormatTap` 统一入口：`data-action` 走 `undo()/redo()/format('indent',±1)/insertImage()/清空(confirm 后 clear())`；
  `data-name/value` 走 `format`。**bold/italic/underline 显式翻转 `!isOn(name)`**；header 传 `Number(value)` 或 `false`；
  align 传 left/center/right/justify。`isOn('align',…)` 对默认左对齐**不点亮**（参考图初始全黑）。
- 提交前 `syncEditor()` 调 `getContents` 把编辑面最新内容收进 blocks（异步），再走校验与 `writeAction`。
  `writeAction` 的 payload 滤掉末尾空文本段（`ensureTrailingTextBlock` 给光标垫的占位：草稿保留、提交滤除）；
  空段落 / 纯 `<br>` 段在桥接层就不产块（`hasVisibleText`），p 包 `<img>` 拆成独立 image 块（#38，云端拒收空正文块）。

## 5. 正文插图：临时链 ↔ fileID

编辑面（Quill/webview）不认 `cloud://` 协议（只有 `<image>`/mp-html 特判它），故显示要换临时 https 链：

- `imgMap: Map<tempURL, fileID>`。加载时 `pushInitialContent` 把 cloud 图换临时链并登记；
  `withCloudSrc` 在 input/提交前把临时链换回 fileID（blocks/草稿/提交只认 fileID）；
  Quill 序列化把 src 里的 `&` 转义成 `&amp;`（临时链带 sign query），查 imgMap 前先解转义（#38）。
- 云存储调用**只在 `useUpload`**（全工程唯一碰 wx.cloud 存储 SDK 的地方）。本页用其两个出口：
  `resolveTempUrls(fileIDs)`（批量换临时链）与 `uploadInlineImage(localPath)`（一次性上传正文图并回临时链）。
  页面不直连 `wx.cloud` / `uni.cloud`。

## 6. 草稿 / 退出确认 / 权限（沿用旧版语义）

- 草稿键 `plan_draft_<openId>`，debounce 与页面 extra 补刀共用 `DRAFT_DEBOUNCE_MS`（`useEditor` 导出，勿抄第二份）。
  登录态翻转草稿键时 `replayForNewDraftKey` 重放；草稿恢复弹窗在自动化前需 `clearStorage`（原生 showModal 吞 tap）。
  **恢复弹窗 confirmText/cancelText 均 ≤4 汉字**（微信 showModal 硬上限）：#40 前 cancelText「从空白开始」5 字必 fail，
  而 `useModal` fail 当「取消」→ `discardDraft()` 静默丢草稿；已改「空白开始」并运行时复验
  （`/tmp/rt/rt-draftmodal.png` 弹窗可见、0 fail、草稿未被丢）。改这两个文案时守上限，别 reintroduce。
- 退出三态：`onBackPress`/`onNavBack` → `guardedExit` → `sheet.openNative(EXIT_ITEMS)`：保存草稿并离开 / 放弃改动。
- 权限：`phase` 派生 loading/error/blocked/ready；非作者或已截止/软删 → blocked，重试无用。
  写被服务端 3001/3002 拦下时 `writeBlocked` 置灰整页。

## 7. 运行时验收（2026-11-12，DevTools 模拟器 SDK 3.17.6，automator）

- 单一编辑面：`#rich-editor` 尺寸 342×249；页面 textarea 仅 1 个（标题）；旧 `editor-block-list` 已不存在。
- WYSIWYG：`setContents` 富文本后截图见 H1 大标题、行内加粗、红字、居中行、分割线同面渲染（`/tmp/rt/rt-2-rich.png`）。
- 工具栏真实路径（`trigger('touchend')`）：H1→`<h1>`、居中→`text-align:center`；statuschange 正确点亮 bold/align/header。
- **工具栏按参考图重做后复验（2026-11-13）**：首屏可见内容上方圆角灰卡两行图标（`/tmp/rt/rt-toolbar-new.png`）；
  直驱 EditorContext 证明右对齐→`text-align:right`、justify→`text-align:justify`、缩进→`ql-indent-1`、
  undo 移除插入字、redo 恢复（`/tmp/rt/rt-toolbar-fn.js`），0 报错。
- **滚动 + 间距 + 浅色复验（2026-11-13）**：`min-height:0` 修复 WebView 下 scroll-view 被内容撑出视口、
  内部不滚的回归（几何 height 732.5 < scrollHeight 1185 ⇒ 可滚）；工具栏底色改 `$color-fill-light`；
  全页卡片间距统一 `$card-gap: 40rpx`（编辑/详情/首页/我的四页截图 `/tmp/rt/rt-gap-*.png`，0 报错）。
- **溢出 + 选项折叠复验（2026-11-13，#34）**：WebView 页 content-box 根因由 `global.scss` 全局 border-box
  重置修掉（工具栏几何 24→366 落在外卡 12→378 内、左右对称）；OptionsSection 折叠改 `--off` 类（v-show 的
  hidden 在 WebView 被类 display:flex 覆盖，兼容清单 §2.6.1），ON 按钮 contained、OFF 仅标题行 H61；
  提示文案「点上方按钮」。截图 `/tmp/rt/rt-fix-options-on.png` / `rt-fix-options-off.png`，0 报错。
- **模块标题统一 + 发布置底 + 导航居中复验（2026-11-13，#35）**：四模块头（标题/配图/截止时间/添加选项）
  统一 `section-head`/`section-title` 规格——computed 全同 15px/600/rgb(26,29,36)、行高 19.5；标题行不设
  min-height、`padding: 0 0 24rpx` 撑开（#36 追加裁定：pb 实测 12px，行高内容驱动 31.5/31.5/34.5/47.8），
  卡内衬 12px；DeadlinePicker 走 BaseCell `section` 变体。发布/更新 移入 `plan-edit__footer` 置底全宽按钮
  （旧导航栏按钮 count 0），空内容触发其编译点击回调 → toast「先给计划起个标题」（`/tmp/rt/rt-final-toast.png`；
  WebView 合成 tap 不派发 @tap，事件槽直调口径见兼容清单 §0.2）。导航标题首页/编辑 centerX=195=390/2。
  截图 `/tmp/rt/rt-unify-home.png` / `rt-unify-edit-top.png` / `rt-unify-edit-bottom.png`，0 报错。
- bold 语义探针：`format('bold', true/false)` 与省略 value 均正确；本页改为显式翻转更稳。
- 桥接层 21 项单测全过（往返、Quill rgb 颜色、ql-align 类名、XSS 消毒）：`/tmp/rt/bridge-test.mjs`。
- **空段发布修复复验（2026-11-13，#38）**：修复前直调提交槽复现用户原话「第 5 个内容块正文不能为空」；
  修复后包 `wx.cloud.callFunction` 抓真实提交 payload = 4 非空文本 + 1 cloud 图、无空文本块（`/tmp/rt/rt-emptyblock.js`，
  toast 截图 `rt-emptyblock-post-toast.png`）。桥接回归扩到 26 断言全过；当前云源码 `validatePlanWrite` 5 断言全过
  （`/tmp/rt/cloud-validate-test.mjs`：旧桥接形态→用户原话、修复后 payload→通过、配图空列表→通过）。
  live create 仍被已部署旧快照挡（见 §8），未部署。
- 详情页 WebView 渲染正常、零报错（`/tmp/rt/rt-7-detail-existing.png`）；行内渲染由 `blocksToHtml` 单测 + WebView 配置保证。
- 全程控制台 0 error / 0 exception。

## 8. 已知限制 / 环境漂移（非本次编辑引入）

- **blockquote**：原生 editor 不支持引用块，`setContents` 的 `<blockquote>` 会被拍平成 `<p>`；工具栏不含引用按钮。
  旧 quote 块进编辑面会显示为普通段落（文本不丢），详情侧仍按 quote 渲染未编辑的旧数据。
- **右对齐 / justify / 缩进仅编辑会话内生效**：冻结契约 `TextBlock.align` 只有 `left|center`，桥 `editorHtmlToBlocks`
  保存时把其余对齐收敛为 left、丢弃 `ql-indent-*`。工具栏按参考图保留这些按钮且 live 可用，但**持久化它们需要扩契约 +
  重新部署云函数**（用户闸门），未擅自改。左/中/加粗/颜色/标题/图片无损往返不受影响。
- **云端配图必填（已修复并部署）**：契约 §5.2 / §8.6 配图可选；旧源码 `asArray→required()` 拒空数组，
  表现为「计划配图不能为空」。已在 `cloudfunctions/common/src/planPayload.ts:123-124` 修为空列表放行
  （非空仍全量校验），并随 #39 用户授权（「部署啊」）重部署生效——无配图探针从 1001 变 5000 即为生效证据。
- **live 写路径 5000（已修复并复验闭环）**：真根因是控制台错建唯一索引（plans.openId 唯一、comments.planId 唯一 →
  `E11000 duplicate key`，同一用户第 2 条计划 / 同一计划第 2 条评论起必撞），代码无问题。#39 经用户授权重部署 +
  临时诊断（router.toFailure 透出裸异常，定位后已撤并重部署干净版）定位；用户控制台删改错索引后复验：
  创建三探针（无配图/文本+配图/正文图块）全 code 0、comment.create/remove 全 0、完整 UI 发布→详情截图
  （`/tmp/rt/rt-emptyblock-post-detail.png`）→清理闭环。详见协作记录 §4.28。
  排查教训：dist-cloud 中文串是 `\uXXXX` 转义，按中文原文 grep 会假阴性；「读正常+写 5000+detail 空」优先查 DB 约束。