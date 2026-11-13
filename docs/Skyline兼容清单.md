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

### 0.2 运行时实测的可用手段与边界（2026-11-12）

拉起方式（本轮实测有效）：

```bash
npm run dev:mp-weixin &                       # 监听式产物，未压缩，必须开这个而不是 build
"/Applications/wechatwebdevtools.app/Contents/MacOS/cli" auto \
  --project <repo>/dist/dev/mp-weixin --auto-port 9222 --trust-project
node -e "require('miniprogram-automator').connect({wsEndpoint:'ws://localhost:9222'})"
```

**能做的**：`reLaunch/switchTab/navigateTo` 路由、`on('console')` / `on('exception')` 逐条取回真实报错、`screenshot()` 出图、`evaluate()` 在 app-service 里跑任意代码。这四件事合起来就足够把「类型通过 + 构建产物生成」这种假验收换成运行时真相。

**不能做的，别再试**：

| 手段 | 结果 |
| --- | --- |
| `page.$('.some-class')` 类选择器 | 恒为 0；Skyline 下 `attributes('class')` 也取不到值 |
| `page.$('tag')` / `page.$$('父tag 子tag')` 标签与后代选择器 | ✅ 页面层级可用；但**自定义组件内部的后代查询恒为 0**（`user-header view`、`plan-list view` 都实测为 0，只有组件宿主节点本身能拿到 `offset()`）——组件内部的布局验证只能靠截图或外围推断 |
| `Element.tap()` | ✅ 可用（实测点中 `1 天` 档位后截止时间真的变了、草稿条文案变成「草稿已自动保存」），但只能点到**已布局**的节点：未挂载的分支 `offset()` 返回 `null`；且 tap 打在组件宿主节点上**不会**触发内部子节点的 `@tap`（事件不向下派发） |
| `page.selectComponent('deadline-picker')` | 返回 null，uni-app 的自定义组件不按标签注册 |
| `$vm.$children[i].openSheet()` | `<script setup>` 的绑定不暴露到公开实例；可调的是编译后的 `.$scope.eN_xxx`，但 `eN_` 后缀是哈希，只能靠模板里绑定的先后顺序猜，不稳 |
| 关闭 `page-container` 之后继续发命令 | automator 连接超时/断开，实测复现两次 |
| `screenshot()` 截图 | ⚠️ **合成器残影**：reLaunch 后 DOM 已换新（选择器与日志可证），截图却连 minutes 级回放旧帧，甚至出现「A 页内容 + B 页 tab 高亮」的杂交帧（20:45 实录）。只有 switchTab/navigateTo 这类**真导航**才触发新合成。逐页冒烟以**选择器 + console 日志**为准，截图只当参考 |
| 直调 store | ✅ `evaluate(() => getApp().$vm.$pinia._s.get('user'))` 能拿到 Pinia store 实例并直接调方法（实测 `store.login()` 走通且 state 响应式翻转）——绕开「组件内部节点不可选」做状态级验证 |

另：`on('console')` 会收到**全部级别**（含 debug）。只过滤 error/warn 会把「请求成功」的轮次误读成「没发请求」——`plan.list` 成功只在 debug 级留一行 `2382ms 0`，这行是判断「链路真的通了」的关键证据。

**因此本轮的验证口径**：页面能否打开、渲染成什么样、控制台报什么错，都算**实测过**；弹层的开合动画与关闭后的状态回落**只验到「关闭后节点确实没有布局盒」**，其余靠代码走查。要补这一口，只能在模拟器里手点。

**2026-11-13 增补（#34，组件边界 + WebView 页 + 刷新状态机）**：

| 手段 | 结果 |
| --- | --- |
| `page.$('.x')` 想拿自定义组件内部节点 | ❌ 不跨组件边界；✅ 两级：先 `page.$('plan-list')` 拿宿主，再 `host.$('.plan-list')` 进组件内部（Skyline 页实测，`offset()` 可量间距） |
| 页面级 `createSelectorQuery` 看组件内部 | ❌；✅ `>>>` 跨组件选择器，**一个 `>>>` 只穿一层边界**：page→OptionsSection→BaseButton 要链两个（`.plan-edit__section >>> .options-section >>> .base-button--block`，WebView 页 mp.evaluate 内实测） |
| `page.callMethod('setupFn')` | ❌ uni-app vue3 的 setup 函数不是页面方法（"this.xxx is not a function"）；状态级验证改走草稿种子 + 真导航，种子键带 `decide:` 前缀（`decide:plan_draft_<openId>`，漏前缀不恢复） |
| `ScrollViewElement.scrollTo(x, y)` | ✅ WebView 页 scroll-view 可用（`page.$('.plan-edit__scroll')` 拿句柄后直调）；`.context()` 的 ScrollViewContext scrollTo ❌ 不滚 |
| `sv.trigger('refresherrefresh')` + `sv.attribute('refresher-triggered')` | ✅ 下拉刷新状态机验收口径：mid `{triggered:true, skeleton:true, items:false}` → after `{triggered:false, skeleton:false, items:true}` |

**2026-11-13 增补（#35，watcher 缓存 + WebView 合成 tap 边界 + 事件槽直调）**：

| 手段 | 结果 |
| --- | --- |
| dev watcher 改 `types.ts` 后不重启 | ❌ 内容级缓存：编译 render 已引用 `_ctx.section` 但 props 声明仍旧版 → 新 prop 运行时被丢（标题 fw 400 暴露）。touch 无效；**重启 watcher** 并 grep 产物 `section: { type: Boolean` 确认 |
| 单行 grep `selector{[^}]*}` 查 dev wxss | ❌ 假阴性：dev 产物是多行格式化（带空格）；用 `grep -rl` 或 -A 上下文匹配 |
| WebView 页 `Element.tap()`（宿主或 `>>>` 拿到的内层 view 句柄） | ❌ 不派发 Vue `@tap`（Skyline 页部分节点可用见上表；WebView 渲染页合成 tap 实测无效，tapped=true 但无 toast）——按钮接线证明改走下一行 |
| 事件槽直调（逻辑层接线证明） | ✅ 编译 WXML `<base-button bindclick="{{aD}}">` → `getCurrentPages()[last].data.aD` 是页面实例上的事件函数名（`eN_hash`）→ `p[name].call(p, {type,detail,target,currentTarget})` 即真实点击的编译回调；实测触发 onSubmit → toast「先给计划起个标题」截图闭环 |
| `p.selectComponent('base-button')` / `selectAllComponents` | ❌ uni-app 页返回 null/0（与 WXML 存在该宿主矛盾）；`vm.$.subTree` 为 null（mp 页不挂 vnode 子树），vnode 树遍历找组件实例不可行 |
| `vm.$.setupState.onSubmit` | ❌ setup 返回 render 函数时 setupState 为空，绑定在闭包里；公开实例同样没有 onSubmit |

**2026-11-13 增补（#37，type="list" 渲染器归属 + 合成触摸边界）**：

| 手段 | 结果 |
| --- | --- |
| WebView 渲染页（详情页）留 `type="list"` | ❌ 触摸滚不动：该属性是 Skyline 专属虚拟列表（官方 scroll-view 文档），WebView 下留着触摸失效；程序化 `scrollTo` 仍可用，故静态/程序化验收暴露不了。移除后恢复（真手指拖动待用户复验） |
| 合成触摸拖动（dispatch touchstart/touchmove/touchend） | ❌ 驱动不了 WebView 原生滚动（详情页与编辑页对照实测 scrollTop 恒 0）；`ScrollViewElement.scrollTo` ✅ 可用。真触摸验收只能用户在模拟器手拖 |
| Skyline 页（首页/我的 PlanList）`type="list"` | ✅ 保留不变；虚拟化与零测量红线照旧（§2.3） |

**2026-11-13 增补（#38，事件槽实参解包 + payload 抓取 + 部署快照核对）**：

| 手段 | 结果 |
| --- | --- |
| 组件 v-model 事件槽直调（ImageUploader `bindupdateModelValue="{{ah}}"`） | ✅ 但实参不走 `detail.value`：vendor `createInvoker` 见 `detail.__args__` 就展开为真实参 → 喂 `{type:'updateModelValue', detail:{__args__:[[fileID]]}, target/currentTarget}` 才写进 `model.images`；普通事件槽（`bindinput` 等）无 `__args__` 时整事件对象作单参 |
| 包 `wx.cloud.callFunction` 抓提交 payload | ✅ 客户端修复的直接证据：evaluate 里换装原函数、stash `opts.data.payload`，比草稿推断强（草稿末尾空段是光标占位、预期保留，滤除只作用于 payload） |
| 判「修复未生效 vs 云端另拒」 | **先读 toast 截图**再下结论：本轮一度把「计划配图不能为空」误读成空块修复未生效；截图措辞才是分流依据 |
| 核对已部署 bundle 与盘上 `dist-cloud/` | ⚠️ dist-cloud 中文串是 `\uXXXX` 转义，按中文原文 grep 假阴性；须按转义形搜或直读调用点。本轮据此证实云上跑旧快照（无送审容错、配图必填），重部署 dist-cloud 同解两题（用户闸门） |

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

**`.a.b`（多类名组合）不属于本节禁止的三类，别再把它写成「Skyline 不支持」。** §1.4 的证据本身就是一条复合类选择器：
scoped 产物是 `.row__label.data-v-6da001a3{`。若复合类选择器失效，全项目所有 scoped 样式一起失效，而 §1.4/§2.2 的实测里没有任何一条失效。
工程保留「一个节点一个类名」的约定，理由是**可预测**（不依赖多类名的层叠顺序与优先级），不是平台限制。
引用本节约束时按此口径表述。

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
| `page-container` | ✅ h=208，但**一个页面只允许存在一个实例**（见 §2.3.1） | 测量 + 编辑页运行时 |
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

### 2.3.1 `page-container` 单实例限制（运行时，2026-11-12 编辑页实测）

§2.3 那行只测了「能不能渲染」，没测「能不能同时存在两个」，所以这条限制一直漏在清单外，直到把编辑页真的跑起来：

```
[Component] <page-container>: Only one instance can exist.
```

**触发条件**：一个页面里有两个（且只需两个）会渲染 `page-container` 的组件**常驻在模板上**。编辑页正是这个形状 —— `DeadlinePicker` 内部一个 `BasePopup`，页面底部又一个 `BaseActionSheet`，两者平时都是 `visible=false`，但节点从页面加载起就存在。

**为什么静态检查抓不到**：`type-check` / `check:templates` / `build:mp-weixin` 全绿，产物里两个 `page-container` 也完全合法。这条只能运行时发现。

**修法（历史，2026-11-12 落地；2026-11-13 起被 §2.3.2 取代）**：`BasePopup` 把「节点是否存在」和「是否显示」拆成 `host` / `shown` 两个状态 —— `visible` 转 true 才挂 `page-container`，下一帧再把 `shown` 翻 true（进场动画路径与原常驻写法完全一致），退场后卸载。于是一页内最多只有一个实例，因为同一时刻只可能有一个弹层是开的。
卸载以 `afterleave` 为准，另加一个 `duration + 80ms` 的兜底定时器：模拟器里关闭 `page-container` 会让 automator 的连接直接断掉，无法证明 `afterleave` 一定送达，而「它没触发」的后果是节点常驻、限制被重新踩破。

**编码规范（2026-11-13 更新）**：`BasePopup` 系（含 `BaseModal` / `BaseActionSheet` / `DeadlinePicker` / `UserHeader` 编辑弹层）已整体弃用 `page-container`（§2.3.2），单实例限制对它们**不再成立**，同页常驻多个也没关系。仍然有效的规则是：任何**直接使用 `page-container`** 的组件，一页最多常驻一个实例；要叠弹层就走 BasePopup 的 fixed 形状。

### 2.3.2 `page-container` 在 WebView 渲染页：未验证组合 → 用户真机实测坏（#78，2026-11-13）

§2.3 的 `page-container` ✅（h=208）是 **Skyline 首屏隔离**测的；它在 **WebView 渲染页**（detail/edit）里的手势与高度行为从未实测。按 §2.8 规则这属于「未验证」，而编辑页的时间选择弹层恰好踩在这个组合上。用户真机实测反馈（2026-11-13）：

- 弹层内两列时间格子**滚不到底**；
- 触摸弹层时**外层页面跟着滚**（滚动穿透），弹层自己不动。

**根因（两层）**：

1. 两列 `scroll-view` 走百分比高度链（`height:100%` 依赖父级撑开）。WebView 下这条链不可靠，列拿不到确定高度就没有内部滚动，触摸全部落到外层文档。
2. `page-container` 的遮罩/手势在 WebView 页**无实测条目**；用户反馈的穿透与「遮罩没拦住文档滚动」一致。修法不赌它的行为，直接换两渲染器都实测过的形状。

**修法（已落地，BasePopup 整体重写）**：

| 件 | 形状 | 证据 |
| --- | --- | --- |
| `BasePopup` | 弃 `page-container`，改 **fixed 全屏根 + 遮罩 + 面板**；遮罩 `@touchmove.stop.prevent`（编译为 `catchtouchmove`）断掉触摸冒泡；面板进/退场走 transform/opacity 过渡（§2.2 实测 ✅） | dist wxml：`catchtouchmove="{{e}}"`；components 产物 `page-container` 计数 0 |
| 节点生命周期 | 保留 host/shown 两态：`visible=true` 才挂节点、30ms 后翻 shown（过渡有起点）、退场 `duration+80ms` 后卸载 | `BasePopup/index.vue` |
| 编辑页锁文档 | `<page-meta :page-style="pageLockStyle" />` 为模板首节点；picker 或 ActionSheet 任一打开 → `overflow:hidden` | dist edit wxml/js：page-meta + pageLockStyle |
| 选择器两列 | **显式定高 440rpx**（`$tap-min-height * 5`），不再走百分比链；初始定位仍 `scroll-into-view`（只在打开时给一次） | dist wxss：`.deadline-picker__col{flex:1;height:440rpx;...}` |
| `BaseActionSheet` 内滚动 | 去 `type="list"` 改普通 `scroll-view :scroll-y="true"`（WebView 下 type=list 触摸滚动失效，#73 同根因；普通 scroll-view 不显式给 scroll-y 就完全不滚）。唯一宿主是编辑页 | dist wxml |

**验收边界（诚实口径）**：automator 跨不过自定义组件边界（setupState 空、vnode 树空、`>>>` 0 命中），**弹层无法程序化打开**，所以「弹层内触摸滚动 / 穿透是否消失 / 震感手感」只能真机复验。模拟器已验的是：产物形状、文档级滚动数字（§2.6.2）、Skyline 首页/我的回归、console 0 报错。**不宣称弹层交互已真机通过。**

**连带更新**：§2.3.1 单实例限制对 BasePopup 系不再成立；§2.7 结论 2、§2.8 表同步改口径。`UserHeader` / `DeadlinePicker` / `mine` 等 README 里写于 #78 之前的 page-container 描述按历史记录读，现状以本节与 `BasePopup/README.md` 为准。

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

**2026-11-12 复测（SDK 3.17.6，spike 已删、证据截图存 /tmp/rt/spike-richtext.png）**：

| 项 | 结论 | 说明 |
| --- | --- | --- |
| mp-html v2.5.2（uni-app 发行版）块级渲染 | ✅ h2/h3/p/blockquote/ul/li/hr/a/img（本地路径）全部正常 | 它对无子节点的叶子走 `rich-text`（node.vue:76），所以**行内流断裂照样继承** —— 段内加粗/变色仍不可用，与原生 rich-text 同源 |
| 原生 `<text>` 兄弟节点拼接 | ❌ 各占一行 | Skyline 布局模型：行内流只存在于 `<text>` 容器内部；view 下 text 是块级（解释了 T0 自研分片「正常」的实际含义 = 段落级换行） |
| `<editor>` 复测 | ❌ 0×0、`bindready` 仍未触发 | T0 结论在 3.17.6 上维持，编辑侧继续走块编辑器 |
| CSS 变量 `var()` | ✅ 组件样式定义生效；**穿自定义组件边界到 mp-html 内联样式也生效** | tokens 桥接方案成立：根节点挂 `--cr-*`，tag-style/内联样式消费，SCSS 变量够不着的第三方组件也能吃到 tokens |

**决策修订（用户裁定 2026-11-12）**：渲染层改走成熟三方库 **mp-html**（不再手写渲染器）；因为契约 §8.1 冻结为段落级样式，行内流断裂这条平台限制**碰不到我们的内容**，mp-html 的块级覆盖（语义标签/引用/列表/分割线/图）完整可用。序列化（`blocksToHtml`）与段落样式仍收敛在 `utils/blocks.ts` 单一源。`<editor>` 结论不变。

### 2.6.1 WebView 渲染页两个盒模型/显示坑（运行时，2026-11-13 编辑页实测）

| 项 | 结论 | 证据与修复 |
| --- | --- | --- |
| 默认 box-sizing | ⚠️ Skyline 默认 border-box；**WebView 渲染页默认 content-box** → `width:100% + 左右 padding` 只在 WebView 页溢出父容器 | 工具栏/添加选项按钮实测溢出；`global.scss` 标签选择器统一 `box-sizing: border-box`；组件运行时 `styleIsolation: 'apply-shared'`（dist common/vendor.js 证实）使 app.wxss 进组件内部，一条规则全修 |
| `v-show` / `hidden` | ⚠️ v-show 编译为 `hidden="{{!x}}"`；WebView 下类 `display:flex` 与框架 `[hidden]` 同优先级、后写赢 → 永不收起（Skyline 原生处理 hidden，不暴露） | OptionsSection 改显式类 `--off { display:none }`（两渲染器都收得起；保活实例不用 v-if）；OFF 实测 section H61、无按钮 |

### 2.6.2 WebView 渲染页高度链裁剪 → 文档级滚动模式（#79，2026-11-13 模拟器实测）

**根因**：`global.scss` 给 `page` 定了 Skyline 形状 —— `display:flex; height:100%; overflow:hidden`（页面不滚、滚动交给 scroll-view）。这条规则在 **WebView 渲染页**把文档高度钉死在一屏：内层 `scroll-view` 的百分比高度链被裁剪，内容超出一屏就**永远滚不到底**。#37/#66/#70 几轮 padding 修补都没碰到这条根因，所以真机反复复发。

**修法（detail/edit 两页已落地）——整页改文档级滚动**：

| 件 | 形状 |
| --- | --- |
| page 覆盖 | 页面级**非 scoped** `<style> page { height:auto; overflow:visible; }`。必须非 scoped：scoped 会给选择器加属性限定，`page` 是渲染器注入的根节点、拿不到 scoped 属性，规则直接死信；页面 wxss 晚于 app.wxss 加载、同优先级后写赢 |
| 导航 | `BaseNavbar fixed`（`position:fixed; z-index:$z-navbar`）+ 页面自留**等高占位** `nav-space`（`appStore.navBarHeight` px，模拟器 87） |
| 滚动触发 | 页面 `onReachBottom`（pages.json `onReachBottomDistance:120`）取代 scroll-view 的 `@scrolltolower` |
| 程序化滚动 | `uni.pageScrollTo({ selector:'#id' })` 取代 `scroll-into-view` |
| 编辑页底部 | 状态行+发布按钮 `position:fixed` 叠层，文档流尾部留 **tail 占位**（`calc(217rpx + env(safe-area-inset-bottom))`）防遮内容 |
| 弹层锁 | 编辑页 `<page-meta :page-style>` 在弹层打开时 `overflow:hidden`（§2.3.2） |
| 根 mixin | `page-root-doc`（flex column、width:100%，**不带 height/overflow**） |

**模拟器实测数字（automator `selectViewport().scrollOffset()` + 节点矩形；长内容计划「111」，非用户 123123）**：

| 页 | scrollHeight | 最大 scrollTop | 对账 |
| --- | --- | --- | --- |
| detail | 1591 | 747.5 | 1591 − 843.5 = 747.5，精确到底；尾部 `#planDetailTail` rect bottom 844.2 ≈ 视口底 843.5 |
| edit | 1248 | 404.5 | 1248 − 843.5 = 404.5，精确到底；nav-space（87px）随文档滚出（top −404.5），导航 fixed 钉住 |

编辑页底部 fixed 叠层 rect：top 719.5 / bottom 844 / height 124.5（含模拟器 ~32px 安全区）；tail 占位 ≈144.8px > 124.5px ⇒ **滚到底时最后一块内容不被底部叠层遮住**。全程 console 0 报错；Skyline 首页/我的回归正常（截图 b4-01…09，存 /tmp/rt/shots/）。

**规范**：WebView 渲染页一律文档级滚动，不要再往里塞「height:100% 的 scroll-view」；Skyline 页维持 §2.3 的 `scroll-view type=list` 形状不变。真机复核项：两页滚到底手感、底部安全区（刘海屏 env 值）、弹层锁（§2.3.2）。

### 2.7 结论汇总

1. Skyline 在本工程**确认可用**（`isSupported=true`），配置穿透、组件放行、scoped CSS 均无问题（§1）。
2. 五大功能需求**不依赖任何不可用组件**：Skyline 页列表用 `scroll-view type=list`；弹层统一 `BasePopup`（fixed 遮罩+面板，#78 起弃 `page-container`，§2.3.2）；WebView 渲染页（detail/edit）整页文档级滚动（§2.6.2）；吸顶用 fixed，动画用 CSS transition，富文本渲染走 mp-html、编辑走自研块编辑器（§2.6 决策修订）。
3. 唯一的产品能力让步：**富文本不支持区间样式**（段落级），已在 §8.1 定稿。
4. 残留风险：真机差异、worklet `applyAnimatedStyle` 未验；云能力已实测通过（§3），仅 `mediaCheckAsync` 回调链路未闭环。

### 2.8 「清单里没有」≠「可以用」——阶段 4/5 下发的判定规则

T0 的实测面是按当时那版技术方案的组件清单圈的，所以**这份清单是「已知集合」，不是「全部可能」**。凡是清单里查不到的原生组件/属性，一律按**未验证**处理：不许当成「支持」，也不许当成「不支持」——要么换成已验证的等价实现，要么写进 README 的真机复核项并给出兜底。

本轮实际踩到两例，都按这条规则处理了：

| 项 | 清单状态 | 本轮决策 |
| --- | --- | --- |
| `<picker>` / `<picker-view>`（截止时间自定义选择） | **零条目**，从未实测 | **不用**。改 `BasePopup`（#78 起为 fixed 遮罩+面板，§2.3.2；原 page-container 方案 §2.3 实测 h=208 ✅）+ 两列可点选单元格（显式定高 440rpx）。理由不是「它一定坏」，而是「它的坏法我们没法在模拟器里证明，而编辑器是本项目最高风险模块，不该再叠一层未知」 |
| `button open-type="chooseAvatar"` / `input type="nickname"`（我的页编辑资料） | **零条目**（属微信原生资料填写能力，与渲染引擎正交，但正交性未经我们实测） | **用**，但必须带兜底：不选头像时只改昵称也要能提交；`avatarUrl` 不许提交成空串。列为真机复核项 |

对照 §2.3 的 `list-view`/`grid-view`：那两个是**实测过且坏**（渲染 0×0），所以禁用有证据；`picker` 是**没测过**，所以「不用它」的证据是风险判断而不是实测结论 —— 这个区别必须写清楚，否则下一个人会把它当成「Skyline 不支持 picker」这条（并不存在的）事实引用。


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
- [x] （2026-11-12 复测修订）渲染路线再修订为 **mp-html**：段落级契约碰不到行内流断裂，块级标签实测全通（§2.6 复测表）；`<editor>` 复测仍死，编辑侧不变
- [x] 《技术方案.md》§8.8 —— FAB 收起改 `scroll` 事件节流（不用 worklet 跟手）；补充「禁止测量视口外节点」
- [x] 《技术方案.md》§11.1 —— 多行截断改 JS 截字 / 单行 ellipsis（line-clamp 不生效）
- [x] 《技术方案.md》§14 —— 风险表按实测收敛，云能力三项标记挂起
- [x] `src/manifest.json` —— `nativeTags` 已收敛为 `["list-item", "grid-item"]`
- [x] 《技术方案.md》§6.6 / §5 / §12 —— 按 §3 云实测回填（部署命令、SDK 版本与类型缺陷、集合命名、客户端 downloadFile 形状、内容安全接口选型）
- [x] 新增 §2.8「清单里没有 ≠ 可以用」，并回写《技术方案.md》三处：§8.1 截止时间**不用原生 `picker`/`picker-view`**（改 `BasePopup` + 两列点选）、§8.7 `FilterTabs` **四项 flex 不横向滚动**、§9.2 editor 清单更正为 9 个目录并禁止 `src/components/editor/` 桶文件
- [ ] **真机复核**（M0）：后代/子代/伪元素选择器、line-clamp、worklet `applyAnimatedStyle`、`share-element` 转场、`chooseMedia` 选图上传
- [ ] **真机复核**（阶段 4/5 新增）：`button open-type="chooseAvatar"` 与 `input type="nickname"` 在 Skyline 下的返回（§2.8 第二例，组件已要求「只改昵称」兜底）；`BasePopup` 内两列 `scroll-view` 在手势/键盘下的表现；`<image src="cloud://…">` 与 `uni.previewImage({urls:[fileID]})`（详情页 §5 已挂同一条）
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
