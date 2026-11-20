# ContentRenderer（T3.6）

`PlanDetail.blocks` 的只读渲染器：详情页正文唯一的展示入口。与编辑器共用 `src/utils/blocks.ts`，
**编辑与渲染不可能长成两副样子**（§8.1 / §10「渲染编辑同源」）。

2026-11-12 起渲染层换 **mp-html**（用户裁定：富文本渲染不许手写）：本组件不再自己拼
`<text>`/view 分支，而是 `sanitizeBlocks()` → `blocksToHtml()` → `<mp-html>`。序列化与段落样式
仍然全部来自 `blocks.ts` 这一份源（`blockStyle()`），组件里没有第二套样式映射。

## Props

| prop        | 类型              | 默认         | 说明                                                                                     |
| ----------- | ----------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `blocks`    | `Block[]`         | 必填         | 云端返回的正文块；组件内再过 `sanitizeBlocks()`，脏块/未知 type 直接丢弃，页面可原样透传 |
| `radius`    | `BaseImageRadius` | `'md'`       | 图片块圆角，经 tag-style 的 `img.border-radius` 落进 mp-html                             |
| `lazy`      | `boolean`         | `true`       | 图片懒加载，透传 mp-html 的 `lazy-load`（详情页在 `scroll-view` 内，建议保持 true）      |
| `preview`   | `boolean`         | `true`       | 点击图片放大预览（mp-html 的自动预览关闭，由本组件接管编排）                             |
| `emptyText` | `string`          | `'暂无内容'` | `blocks` 为空数组时的兜底文案                                                            |

## Emits / Slots

无。块内除图片点击外不可交互；编辑态是 `subpkg-editor` 里 `Editor*` 组件的职责，不要往这里加事件。

## 块 → HTML 的映射（`blocksToHtml`，见 utils/blocks.ts）

| 块        | HTML                                                                                        | 为什么                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `text`    | level 1/2/3 → `<h2>/<h3>/<p>`，段落内换行拆成「每行一个标签」，非末行内联 `margin-bottom:0` | Skyline 行内流断裂（兼容清单 §2.6，mp-html 叶子走 rich-text 同样继承），`<br>` 会变成独立叶子行，拆行是唯一稳的写法       |
| `image`   | `<img src="fileID" width="W" height="H">`，图注是居中 `<p>`                                 | `cloud://` 是 mp-html 显式特判支持的协议；宽高经属性传入，解析期即可算出占位比例（§11.1 防顶跳），无 w/h 时 widthFix 自撑 |
| `quote`   | `<blockquote>` 内嵌 `margin:0` 的 `<p>` 行                                                  | 外框（浅底/左边框/圆角）属于容器样式，由 tag-style 提供；内部行距靠 `margin:0` 收紧                                       |
| `divider` | `<hr />`                                                                                    | tag-style 里重画边线（`border-top`，Skyline 无伪元素）                                                                    |

## tokens 桥接

mp-html 内部只能用内联样式与 tag-style，SCSS 变量够不着。组件根节点把用到的 tokens
挂成 CSS 变量（`--cr-fill/--cr-primary/--cr-border/--cr-text-3`，SCSS 插值、编译期完成），
tag-style 与序列化出来的内联样式用 `var()` 消费 —— **tokens.scss 仍是唯一色值源**。
Skyline 下 `var()` 穿自定义组件边界已实测（2026-11-12 spike，兼容清单 §2.6）。

## 图片预览

走 `uni.previewImage`（编译到微信即 `wx.previewImage`），把全文图片 `fileID` 一次性作为 `urls` 传入、
`current` 定位到点击那张，所以能左右滑。失败时 `useToast` 提示，不裸调 `wx.showToast`，也不出现 `wx.cloud`。
mp-html 的 `preview-img`/`show-img-menu` 固定关掉，预览编排只在这一个出口。

> 风险（已上报）：`BaseImage` 的约定是「fileID 预览请先换临时 URL」，但换 URL 需要云存储 SDK，
> 而全工程只允许 `api/request.ts` 与 `useUpload.ts` 碰 `wx.cloud`。这里直接把 `cloud://` fileID 喂给
> `previewImage`；若真机验说不支持，需要 api 层补一个 `getTempFileURL` 封装，由页面把可预览 URL 传进来。

## 用法

```vue
<ContentRenderer :blocks="detail.blocks" />
```

## 不做的事

- 不做多行截断（`-webkit-line-clamp` 在 Skyline 不生效，正文本就全量展示）；
- 不做虚拟滚动、不做布局测量（§11：详情正文长度有限，长内容靠页面外层 `scroll-view`）；
- 不重算 `blocksToText`（摘要截字是列表侧 `PlanCard` 的事）；
- 不做行内富文本（加粗/颜色只到段落级，§8.1 契约决定，也是 Skyline 行内流的平台上限）。
