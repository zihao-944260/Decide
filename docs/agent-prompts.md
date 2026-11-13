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

---

## 8. 第二窗口重拉增补（2026-11-12 14:00，必须随上面三节一起下发）

第一窗口的 A/C/D 随宿主会话一起消失。重拉时磁盘现状：A 已有 8 个 base 组件与改过的 `tokens/mixins.scss`；**C 与 D 零产出**（`src/composables/` 不存在，`cloudfunctions/` 只有共享 `package.json` + `node_modules`）；B 已完成并被主 agent 验收。

### A · 增补
- **续做，不重做**：已有的 `BaseNavbar`/`BaseButton`/`BaseImage`/`BaseAvatar`/`BaseCell`/`BasePopup`/`BaseActionSheet`/`BaseModal` 整体可用，**禁止重写**；只补 `BaseToast`/`BaseEmpty`/`BaseSkeleton`/`BaseLoadMore` 四个，风格与 tokens 引用方式必须与已有的对齐。
- 点名修两个 `type-check` 错误：
  1. `src/components/base/BaseCell/index.vue:5` — `TS6133 'props' is declared but its value is never read`。
  2. `src/components/base/BaseNavbar/index.vue:22` — `TS2339 Property 'left' does not exist`。冻结的 `src/stores/app.ts:20` 里 `menuButtonRect` 故意只有 `{top,height,right,width}` → 用 `rect.right - rect.width` 推左边缘，**不许给 store 加字段**。
- `styles` 只补缺口，不重构已有 token 命名（8 个组件在引用）。

### C · 增补
- 从零做，无需迁就历史代码。
- **B 的 `src/api/*` 与 `src/stores/{user,plan}.ts` 已真实落盘**：直接读文件按真实导出对齐，不要再靠本文件 §B 节的签名约定猜。
- 补一条实测教训：`src/stores/user.ts` 的 1002 handler 曾因走默认去重而自等待成环。**在任何 request 调用栈内部再次发起同类调用，必须显式传 `noDedupe: true`。**

### D · 增补
- 从零做。`cloudfunctions/package.json`（`wx-server-sdk@4.0.2` + `@types/node@^16`）与 `node_modules/` **已装好，不要再 `npm install`**。
- **编译命令纠正（上面 §D 原文的 `../node_modules/.bin/tsc` 与 `../../node_modules/.bin/tsc` 两种写法都要核对）**：从 `cloudfunctions/<fn>/` 出发，**只有 `../../node_modules/.bin/tsc`（工程根）存在**。`cloudfunctions/node_modules` 那层只装 `wx-server-sdk` + `@types/node`，**没有 typescript**，所以 `../node_modules/.bin/tsc` 会直接 `no such file`。完整命令：
  `cd /Users/duan/Desktop/Decide/cloudfunctions/<fn> && /Users/duan/Desktop/Decide/node_modules/.bin/tsc -p tsconfig.json --noEmit`
- **剩余分工**（D 撞 150 轮上限被强杀后拆两路并行）：D1 = `cloudfunctions/plan/**`（`tsconfig.json`、`config.json`、`src/handlers/helpers.ts` 已就位，只缺 `src/index.ts` 与 6 个 action handler）；D2 = `cloudfunctions/{vote,comment,scheduler}/**`（vote/comment 只有 package.json + tsconfig，scheduler 只有 package.json，`config.json` 要自建）。两路都被禁止改 `common/**` 与 `user/**`；缺 helper 就在自己目录内私有实现并汇报，由主 agent 统一决定是否上提 common。

### 全体 · 增补
- **v1 不做取消投票**（主 agent 裁决）：`VoteTypeValue` 只有 `1|2`，技术方案 §8.3 的 `type: 0` 措辞已删除。前端不要造取消入口，云函数不要实现 `type=0` 分支。

---

## 9. 阶段 3 业务组件（E1/E2/E3，2026-11-12 14:30 下发）

> 依赖面已稳定：A（12 个 base 组件）、B（`api/*` + `stores/{user,plan}`）、C（`utils/*` + 13 个 composable）全部验收，D1/D2 只在 `cloudfunctions/**` 写盘，与 E 路零交集。

### 三条线共用的约束（本节相对 A/B/C/D 的增量，必须逐条下发）

- **冲突面是全新的**：三条线同时往 `src/components/business/` 写。因此
  1. **禁止创建/修改任何共享文件**，含 `src/components/business/index.ts` 这类桶文件（三路同写一文件必然互相覆盖）。页面层 import 一律走完整路径 `@/components/business/Xxx/index.vue`。
  2. **`npm run type-check` 会被兄弟 agent 的半成品污染**，所以自检形式固定为 `npm run type-check 2>&1 | grep -E "<自己目录的正则>"`，期望无输出；别人路径的报错一律忽略、不碰、不 import。
- 各自只拥有 prompt 里点名的目录，每目录 `index.vue` + `types.ts`（复杂组件加 `README.md`）。
- 禁改清单：`src/{styles,composables,api,stores,types,constants,utils,pages}/**`、`src/components/base/**`、`src/pages.json`、`cloudfunctions/**`、`package.json`、`shared/**`、文档。缺口一律**上报**，不许自己动手 —— 尤其禁止为了迁就渲染去改 `utils/blocks.ts`。
- 复用不重写：倒计时走 `useCountdown`、投票走 `useVote`、分页走 `usePagingList`、内容切分走 `utils/blocks.ts`、提示走 `useToast`。组件里出现第二个 `setInterval`、`wx.cloud`、裸 `wx.showToast` 都算错。
- 命名冲突预警：`CommentItem` 组件与 `types/models.ts` 里的 `CommentItem` interface 同名，必须 `import type { CommentItem as CommentDTO }`。
- 约定同前：Skyline（文字包 `<text>`、禁 `inline-block`/`line-clamp`/`list-view`/`sticky-*`、BEM 单类名、绝不对 `scroll-view type="list"` 做测量）、tokens 化样式、88rpx 最小点击高度、`defineProps/defineEmits` 无 any。

### E1 · 列表四件套 `ageneral-purpose-e2c862c7645c2198`

`CountDown`（T3.1，薄壳包 `useCountdown`，按 `level` 切样式，归零置灰）· `VoteRatioBar`（T3.2，0 票空态不许 NaN，`transition` + `animated` 降级）· `PlanCard`（T3.3，§8.5 布局，摘要**只做单行 ellipsis**（云端已截 60 字），封面只有 `cover` 一张（见协作记录 §5 裁决 1），比例与我的投票态**优先读 `planStore.voteCounts[planId] ?? summary.votes`**，这是 §10「详情投票后返回列表即时同步」的落点，用 computed 不用 watch）· `PlanList`（T3.4，props 注入 `PageFetcher<PlanSummary>`，可透传 `seed/onPage`，`scroll-view type="list"` + 骨架/空态/`BaseLoadMore` + `refresher`，`defineExpose` 出 `reload/refresh/patchItem/removeItem/appendItem`）。页面编排（T3.5）由主 agent 接。

### E2 · 详情内容四件套 `ageneral-purpose-20d9f6a160932014`

`ContentRenderer`（T3.6，四块型渲染，必须复用 `utils/blocks.ts` 的切分，图片用 `BaseImage`，预览只允许 `wx.previewImage`）· `OptionCardList` + `OptionCard`（T3.7，选项 < 2 或开关关闭整块不渲染，保持云端顺序不本地重排，名称 20 字单行 ellipsis）· `VoteActions`（T3.10，直接用 `useVote` 的 `myVote/counts/total/voting`，`isAuthor` **整块隐藏**而非禁用，`closed` 置灰，`voting` 期 loading 防重复点）。

### E3 · 评论三件套 `ageneral-purpose-2ea978672c395391`

`CommentItem`（T3.8，`CommentStatus` 已删除/被拦时灰色占位但保序，自己可删只发 `delete` 事件由外层调 api，内容不截行数用自然多行）· `CommentList`（T3.8，按 `useComments` 的真实形状选一种最省的接线方式并在 README 写清页面层怎么接，触底加载用 `scrolltolower`，不得每条评论挂 observer/定时器）· `CommentInput`（T3.9，`position: fixed` 吸底而非 sticky，`maxlength` 取 `Limit`，键盘避让不许碰选区 API，收起要复位且可被外层关掉，提交中禁重复点）。

### 重拉提示（E 路）

- E 路任何一路被强杀/失联时，先看 `src/components/business/<该路目录>` 是否落盘，再跑 `npm run type-check` 判断能否留用 —— 与 D 路同一条教训。
- 三条线都不许改 `技术方案.md`；已裁决的两处文档/契约分歧（列表只有 `cover`、`FilterTabs` 四个 tab）已写进技术方案，agent 无需再问。

## 10. 阶段 3 页面编排（F1/G1，2026-11-12 15:05 下发）

> 前置：E1/E2/E3 11 个业务组件全部验收（§4.7~§4.9），D4 打包链路验收（§4.10）。派发前主 agent 先把三件共享活做完：`pages.json` 两条路由、两个占位页、`App.vue` 冷启动静默登录。**页面是天然的冲突面（`pages.json` 只有一份），所以这一阶段每路只给一个页面目录。**

### 两路共用的约束（相对 §9 的增量）

- **所有权精确到一个页面目录**：F1 只写 `src/pages/home/**`，G1 只写 `src/pages/plan/detail/**`。`src/pages.json`、`src/components/**`、`src/composables/**`、`src/api/**`、`src/stores/**` 一律禁改，缺口只上报。
- 自检固定为 `npm run type-check 2>&1 | grep <自己路径>`；另一路在飞，别人路径的报错必然出现，不许管、不许修。
- 生命周期不许自己写 `onShow/onHide`、不许自己调 `pauseTick/resumeTick`：`usePageRefresh` 已经把这些收在里面（含 60s 新鲜度与 `invalidatePage` 跨页失效）。**这是最容易写成两份的地方，两路 prompt 里都单独点了一遍。**
- 路由与 query 约定：详情 `/pages/plan/detail/index?planId=<id>`，发布 `/pages/plan/edit/index`（T4.11 才实现，现在是占位页）。参数名 `planId` 是两路之间的唯一契约，写死在 prompt 里。
- 本轮明确不做：`share-element` 跨页转场（M0 真机项，两路各自发明会分叉）、首页长按管理（属 T5.6）、详情页自投提示文案（§8.3 已裁决不显示）。
- 提示只走 `showToastMsg`；`api/request.ts` 已统一 toast 过一次，页面再弹就是两条（`CommentInput` 的 `publish` 必须带 `toast: false` 就是这个原因）。

### F1 · 首页 `ageneral-purpose-e0c65db4943d8f3a`

T3.5：`PlanList` 注入 `fetcher`（**api 的 `PageQuery` 是对象、`PageFetcher` 是位置参数，必须写适配**）+ `seed`/`onPage` 接 `planStore.home`/`setHomePage`；`BaseNavbar` 的 `right` 插槽放消息占位；FAB 是 scroll-view 的兄弟节点、`position: fixed`、`@scroll` 时间戳节流收起态、**明令不用 worklet**（T0 结论 SharedValue 无法经 Vue 模板承载）；`expire` → `planStore.patchPlan(planId, { status: Ended })`，不重拉。

### G1 · 详情页 `ageneral-purpose-37a57b12b81814cf`

T3.11 + T3.12：整页**只有一个** `scroll-view type="list"`，评论区在滚动流内，触底用 `@scrolltolower` 调 `commentListRef.loadMore()`，阈值用组件导出的 `COMMENT_LOWER_THRESHOLD`；`CommentInput` 是它的兄弟节点。首屏 `fetchPlanDetail` 后必须 `applyVoteResult` + `patchPlan` 写回 store，且**不许在卸载时清掉 `voteCounts[planId]`**——返回首页能立刻看到新比例全靠它（T3.12 的验收标准）。`isAuthor` 与 `canRemove` 从 `useUserStore().userInfo?.openId` 派生成 computed（openId 异步晚到，允许先按游客视角渲染）；`canRemove` 注入「本人 || 计划作者」正是 §4.9 缺口 1 留给页面层的活，**不许为此去改 `useComments`**。

### 重拉提示

- 页面级 agent 最容易「自己造一份生命周期管理」，重拉时先 `grep -n "onShow\|pauseTick\|setInterval" <页面文件>`，有命中就说明它绕过了 `usePageRefresh`。
- 两路都依赖 E 路组件的真实形状，prompt 里的 props/emits 清单是从已验收源码里抄的；如果 agent 报告说「签名对不上」，先怀疑它没读 `types.ts`，再怀疑源码。

## 11. 阶段 4/5 组件线（H1/H2/H3/I1，2026-11-12 15:59 下发）

> 前置：F1/G1 两页验收（协作记录 §4.11/§4.12），阶段 3 全部收口。本轮是**组件线不是页面线**：`src/pages/plan/edit/**`（T4.11~T4.13）与 `src/pages/mine/**`（T5.5/T5.6）留给下一轮，因为页面只有一份、且必须先有已验收的编辑器组件形状才能写接线。
> 拆路依据是**依赖方向**而不是数量：`EditorBlockList` 要渲染四类块单元，块单元必须同源，否则宿主与子件的 props 由两个 agent 各发明一套（§10 已经验证过「跨路契约只能有一个字面量来源」这条纪律）。

### 四路共用的约束（相对 §9/§10 的增量）

- **所有权精确到 prompt 点名的组件目录**。`src/components/editor/` 本轮首次创建，四路中三路往里写，所以**目录级隔离**是硬要求：`src/components/editor/index.ts` 这类桶文件禁止创建（同 §9 的 business 桶文件教训）。import 一律走完整路径 `@/components/editor/Xxx/index.vue`。
- 禁改清单（缺口只上报，由主 agent 收口）：`src/{styles,composables,api,stores,types,constants,utils,pages}/**`、`src/components/{base,business}/**`（除自己点名的 business 目录）、`src/pages.json`、`cloudfunctions/**`、`package.json`、`scripts/**`、`docs/**`、`技术方案.md`。
- 自检两条，都只看自己：`npm run type-check 2>&1 | grep <自己目录>` 期望空；`npm run check:templates` 期望全绿（它只报「模板标签找不到对应 import」，是本轮新加的闸，专门堵 `vue-tsc` 在 `strictTemplates` 关闭时静默放过未知标签这个洞）。
- **受控组件**：编辑器四路一律 props in / emits out，**禁止在组件里调 `useEditor()` / `useForm()` / store / api**。状态机只有一个，归页面（T4.11）。唯二的例外：① 上传组件内部可以 `useUpload`（它本身就是一台小状态机，见下条）；② `UserHeader` 可以调 `useUserStore().updateProfile()` —— 它是 business 组件且 §9.1-4 允许，契约里没有别的地方该干这件事。
- 上传只有一个出口：`useUpload`。组件里出现第二个 `wx.cloud`、`uni.chooseImage`、裸 `wx.showToast` 都算错（`useUpload` 是全工程唯一允许直接碰云存储 SDK 的地方，见其文件头注释）。
- 提交门禁的口径提前定死，免得下一轮页面自己猜：**`useUpload.done` 要求「至少一张且全部完成」，配图可为空，所以页面门禁要用 `!uploading`，不是 `done`**。
- Skyline 硬约束照旧且更严：整页唯一 `scroll-view type="list"` 由页面持有，**编辑器组件内部不得再嵌 scroll-view**（嵌套滚动在 Skyline 下未验证）；绝不对 `scroll-view type="list"` 内节点做 `boundingClientRect`/`SelectorQuery`；`textarea` 只允许实测过的属性集 `auto-height / adjust-position / cursor-spacing / hold-keyboard / disable-default-padding / maxlength`（兼容清单 §2.4），**没有选区**，所以没有任何「选中部分加粗」的实现路径；滚动定位只用 `scroll-into-view`。
- 样式：BEM、tokens.scss 变量、`$tap-min-height`、无 `inline-block`/`line-clamp`/伪元素布局。色值不许硬编码 —— 编辑器色板用 `@/constants/plan` 的 `TEXT_COLORS`（本轮主 agent 新加，见下节），别的色用 `$color-*`。
- 每路交付 = 每个组件目录 `{index.vue, types.ts}` + 复杂组件一份 `README.md`，README 必须含**逐字可抄的页面接线示例**（props/emits/expose 全从 `types.ts` 抄，不能写理想签名）。E 路三份 README 是这个标准的样板。

### 本轮新增/变更的共享层契约（写 prompt 时已在盘上，主 agent 15:59 改的）

| 契约 | 位置 | 谁要用 |
| --- | --- | --- |
| `editor.updateImage(id, {fileID,w,h})` | `src/composables/useEditor.ts`（新增） | H2 的 `EditorImageBlock` 上传成功后写回；H1 的 `EditorBlockList` 只透传事件，不碰它 |
| `TEXT_COLORS`（4 项，含 `value:''` 复位项） | `src/constants/plan.ts`（新增） | H2 的 `EditorToolbar` 是唯一生产者；渲染侧只读 `block.color` 写内联 style |
| `onRefresh(ctx: { first: boolean })` | `usePageRefresh` | 下一轮页面；本轮组件无关，别按旧签名接 |
| `planStore.homePage()` / `myPage(filter)` | `src/stores/plan.ts` | I1 不直接用，我的页页面层用 |
| `PlanList` 的 `@scroll` + `PlanListScrollEvent` | `components/business/PlanList/types.ts` | 下一轮页面；I1 **不许**碰 PlanList |
| `toStoreVote(number)` | `@/composables`（useVote） | 页面层 |
| `CommentStatusValue` | `@/constants/plan` | 组件层窄化 |
| `useActionSheet().open(ActionSheetItem[])` | `useActionSheet` + `BaseActionSheet/types` | H1/H3 若用长按菜单，字段名是 `text/desc/disabled/key`，**不是 `label`** |
| `$fab-size` | `src/styles/tokens.scss` | 页面层 |

### 跨路唯一契约：`EditorImageBlock`（H2 实现 · H1 消费）

H1 的 `EditorBlockList` 要在 `type === 'image'` 分支渲染 H2 的组件，两侧 prompt 里逐字给同一段：

```ts
// src/components/editor/EditorImageBlock/types.ts
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

`update` 由宿主透传给页面的 `editor.updateImage(block.id, $event)`。选图/进度/重试全在 H2 组件内部（`useUpload({ max: 1 })`），H1 不知道也不需要知道上传的存在。

### H1 · 编辑器块组件 `T4.2 / T4.5 / T4.7` · `ageneral-purpose-fb589add5cce78ab`

目录：`src/components/editor/{EditorBlockList,EditorTextBlock,EditorQuoteBlock,EditorDividerBlock}/**`。
`EditorBlockList` = 纯渲染容器：`v-for` over `blocks`，按 `type` 分派四个子件（image 分支消费上面的契约），每块外层节点 `:id="'blk-' + block.id"`（页面的 `scroll-into-view` 目标，格式与 `useEditor.setFocus` 写进去的完全一致，**这个字符串两路各写一次就会跳不过去**）。长按 → 只 `emit('long-press', {id,index})`，ActionSheet 归页面。`EditorTextBlock` 是 textarea + `blockStyle()` 内联样式，输入 `emit('input', text)`，字数提示用 `Limit.BLOCK_TEXT_MAX`，禁 `line-clamp`。

### H2 · 图片块与工具栏 `T4.4 / T4.6 / T4.8` · `ageneral-purpose-e2dc0d4353834088`

目录：`src/components/editor/{EditorImageBlock,EditorToolbar,ImageUploader}/**`。
`EditorToolbar` 固定底部（`position: fixed`，是页面 scroll-view 的兄弟节点，组件自己不 fixed 到视口外——它只输出 markup），项：级别 1/2/3、加粗、色板 `TEXT_COLORS`、左/中对齐、插入引用/分割线/图片；`stylable === false` 时样式项**置灰不可点**而非隐藏（隐藏会让工具栏宽度跳动）。
`ImageUploader` = 计划配图九宫格，`useUpload({ max: Limit.IMAGE_MAX })`，超上限的拦截文案由 `useUpload` 内部已弹（组件不再补 toast）；编辑态回填用 `addExisting(fileID)`。

### H3 · 截止时间与选项编辑 `T4.9 / T4.10` · `ageneral-purpose-acc69d9ea4249440`

目录：`src/components/editor/{DeadlinePicker,OptionsSection,OptionEditorCard}/**`。
`DeadlinePicker`：快捷三项来自 `DeadlinePreset`；「自定义」**不许用原生 `<picker>` / `<picker-view>`**（兼容清单没有任何 Skyline 条目，等于未验证），改 `BasePopup` + 两列可点选单元格（日期列 = 今天起 14 天，时间列 = 每 30 分钟一档），选中态由 index 决定，**不测高、不用 scroll-top**。过去时间拦截：日期列只放 `>= now` 的档位，且确认后仍要二次校验 `deadline > now + 60_000`（给云函数留时钟抖动余量）。展示文案用 `utils/format.ts` 的 `formatDateTime`，不许自己拼年月日。
`OptionsSection`：开关默认关，关闭时 `display: none` 折叠**但数据不清空**（§8.6 原文要求），别用 worklet；`OptionEditorCard` 内含单图选择（`useUpload({ max: Limit.OPTION_IMAGE_MAX })`）+ 名称 `Limit.OPTION_NAME_MAX` 实时字数 + 上移/下移/删除。**不新增第三个目录**（§8.6 提到的 `OptionImagePicker` 只是描述，§9.2 清单里没有它）。
优先级：`DeadlinePicker` 先，`OptionsSection` 后；若逼近轮次上限，先交 DeadlinePicker 并在报告里说明 OptionsSection 未完成到什么程度，**不要两头都留半成品**。

### I1 · 我的页三件套 `T5.2 / T5.3 / T5.4` · `ageneral-purpose-f56af70b860e4d23`

目录：`src/components/business/{UserHeader,StatCards,FilterTabs}/**`。
`UserHeader`：未登录态出「点击登录」，已登录态出 `BaseAvatar` + 昵称 + 编辑入口；编辑弹层用微信原生资料能力 `button open-type="chooseAvatar"` + `input type="nickname"`（`BaseButton` 没有 `open-type` 透传，属已知缺口，**禁止为此改 BaseButton**，直接用原生 `<button>` 并写清理由），提交走 `useUserStore().updateProfile()`。`chooseAvatar` 在 Skyline 下没有实测条目 → README 标为待真机复核，且必须有兜底：用户不选头像时只改昵称也要能提交。
`StatCards`：三个数字来自 `useUserStore().stats`（`created/joined/ongoing`），点击 `emit('select', filter)`，filter 值是 `@/constants/plan` 的 `MyFilter` 联合类型，不许自己造字符串。
`FilterTabs`：**四个 tab**（`MY_FILTERS`，已裁决），`view` + flex 等分一行放下，**不做横向滚动**（§8.7 写的「横向滚动」在 4 项下没必要且 `scroll-view` 需 `type` 声明，收益为零）；选中态高亮 + `emit('change', filter)`；缓存语义在 `planStore.myLists[filter]` 与页面，组件不管请求。

### 重拉提示

- 组件线最容易「顺手改共享层」，收拉前跑 `git status --porcelain src` 对照各路的目录授权，越界的改动一律回退到上报。
- H1/H2 之间的 `EditorImageBlock` 契约是本轮唯一的跨路接口：若两路报「对不上」，先信 prompt 里那段字面量，再信源码 —— 与 §10 的 `planId` 同一条处理方式。
- 四路都是新代码，失联时直接看目录是否落盘 + `npm run type-check 2>&1 | grep editor`，不需要像 D 路那样猜「哪些文件已就位」。

## 12. 阶段 4/5 页面波（J1 编辑页 / J2 我的页，2026-11-12 16:35 下发）

组件层（§11 四路）已全部验收，共享层收口见《多agent协作记录》§4.13。本轮把 9 个编辑器件 + 3 个我的页件接成两个页面，**两路零交集**：J1 只写 `src/pages/plan/edit/**`，J2 只写 `src/pages/mine/**`（两个占位页都在，直接替换）。

### 两路共用的约束（相对 §10/§11 的增量）

1. **目录所有权**：只许写自己那一个页面目录。共享层（`src/{composables,utils,stores,api,types,constants,components}/**`、`src/styles/**`、`src/pages.json`）**一行都不许改**，缺口只上报。
2. **一页一目录 + co-located `types.ts` + `README.md`**。README 是下一轮（真机复核、验收、维护）的唯一说明源，必须写：接线逐字片段、门禁谓词及**为什么不是另一种写法**、待真机复核项、上报的共享层缺口。
3. **允许的命令只有** `npm run type-check`、`npm run check:templates`。**禁止** `build:mp-weixin` / `build:cloud` / install / 任何 git 写操作 / 开发者工具 CLI / 云控制台。自检报错只 grep 自己路径，别人的一律不碰。
4. **Skyline 红线**（《Skyline兼容清单》）：无 `inline-block`、无 `line-clamp`、无 `list-view`/`grid-view`/`sticky-*`、无 `scroll-top`、无伪元素/后代/结构伪类选择器（一个节点一个类名 + 平铺 class）、禁 `boundingClientRect`/`createSelectorQuery`（`scroll-view type="list"` 内视口外节点被虚拟化，取矩形**永久挂起**）、`setInterval` 只归 `utils/ticker`。§2.8 那条判定照旧：**清单里没写 ≠ 可用**。
5. **整页唯一的滚动流**是一个 `scroll-view type="list"`；吸底栏是它的**兄弟节点**，由页面 flex 布局钉底，组件自己不 fixed。
6. 上传只 `useUpload`；云端只 `src/api/*`（不出现 action 字面量、不出现 `wx.cloud`）；提示只 `showToastMsg`/`useToast`（失败文案 `api/request.ts` 已统一弹，**不要补第二条**）；色值与尺寸只用 token，不写字面量。

### 本轮新增的活契约（我 16:1x~16:32 落的，prompt 与源码以盘为准）

| 位置 | 形状 | 用途 |
| --- | --- | --- |
| `useUpload` | `uploadLocal(path, meta?) => UploadItem \| undefined` | `chooseAvatar` 这类「路径由外部给」的上传，走 validate + remaining，不再手搓条目 |
| `useUpload` | 导出 `UPLOAD_HINT` / `MAX_SIZE` / `DEFAULT_ACCEPT`；`item.message` 带 `err.errMsg` | 提示文案单一来源；失败原因可分网络/权限 |
| `constants/plan` | `Limit.NICKNAME_MAX = 30`、`MY_FILTER_LABELS` | 昵称限长、四个 filter 的文案 |
| `utils/format` | `countChars(s)`（码点计数） | **`useForm` 的 `max`/`min` 已改用它**：展示截断用 `textWidth`/`truncate`，限长一律码点 |
| `useEditor` | `blurIf(id)` | 页面 `@blur="editor.blurIf"` 直接接，别自己写判等（A→B 快切时 blur 慢一拍会抹掉新焦点） |
| `utils/blocks` | 导出 `LEVELS` / `ALIGNS` | 段落档位取值与 `sanitizeBlocks` 白名单同源 |

### J1 · 编辑页 `T4.11 / T4.12 / T4.13`

目录 `src/pages/plan/edit/**`。发布与二次编辑同一页（`?planId=` 区分）。

**必须先做的模拟器核对（写进 README 的第一条）**：`EditorBlockList` 的 `input(id, text)` 是**双参 emit**。`uni-mp-vue` 的 `__args__` 本来就是数组、设计上支持多参，但全工程已验收页面只走过 0/1 参（`BaseActionSheet` 的 `select(action, index)` 是唯一 2 参先例且从未被页面消费过）。打字后确认页面同时收到 id 与 text；只收到一个就退化成单对象载荷并在 README 记录。

**六条硬契约与陷阱**：
1. **`blk-` 前缀**：页面 `scroll-view` 的 `:scroll-into-view` 绑 `editor.scrollIntoViewId`，而 `useEditor.setFocus` 写的是 `` `blk-${id}` ``，`EditorBlockList` 每块外层 `:id="blockNodeId(id)"` 也是这个前缀。拼错**不报错**，只表现为「聚焦不滚动」。
2. **ActionSheet 归页面且必须有宿主节点**：块容器只 `emit('long-press', {id, index})`（`index` 是未过滤 `props.blocks` 的下标，直接喂 `moveBlock`）。页面 `sheet.open({...})` 之前**必须渲染 `<BaseActionSheet>`** —— 否则 Promise 永不 resolve，表现是「点了没反应」且无任何报错（H3 上报）。`useActionSheet().open()` 的 `actions` 与 `<BaseActionSheet :actions>` 现在是同一份数组（`ActionSheetItem`），不用 map 一层。
3. **提交门禁是三件事，不是一个**：`!imagesUploading`（**不是 `done`** —— 配图可选，`done` 要求「至少一张」，用它就是「没传图永远不能发布」）＋ `!optionsUploading`（`OptionsSection @uploading`）＋ `blocks.every(b => b.type !== 'image' || b.fileID)`（正文图块的上传状态长在 `EditorImageBlock` 内部，契约里没有 uploading 通道；空 fileID 提交会被 `cloudfunctions/common/src/planPayload.ts:39` 整单拒）。失败拦截文案用 `failedIds.length > 0`，别用 `done` 反推。
4. **选项校验必须调 `OptionsSection/types` 的三个出口**：`optionsProblem(list, enabled)`（`''` = 通过）、`firstInvalidOptionIndex(list)`、`optionCardId(id)`（配合 `scroll-into-view` 定位到第一张错误卡）。绕过它们自己判 = 发出一条只有 1 个选项的计划，而 `OptionCardList` 在 `length < 2` 时整块不渲染，用户看不见自己的选项。折叠态用 `v-show`，**绝不清空 `options`**。
5. **草稿 key 会随登录异步改写**（本轮最容易踩的一条）：`draftKey = plan_draft_${owner()}`，而 `owner()` 在 `userStore.userInfo?.openId` 到位前是 `'guest'`（`useEditor.ts:109`）。冷启动静默登录是异步的，所以直接进编辑页时 `draftKey` 会**从 `plan_draft_guest` 翻成 `plan_draft_{openId}`**：只在 `onLoad` 里 `restoreDraft()` 会读到空草稿、把用户上次写的内容丢掉；反之在 openId 到位前 `scheduleDraft()` 会把内容写进 guest 键成为孤儿。要求：`restoreDraft` 挂到「`openId` 到位」这件事上（`watch(editor.draftKey)`），且**只在 `!isDirty` 时重放**，否则会覆盖用户正在写的东西。
6. **截止时间只读不算**：`DeadlinePicker @change` 收到的就是毫秒时间戳，快捷项与档位内部已用 `peekNow()` 校准、过去时间两层拦截都在组件里做完了。页面只把它写进 model，**不要再算一遍 `Date.now() + days`**（倒计时与截止判定全走校准时间，用本地钟会出现「还没到就截止」）。

- 编辑态回填：`plan.detail` → `editor.load(blocks)` + `form` 填 title/images/deadline/options；`isAuthor` 必须是 **computed**（`userInfo.openId` 异步晚到，先按游客渲染再收敛）；非作者进得来就拦停并给明确出口。
- 退出确认：`isDirty` 时返回要 `useModal.confirm`；注意 `onBackPress` 不覆盖 tabBar 切换，README 要写清哪些路径会绕过确认。

### J2 · 我的页 `T5.5 / T5.6`

目录 `src/pages/mine/**`。

1. **`activeFilter` 只有一个真相**：页面一个 `ref<MyFilter>` 同时喂 `StatCards :active` 与 `FilterTabs :active`，否则「卡片高亮 A、列表是 B」。`StatCards` 的 `select` 与 `FilterTabs` 的 `change` 落回同一个 setter。默认 `'created'`，**没有「全部」这个 tab**（`MyFilter` 只有 4 个值，「全部」要 `created ∪ joined` 并集，与游标分页和 3s 超时都不友好 —— 已裁决）。
2. **stats 只有一个来源，但必须刷新它**：数字读 `useUserStore().stats`，页面不 import `api/user`；更新走 `userStore.refreshStats()`（= `user.stats`），挂在 `loadPage` 里。
   **本条是 J2 验收时改写的**：原指令写的是「stats 随 `userInfo` 走，不另发请求」，那是我从 `技术方案.md` §8.7 的一句旧裁决抄下来的、**没有对着云端代码核**。实际链路是 `login.ts:66` 建档写死 `{0,0,0}` → `login.ts:9-10` 明确「登录路径不重算」→ 全云端唯一改写 `users.stats` 的是 `handlers/stats.ts:32`，而它没有任何调用方 ⇒ 三张卡必然与列表条数不一致，T5.3 验收直接失效。J2 上报了这条并给了三个方案，取第三个：`user.stats` 是 read-kind（不占写限流桶）、算完顺手回写库、每次全量重算所以不会像 `$inc` 那样漏一条路径就永久漂移，且不用改云函数（部署是用户审批项）。
3. 列表复用 `PlanList` + `planStore.myPage(filter)` + `usePageRefresh`（它拥有 onShow/onHide、ticker 订阅、过期判定与 `invalidatePage`）；`onRefresh(ctx.first)` 的 `ctx.first` 是首页波之后定下来的口径，照 `src/pages/home/index.vue` 的接法抄，不要自己发明。
4. **未登录**：不发列表请求，`StatCards`/`FilterTabs` 传 `disabled`，登录入口只 `emit('login')` 后走 `userStore.login(..., { silent: true })` —— 不许出现第二条登录链路。
5. **T5.6 长按管理只在「我发起的」里给**：ActionSheet 三项（编辑 / 提前截止 / 删除）。编辑 → 跳 `pages/plan/edit/index?planId=`；提前截止 → `plan.update` 带**完整 payload**（服务端 `validatePlanWrite` 是整单校验，不支持打补丁式改字段）；删除 → `plan.remove` + 写穿 `planStore`（`patchPlan`/移除缓存），让首页与详情页一起收敛。删除是危险操作，必须二次确认。
6. `UserHeader` 是**唯一允许 import store 的 business 组件**（§11 例外②），它的 `updated` 事件页面要接 `invalidatePage('mine')` —— 昵称变了列表里的作者名不重拉就是旧值。

### 重拉提示

- 页面波最容易「顺手改组件」。收拉前跑 `git status --porcelain src` 对照授权：J1 只该出现 `pages/plan/edit/**`，J2 只该出现 `pages/mine/**`。
- 组件的行为如果和 README 不一致，**以源码为准并在报告里指出 README 错**（§11 已裁决过一次「文档里凡出现『已预留/已支持』必须在冻结契约上核对」）；不要为了迁就文档写错代码。
- `build:mp-weixin` 在此之前不会编译这两个页面的组件，所以 §4.13 说的「WXML 生成未验」要到本轮才第一次被真正覆盖 —— 两路禁跑构建，就在各自 README 列一条「集成时首跑必看」。

## 13. J 波收口后的活契约变更 + 自检清单增量（主 agent 归档，未下发过）

J1/J2 回来后共享层由我在无 agent 在飞时改了 8 处，逐项理由见《多agent协作记录》§4.14。**下一轮 prompt 里描述共享层要从这张表抄，不要照 §12 写作当时的样子描述**（§12 是已下发指令的存档，其中的 `useEditor.ts:109` 这类锚点已经整体漂移，故意不改）。

| 位置 | 形状 | 用途 / 注意 |
| --- | --- | --- |
| `BaseNavbar` | `guard-back?: boolean`（默认 false）+ `@back` | 为真时组件只 emit、不 `navigateBack`。**小程序端 `onBackPress` 根本不被调用**，这是 T4.13 唯一可用触发路径；拦不住 iOS 侧滑与 Android 返回键，靠 `onUnload` 落盘兜 |
| `useEditor` | `applyStyleTo(id, patch)`；`applyStyle(patch)` 改为委托它 | 长按菜单作用于**被长按的块**，不是焦点块。条件判定只有一处实现 |
| `useEditor` | `export const DRAFT_DEBOUNCE_MS = 1500` | 页面「只改了 deadline/选项/配图」那条补写路径必须与这里同一个节拍，不许再抄一个字面量 |
| `planStore` | `removePlan(planId)` | 清五个桶 + `delete voteCounts[planId]` + `delete myVotes[planId]`。**不传导到屏幕**，见下面必读 1 |
| `constants/pages` | `PAGE_KEYS` + `PageKeyValue` | `usePageRefresh` 的 `key?: PageKeyValue`、`invalidatePage(key: PageKeyValue \| '*')` —— 类型化是刻意的，传错编译不过 |
| `usePageRefresh` | `runNow()` | 强制刷新。在途那一轮由 composable 自己补跑第二轮，页面**不要**再写 `if (!ran) markStale()` |
| `PlanList` | `empty-action-owned?: boolean` + `@empty-action` | 为真时空态按钮只 emit。默认 false，其余列表页行为逐字不变 |
| `constants/plan` | `TextInput = { CURSOR_SPACING: 16, WARN_REMAINING: 100 }` | 输入组件的**观感**参数，全项目一份。**不进 `Limit`**：`Limit` 是「能不能提交」且与云端同源 |
| `utils/event` | `readInputValue(event): string` | 只认 `event.detail.value`，不读任何 selection 字段（Skyline 下读回来是 -1，§2.4）。别在组件里再写一份 |

### 两条必读纪律

1. **成对写穿（所有列表页）**：`usePagingList.applyPage` 与 `planStore.writeBucket` 各自新建容器、装同一批对象，`patchLists`/`removePlan` 只换桶里那一格 —— **屏幕上看不到 store 的写**。所以 `patchPlan`/`removePlan` 之后必须同时调 `planListRef.value?.patchItem / removeItem`。这条已经写进 `src/stores/plan.ts` 的 `patchLists` 上方注释，接列表页前先读它。
2. **不要复述「mp-weixin 传不过去函数值 prop」**。那句话是我自己写进两份 README 的**未验证推断**，已经被证伪（`PlanList` 早就在跨边界传 `fetcher/seed/onPage/getId` 四个函数 prop 并验收过；《Skyline兼容清单》对此零条目）。需要「组件不 await 外部流程」时，理由是**组件取消不了也打断不了它**，不是平台传不过去。任何这类说法若无兼容清单条目支撑，一律标 §2.8「零实测条目、待真机复核」。

### 自检清单增量

`npm run check:docrefs` 与 `type-check` 同级：**改过任何共享层文件就要跑**。它只读不写、不改代码，报「README 引用的那一行里没有它点名的符号」。本轮它抓到 37 条漂移（共享层插导出导致的行号整体偏移），现已清到 0（127 条引用 / 0 硬错误 / 0 疑似漂移）。这类漂移不报错、不影响编译，只会让下一个读文档的 agent 对着空行怀疑人生 —— 所以它是文档唯一能自动化的一环。

## 14. 验收口径的永久改动：静态全绿不算验收（2026-11-12 起）

前 14 波我把 `type-check` + `check:templates` + `check:docrefs` + `build:mp-weixin` 全绿当成一波做完的依据。这个口径**漏掉了两类真缺陷**，两类都只在程序真的跑起来时才出现：

- `page-container` 单实例限制：编辑页加载即报错，而四个静态检查全绿、产物也合法（§4.15 / 兼容清单 §2.3.1）。
- 传输层 `errMsg` 直接上屏：文案错误在类型层和模板层都不成立，只有截图能看见。

**新规矩（主 agent 的验收步骤，不是 agent 的）**：

1. 每一波我这边收口时，必须跑一次运行时扫描 —— 拉起方式、可用手段与边界全部记在《Skyline兼容清单》§0.2，照抄即可，不要重新摸索端口和选择器。
2. 结论必须贴**报错原文 + 截图**，不接受「我以为它渲染正常」。
3. agent 仍然禁止碰开发者工具 CLI（§11 那条不变）：它们只写代码、报缺口。运行时验证是我的活。
4. 凡是「静态验不了、运行时也没验到」的项，写文档时必须明说没验到，禁止用「已落地 / 已收口」这类完成时态。本轮的弹层开合动画就属于这一类，已在 §4.15 末尾点名。

**还有一条测量上的教训**：用自动化脚本给日志贴「当前页面」标签会错归因 —— tabBar 下上一页仍存活并继续发请求，我据此误报过「我的页把日志打在 `[home]` 下」和「冷启动重复请求」两条不存在的缺陷。**上报缺陷前先确认那条输出到底是谁发的。**


