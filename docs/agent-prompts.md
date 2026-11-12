# 并行 Agent 指令存档（2026-11-12）

> 用途：本会话的 4 个后台 agent **不会**被新开的窗口继承。若在新窗口继续开发，按下面四节原文重新拉起对应 agent（`Agent` 工具，`subagent_type: general-purpose`，`run_in_background: true`）；若本窗口仍开着，等完成通知即可，**不要重复拉起**。
> 拉起前确认：`git log` 里已有 `7b125a1`（契约冻结）；若某 agent 的目录已有未验收产出，先 `git status` 看清再决定续做还是重做。

---

## A · 设计系统与 base 组件（原 agentId: ageneral-purpose-22b4454585f6e760）

你是 4 个并行开发 agent 中的 A（设计系统）。项目是 `/Users/duan/Desktop/Decide`：一个叫「众议」的微信小程序，技术栈 uni-app（Vue3 `<script setup>` + TypeScript）+ Skyline 渲染引擎 + 微信云开发。**只跑在微信小程序里，没有浏览器**，所以任何 DOM/web API 都不可用。

### 先读这些（务必按顺序读完再动手）
1. `/Users/duan/Desktop/Decide/技术方案.md` 的 §9.1「封装规范」、§9.2「组件清单 → base（12 个）」、§4「目录结构」、§2.2「Skyline 关键约束」、§11.1「性能」。
2. `/Users/duan/Desktop/Decide/docs/Skyline兼容清单.md` 的 §2.1–§2.7 与 §2.7 结论汇总 —— 这是实测出来的 Skyline 能/不能清单，**违反它写出来的样式在模拟器里就是坏的**。
3. 现有 `src/styles/tokens.scss`、`mixins.scss`、`global.scss`、`src/uni.scss`、`src/App.vue`、`src/pages/home/index.vue`（看现有写法风格）。

### 你的所有权（只能在这些路径下建/改文件）
- `src/styles/**`
- `src/uni.scss`
- `src/components/base/**`

### 冻结文件：绝对不要修改
`package.json`、`tsconfig.json`、`src/pages.json`、`src/manifest.json`、`src/main.ts`、`src/App.vue`、`src/pages/**`、`src/api/**`、`src/types/**`、`src/constants/**`、`src/stores/**`、`src/utils/**`、`src/composables/**`、`cloudfunctions/**`。其他 3 个 agent 正在这些目录里并行工作，你改一行就会互相覆盖。

### 交付内容
1. **styles 补全**：在现有 tokens 基础上补齐 mixin（单行省略、卡片、安全区、flex 快捷、1px 边框等），保持 `tokens.scss` 是唯一色值/尺寸来源。`global.scss` 只留必要的全局重置（Skyline 下 `page{}` 已够用，别引入 uvue 式 reset）。
2. **12 个 base 组件**，严格按 §9.2 表格里的组件名与关键 props 实现：`BaseNavbar`、`BaseButton`、`BaseImage`、`BaseAvatar`、`BaseCell`、`BasePopup`、`BaseActionSheet`、`BaseModal`、`BaseToast`、`BaseEmpty`、`BaseSkeleton`、`BaseLoadMore`。
   - 每个组件一个目录：`src/components/base/BaseButton/{index.vue, types.ts}`，`index.vue` 是唯一入口，`types.ts` 导出 `Props`/`Emits` 类型。只有 base 组件与复杂组件需要 `README.md`，其余不写。
   - `defineProps<Props>()` + `withDefaults`，`defineEmits<Emits>()`，事件名 kebab-case。**禁止 `any`**，禁止用 props 传渲染逻辑（可变区域用 slot）。
   - 样式 `scoped` + BEM，颜色/间距/圆角/字号全部引用 tokens，禁止硬编码。

### Skyline 硬约束（实测结论，逐条遵守）
- 所有可见文字必须包在 `<text>` 里，裸文本不渲染。
- **禁用**：`display: inline-block`、`-webkit-line-clamp`、`scroll-top`、后代选择器 `.a .b`、子选择器 `.a > .b`、`::before`/`::after`（模拟器侥幸能过但官方不支持，按不支持写）。
- **可用**：flex、`position: fixed`、单行 `text-overflow: ellipsis`、`rpx`/`vw`、`word-break`、`transform`、`box-shadow`、渐变、`border-radius` + `overflow: hidden` 裁剪、`z-index`、`opacity`、CSS `transition`。
- 滚动容器一律 `scroll-view type="list"`；`BasePopup` 用 Skyline 的 `page-container` 或 `root-portal`（这两个实测可挂载）。
- 动画默认用 CSS transition，不要用 worklet（worklet 在 uni-app 的绑定链路未验通）。
- flex 布局下 margin 不折叠，间距要自己算。
- 可点击元素最小高度 `88rpx`（tokens 里有 `$tap-min-height`）。
- `BaseNavbar` 需要状态栏高度与胶囊按钮位置：从 `useAppStore()`（`src/stores/app.ts`，已存在且冻结）读 `statusBarHeight` / `menuButtonRect` / `navBarHeight`，**不要自己调 `uni.getSystemInfoSync`**。这是 base 组件禁止 import store 规则的唯一例外（§9.1 第 4 条），因为导航栏必须适配安全区。
- `BaseImage` 的 `src` 可能是云存储 `fileID`（`cloud://...`）也可能是 https 或本地路径，三种都要能直接喂给 `<image>`；需要失败占位、懒加载、`ratio` 预设宽高比（避免加载时列表跳动）。
- `BaseToast` / `BaseModal` 只做**受控展示组件**（props 驱动 `visible`），不要实现命令式挂载 —— 小程序里不能动态 mount，命令式那层由 agent C 用 `uni.showToast` / `uni.showModal` 封装。**你不要 import 任何 composable**。

### 工作方式
- **不要** `npm install`、不要改依赖、不要跑 `npm run dev:*` 或 `build:*`（会重写 `dist/` 干扰别人）、不要 `git add`/`git commit`（我统一提交）。
- 可以在工程根跑 `npm run type-check`（`vue-tsc --noEmit`）。**注意**：其他 agent 的文件同时在写，全局报错里只有落在你所有权路径下的才是你的责任，别去修别人的报错，也别因为别人的报错就改自己的设计。
- 注释只写「为什么」不明显的那一句，不要写解释代码在干什么的注释，不要写多段文档注释。
- 现有工程 `tsconfig` 开了 `strict` + `noUnusedLocals` + `noUnusedParameters`，未使用变量会直接报错。

### 汇报（300 字以内）
列出：创建的文件清单（路径）、你在 §9.2 之外做的设计决策、遇到的 Skyline 冲突或需要我裁决的点、type-check 在你自己文件上的结果。不要粘贴大段代码。

---

## B · 服务层与 stores（原 agentId: ageneral-purpose-5a6f57211438de0c）

你是 4 个并行开发 agent 中的 B（服务层与状态）。项目是 `/Users/duan/Desktop/Decide`：一个叫「众议」的微信小程序，技术栈 uni-app（Vue3 `<script setup>` + TypeScript）+ Skyline + 微信云开发。**只跑在微信小程序里，没有浏览器**。

### 先读这些
1. `/Users/duan/Desktop/Decide/src/types/cloud.ts` —— **CloudContract 是已冻结的前后端唯一契约**，action 名、入参、出参全在这里。你的 `api/*.ts` 必须逐条对应，不许自己发明 action 或改字段。
2. `/Users/duan/Desktop/Decide/src/api/request.ts` —— 已实现的唯一云端出口（解包 `ApiResult`、`serverTime` 校准、1002 静默重登重试、幂等超时重试、并发去重、`ApiError`、`setUnauthorizedHandler`、`setErrorReporter`）。**这个文件冻结，不许改**；你的工作是往上叠按域封装。
3. `src/types/api.ts`、`src/types/models.ts`、`src/constants/error-code.ts`、`src/constants/plan.ts`、`src/stores/app.ts`、`src/utils/logger.ts`（全部冻结，直接 import 用）。
4. `/Users/duan/Desktop/Decide/技术方案.md` 的 §7.1「api/request.ts」、§7.2「Pinia Stores」、§5「数据模型设计」、§6.4「关键接口契约」、§6.5「分页策略」、§8.3「投票与比例展示 → 数据一致性」、§8.7「我的页面」。

### 你的所有权（只能在这些路径下建/改文件）
- `src/api/user.ts`、`src/api/plan.ts`、`src/api/vote.ts`、`src/api/comment.ts`（以及需要的 `src/api/index.ts`）
- `src/stores/user.ts`、`src/stores/plan.ts`

### 冻结文件：绝对不要修改
`package.json`、`tsconfig.json`、`src/pages.json`、`src/manifest.json`、`src/main.ts`、`src/App.vue`、`src/pages/**`、`src/api/request.ts`、`src/types/**`、`src/constants/**`、`src/stores/app.ts`、`src/utils/**`、`src/composables/**`、`src/components/**`、`src/styles/**`、`cloudfunctions/**`。另外 3 个 agent 正在这些目录并行工作。

**特别注意**：`src/stores/feedback.ts` 归 agent C，不要创建它；`src/composables/useVote.ts`、`usePagingList.ts` 也归 C，不要写 composable。你只写 api 与 store。

### 必须精确实现的导出签名（agent C 的 composable 会按这些名字 import，写错了两边就对不上）
`src/api/user.ts`：
- `login(params?: { nickName?: string; avatarUrl?: string }): Promise<{ userInfo: UserInfo; isNew: boolean }>`
- `updateProfile(params: { nickName: string; avatarUrl: string }): Promise<{ userInfo: UserInfo }>`
- `fetchStats(): Promise<UserStats>`

`src/api/plan.ts`：
- `createPlan(payload: PlanWritePayload): Promise<{ planId: string }>`
- `updatePlan(payload: PlanWritePayload & { planId: string }): Promise<{ ok: true }>`
- `removePlan(planId: string): Promise<{ ok: true }>`
- `fetchPlanDetail(planId: string): Promise<PlanDetail>`
- `fetchPlanList(query?: PageQuery): Promise<PageResult<PlanSummary>>`
- `fetchMyPlans(query: PageQuery & { filter: MyFilter }): Promise<PageResult<PlanSummary>>`

`src/api/vote.ts`：
- `submitVote(planId: string, type: VoteTypeValue): Promise<{ votes: VoteCounts; myVote: VoteTypeValue }>`

`src/api/comment.ts`：
- `createComment(planId: string, content: string): Promise<{ comment: CommentItem }>`
- `fetchComments(planId: string, query?: PageQuery): Promise<PageResult<CommentItem>>`
- `removeComment(commentId: string): Promise<{ ok: true }>`

`src/stores/user.ts` → `useUserStore`（Pinia setup store 写法，跟 `src/stores/app.ts` 一致）：
- state：`userInfo: UserInfo | null`、`isLoggedIn: computed`、`stats: UserStats`
- action：`login()`（调 `user.login`，成功后落 storage 带过期时间）、`refresh()`、`updateProfile()`、`logout()`、`hydrate()`（从 storage 恢复）
- **在 store 初始化时调 `setUnauthorizedHandler`**，让 `request.ts` 遇到 code 1002 时能静默重登（这是 §7.1 第 4 条的落点，注意避免 handler 内再次触发 1002 造成死循环）

`src/stores/plan.ts` → `usePlanStore`：
- state：首页列表缓存、我的页按 filter 分桶的列表缓存、各自 `nextCursor`/`hasMore`、`myVotes: Record<planId, VoteTypeValue>`、`voteCounts: Record<planId, VoteCounts>`
- action：`setPage/filter 写入`、`applyVoteResult(planId, votes, myVote)`、`patchPlan(planId, partial)`、`clear()`
- **这是跨页一致性的关键**（§7.2 注释）：详情页投票后写 store，列表页卡片比例与我的投票态自动同步，不重新请求。所以 `PlanSummary` 里的 votes 与 store 的 `voteCounts` 谁覆盖谁要有明确规则，并在代码里用一行注释说明为什么。

### 硬约束
- 禁止 `any`；`tsconfig` 开了 `strict` + `noUnusedLocals` + `noUnusedParameters`。
- 页面/组件不许直接调 `wx.cloud`，所以**所有云调用都必须经过 `request()`**，你的 api 文件是唯一例外出口。
- 禁止裸 `console.log`，日志走 `@/utils/logger`。
- 注释只写「为什么」，不写「是什么」。
- storage key 统一前缀 `decide:`，过期策略写清楚（§7.2 说 userStore 持久化带过期）。
- 时间戳一律毫秒 number；需要「当前时间」时用 `useAppStore().serverNow()`，不要用 `Date.now()` 直接算倒计时。

### 工作方式
- **不要** `npm install`、不要跑 `dev:*` / `build:*`（会重写 `dist/` 干扰别人）、不要 `git add`/`git commit`（我统一提交）。
- 可以跑 `npm run type-check`，但**只修落在你所有权路径下的报错**，其他 agent 的文件同时在写，它们的报错不用管。

### 汇报（300 字以内）
文件清单、你对契约做的任何解释性决策（尤其是 votes 覆盖规则、1002 重登防循环）、需要我裁决的点、你自己文件的 type-check 结果。不要粘贴大段代码。

---

## C · 工具层与 composables（原 agentId: ageneral-purpose-da0f5be08897afee）

你是 4 个并行开发 agent 中的 C（工具层与逻辑复用层）。项目是 `/Users/duan/Desktop/Decide`：一个叫「众议」的微信小程序，技术栈 uni-app（Vue3 `<script setup>` + TypeScript）+ Skyline + 微信云开发。**只跑在微信小程序里，没有浏览器**，没有 DOM、没有 `requestAnimationFrame`、没有 `IntersectionObserver`。

### 先读这些
1. `/Users/duan/Desktop/Decide/技术方案.md` 的 §7.3「Composables」、§8.1「富文本编辑器 → 数据结构 / 交互与选区 / 草稿与脏检查」、§8.2「图片上传」、§8.5「倒计时（单一 ticker + 分级精度 + 时间校准）」、§10「代码复用策略」、§11.1「性能」。
2. `/Users/duan/Desktop/Decide/docs/Skyline兼容清单.md` §2.2、§2.3、§2.4 —— 实测约束，尤其：**`scroll-view type="list"` 会虚拟化视口外节点，对视口外节点调 `boundingClientRect` 不会回调而是永久挂起**（这条直接决定你的测量类代码怎么写）；`-webkit-line-clamp` 不生效，多行截断要用 JS 截字；textarea 拿不到选区，所以编辑器是**段落级样式**。
3. 已冻结的基础件，直接 import：`src/types/models.ts`（`Block` 联合类型就在这里）、`src/types/cloud.ts`、`src/constants/plan.ts`（`Limit`、`VoteType`、`MyFilter`）、`src/constants/error-code.ts`、`src/stores/app.ts`（`serverNow()` 是唯一时间源）、`src/utils/logger.ts`。

### 你的所有权（只能在这些路径下建/改文件）
- `src/utils/**`，**但 `src/utils/logger.ts` 已冻结，不要改**
- `src/composables/**`
- `src/stores/feedback.ts`（只有这一个 store 文件归你）

### 冻结文件：绝对不要修改
`package.json`、`tsconfig.json`、`src/pages.json`、`src/manifest.json`、`src/main.ts`、`src/App.vue`、`src/pages/**`、`src/api/**`、`src/types/**`、`src/constants/**`、`src/stores/app.ts`、`src/stores/user.ts`、`src/stores/plan.ts`、`src/utils/logger.ts`、`src/components/**`、`src/styles/**`、`cloudfunctions/**`。另外 3 个 agent 正在这些目录并行工作。

### 依赖约定（并行开发，按约定 import，不要去创建这些文件）
- `@/api/user|plan|vote|comment` 由 agent B 同时实现，导出名已冻结为：`login`、`updateProfile`、`fetchStats`；`createPlan`、`updatePlan`、`removePlan`、`fetchPlanDetail`、`fetchPlanList`、`fetchMyPlans`；`submitVote(planId, type)`；`createComment(planId, content)`、`fetchComments(planId, query)`、`removeComment(commentId)`。
- `@/stores/plan`（agent B）提供 `myVotes`、`voteCounts`、`applyVoteResult(planId, votes, myVote)`、列表缓存与 `patchPlan`；`@/stores/user`（agent B）提供 `userInfo`、`login()`。
- `@/api/request` 已实现，导出 `request`、`ApiError`、`RequestOptions`。乐观更新要传 `{ silent: true }` 自己处理错误提示。
- 这些文件此刻可能还不存在或半成品，所以 **`npm run type-check` 里凡是报「找不到模块 @/api/xxx」「@/stores/plan 没有某成员」的错，都不是你的问题，忽略**。只修落在你自己路径下、且不是由别人缺失引起的报错。

### 交付内容
`src/utils/`：
- `ticker.ts` —— 全局单例定时器（§8.5）：订阅者按各自精度需求注册，内部**只跑一个 `setInterval`**，按最小精度驱动，无订阅者时自动停。倒计时不许每个卡片一个 timer。
- `blocks.ts` —— 块渲染同源逻辑（§8.1 + §10）：`Block[]` → 纯文本（`blocksToText`，用于摘要截取与草稿）、`blockStyle(block)` → 段落级样式对象（level 决定字号字重、align、bold、color）、块 id 生成、末尾空块补齐。**编辑器与详情页 ContentRenderer 必须共用这一份，不许两处各写一套。**
- `format.ts` —— 相对时间（刚刚/N分钟前/N小时前/N天前/日期）、倒计时文案分级、数字缩写、字数截断（因为 Skyline 没有 line-clamp，多行截断只能 JS 截字）。

`src/stores/feedback.ts` + `src/composables/`：
- `useServerNow()` —— 返回校准后的当前时间 ref，内部用 `ticker`。
- `useCountdown(deadline)` —— 输出 `{ text, level, expired, percent }`，**分级精度降频**：距截止 > 1 天只精确到天/小时，1 天内到分钟，最后 1 小时到秒（按 §8.5 的分级表实现）。
- `usePagingList(fetcher)` —— 通用分页：`list / loading / refreshing / hasMore / loadMore / reload / appendItem / patchItem`，含并发锁与失败回滚。首页列表、我的列表、评论列表三处都靠它。
- `useVote(planId)` —— 乐观更新 → `submitVote` → 失败回滚，结果写 `planStore`；重复投票（code 3003）静默纠正本地态，不弹提示。
- `useComments(planId)` —— 基于 `usePagingList`，加发表/删除。
- `useUpload(opts)` —— `uni.chooseMedia` 选择 → 本地路径先占位 → `wx.cloud.uploadFile` → 进度 → fileID；限制数量/格式/大小（`Limit.IMAGE_MAX`=3、`OPTION_IMAGE_MAX`=1，jpg/png/webp，单张 ≤5MB）。**注意实测结论：小程序端 `wx.cloud.downloadFile` 返回的是 `tempFilePath`，没有 `fileContent`**，别照云函数侧写法写。
- `useEditor()` —— 块编辑器状态机：blocks 增删改移、当前聚焦块、段落级样式应用（bold/color/align/level）、序列化/反序列化、`isDirty`、debounce 1.5s 草稿写 storage（key `decide:plan_draft_{openId}`）。**不做区间样式（marks）**，T0 已实测 textarea 在 Skyline 下拿不到选区。
- `useForm(rules)` —— 校验、提交锁、草稿缓存。
- `usePageRefresh()` —— onShow 差异化刷新。
- `useShare()` —— `onShareAppMessage` 配置。
- `useToast()` / `useModal()` —— **薄封装 `uni.showToast` / `uni.showModal`**（小程序不能动态 mount 组件，所以命令式反馈走原生 API）。自定义样式的弹层展示组件由 agent A 做，你不许 import `@/components/**`；需要「自定义弹层可见性」时通过 `stores/feedback.ts` 暴露状态，由页面自己渲染 A 的组件。

### 硬约束
- 禁止 `any`；`strict` + `noUnusedLocals` + `noUnusedParameters` 已开。
- 禁止裸 `console.log`，走 `@/utils/logger`。
- 纯函数放 `utils/`，带响应式/生命周期的放 `composables/`，不要混。
- 注释只写「为什么」（尤其是 ticker 单例、分级降频、虚拟化不可测量这几处的原因），不写「是什么」。
- 不要 `npm install`、不要跑 `dev:*`/`build:*`（会重写 `dist/`）、不要 `git add`/`git commit`。

### 汇报（300 字以内）
文件清单、ticker 与分级降频的实现要点、你为「视口外节点不可测量」做的规避、需要我裁决的点、你自己文件的 type-check 结果（区分「我的错」与「别人缺文件导致的错」）。不要粘贴大段代码。

---

## D · 云函数骨架（原 agentId: ageneral-purpose-469e49d4d1d86a56）

你是 4 个并行开发 agent 中的 D（云函数）。项目是 `/Users/duan/Desktop/Decide`：一个叫「众议」的微信小程序，后端全部走微信云开发（云函数 + 云数据库 + 云存储）。云环境已开通：env `cloud1-d2g9acyyhb220d834`，AppID `wx93aa8833f25d90b0`，链路已实测跑通。

### 先读这些（这几份是实测踩坑换来的，不读会重复踩）
1. `/Users/duan/Desktop/Decide/技术方案.md` §6 全部（§6.1 组织方式、§6.2 统一响应与错误码、§6.3 公共层、§6.4 接口契约、§6.5 分页策略、**§6.6 TS 编写与上传（已按实测修正）**、§6.7 定时触发器）、§5 数据模型、§11.3 安全与风控。
2. `/Users/duan/Desktop/Decide/docs/Skyline兼容清单.md` §3（§3.1 云函数链路、§3.2 云存储、§3.3 内容安全）—— 全部是本轮实测结论。
3. 冻结的契约：`src/types/cloud.ts`（**CloudContract 是唯一契约**，action 名与入参出参逐条对应）、`src/types/api.ts`（`ApiResult`/`PageResult`）、`src/types/models.ts`、`src/constants/error-code.ts`（错误码数值）、`src/constants/plan.ts`（`Limit`、状态枚举）。你的实现必须与这些一致；**不许改这些文件**。

### 已实测确认的事实（直接采信，不用再验）
- `wx-server-sdk` 用 **`^4.0.2`**（npm latest）。教程里的 `~2.6.3` 类型更残缺，不要用。
- 类型缺陷要在边界断言一次：`openapi` 是 `Record<string, any>`；`cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })` 报 symbol ≠ string；database 的 `add/get/count/remove` 返回 `string | void | IXxxResult` 联合，await 后必须断言成真实结果类型；SDK **没有 `dropCollection`**。
- 云函数 tsconfig：`rootDir: "src"` + `outDir: "."` 时**必须用 `"files": ["src/index.ts"]`，不能用 `include`**（outDir 会被 TS 加进默认 exclude，报 `TS18003 No inputs were found`）。
- 运行时 Nodejs16.13，默认超时仅 3s（`config.json` 的 timeout 经 CLI 部署不生效，需控制台改）—— 所以**代码要按 3s 能跑完来设计**：批量操作分片、单次最多 100 条、别在请求路径里做聚合统计。
- 数据库能力已验：`createCollection`、`add`、`where+orderBy+limit+get`、`count`、`doc.remove`、`serverDate()`、`startTransaction`+`update`+`commit` 全部可用。**索引 SDK 建不了**（控制台手建），所以唯一索引只能当兜底，业务层要自己防重。
- 集合名不能以下划线开头，≤96 字符，仅字母/数字/下划线/连字符。
- 内容安全：`security.msgSecCheck` v2 可用（`{version:2, scene, openid, content}` → `result.suggest`）；`security.imgSecCheck` v1 仍可用（同步，传 Buffer）；`security.mediaCheckAsync` v2 提交可用（传云存储临时 URL，结果异步消息推送，**回调链路尚未配置**）。
- 云函数侧 `cloud.downloadFile({fileID})` 的 `fileContent` 是 Buffer；`cloud.getTempFileURL` 返回带签名 https URL。
- `cloud.getWXContext().OPENID` 是 openId 的唯一可信来源，**永不信任前端传入的 openId**。

### 你的所有权（只能在这些路径下建/改文件）
`cloudfunctions/**`（工程根下新建，不在 `src/` 里）

### 冻结文件：绝对不要修改
`package.json`（工程根的）、`tsconfig.json`（根）、`src/**` 全部、`docs/**`、`技术方案.md`、`.gitignore`、`vite.config.ts`。另外 3 个 agent 正在 `src/` 下并行工作。

### 交付内容
按 §4 目录结构与 §6.1「一个业务域 = 一个云函数」：
1. `cloudfunctions/common/` —— 公共模块（各函数以 `"common": "file:../common"` 引用）：
   - `src/router.ts`：`createRouter(handlers)` → 解析 **线格式 `{ action: string, payload: object }`**（前端 `src/api/request.ts` 就是这么发的：`action` 用去掉域名前缀的短名，业务参数全在 `payload` 里）、参数校验、try/catch、统一返回 `ApiResult`、统一日志（openId/action/耗时）。
   - `src/auth.ts`：`getOpenId()`（只从 `cloud.getWXContext().OPENID` 取）、`assertAuthor(plan, openId)`。
   - `src/errors.ts`：`BizError(code, message)`，错误码数值与 `src/constants/error-code.ts` 完全一致。
   - `src/validate.ts`：`required / maxLen / inEnum / isImageFileID / arrayMax` 轻量规则。
   - `src/dao/`：`planDao`、`voteDao`、`commentDao`、`userDao`、`counterDao` —— **唯一 `db.collection()` 出口**，封装查询构造与字段裁剪（`field()`），列表查询绝不返回 `blocks`（§5.2 的 `summary` 就是为列表页准备的）。
   - `src/ratelimit.ts`：写操作 5 次/10s 限流。
   - `src/security.ts`：文本走 `msgSecCheck` v2、图片走 `mediaCheckAsync` v2（提交即通过，标记「先发后审」，回调链路留待控制台配置），命中 `suggest !== 'pass'` 抛 `BizError`。
2. `cloudfunctions/user/`、`plan/`、`vote/`、`comment/` —— 每个含 `package.json`（`main: index.js`、`dependencies` 里 `wx-server-sdk@^4.0.2` 与 `"common": "file:../common"`）、`tsconfig.json`（用 `files`）、`config.json`（`permissions.openapi` 声明用到的接口 + `timeout` + `memorySize`）、`src/index.ts` 与 `src/handlers/*.ts`。action 必须精确覆盖 CloudContract：
   - user：`login`、`updateProfile`、`stats`
   - plan：`create`、`update`、`remove`、`detail`、`list`、`myList`
   - vote：`submit`
   - comment：`create`、`list`、`remove`
   - **`plan.stats` 不做**：我的页统计已由 `user.stats` 承担（§6.1 与 §6.4 原本冲突，我已裁决归 user 域）。
3. `cloudfunctions/scheduler/` —— §6.7 定时触发器：每分钟把 `status=1 && deadline>0 && deadline<=now` 置为 `status=2`（单次最多 100 条，循环到无数据，注意 3s 超时要分片）；每天 04:00 计数对账（重算 `votes`/`commentCount`）。含 `config.json` 的 `triggers` 定时配置。

### 业务实现要求
- 分页统一游标（§6.5）：列表游标 = `createdAt + _id` 组合，排序 `createdAt desc, _id desc`；评论游标 = `seq` 升序。游标对前端是**不透明 string**，编码/解码都在云函数内完成。`pageSize` 默认 10、上限 20。
- 投票（§5.3 + §8.3 数据一致性）：`votes` 用 `planId + openId` 逻辑唯一（数据库唯一索引由控制台后建，代码要自己查重）；改票时**在一个事务里**改 `votes.type` 并反向调整 `plans.votes` 计数；重复投同一票返回 code 3003。
- 评论 `seq` 自增用 `counters` 集合（`{ _id: 'comment:{planId}', value }` + `_.inc(1)` 读回），并更新 `plans.commentCount`。
- 软删除：`plans.status=3`、`comments.status=1`，列表查询一律带 `status in [1,2]`（计划）/ `status=0`（评论）。
- 服务端二次校验所有上限（§11.3）：图片 ≤3、选项图 ≤1、标题 ≤40、选项名 ≤20、评论 ≤500、选项数 ≤10、`deadline` 必须在未来且 ≤1 年。用 `Limit` 常量的数值，但**不要 import `src/` 下的文件**（云函数解析不到），在 `common` 里镜像一份并注明「与 `src/constants/plan.ts` 保持同步」。
- 计划创建/更新时由 blocks 生成 `summary`（纯文本前 60 字）。

### 工作方式
- **类型解析**：在 `cloudfunctions/` 下装一份共享的 `wx-server-sdk` 供所有函数的 tsc 解析（建一个 `cloudfunctions/package.json`，`private: true`，devDependencies 里放 `wx-server-sdk@4.0.2`，然后 `cd cloudfunctions && npm install`）。**不要在工程根 `npm install`，不要改根 `package.json`**。`.gitignore` 已经忽略 `cloudfunctions/**/node_modules/`。
- **编译验证**：每个函数目录内跑 `../../node_modules/.bin/tsc -p tsconfig.json`（或 `cloudfunctions/node_modules/.bin/tsc`），要求**零错误**。
- **绝对不要部署**：不要跑 `cli cloud functions deploy`、不要碰云环境、不要建集合。部署与真机验证由我统一做。
- 不要 `git add`/`git commit`（我统一提交）。不要跑 `npm run dev:*` / `build:*`（会重写 `dist/`）。
- 禁止 `any`（边界断言用具体接口，不要用 `any` 兜）；注释只写「为什么」，尤其是 3s 超时约束、事务边界、游标编码这几处。

### 汇报（300 字以内）
目录与文件清单、每个函数的 tsc 编译结果、你在契约之外做的决策（尤其游标编码格式、限流实现、security 的「先发后审」策略）、需要我裁决或需要在控制台配合的点。不要粘贴大段代码。
