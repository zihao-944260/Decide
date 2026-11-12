# Skyline 兼容清单

> 本文档是《技术方案.md》第 2.2 节「关键约束」与第 14 节「风险与应对」的验证依据。
> 所有结论都注明验证方式：**静态**＝读编译产物 / uni-app 源码，可复现；**运行时**＝需在微信开发者工具模拟器里实测。

## 0. 验证环境

| 项 | 值 |
| --- | --- |
| 工程 | `/Users/duan/Desktop/Decide`（验证期在 `src/spike/` 隔离目录，验证后已删除，见 §5） |
| uni-app | `3.0.0-5030420261029002`，vite 5.2.8，vue 3.4.21 |
| 编译产物 | `dist/build/mp-weixin/` |
| AppID | `wx93aa8833f25d90b0`（正式注册；早期用 `touristappid` 被 CLI 拒绝，见 §0.1） |
| 云环境 | `cloud1-d2g9acyyhb220d834`（见 §3） |
| 开发者工具 | 36.6.0（Electron 版，`Contents/Resources/app.asar`），自动化端口 `cli auto --auto-port 9420` |
| 运行时环境 | 模拟器 iPhone 12/13，基础库 3.17.5，Skyline 1.4.23 |
| 验证脚本 | `scripts/spike-*.mjs`（Skyline）、`scripts/cloud-verify*.mjs`（云能力），均已删除，见 §5 |

### 0.1 环境阻塞记录：CLI 自动化必须有真实 AppID

两条已踩实的结论，后来人不要再试：

1. **开发者工具的「服务端口」与「自动化端口」不是一回事。** 服务端口（`cli open` 输出里的 `http://127.0.0.1:56457`）是 CLI 的 HTTP 服务；`miniprogram-automator.connect()` 要连的是 `cli auto --auto-port 9420` 开出来的 WebSocket。连错端口会表现为「WebSocket 握手成功但所有命令 30s 超时」。
2. **36.6.0 起，CLI 会对 AppID 做服务端校验。** `touristappid` 与空字符串都会被拒，报 `CLI_INVALID_APPID: 不存在此 AppID 请检查后重新输入`，抛点在 `formatProject`。翻 `app.asar` 确认：`formatProject(path, { validateAppId })` 只有 `share_minicode` 一个命令传 `false`，`auto` / `open` 都走校验，**没有绕过手段**。

所以 `src/manifest.json → mp-weixin.appid` 必须填真实 AppID，编译产物的 `project.config.json` 才不会是 `touristappid`。旧版工具（1.06.2308310）能用游客模式跑 CLI，新版不行——这也顺带解释了早期「自动化连上但无实例」的现象。

---

## 1. 已确认 —— 静态验证

### 1.1 Skyline 配置能原样穿透到 app.json ✅

`src/manifest.json → mp-weixin` 下的全部键，会被 uni-app 复制进编译后的 `app.json`。

实现位置：`@dcloudio/uni-cli-shared/dist/json/mp/pages.js` 的 `mergeMiniProgramAppJson`。它只排除两类键——属于 `project.config.json` 的键，以及白名单 `NON_APP_JSON_KEYS`（`unipush / secureNetwork / usingComponents / optimization / scopedSlotsCompiler / uniStatistics / mergeVirtualHostAttributes / styleIsolation / enableVirtualHost / nativeTags`）。

产物 `dist/build/mp-weixin/app.json` 实测含有：

```json
"renderer": "skyline",
"componentFramework": "glass-easel",
"lazyCodeLoading": "requiredComponents",
"rendererOptions": { "skyline": { "defaultDisplayBlock": true, "disableABTest": true, "sdkVersionBegin": "3.0.0", "sdkVersionEnd": "15.255.255" } }
```

**结论：技术方案 §2.1 的 Skyline 配置写法成立，无需 `app.json` 手工改写。**

补充：页面级 `json` 不会带 `renderer`（只在全局 `app.json`），因此 `pages.json` 里不必为每个页面重复声明。

### 1.2 Skyline 专有组件，编译器全部放行 ✅

`@dcloudio/uni-mp-weixin/dist/uni.compiler.js` 第 137 行 `const customElements = [...]` 显式列出了 Skyline 组件族，编译时不会被当成未知标签而丢弃或包裹：

`draggable-sheet`、`grid-builder`、`grid-view`、`list-builder`、`list-view`、`nested-scroll-body`、`nested-scroll-header`、`open-container`、`page-container`、`root-portal`、`share-element`、`snapshot`、`sticky-header`、`sticky-section`、`page-meta`、`navigation-bar`、`keyboard-accessory`、`match-media`、`selection`、`editor-portal`、`subscribe`，以及手势族 `tap / pan / long-press / scale / force-press / vertical-drag / horizontal-drag / double-tap-gesture-handler`。

产物 `dist/build/mp-weixin/spike/scroll.wxml` 实测：

```xml
<list-view id="s-list-view" class="zone__lv data-v-2102cfb0">
<list-item id="s-list-item" type="a" class="li data-v-2102cfb0">
```

13 个被测标签全部原样出现在 WXML 中。

**注意两个坑：**

1. **`span` 被注释掉了**。`uni.compiler.js` 里 `span` 带着一条 TODO（需要区分 Skyline 环境），所以 `<span>` **不在** `customElements` 中。技术方案里凡是用 `<span>` 的地方一律改成 `<text>`。
2. **`list-item` / `grid-item` 也不在内置名单里**，但可以通过 `nativeTags` 逃生口放行（见 1.3）。

另外：这些标签在 `uni-shared` 的 `BUILT_IN_TAG_NAMES` 里**没有**——搜索命中的是 `UVUE_BUILT_IN_TAGS`，那是 uni-app x 的名单，与本工程无关。判断「uni-app 是否支持某标签」必须看 `uni-mp-weixin/uni.compiler.js`，不能看 `uni-shared`。

### 1.3 `nativeTags` 逃生口 ✅

`@dcloudio/uni-cli-shared/dist/json/manifest.js` 的 `getNativeTags(inputDir, platform)` 读取 `manifest.json → mp-weixin.nativeTags`，其返回值被拼进 `customElements`。

因此任何编译器不认识的微信原生标签，都可以这样放行。本工程当前配置：

```json
"nativeTags": ["list-item", "grid-item", "sticky-view", "span"]
```

**决策：正式工程保留 `list-item`（列表项必需）；`grid-item` 保留（§8.7 我的页筛选卡片用 grid-view）；`sticky-view` / `span` 待运行时确认后决定去留（`span` 建议直接删，改用 `<text>`）。**

### 1.4 scoped CSS 编译成 class 选择器，Skyline 安全 ✅

Vue 的 `scoped` 样式被 uni-app 编译为**类名后缀**，不是属性选择器。

产物 `spike/css.wxss`：`.row__label.data-v-6da001a3{`，全文件**零个** `[data-v-` 属性选择器。

Skyline 只支持 class / ID / 标签选择器，不支持属性选择器——这条恰好绕开了。**结论：组件可以放心用 `<style scoped>`。**

### 1.5 非 scoped 的后代 / 子 / 伪元素选择器会被原样输出 ⚠️

产物 `spike/css.wxss` 中原样保留了：

```css
.desc-parent .desc-child{   /* 后代 */
.child-parent>.child-kid{   /* 子代 */
.after-host__t:after{       /* 伪元素 */
```

编译器不拦，但 Skyline 运行时按官方文档不支持。**这三类是否真的失效、失效时是否静默，属于运行时项（见 §2.1）。**

**编码规范先行约束（不等验证结果也要执行）：**
- 禁止后代 / 子代选择器，一律平铺 class；
- 禁止 `::before` / `::after`，装饰性内容用真实节点或图片；
- 这条已写入技术方案 §15「开发规范约定」。

### 1.6 官方渲染引擎检测 API 存在 ✅

`@dcloudio/types/uni-app/uni-patches/wx/index.d.ts`：

| API | 位置 | 签名 |
| --- | --- | --- |
| `wx.getSkylineInfoSync()` | 18167 | `→ { isSupported: boolean; version?: string; reason?: string }` |
| `wx.getSkylineInfo()` | 19295 | 异步版 |
| `wx.getRendererUserAgent()` | 18179 | `→ Promise<string>` |

`reason` 枚举：`'client not supported' | 'baselib not supported' | 'a-b test not enabled' | 'SwitchRender option set to webview'`。

**结论：技术方案里「降级判断」不要用 UA 嗅探或裸文本高度探测，直接用 `wx.getSkylineInfoSync().isSupported` + `reason`。** `src/spike/index.vue` 已按此改写。

### 1.7 Skyline 下 project.config.json 生成条件 ✅

`@dcloudio/uni-cli-shared/dist/json/mp/project.js`：

```js
weixinSkyline(config) === config.renderer === 'skyline' && config.lazyCodeLoading === 'requiredComponents'
```

两个条件必须同时满足，缺一则不走 Skyline 分支。产物已验证两者都在。

### 1.8 不会注入 uvue 的 CSS reset ✅

`@dcloudio/uni-mp-vite/dist/plugin/configResolved.js` 里跳过 CSS reset 的判断键是 `page.style.renderer === 'skyline'`，但该逻辑属 uvue 分支，本工程（Vue3 非 uvue）不经过。实测任何页面 wxss 中**没有** `@import` reset。`src/styles/global.scss` 只保留 `page{}` 一条重置规则，由 `App.vue` 引入一次。

### 1.9 AppID 只影响 CLI 自动化，不影响 Skyline 本身 ⚠️（原结论已作废）

早期在旧版工具（1.06.2308310）下测得「`touristappid` 也能跑 `cli auto`」，据此写过「没有 AppID 不阻塞验证」。**在 36.6.0 上该结论不成立**：`touristappid` 与空 appid 都被服务端校验拒绝（详见 §0.1），必须真实 AppID。

与 Skyline 渲染本身无关——`app.json` 里的 `renderer/componentFramework/rendererOptions` 不依赖 AppID，静态层面（§1.1–§1.8）在任何 AppID 下都成立。

---

## 2. 运行时实测结果

环境：DevTools 36.6.0 模拟器（iPhone 12/13，390×762，pixelRatio 3），`wx.getSkylineInfoSync()` → `{ isSupported: true, version: '1.4.23' }`，基础库 3.17.5。
原始数据与关键截图归档于 `docs/spike-evidence/`（`results.json`、`results2.json` 及 6 张被本文引用的截图）。

> **重要前提：以下全部为模拟器结论。模拟器通过 ≠ 真机通过**，真机复核列入 M0。

### 2.1 环境自检（S0，`spike/index`）

| 项 | 结论 | 证据 |
| --- | --- | --- |
| `wx.getSkylineInfoSync()` | ✅ `isSupported=true, version=1.4.23` | results.json |
| `wx.getRendererUserAgent()` | ⚠️ 经 automator `evaluate` 调用超时，不作为判定依据 | Promise 型 API 在自动化通道不可靠 |
| 裸文字 vs 包 `<text>` | 两者高度相同（37.5）→ 本版本裸文字**会渲染** | 截图 s1-css-top |

裸文字虽渲染，编码规范仍强制包 `<text>`（官方约束，且真机行为可能不同）。

### 2.2 CSS / 布局（S1，`spike/css`）

| 项 | 结论 | 证据 |
| --- | --- | --- |
| `display: inline-block` | ❌ 不并排（top 125 / 154.2，纵向堆叠） | 测量 + 截图 |
| `-webkit-line-clamp: 2` | ❌ **不截断**（截图显示 4 行全文） | 截图 s1-css-top；原「比值 2.03 pass」系基线取错，作废 |
| `word-break: break-all` | ✅ 长串换行 2 行 | 截图；原 fail 系基线取错，作废 |
| `scroll-view` 的 `scroll-top` | ❌ 设置 99999 后页面未滚动 | 截图 s1-css-bottom 前后对比 |
| `scroll-view` 的 `scroll-into-view` | ✅ 两页均生效 | 截图 s2-scroll-jump、s1-css-bottom |
| `fields({ computedStyle })` | ❌ 返回 `{}`，自动化读不到计算样式 | results.json |
| `position: fixed` | ✅ top=740 ≈ windowHeight−22，滚动后仍钉在视口 | 测量 + 截图 |
| `text-overflow: ellipsis` | ✅ 单行省略号 | 截图 |
| `flex: 1` | ✅ 等分 130.6 / 130.6 | 测量 |
| `rpx` | ✅ 实测 104.1 vs 理论 104.0 | 测量 |
| `vw` | ✅ 50vw = 195 | 测量 |
| `transform: translateX` | ✅ left=176.5 | 测量 |
| margin 折叠 | 不折叠（20+20=40） | 测量 |
| 后代选择器 `.a .b` | ✅ 模拟器生效（红字） | 截图 |
| 子代选择器 `.a > .b` | ✅ 模拟器生效（蓝字） | 截图 |
| `::after` | ✅ 模拟器生效（`[AFTER]`） | 截图 |
| `box-shadow` / `linear-gradient` | ✅ | 截图 |
| `border-radius` + `overflow:hidden` 裁剪 | ✅ 子块被圆角裁掉 | 截图 s1-css-bottom |
| `z-index` | ✅ 上层覆盖下层 | 截图 s1-css-bottom |
| `opacity` | ✅ 0.4 半透明 | 截图 s1-css-bottom |

**编码决策**：后代/子代/伪元素在模拟器可用但官方声明不支持 → 规范仍按「不支持」执行（平铺 class、真实节点代替伪元素），避免真机翻车。多行截断改 JS 截字或单行 ellipsis。滚动定位只用 `scroll-into-view`。

### 2.3 滚动容器与 Skyline 专属组件（S2，`spike/scroll`，首屏内逐个隔离挂载）

| 组件 | 结论 | 证据 |
| --- | --- | --- |
| `scroll-view type="list"` | ✅ h=752，120 项流畅 | 测量 |
| `scroll-into-view` | ✅ 跳到第 100 项 | 截图 s2-scroll-jump |
| `page-container` | ✅ h=208 | 测量 |
| `root-portal` | ✅ w=193 h=33.7 | 测量 |
| `share-element` | ✅ w=365 h=45.8 | 测量 |
| `draggable-sheet` | ✅ h=124.8 | 测量 |
| `snapshot` | ✅ h=45.8 | 测量 |
| `open-container` | ✅ h=45.8 | 测量 |
| `scroll-view type="nested"` + header/body | ✅ h=37.5 | 测量 |
| `list-view` | ❌ 渲染为 0×0 | 测量 |
| `grid-view` | ❌ 渲染为 0×0 | 测量 |
| `sticky-section` / `sticky-header` | ❌ 渲染为 0×0 | 测量 |
| `list-item` | ❌ 随 `list-view`，节点未进布局树 | 探针查询挂起 |

**两个坑（写进规范）**：

1. `scroll-view type="list"` 会**虚拟化视口外节点**：首测时组件区放在 120 项列表之后，半数探针的 `boundingClientRect` **挂起不回调**（不是返回 null）。业务代码禁止测量视口外节点；自动化断言必须把目标放在首屏。
2. `list-view / grid-view / sticky-*` 在本环境不可用 → 首页、我的页一律 `scroll-view type="list"` + flex；吸顶用 `position: fixed` 头部。

### 2.4 textarea 选区（S3，`spike/textarea`）—— §8.1 的决策依据

| 项 | 结论 |
| --- | --- |
| `canIUse('textarea.bindselectionchange')` / `bind.selectionchange` | ❌ false / false |
| `selection-start` / `selection-end` 属性 | canIUse true，但设置 2~5 并聚焦后**无任何选区高亮**（截图 s3-textarea-after） |
| `auto-height` / `bindlinechange` / `bindkeyboardheightchange` / `adjust-position` / `cursor-spacing` / `hold-keyboard` / `disable-default-padding` | ✅ 全部 true；`lineCount=1 height=44` |
| 2000 字长文本 | ✅ auto-height 撑开 6 行，多块共存正常（截图） |
| `selectionchange` 事件流 | 拖动/输入均未收到（`start=-1 end=-1`） |

**决策（已回填技术方案 §8.1）**：采用**段落级样式**。`Mark` 区间类型删除，`Block.text` 块携带 `bold?/color?/level/align`，工具栏作用于当前聚焦块整段。不提供「选中部分文字加粗」。

### 2.5 worklet 动画（S4，`spike/worklet` + 原生组件）

| 项 | 结论 |
| --- | --- |
| `wx.worklet` | ✅ 存在；API：`runOnJS, runOnUI, cancelAnimation, shared, derived, delay, repeat, sequence, timing, spring, decay, Easing, snapshotContext, scrollViewContext, getBoundingClientRect` |
| `worklet.measure` / `DerivedValue` / `useAnimatedStyle` | ❌ undefined（后两者本就不在 `wx.worklet` 上） |
| Vue 模板 style 承载 SharedValue | ❌ 拼接结果 `transform: translateX([object Object]px)` |
| CSS `transition: transform 600ms` | ✅ 方块平滑位移（截图 s4-css-transition） |
| 原生组件 `runOnUI + timing`（未绑定节点） | ❌ BOX 不动 |
| 原生组件 `applyAnimatedStyle`（官方正解） | ⚠️ **未验证**：自动化 tap 未送达原生组件按钮（msg 停留「未开始」），真机阶段补验 |
| `pan-gesture-handler` | ✅ 可渲染 h=45.8 |

**决策（已回填技术方案 §2.2-5 / §8.8）**：交互动画默认 CSS transition；确需跟手 worklet 的场景封装 `wxcomponents` 原生组件 + `applyAnimatedStyle`，并在真机阶段补验。首页 FAB 收起改用 `scroll` 事件节流，不跟手。

### 2.6 rich-text 与 editor（S5，`spike/richtext`）

| 项 | 结论 | 证据 |
| --- | --- | --- |
| `rich-text` HTML 字符串 | ✅ 渲染 h=138.5，颜色/加粗/斜体/base64 图均生效 | 截图 s5-richtext-top |
| `rich-text` nodes 数组 | ✅ h=97.5 | 截图 |
| `rich-text` 本地路径图片 | ✅ h=92.5 | 截图 |
| `rich-text` 内联流 | ❌ **被打断**：HTML 中每个行内节点独占一行（「蓝色 span」「斜体」各占一行） | 截图 |
| 自研块渲染器（原生 `<text>` 分片 + 内联样式） | ✅ 内联流正常、混排样式保真 | 截图第 4 区 |
| `<editor>` 渲染 | 盒子 h=124.8，`canIUse('editor')=true` | 测量 |
| `<editor>` 可用性 | ❌ `bindready` 4s 内不触发，`EditorContext` 取不到 → 无法读写内容 | results2.json |

**决策（已回填技术方案 §8.1）**：编辑器与详情页正文共用自研块渲染器，**不走 `rich-text`**（内联流断裂）；`<editor>` 彻底排除。

### 2.7 结论汇总

1. Skyline 在本工程**确认可用**（`isSupported=true`），配置穿透、组件放行、scoped CSS 均无问题（§1）。
2. 五大功能需求**不依赖任何不可用组件**：列表用 `scroll-view type=list`，弹层用 `page-container`/`root-portal`，吸顶用 fixed，动画用 CSS transition，富文本用自研块编辑器。
3. 唯一的产品能力让步：**富文本不支持区间样式**（段落级），已在 §8.1 定稿。
4. 残留风险：真机差异、worklet `applyAnimatedStyle` 未验；云能力已实测通过（§3），仅 `mediaCheckAsync` 回调链路未闭环。


## 3. 云开发能力（T0.2 / T0.7 / T0.8）—— 已实测

环境：AppID `wx93aa8833f25d90b0`，云环境 `cloud1-d2g9acyyhb220d834`（微信体验版）。

> 开通路径踩坑：开发者工具 36 的「云开发」按钮是**扩展窗口**，本机加载失败（日志有 SSL 错误），点不出面板。改走网页控制台 <https://cloud.weixin.qq.com/cloudbase> 新建环境即可，之后 `cli cloud env list --project dist/build/mp-weixin` 就能读到 env ID。

### 3.1 T0.2 云函数「TS 编译 → 部署 → 调用」链路 ✅

| 项 | 实测结论 |
| --- | --- |
| 部署命令 | `cli cloud functions deploy --env <env> --paths <绝对路径> --remote-npm-install --project dist/build/mp-weixin`。用 `--paths` 就**不需要 `cloudfunctionRoot`**（uni-app 产物的 `project.config.json` 里没有这个键；它是 manifest 穿透键，但会相对产物目录解析，指向 `dist/build/mp-weixin/cloudfunctions`，不符合源码目录习惯） |
| 首次部署 | 函数不存在时先建后传，会报 `FailedOperation.UpdateFunctionCode：当前函数处于 Creating 状态` —— **原样重试一次即成功**，不是配置问题 |
| 运行时 | `Nodejs16.13`，函数内 `process.version` = `v16.13.1` |
| 超时 | 默认 **3s**；`config.json` 里写 `timeout: 20` **CLI 部署不生效**（`functions info` 仍是 3），只能控制台改。长任务函数上线前必须手动确认 |
| 包体 | `--remote-npm-install` 时只上传 6 个文件 / 15.8 KB，依赖在云端装，本地 `node_modules` 不上传 |
| 客户端调用 | `wx.cloud.callFunction({name:'hello'})` 通；`cloud.getWXContext()` 拿到 OPENID `oprgZxj9nTWd4_GZyYL1GcrSka0s`、APPID、`UNIONID` 为空、`process.env.TCB_ENV` = 环境 ID |
| TS 工程 | `cloudfunctions/hello/{src/index.ts, tsconfig.json}`，`rootDir: src` + `outDir: .` + `"files": ["src/index.ts"]`。**不能用 `include`**：`outDir` 为 `.` 时它会被加进默认 exclude，直接报 `TS18003 No inputs were found`；`files` 绕过 exclude |
| SDK 版本 | 用 `wx-server-sdk@4.0.2`（npm latest），不是各教程里的 `~2.6.3`（2.6.3 的 database 类型更残缺） |
| SDK 类型缺陷 | ① `openapi` 只是 `Record<string, any>`，没有接口级类型；② `DYNAMIC_CURRENT_ENV` 是 symbol，而 `init({env})` 形参只收 string，必须转一次；③ database 的 `add/get/count/remove` 返回 `string \| void \| IXxxResult` 联合（回调与 Promise 重载混写），await 后无法收窄 —— 只能在调用边界各断言一次；④ 没有 `dropCollection` |
| 数据库能力 | `createCollection` / `add` / `where+orderBy+limit+get` / `count` / `doc.remove` / `serverDate` / `startTransaction`+`update`+`commit` 全部 ✅（计数扣减与投票去重可以放心用事务） |
| 集合命名 | **不能以下划线开头**（`_t0_probe` 报 `InvalidParameter`），≤96 字符，仅字母/数字/下划线/连字符。技术方案 §5 的 `users/plans/votes/comments/counters/participations` 均合规 |

### 3.2 T0.7 云存储闭环 ✅（`chooseMedia` 的 UI 路径留真机）

| 步骤 | 实测 |
| --- | --- |
| 写本地文件 | `FileSystemManager.writeFileSync(path, base64, 'base64')` ✅；模拟器里 `wx.env.USER_DATA_PATH` = `http://usr` |
| `wx.cloud.uploadFile` | `statusCode: 204`，fileID 形如 `cloud://<env>.636c-<env>-1530577071/t0/probe-<ts>.png` |
| `getTempFileURL` | `status: 0 / errMsg: ok`，返回带签名的 `https://636c-<env>-1530577071.tcb.qcloud.la/...?sign=&t=`（可直接给 `<image src>`） |
| 客户端 `wx.cloud.downloadFile` | 返回 `{tempFilePath, statusCode, dataLength, header, cookies, errMsg}`，**没有 `fileContent`**；`tempFilePath` 形如 `http://tmp/xxx.png`。`fileContent` 只存在于云函数侧 SDK |
| 云函数侧 `cloud.downloadFile` | `fileContent` 是 Buffer，101498 字节原样取回 ✅ |
| `deleteFile` | `status: 0 / ok` ✅ |

### 3.3 T0.8 内容安全接口 ✅

| 接口 | 实测 |
| --- | --- |
| `security.msgSecCheck` v2（`{version:2, scene:2, openid, content}`） | 成功。返回 `detail: [{strategy:'keyword',errcode:0}, {strategy:'content_model',suggest:'pass',label:100,prob:90}]`、`result.suggest='pass'`、`traceId` |
| `security.imgSecCheck`（v1 同步，传 Buffer） | **仍可用**，`errCode: 0`。但官方主推 v2 异步，v1 有下线风险 → 图片审核以 `mediaCheckAsync` 为主，v1 只作降级 |
| `security.mediaCheckAsync` v2（`media_url` + `media_type:2`） | 提交成功，返回 `traceId`。**审核结果走消息推送异步回调**，需在控制台配置推送目标；本次未配置，故「回调 → 改 plan 状态」这一段未验，留到 T4 |
| 违规样本 | **未测**。只用正常文本确认接口可用性，避免在正式 AppID 上留下风控记录 |
| `config.json → permissions.openapi` | 已声明三个接口；实测不声明也调得通（云函数侧 openapi 默认可用），保留声明只为控制台可见 |

### 3.4 仍未闭环

- `mediaCheckAsync` 的异步回调链路（要控制台配消息推送 + 一个接收函数）。
- 云函数超时 / 内存 / 环境变量：CLI 改不动，上线前在控制台逐个函数确认。
- `chooseMedia` 真机选图 → 压缩 → 上传（模拟器无相机相册，只能真机）。
- 数据库索引：SDK 无建索引接口，必须控制台手建（T2.1）。

---

## 4. 结论落地清单

- [x] 《技术方案.md》§2.2 —— 8 条约束全部改写为实测结论
- [x] 《技术方案.md》§8.1 —— 定稿**段落级样式**，`Mark` 类型已删除；渲染路线改为自研块渲染器（`rich-text` 内联流断裂）
- [x] 《技术方案.md》§8.8 —— FAB 收起改 `scroll` 事件节流（不用 worklet 跟手）；补充「禁止测量视口外节点」
- [x] 《技术方案.md》§11.1 —— 多行截断改 JS 截字 / 单行 ellipsis（line-clamp 不生效）
- [x] 《技术方案.md》§14 —— 风险表按实测收敛，云能力三项标记挂起
- [x] `src/manifest.json` —— `nativeTags` 已收敛为 `["list-item", "grid-item"]`
- [x] 《技术方案.md》§6.6 / §5 / §12 —— 按 §3 云实测回填（部署命令、SDK 版本与类型缺陷、集合命名、客户端 downloadFile 形状、内容安全接口选型）
- [ ] **真机复核**（M0）：后代/子代/伪元素选择器、line-clamp、worklet `applyAnimatedStyle`、`share-element` 转场、`chooseMedia` 选图上传
- [ ] 云端待办：`mediaCheckAsync` 消息推送回调（T4）、控制台改云函数超时（默认仅 3s）、控制台建集合索引（T2.1）

---

## 5. 验证后清理（已执行）

**Skyline 验证**：验证代码已全部删除，不留残余：`src/spike/`、`src/wxcomponents/spike-worklet/`、`src/static/spike-probe.png`、`scripts/spike-*.mjs`、`.spike-results/`。

配置同步收敛：`src/pages.json` 删除 6 条 spike 路由；`package.json` 移除 `miniprogram-automator`；`src/manifest.json` 的 `nativeTags` 收敛为 `["list-item", "grid-item"]`；`.gitignore` 移除 `.spike-results/`。

**云能力验证**：`cloudfunctions/hello/`（含 `src/index.ts`、`tsconfig.json`、`config.json`、`node_modules`）与 `scripts/cloud-verify*.mjs` 已删除；`miniprogram-automator` 再次卸载。保留下来的是正式代码：`src/config/cloud.ts`（env 常量）与 `App.vue` 的 `wx.cloud.init`。

**证据归档**（不参与小程序打包）：`docs/spike-evidence/` —— Skyline 的 `results.json` / `results2.json` + 6 张截图，云能力的 `cloud-t0-main.json` / `cloud-t0-followup.json`。

**需要在控制台手工删除的云端残留**（CLI 没有 delete 命令，SDK 也没有 `dropCollection`）：

1. 云函数 `hello`（环境 `cloud1-d2g9acyyhb220d834` → 云函数 → 删除）。
2. 数据库集合 `t0_probe`（已清空，只剩空集合）。
3. 云存储 `t0/` 前缀下的对象已由 `deleteFile` 删除，无需处理。

清理后 `npm run build:mp-weixin` 与 `npm run type-check` 均通过，无死引用。
