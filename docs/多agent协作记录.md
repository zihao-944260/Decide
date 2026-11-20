# 多 Agent 协作记录（2026-11-12 16:32 快照 · 阶段 3 与阶段 4/5 **组件层全部收口**：组件 12 + 9 个编辑器/我的页件 + 首页 + 详情页；下一波是 T4.11~T4.13 编辑页与 T5.5/T5.6 我的页）

> 本文件是**跨窗口交接**用的唯一事实源。新开窗口继续开发时：先读本文件 + `docs/agent-prompts.md`（含 §8 重拉增补），再 `git log` / `git status` 核对实际状态。
> 关键事实：**后台 agent 属于发起它的会话**。新窗口不会继承正在跑的 agent，也收不到它们的完成通知；若本窗口仍开着，结果会以通知形式回到本窗口，**不要在新窗口重复拉起同一 agent**。
> 第一窗口关闭后，A/C/D 三路 agent 随宿主会话一起消失。重拉时发现 **C、D 当时磁盘零产出 = 完全没写盘**：agent 失联可以一点产出都不留，所以交接必须以 `git status` 为准，不能信上一份记录里的「运行中」。

## 1. 仓库状态

| 项         | 值                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 仓库       | `/Users/duan/Desktop/Decide`，分支 `main`（2026-11-12 初始化）                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 基线提交   | `d5bb797` chore: 初始化仓库，纳入 T0 预研后的工程基线                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 契约提交   | `7b125a1` feat(contract): T1.1 冻结前后端接口契约与请求单一出口                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 文档提交   | `e15840d` docs: 记录四路并行 agent 的指令存档与跨窗口交接状态                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 工作区     | **仍无任何新提交**（HEAD 还是 `e15840d`）。A/B/C/D/D1/D2/D3/D4/E1/E2/E3/F1/G1 全部已验收但都未 commit——等用户点头。**H1/H2/H3/I1 四路在飞**（15:59 拉起，阶段 4 编辑器组件 + 阶段 5 我的页组件，0 条已验收）；阶段 3（组件 + 首页 + 详情页）已收口，页面层 `pages/plan/edit/**`（T4.11~T4.13）与 `pages/mine/**`（T5.5/T5.6）留给下一轮                                                                                                                                                                          |
| WIP 恢复点 | `/tmp/decide-wip-1430.tar.gz`（拉起 E 路前）→ `/tmp/decide-wip-1505.tar.gz`（拉起 F1/G1 的时刻：已确认快照里 `pages/home/index.vue` 是 10:43 占位、`pages/plan/detail/index.vue` 是 14:58 占位，**两路 agent 尚未写盘**，所以这是干净的阶段 3 终点态）→ `/tmp/decide-wip-1559.tar.gz`（拉起 H1/H2/H3/I1 的时刻，274 条目：阶段 3 全量产出 + 本轮我改的 `useEditor.updateImage` / `TEXT_COLORS`；已确认快照里 `src/components/editor/**` 与 `UserHeader/StatCards/FilterTabs` **均不存在**，即阶段 4/5 起点干净） |
| 云环境     | `cloud1-d2g9acyyhb220d834`；AppID `wx93aa8833f25d90b0`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 2. 冻结文件（所有 agent 与我都不许改，改动需先裁决）

`tsconfig.json`、`src/manifest.json`、`src/main.ts`、`src/api/request.ts`、`src/types/**`、`src/constants/**`、`src/stores/app.ts`、`src/utils/logger.ts`、`shared/**`、`docs/**`、`技术方案.md`、`vite.config.ts`。

**这些是 agent 的禁改清单**（对 agent 而言「冻结」= 完全不许写盘，缺口只能上报）。`package.json`、`src/pages.json`、`src/App.vue`、`.gitignore`、`src/pages/**`、`src/styles/**`、`src/stores/{user,plan}.ts` 也在原文里列为冻结，但它们是本窗口**由我**改过的，逐条裁决如下，改动都在 §4/§5 有出处：

| 文件                                                                                         | 谁改                          | 裁决依据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                                               | D4 + 我                       | 只加一行 `build:cloud`；`esbuild` 暂时靠传递依赖，显式声明留到 ESLint 那一批                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `.gitignore`                                                                                 | D4 + 我                       | 产物治理：`dist-cloud/`、`cloudfunctions/_/\**/_.js                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | d.ts` 通用规则（§4.10） |
| `src/pages.json`                                                                             | 我                            | 页面路由是天然单写点，只能我加：`plan/detail/index`、`plan/edit/index`（§5）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/App.vue`                                                                                | 我                            | T5.1 上半：`wx.cloud.init` 之后加冷启动静默登录（`silent: true`，§5）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/pages/**`                                                                               | 我建占位 → F1/G1 拥有         | 阶段 3 的交付物就是页面；**从「冻结」改成「按 §3 所有权表逐目录放行」**，两路各只有一个页面目录                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/styles/tokens.scss`                                                                     | 我                            | `$ratio-bar-*` 三个专用 token（§4.7）。A 路已收口，禁飞期为零                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/stores/user.ts`                                                                         | 我                            | `login()` 加可选 `options: RequestOptions` 透传，为的就是冷启动那次登录不弹错误 toast（§5）                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/constants/plan.ts`                                                                      | 我                            | 阶段 3 收口：只**加**一行 `CommentStatusValue`（与既有 `PlanStatusValue` / `VoteTypeValue` 同构），既有值与语义一字未动（§4.12）。阶段 4 下发前：**再加 `TEXT_COLORS` 色板**（4 项，含 `value: ''` 复位项），因为 §9.1-5 禁止组件硬编码色值、而色板是 `blocks.color` 这份**数据**的合法取值集合，SCSS 变量在 TS 里读不到，只能有个 TS 侧单点（§11）                                                                                                                                                                                                                     |
| `src/composables/{usePageRefresh,useVote,useActionSheet,index}.ts`、`src/stores/feedback.ts` | 我                            | F1/G1 上报的共享层缺口：`onRefresh(ctx.first)`、`toStoreVote()`、`SheetAction` 删除改渲染侧的 `ActionSheetItem`；C 路早已验收，改动时**无 agent 在飞**（§4.11 / §4.12）                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/composables/useEditor.ts`                                                               | 我                            | 阶段 4 下发前的**唯一一处** composable 变更：新增 `updateImage(id, {fileID,w,h})`。缺口来源是「图片块先以空 `fileID` 落进列表、上传成功后才写回」这条 T4.4 流程 —— 既有 `EditorController` 只有 `insertImage`，没有落定已有块的入口，而 `blocks` 是裸 `Ref<Block[]>`，让页面/组件直接改它会绕过 `ensureTrailingTextBlock` 与草稿 debounce 两个不变量。加在 composable 里而不是让 H2 自己 mutate，是为了让「异步上传回调踩到已被删除的块」这种边界只处理一次（实现里对非 image 块与不存在 id 静默 return）。改动时**无 agent 在飞**，`type-check` 相关文件 0 报错（§11） |
| `src/components/business/**`（E1/E2/E3 的目录）                                              | 我                            | 验收后所有权回到我：PlanList 补 `scroll` 转发 + 组件契约类型，CountDown / VoteRatioBar / CommentItem / OptionCardList / CommentList 的注释与 README 口径修正                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/styles/tokens.scss`                                                                     | 我                            | 第二条 `$fab-size: 96rpx`（FAB 本体与让位区同源，§4.11 裁决 4）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/styles/mixins.scss`                                                                     | 接手前就有（A 路 / 第一窗口） | 删 `ellipsis-n`（兼容清单 §2.2：Skyline 下 `-webkit-line-clamp` 不生效，多行截断只能 JS 截字）、加 `flex-*` / `safe-area-bottom` / `hairline-*`。**本窗口没再动它**，列出来只为让 §1 的 `git status` 逐个对得上                                                                                                                                                                                                                                                                                                                                                         |
| `package.json`                                                                               | 我                            | 第二条 `check:templates`；`esbuild` 显式声明仍与 ESLint 同批（§5）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `scripts/check-templates.mjs`                                                                | 我（新增）                    | G1 那条工具链缺口的替代方案：静态对账模板标签 ↔ import（§4.12）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/Skyline兼容清单.md`                                                                    | 我                            | §1.5 末尾补「`.a.b` 不属于禁用三类」的澄清，防止假平台限制继续流传（§4.11 裁决 6）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## 3. 并行 agent（第二窗口拉起：D1/D2 续做 → E1/E2/E3 组件 → D4 打包 → F1/G1 页面 → H1/H2/H3/I1 阶段 4/5 组件 → J1/J2 阶段 4/5 页面）

| 代号                   | agentId                                                                               | 所有权                                                                                                                                                               | 状态                                                                                     | 接手方式                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A 设计系统             | `ageneral-purpose-bdbb167de7f3b3a3`                                                   | `src/styles/**`、`src/uni.scss`、`src/components/base/**`                                                                                                            | **已交付并验收**，见 §4.1                                                                | 续做完成：12 个 base 组件齐 + 2 个类型错误已修                                                                                                                                                                                      |
| B 服务层               | —（第一窗口已完成）                                                                   | `src/api/{user,plan,vote,comment,index}.ts`、`src/stores/{user,plan}.ts`                                                                                             | **已验收**，见 §4                                                                        | 无需重拉                                                                                                                                                                                                                            |
| C 工具层               | `ageneral-purpose-41914bbbcee1e1b2`                                                   | `src/utils/**`（logger 除外）、`src/composables/**`、`src/stores/feedback.ts`                                                                                        | **已交付并验收**，见 §4.3                                                                | 从零重做完成：2530 行，14 个文件                                                                                                                                                                                                    |
| D1 云函数·plan 域      | `ageneral-purpose-06a107812535f84c`                                                   | `cloudfunctions/plan/**`                                                                                                                                             | **已交付并验收**，见 §4.4                                                                | 6 个 action + `writeShared.ts`，tsc 0 错误                                                                                                                                                                                          |
| D2 云函数·其余         | `ageneral-purpose-358fac6f7fae6768`                                                   | `cloudfunctions/{vote,comment,scheduler}/**`                                                                                                                         | **已交付并验收**，见 §4.5                                                                | 12 个文件，三目录 tsc 各 0 错误                                                                                                                                                                                                     |
| D3 云函数·参与轨       | `ageneral-purpose-13ac9a9b03dd2956`                                                   | `common/src/{constants,paging,dao/participationDao,dao/index}.ts` + `{vote,comment}/src/**` + `plan/src/handlers/{helpers,myList}.ts` + `user/src/handlers/stats.ts` | **已交付并验收**，见 §4.6                                                                | 重建后产物 hash 一致，无手抄漂移                                                                                                                                                                                                    |
| E1 业务·列表           | `ageneral-purpose-e2c862c7645c2198`                                                   | `src/components/business/{CountDown,VoteRatioBar,PlanCard,PlanList}/**`                                                                                              | **已交付并验收**，见 §4.7                                                                | 4 组件 710 行，无越界改动                                                                                                                                                                                                           |
| E2 业务·详情内容       | `ageneral-purpose-20d9f6a160932014`                                                   | `src/components/business/{ContentRenderer,OptionCardList,OptionCard,VoteActions}/**`                                                                                 | **已交付并验收**，见 §4.8                                                                | 被明令禁止改 `utils/blocks.ts` 与重写 `useVote`；这两处由主 agent 修                                                                                                                                                                |
| E3 业务·评论           | `ageneral-purpose-2ea978672c395391`                                                   | `src/components/business/{CommentItem,CommentList,CommentInput}/**`                                                                                                  | **已交付并验收**，见 §4.9                                                                | `CommentItem` 组件名与 `types/models.ts` 同名 interface 已用 import 别名隔开                                                                                                                                                        |
| D4 云函数·打包         | `ageneral-purpose-4f8fd968ae4be963`                                                   | `scripts/build-cloud.mjs`、`dist-cloud/**`、根 `package.json` 的 `build:cloud`、`.gitignore`                                                                         | **已交付并验收**，见 §4.10                                                               | esbuild 单文件 bundle，解掉 `file:../common` 部署死结；主 agent 补做了产物治理                                                                                                                                                      |
| F1 页面·首页           | `ageneral-purpose-e0c65db4943d8f3a`                                                   | `src/pages/home/**`                                                                                                                                                  | **已交付并验收**，见 §4.11                                                               | 15:05 与 G1 同时拉起；上报 6 条共享层缺口，全部由我收口（页面自己一条没碰）                                                                                                                                                         |
| G1 页面·详情页         | `ageneral-purpose-37a57b12b81814cf`                                                   | `src/pages/plan/detail/**`                                                                                                                                           | **已交付并验收**，见 §4.12                                                               | 与 F1 同时拉起、约 21 分钟返回；自己发现「模板用了未 import 的组件而 vue-tsc 不报」并修掉，催生 `check:templates`                                                                                                                   |
| H1 编辑器·块组件       | `ageneral-purpose-fb589add5cce78ab`                                                   | `src/components/editor/{EditorBlockList,EditorTextBlock,EditorQuoteBlock,EditorDividerBlock}/**`                                                                     | **已交付并验收**，见 §4.13（T4.2/T4.5/T4.7，1090 行）                                    | 四类块单元与它的宿主同源，否则宿主与子件的 props 由两路各发明一套；`EditorBlockList` 消费 H2 的 `EditorImageBlock`，契约字面量两侧 prompt 逐字相同（§11）—— **两侧落盘逐字一致，这是本轮唯一真正被验证的跨路契约**                  |
| H2 编辑器·图片与工具栏 | `ageneral-purpose-e2dc0d4353834088`                                                   | `src/components/editor/{EditorImageBlock,EditorToolbar,ImageUploader}/**`                                                                                            | **已交付并验收**，见 §4.13（T4.4/T4.6/T4.8，1521 行）                                    | 唯一被授权使用 `useUpload` 的一路（§11 的例外条款）；色板必须 import `TEXT_COLORS`；`updateImage` 契约依赖我 15:59 的 composable 变更                                                                                               |
| H3 编辑器·截止与选项   | `ageneral-purpose-acc69d9ea4249440`                                                   | `src/components/editor/{DeadlinePicker,OptionsSection,OptionEditorCard}/**`                                                                                          | **已交付并验收**，见 §4.13（T4.9/T4.10，1498 行；**发现一处 uid 计数器缺陷，已由我修**） | 已明令**禁用原生 `<picker>`/`<picker-view>`**（兼容清单在 Skyline 下对它们零实测条目），自定义改 `BasePopup` + 两列可点选；给出「DeadlinePicker 先交」的优先级，避免两头半成品                                                      |
| I1 组件·我的页         | `ageneral-purpose-f56af70b860e4d23`                                                   | `src/components/business/{UserHeader,StatCards,FilterTabs}/**`                                                                                                       | **已交付并验收**，见 §4.13（T5.2/T5.3/T5.4，1183 行）                                    | 与编辑器三路零交集；已裁决 `FilterTabs` 四项用 flex 一行放下、**不做横向滚动**（§8.7 原文那句是为一个不存在的问题引入未验证风险）；`chooseAvatar`/`nickname` 无 Skyline 实测条目，要求 README 标待真机复核 + 必须有「只改昵称」兜底 |
| J1 页面·编辑页         | —（**agentId 未归档**，16:35 与 J2 同时下发；指令原文见 `docs/agent-prompts.md` §12） | `src/pages/plan/edit/**`                                                                                                                                             | **已交付并验收**，见 §4.14（T4.11/T4.12/T4.13，上报 10 条共享层缺口、自己一条没碰）      | 首跑就覆盖了 §4.13 遗留的「编辑器组件 WXML 生成未验」；它抓到的 `onBackPress` 在 mp-weixin 不生效，是本轮最有价值的一条上报                                                                                                         |
| J2 页面·我的页         | —（同上）                                                                             | `src/pages/mine/**`                                                                                                                                                  | **已交付并验收**，见 §4.14（T5.5/T5.6，上报 8 条）                                       | 它把「stats 随 `userInfo` 走」这条**我的旧裁决**顶了回来：`user.login` 不重算 stats，`user.stats` 零调用方 ⇒ 三张卡必然与列表条数不一致。指令已按它改写（§12 J2 第 2 条）                                                           |

> **阶段 3 拆三条线而不是两条**：E2/E3 各自的组件数（4 / 3）看着不多，但 `ContentRenderer` 要吃透 `utils/blocks.ts` 的块解析、`CommentInput` 要吃透 Skyline 的 textarea 限制，都是要反复读源码的活。按 D 路撞 150 轮上限的教训，宁可多开一路，也不让一个 agent 横跨「渲染 + 投票 + 评论」三域。
> **E 路的公共新增约束**（此前 A/B/C/D 没有的冲突面）：三条线同时往 `src/components/business/` 写，`npm run type-check` 会互相污染 → 已要求每条线只 grep 自己路径的报错、别人的半成品一律不碰，并且**禁止创建 `src/components/business/index.ts` 这类共享桶文件**（否则三路同写一文件必然互相覆盖）。页面层 import 用完整路径 `@/components/business/Xxx/index.vue`。**这条纪律在阶段 4 被原样继承到 `src/components/editor/`（见 §11），说明它是通用的，不是 business 目录专属。**

> **阶段 4/5 拆四路的依据是依赖方向而不是数量**：`EditorBlockList` 要渲染四类块单元，所以块单元（含它的图片块契约）同源；工具栏/配图与块容器只通过页面的 controller 相接，可以独立；截止与选项是「表单值的生产者」，与渲染层无关；我的页与编辑器零交集。四路同时往 `src/components/` 写，其中三路同时首建 `src/components/editor/` —— 与 E 路同一条冲突面，所以 §11 把「禁止创建 editor 桶文件」和「只 grep 自己路径的报错」原样重申了一遍。
> **本轮唯一的跨路接口是 `EditorImageBlock` 的 props/emits**：H1 消费、H2 实现，两侧 prompt 与 `docs/agent-prompts.md` §11 给的是同一段字面量。这与 §10 的 `planId` 同一条纪律 —— 跨路契约要么提前定死成字面量，要么就别拆路。

> **D 路撞了 general-purpose 的 150 轮上限被强杀**（原 agentId `ageneral-purpose-34ff0854af3599c7`，174 次工具调用、1342 秒后中断）。这不是设计失败，是**预算规划失误**：云函数全量（common + 4 域 + scheduler）超出单 agent 轮次预算。已拆成 D1/D2 两路并行续做。**教训：以后给 agent 派活前先估量级，一个 agent 只做一件事；被强杀的 agent 会留下可编译的干净半成品，所以重拉前必须先跑一遍 `tsc`/`type-check` 确认哪些能留。**

A/B/C/D 四路的指令原文见 `docs/agent-prompts.md` 对应节；本窗口实际下发的 prompt 在其基础上有 4 处增量，已归档为该文件的 §8，重拉时必须一并带上。**阶段 3 的 E1/E2/E3 是本窗口新写的指令（无历史节），下发要点归档为 §9；F1/G1 页面编排归档为 §10；本轮 H1/H2/H3/I1 归档为 §11 —— §11 还额外记录了「阶段 3 收口后共享层实际长什么样」的九条活契约（`onRefresh(ctx.first)`、`homePage()/myPage()`、`PlanList @scroll`、`toStoreVote`、`CommentStatusValue`、`ActionSheetItem` 化的 `useActionSheet().open`、`updateImage`、`TEXT_COLORS`、`$fab-size`），下一轮页面 agent 的 prompt 直接从这里抄，不要再按源码之前的样子猜。**

## 4. B 路：已验收（含主 agent 的一个修复）

新建 7 个文件：`src/api/{user,plan,vote,comment,index}.ts`、`src/stores/{user,plan}.ts`。签名与要求逐条一致，统一追加可选尾参 `options?: RequestOptions`（透传 `silent/noDedupe`），与冻结契约兼容。保留的决策：

- **votes 覆盖规则**：`applyVoteResult` 无条件覆盖 `voteCounts`（投票响应必然新于列表快照），列表写入只回填尚不存在的 planId，并 patch 已缓存 summary 的 `votes`。
- storage key `decide:user`，TTL 7 天；`logout()` 同时 `planStore.clear()`；`refresh()` = 重放幂等的 `user.login`（契约无 getProfile）。

**集成时修掉一个真死锁**（`src/stores/user.ts` 的 1002 handler）：原来是 `loginApi({}, { silent: true })`，走默认并发去重。若触发 handler 的正是 `user.login` 且 payload 为 `{}`（即 `login()` 不带 profile，或 `refresh()`），去重 key `user.login:{}` 命中的是**自己正在 await 的那个 in-flight promise** → handler 永久等待 → 整条调用链挂死。已改为 `{ silent: true, noDedupe: true }`。

> 通用结论：**任何在 request 调用栈内部再次发起同类调用的 handler（静默重登、token 刷新、兜底重试）都必须带 `noDedupe`**，否则去重表会变成自等待环。这类 bug 不会在 type-check 里暴露，只有读 diff 能发现——这正是验收清单第 2 条「不信自述」的理由。

**已定裁决**：v1 不做取消投票。原始需求只有赞同/反对，改票即投另一票；`VoteTypeValue` 只有 `1|2`，契约不改。`applyVoteResult` 的 `myVote: null` 分支保留但不接入 UI。技术方案 §8.3 与 §12（T2.7/T3.10）的 `type: 0` 措辞已在本窗口删除。

## 4.1 A 路：已交付并验收

新增 `BaseToast`/`BaseEmpty`/`BaseSkeleton`/`BaseLoadMore`（各含 `index.vue` + `types.ts` + `README.md`），12 个 base 组件齐；`tokens.scss` 只追加 5 个 token，未动既有命名。主 agent 独立复核结果：

- `npm run type-check` **全仓 0 报错**（我自己跑的，不是转述）。
- 越层 import 检查：`src/components/base` 下只有 `BaseNavbar` import `@/stores/app`，即 §9.1-4 的唯一例外，未被扩大。
- 禁用项扫描：`inline-block` / `line-clamp` / `::before` / `::after` / `scroll-top` / 后代与子代选择器 **零命中**（`mixins.scss:11` 那处 line-clamp 是注释）。
- 两个类型错误修法经核对无误：`BaseNavbar` 用 `windowWidth - (rect.right - rect.width)` 推胶囊左边缘（等价于原意，且不动冻结 store）；`BaseCell` 不再接 `withDefaults` 的返回值。
- **A 提的问题已答复**：`BaseToast` 保持受控组件，命令式反馈由 C 的 `useToast()` 走 `uni.showToast`；页面若要自定义样式才常驻 `BaseToast` 节点。两者不冲突，按原约束执行。
- **新发现未验项**：A 在 `BaseButton`/`BaseLoadMore`/`BaseSkeleton`/`BaseToast` 里用了 5 处 `@keyframes`（loading 旋转、骨架 pulse、toast 淡入）。T0 兼容清单只实测过 `transition`，**`@keyframes` 在 Skyline 下未实测**。已列入 §7 真机复核；失效后果仅是装饰性（骨架不闪、spinner 不转），不影响功能，暂不改实现。

## 4.2 D 路上半（`common/` + `user/`）：已验收

- `common/` 65 个文件、`user/` 11 个文件，两者 `tsc -p tsconfig.json --noEmit` **零错误**（主 agent 实测，非转述）。
- **编译命令纠正**：必须用工程根的 tsc，即函数目录内 `../../node_modules/.bin/tsc`。`cloudfunctions/node_modules/.bin/tsc` **不存在**（那层只装 `wx-server-sdk` + `@types/node`，没装 typescript），而 `docs/agent-prompts.md` §D 原文写的 `../node_modules/.bin/tsc` 也是错的——两路续做的 prompt 里已明确纠正，§8 也要按此修订。
- `common` 的出口面收在 `common/src/index.ts`，业务函数只 `from 'common'` 不深入子路径；SDK 的类型缺陷全部收口在 `db.ts`（`rowsOf`/`totalOf`/`idOf`/`isDuplicateKeyError`/`isTransactionConflict`…），符合「断言不散落到 action」的要求。
- `plan/` 的 `tsconfig.json`（`files: ["src/index.ts"]`）与 `src/handlers/helpers.ts`（list/myList 共用出参逻辑，90 行）已就位，D1 只补 `index.ts` + 6 个 handler。
- **待我裁决的机制**：D1、D2 都被要求「若 common 缺 helper，就在自己目录内私有实现 + 汇报，禁止改 common」。验收时我统一判断哪些该上提到 common，避免两路同时改公共层互相覆盖。

## 4.3 C 路：已交付并验收

14 个新文件共 2530 行：`src/utils/{ticker,blocks,format,storage}.ts`、`src/composables/`（13 个 use* + `internal.ts` + `index.ts` 桶文件）、`src/stores/feedback.ts`。主 agent 独立复核：

- **测量禁令**：`boundingClientRect` / `SelectorQuery` 在 `src/utils`、`src/composables`、`src/stores` 下**零命中**（只有两处注释解释为什么不用）。滚动定位一律 `scroll-into-view` + 块 id，截断走字宽预算。
- **单定时器**：`setInterval` 只出现在 `utils/ticker.ts:86` 一处；周期取订阅者最小精度、20ms 抖动容差、回调前 `slice()` 复制（订阅者回调里可安全退订）、单 listener 抛错被 try 兜住不冻整页、0 订阅自动停表、`pause/resume` 且 resume 强制广播一次补时。另留了 `tickerSnapshot()` 供验收断言。
- **useVote 的哨兵处理正确**：`NO_VOTE = 0` 只活在 composable 的 `MyVote` 类型里，**从不写进 `planStore.myVotes`**（值域是 `1|2`，回滚到未投时 `delete` 键），也从不向服务端发 `type: 0`。3003 走 `correctFromServer` 静默纠偏，截止走 3002 → toast + 置灰回调。
- `npm run type-check` 全仓 0 报错（我自己跑的）。

**对 C 三个请示的裁决**：

1. **`useUpload` 直调 `wx.cloud.uploadFile`：批准**。它不是 `callFunction`，`request.ts` 的解包/重试/去重语义对它不适用，且 §8.2 本来就把上传划给 `useUpload`。已把「全工程只允许两处 `wx.cloud`：`api/request.ts` 与 `useUpload.ts`」写进技术方案 §3 分层原则。**不新建 `api/storage.ts`** —— 为一个函数加一层转发是多余的抽象。
2. **`NO_VOTE` 哨兵：批准**，见上，实现已正确隔离。
3. **`usePagingList` 的 `seed()/onPage()` 注入方式：批准**。B 的 planStore 没有读缓存的方法，切 filter 不重查这条要在页面侧接线时满足——是我 T3.5/T5.5 的编排工作，不是 C 的责任。
4. **额外发现（无需改动，但要知道）**：摘要有两份实现且语义不同——云端 `common/src/mapper.ts:buildSummary`（含 image caption、空格连接、截 60 字加省略号）是**唯一权威**，因为它写进 `plans.summary`；前端 `utils/blocks.ts:blocksToText`（不含 caption、换行连接）只服务草稿与字数统计。**禁止在编辑器里用 `blocksToText` 预览摘要**，否则与列表显示不一致。

## 4.4 D1 路（`plan/`）：已交付并验收

新增 582 行：`src/index.ts`（注册 create/update/remove/detail/list/myList 六个 action，契约里 13 个 action 至此全覆盖，`plan.stats` 不存在——§6.1/§6.4 的冲突早已裁决归 user 域）+ 6 个 handler + `writeShared.ts`（220 行，create/update 共用写路径）。`tsc -p tsconfig.json --noEmit` **0 错误**（主 agent 实测）。

- **校验顺序是刻意的**：纯本地校验 → 身份可写 → 文本送审（先审后发，命中即 1001，一个字都不落库）→ 写库 → 图片送审（先发后审）。摘要只有 `buildSummary` 一个生成点，与 §4.3 第 4 条对齐。
- **`REVIEW_MIN_LEFT_MS = 600` 这条判断值得记下来**：图片送审要一次 `getTempFileURL` + N 次 `mediaCheckAsync`，一旦顶过 3s，客户端看到的是超时失败 → 用户再发一次 → 多出一条重复计划。宁可这一版图片没送审（warn 留痕）也不能让已经写成功的请求翻车。这是「超时预算」第一次被写进业务时序，不是我原先设想的那样只存在于 common。
- **改了一处上一轮的死桩**：`helpers.ts:assembleJoinedPage` 原来固定返回 `nextCursor:''/hasMore:false`（翻页直接断），现在按 votes 行做 `buildPage`，并且**排序键与游标锚点同源**（都用 votes 的行时间）——上一轮「orderBy 用 A、游标存 B 必然错页」那个坑没有被再次引入。
- **`assertImagesInThisEnv`：批准，且不强制上提 common**。D1 指出 `common/planPayload` 的 `validateBlock` 允许 `https://`，而外链 fileID 拿不到临时 URL → `mediaCheckAsync` 永远审不到 = 审核绕过口。它在 plan 写路径收紧了，而 **create/update 是图片进库的唯一入口**，所以漏洞实际已闭合，暂不改 common 的校验器（改动会波及已验收代码，收益只是纵深防御）。留观：若 T4 出现第二个图片写入点，必须回头收紧 common。
- 私有 helper 裁决：`OPTION_MIN`、`getLivePlan`、惰性截止判定、送审文本/图片拼装**全部留在 plan 域内不上提**（单点使用，上提是提前抽象）。

## 4.5 D2 路（`vote/` + `comment/` + `scheduler/`）：已交付并验收

12 个文件、882 行，三目录 `tsc` **各 0 错误**（主 agent 实测）。

- `vote.submit`（179 行）把 §8.3 五步全放进**一个事务**：读 plans（存在/软删/自投/截止，deadline 只跟 `Date.now()` 比，不信前端时钟）→ 读 votes → 无记录 insert+inc / 改票 update+旧-1新+1 / 同票 3003 不动任何计数 → commit；`isDuplicateKeyError` 与 `isTransactionConflict` 各重试 1 次，重试耗尽后**回读库态按 3003 纠偏**（前端会静默 `correctFromServer`，比弹「服务开小差了」更贴近真实：票其实已经落库了），只有确实查无此票才报 5000。commit 后再回读一次权威计数，失败则回落事务内推算值。
- **计数为什么只有 remove 走事务、create 不走**（D2 的取舍，我认可）：评论插入没有前置条件，原子 `_.inc` 足够；删除有条件（只有 `status` 真从 0 翻到 1 才该减），条件与计数必须同生共死才需要事务。这正是 §5.2「同函数内原子自增 + 每日对账」的原意。
- `comment.list` 保留 `status=1` 的占位行（`CommentStatus.Normal=0 / Removed=1`，与契约和 §5.4 完全一致，DAO 用 `in([0,1])`、`toCommentItem` 抹掉 content）——过滤掉会让时间线中间空出一格，看起来像被篡改。**这条不是分歧，D2 只是不确定 §11.3 的一句话，已确认按契约。**
- `scheduler` 不套 `createRouter` 是**对的**：定时器事件没有 OPENID，套 router 会 100% 返回 1002。它自己做了 `TriggerName → job` 的薄分发，未知事件默认落到 `expire`（每分钟那条、最不能停的一条），异常一律不抛给运行时（抛错会被记失败并触发重试，而这里失败的语义是「本轮没做完」，下一分钟自然接上）；两个 job 都在 `TIME_BUDGET_MS(2200ms)` 内主动收工，都是幂等状态机。`config.json` 两个 cron：`0 * * * * * *`（每分钟）与 `0 0 4 * * * *`（每日 04:00）。
- 已裁决的两点：作者自投 → **2001 拦住**（前端藏按钮挡不住构造请求，作者票会带偏比例条）；对软删计划投票/评论 → **3001**，与已截止的 3002 分开。
- **撞车点见 §4.6**：vote 与 comment 各写了一份逻辑相同的 `private/participations.ts`，而 plan/user 的 `joined` 读的是 votes。

## 4.6 「我参与的」数据源冲突与 D3 派发（主 agent 裁决）

两路各自上报了同一个问题，且**方向相反**：D1 说 joined 走 votes（理由是 common 没有 participations 的集合常量与 dao，且 `user.stats.joined` 已经数的是 votes，列表换源会和统计卡打架）；D2 已经按 §8.7 把 participations **写了两份私有副本**（vote 与 comment 各一份，`_id = openId#planId` 确定性主键、best-effort、一次 get + 一次 set 的 upsert）。

**裁决：participations 是权威源，四处全部接上，两份副本上提 common。** 理由：

1. §8.7 的定义是「投过票 **或** 评过论」，votes 单源天生漏掉只评论没投票的计划——那是这个产品里很常见的一类参与。
2. 「数字打架」是**当前实现**的问题，不是选 votes 的理由：把 `stats.joined` 一起换成 participations，两边自然一致。
3. 排序口径 `lastActionAt desc` 比「我什么时候投的票」更符合「我参与的」这个 tab 的语义，而且它是 §5.4 已经设计好的索引（`openId + lastActionAt(desc)`）。
4. 两份逐字相同、只有注释不同的副本已经是漂移风险本身（D2 自己也写了「两份一旦分叉，joined 的顺序会随最后一个写它的域漂移」）。

D3（`ageneral-purpose-13ac9a9b03dd2956`）的边界与硬要求：拥有 `common/src/{constants,paging,dao/participationDao,dao/index}.ts` + `{vote,comment}/src/**` + `plan/src/handlers/{helpers,myList}.ts` + `user/src/handlers/stats.ts`；**读 participations 必须容错 `isCollectionMissing`**（控制台还没建表，这是当前真实状态，不容错就是上线即 5000）；joined 的**排序键与游标锚点必须同时换成 `lastActionAt`**，不许只换一半；契约零改动（`MyFilter` 四个值、`UserStats` 三个字段不变，只是数据源换轨）；`readPageArgs` 加一个向后兼容的可选 `defaultSize` 以消灭 comment 的私有版本；不许动 scheduler、不许动前端、不许改错误码与业务判定。

> 编排教训：**并行 agent 各自「私有实现 + 上报」的策略会在跨域概念上撞车**（这次是 participations）。它仍然优于让两路同时改公共层，但主 agent 必须在两路都收口后**立刻**派一次收敛任务，否则副本会随后续开发继续分叉。

## 4.7 E1 路（列表侧：CountDown / VoteRatioBar / PlanCard / PlanList）：已交付并验收

4 个组件共 710 行（`src/components/business/{CountDown,VoteRatioBar,PlanCard,PlanList}/`，各带 types.ts 与 README）。验收证据（我独立跑，不信自述）：过滤式 type-check 零报错、Skyline 禁用项扫描零命中、`setInterval` 只在 `utils/ticker.ts` 出现一处、business 目录零硬编码色值。

值得留下的三个实现决策：

1. **`CountDown` 只转发「挂载之后」的归零沿**（`index.vue:19` 的 `mounted` 开关）。`useCountdown` 首次 sync 在 setup 里同步执行，不过滤这一刀的话，一屏 N 张已过期卡片会在首帧广播 N 次 `expire`，页面照做就是 N 次 reload——列表越滚越忙。这类「派生状态的边沿语义」是 agent 自己判断出来的，指令里没写。
2. **`PlanCard` 的票数优先读 `planStore.voteCounts[planId]`，未命中才退回列表快照**（`index.vue:28`）。§10 要求「详情页投票后返回列表比例即时同步」，落点就在这里，且用 computed 派生、不 watch、不副作用。
3. **`PlanList` 不 import api、不 import store**，`fetcher / seed / onPage` 全部由页面注入，`autoLoad` 默认 false（生命周期归页面，`onShow` 要重新校准时钟）。首页与我的页因此能共用同一组件，只差一个 fetcher。

主 agent 在这一路修的两处（都是跨路撞车，不是 E1 的失误）：

- 百分比钳位：E1 在 `VoteRatioBar` 内手写了一份 clamp，E2 同时上报「format.ts 缺公共比例函数」→ 抽 `ratioPercent(part, whole)` 进 `src/utils/format.ts`，VoteRatioBar 迁移；反向比例继续用 `100 - agreePercent`，保证四舍五入后两边铺满整条，不留 33%+66%=99% 的缝。
- 条高借用了 `$space-1/2/3`（E1 主动上报的 token 缺口）→ 裁决：在 `tokens.scss` 加专用 `$ratio-bar-sm/md/lg`，**值不变**（8/16/24rpx），只是把「间距体系调整会误伤视觉尺寸」这条耦合断开。

## 4.8 E2 路（详情内容：ContentRenderer / OptionCardList / OptionCard / VoteActions）：已交付并验收

**本路最重要的一条是我的指令错误。** 下发时我要求「每张选项卡显示该选项票数、点选项卡即对该选项投票」，这与技术方案 §8.6「v1 选项不参与投票统计（仅展示）」以及冻结契约直接冲突——`VoteTypeValue` 只有 `1|2`，`vote.submit` 的 payload 里没有 `optionId`。E2 照做了并把这个冲突作为「契约缺口」上报。**裁决：撤回指令，按 §8.6 重写。** OptionCard 只剩序号徽标 + 名称单行 ellipsis + 可选 16:9 单图预览，OptionCardList 只剩 `options`/`previewable` 两个 prop，无 emit、无投票入口；两个 README 都把这次反转写进正文，免得后来人以为这里「漏实现了 v2 特性」。

> 编排教训：**主 agent 写指令时也会违反已冻结的契约**，而且 agent 一般会照做再上报，不会拒绝。所以「上报冲突」必须是显式要求写进指令的硬约束，否则错误指令会一路做到底。

另两处由主 agent 在源头修掉：

- `imageBlockRatio` 原返回 `h/w`，与 `BaseImage.ratio`（CSS aspect-ratio，`w/h`）单位相反；E2 在组件里取倒数绕过。**在 `utils/blocks.ts` 改成 `w/h`，同时删掉 ContentRenderer 的倒数**——绕过留在组件里，下一个读 blocks 的人会再踩一次。
- `VoteActions` 的 `showRatio` prop 名不副实（它控制的是「显示计数」不是「显示比例」）→ 改名 `showCount`，与 `VoteRatioBar` 的同名 prop 对齐；README 的示例改成 `<VoteRatioBar show-count />` + `<VoteActions />` 并列，并写明 §8.3 里计数只在比例条出现一次。

v1 已裁决不做的两点：BaseButton 没有「赞同绿」变体，赞同按钮直接用 `primary`；已选项二次点击由 `useVote` 直接忽略，UI 不再加第二份拦截、也不弹提示。

## 4.9 E3 路（评论区：CommentItem / CommentList / CommentInput）：已交付并验收

`CommentInput` 359 行是阶段 3 最重的单个组件，Skyline 的 textarea 限制全压在这里。三条硬规则的落点：顶起用 `position: fixed` + `transform: translateY(-Npx)`（不用 sticky；`KEYBOARD_GAP=8`、`CURSOR_SPACING=16`）；`blur` 无条件把键盘高度归零兜底（部分机型不发 `height=0` 的 keyboardchange）；事件只读 `detail.value`，不碰任何 selection API（兼容清单 §2.4）。另外组件自己避让时**强制关掉原生 `adjust-position`**，否则两次位移会叠加。

三个遗留缺口的裁决：

1. `useComments.canRemove` 只判「本人」，没有 §8.4 要求的「计划作者可删」。**缺口属实，但不改 C 路代码**（已验收、且在禁飞期）：`CommentList` 预留了 `canRemove` prop 覆盖，页面接线时由我注入 `isAuthor || isSelf`。
2. 契约里没有 `CommentStatusValue` 联合类型（只有 `CommentStatus` 常量对象）→ 刻意不补，补它要动冻结的 `types/cloud.ts`；组件用 `!== CommentStatus.Normal` 判定已足够。
3. 昵称兜底「匿名用户」只在 `CommentItem` 有一份——grep 整个 business 目录确认无第二份，**不需要抽公共函数**；出现第二份时再进 `format.ts`。

## 4.10 D4 路（云函数打包与产物治理）：已交付并验收

`scripts/build-cloud.mjs`（不是 `.ts`：工程里没有 tsx/ts-node，.mjs 零新增依赖直跑）+ 根 `package.json` 一行 `build:cloud`。流程：清空 `dist-cloud/` → `tsc --noEmit` 逐个检查 common 与 5 个函数（任一失败即中止，D4 用假路径实测过 exit=1 且不产出）→ esbuild 单文件 CJS（`--alias common=cloudfunctions/common/src/index.ts`、`wx-server-sdk` external）→ 原样拷贝 `config.json`、生成只含 `wx-server-sdk` 的部署 `package.json` → 自检（`require("common")` 必须 0 命中 + `node --check`）。

我独立复跑验证的结论：5 个 bundle 的 `require` 只剩 `wx-server-sdk`；`npm run build:cloud` 连跑三次产物 md5 全等（确定性）；scheduler 的两个 timer 与 timeout 在 `config.json` 里逐字保留，没有被脚本重写。

**这一路解锁的是部署死结**：`--remote-npm-install` 只看函数目录内的文件，`file:../common` 在云端根本装不上，`cloudfunctions/vote/node_modules` 本地都不存在。部署 `--paths` 从此指向 `dist-cloud/<fn>`。

主 agent 收尾的三件事（D4 授权边界之外）：

1. 删掉 `cloudfunctions/user/{index.js,handlers/*.js}` 4 个旧 emit 残留；删前删后各跑一次构建，5 个 bundle md5 全等，证明从未参与构建。`.gitignore` 从逐目录点名改成通用规则 `cloudfunctions/*/**/*.js|*.d.ts`。
2. **6 个 tsconfig 把 `"outDir": "."` 换成 `"noEmit": true`**（common 另删 `declaration`），`common/package.json` 的 emit 型 `build` 脚本删除。上面那批残留的成因就是「谁都能跑一次不带 --noEmit 的 tsc -p」，把源头堵死比每次再扫一遍干净。
3. 技术方案 §6.6 改写：「就地编译到 index.js」的旧口径、`build-cloud.ts` 文件名、以及「脚本内置部署重试」的要求都已更正——**部署与重试归主 agent，构建脚本不产生任何云端副作用**。

已知假设（不改，但要记着）：脚本 `import esbuild from 'esbuild'` 依赖 esbuild 由 `vite` / `@dcloudio/uni-cli-shared` 提升到根 `node_modules`（当前 0.20.2）。npm 的扁平安装满足这一点；若将来换 pnpm 或升级后不再提升，需要把 esbuild 显式写进 `devDependencies`（与 ESLint/husky 一起补，避免与运行中的 agent 抢 node_modules）。

## 4.11 F1 路（首页编排 T3.5）：已交付并验收 + 六条共享层裁决

交付物：`src/pages/home/index.vue`（247 行）、`src/pages/home/README.md`（含接线表、Skyline 布局依据、待人工验证 7 条）。F1 另建的 `src/pages/home/types.ts`（只有一个 `ListScrollEvent`）已由我删除——组件契约补上 `PlanListScrollEvent` 之后，页面再留一份同形类型就是第二处真相。

我按磁盘实物验收（不信自述）：页面**没有**自己写 `onShow/onHide`、没有第二个定时器、没有重写骨架/空态/重试；`fetcher` 包装、`seed`、`onPage`、`onError`（只记日志，toast 归 `api/request`）、`@expire` 只写 store 不整表刷新，全部与指令一致；FAB 是 `scroll-view` 的兄弟节点 + `position: fixed`，让位靠 `.home__fab-space` 垫高而不是测量（禁 `boundingClientRect`）。

F1 上报 6 条共享层缺口，一条不落全部由我收口：

1. **`PlanList` 不转发 `scroll`** → 组件的 `emits` 补 `scroll`、内部 `scroll-view` 补 `@scroll` → `triggerEvent`。编译产物核对：`components/business/PlanList/index.wxml` 里 `bindscroll="{{m}}"`、`pages/home/index.wxml` 的 `<plan-list>` 标签上 `bindscroll="{{f}}"`。**顺带查清一条运行时事实**：uni-mp-vue 的 `emit` 编译成 `triggerEvent(name, { __args__: args })`，父级拿的是 `e.detail.__args__` 而**不是原生 event**——所以组件转发的地方只重建 `{ detail: { scrollTop } }`，不透传原始对象，页面声明的形状就是它实际收到的形状。FAB 收起就此从「待命」变「生效」。
2. **`seed` 与 `invalidatePage` 相撞** → F1 用 `reload({ force: list.loaded })` 绕过，能跑但把判据压在组件实例状态上。**裁决：`usePagingList` 的 `force` 语义不动**（「忽略缓存」只能有一个含义），改为 `usePageRefresh` 把「为什么刷新」告诉页面：`onRefresh(ctx: { first: boolean })`，页面写 `reload({ force: !first })`。理由：`loaded` 是**实例级**状态，而一个 PlanList 实例要服务我的页四个 filter 桶，它分不清「这个桶加载过没有」——T5.4 必然踩。
3. **`PageBucket`/`PageResult` 的空桶判据重复** → `planStore.homePage()` / `myPage(filter)`：`list.length > 0 ? bucket : null` 收进 store（返回空对象会被 `reload` 误判成「加载过且为空」）。页面只剩一行转发。
4. **没有 FAB 尺寸 token** → `src/styles/tokens.scss` 新增 `$fab-size: 96rpx`，FAB 本体（width/height）与让位区（`safe-area-bottom($fab-size + $space-4)`）同源，改尺寸不会只改一半。
5. **组件宿主节点的高度链** → 保留页面侧 `.home__list { flex:1; display:flex; flex-direction:column; overflow:hidden }` 兜底。裁决：**不改组件**——`.plan-list` 是 scoped 样式，页面选不到宿主节点，也不该选；若 M0 真机确认组件是虚节点，这几条落在不存在的节点上，无副作用，届时随真机清单一并删。
6. **「Skyline 不支持 `.a.b` 复合选择器」是条错口径** → 兼容清单 §1.5 禁的是后代 / 子代 / 伪元素三类，**没有 `.a.b`**；而 §1.4 的证据本身就是一条复合类选择器（scoped 产物 `.row__label.data-v-6da001a3`），它失效则全项目 scoped 样式一起失效。已在 §1.5 末尾补澄清，并把 `CountDown`、`VoteRatioBar`、详情页三处代码注释改成「工程约定：一个节点一个类名，理由是可预测的层叠，不是平台限制」。这条与 §5 那条「假事实」教训同源：**引用约束前先回到证据文件核对一次。**

验收证据（全绿，均为我本机实跑）：`npm run type-check` exit=0；`npm run check:templates` 28 个 .vue 全绿；`npm run build:mp-weixin` exit=0 且**零告警**、四页齐全；`npm run build:cloud` exit=0，5 个 bundle 字节数与 D4 验收时逐字相同（前端改动不碰云产物）。待人工验证 7 条写在页面 README（宿主节点高度、下拉刷新头、FAB 与安全区/tabBar、冷启动首屏命中 ref、三条返回路径的刷新语义、滚动逐帧到达与 120ms 节流、本地时钟被改时 FAB 不冻）。

## 4.12 G1 路（详情页编排 T3.11 + 跨页联动 T3.12）：已交付并验收

交付物：`src/pages/plan/detail/index.vue`（583 行）、`types.ts`（80 行，`DetailView` 视图模型 + `EMPTY_DETAIL_VIEW` 兜底）、`README.md`（87 行，结构图 / 接线依据表 / 刻意没做 / 待验项 / 缺口裁决）。

我按磁盘实物核对的硬约束：全页**只有一个** `scroll-view type="list"`（`grep -c` = 1），评论区在滚动流内、`CommentInput` 是它的兄弟节点（fixed，不被虚拟列表回收）；状态分支用 `v-if="ready"` 挂在每个区块上而不是 `<template v-else>` 包多格，**为的是 `scroll-view type="list"` 的直接子节点就是单元格，中间不插 `<block>`**——这条是 §2.3 虚拟化坑的正确规避；生命周期全交 `usePageRefresh`，页面零 `onShow`；`scroll-into-view` 尾部锚点（`scroll-top` 在 Skyline 实测无效，兼容清单 §2.2）；键盘避让靠组件自身 + 页面接 `keyboard-height` 给尾部加高，不叠 `adjust-position`；跨页一致性不清 `voteCounts[planId]`（清了首页就退回进详情前的快照，T3.12 验收标准直接失效）。

我动它的三处，都在收口面上：

1. **`bumpCommentCount` 写穿 store**（原来只改本页 `detail.commentCount`）：首页卡片的「评论 N」读的是 `planStore` 桶里的 `summary.commentCount`，不写穿就要等列表过期重拉才对得上——`patchPlan` 的注释里点名的正是这条场景。
2. **删掉页面本地的 `myVoteOf`**，收成 `useVote.toStoreVote(value): VoteTypeValue | null` 并从 `@/composables` 出口：契约里 `PlanDetail.myVote` 是裸 `number`（云端镜像也返回 number，冻结契约不动），收窄逻辑此前在 `useVote` 与本页各写一份，现在只有一处。
3. 样式注释里那条 `.a.b` 错口径改掉（§4.11 裁决 6）。

G1 上报 8 条缺口，处置见 `src/pages/plan/detail/README.md` §6 的裁决表（`ActionSheet` 两套 item 字段名统一、`toStoreVote`、`CommentStatusValue` 补齐、`canRemove` 保留页面注入、`OptionCardList` 的 `length<2` 与 `optionsEnabled` 在写入侧恒等、`strictTemplates` 不开的替代方案）。

**G1 自己发现并修掉的缺陷值得留档**：`ContentRenderer` 在模板里用了但 `<script setup>` 忘了 import，**vue-tsc 不报**（未开 `strictTemplates`，且 `@dcloudio/uni-app-types` 插件 `Load plugin failed`），运行时静默变成未知标签、页面少一块。我的处置不是打开 `strictTemplates`（插件加载失败时会把全部内置标签判成未知元素，噪音等于没有检查），而是补一条静态对账 `scripts/check-templates.mjs`（`npm run check:templates`）：模板标签必须能对上 import 或内置清单，并用负样例验证它真的会拦（PascalCase 与 kebab-case 两种写法都测）。**这条以后每路页面 agent 的自检都要跑。**

## 4.13 阶段 4/5 组件波（H1/H2/H3/I1）：已交付并验收 + 十条收口裁决

四路 15:59 拉起，各自在 **21 / 23 / 26 分钟**（H2/H3/H1 的 `duration_ms`）后返回，I1 更早；写这一节时是 16:32，全部只写自己的目录（`git status --porcelain src` 逐条对过：`src/components/editor/**` 新增 9 个目录、`src/components/business/{UserHeader,StatCards,FilterTabs}` 新增 3 个，共享层一行没碰）。**四路都上报了共享层缺口而没有自己动手**，这条纪律本轮第一次被完整执行（阶段 3 时 E2 还被我抓到改过 `utils/blocks.ts`）。

验收手段（不采信自述）：`wc -l` 对文件清单 → 全量 `type-check` → `check:templates`（41 个 .vue）→ `build:mp-weixin` → 逐目录 Skyline 禁用项扫描 → **通读 H2/I1 全部源码 + H1 的 `EditorBlockList` + H3 的 `DeadlinePicker`**。

### 我落地的共享层收口（无 agent 在飞时写入，10 项）

1. **`useUpload.uploadLocal(localPath, meta?)`**（I1 缺口 2）。这不是锦上添花：I1 原来的替代写法是手搓 `UploadItem` → `files.value = [item]` → `retry(id)`，**绕过了 `validate()` 和 `remaining()`**，5MB 上限/格式白名单/张数上限三条全部形同虚设，而且是整盘覆盖 `files`。`chooseAvatar` 给外部路径这件事是合理需求，绕过校验不是。配套把 `validate()` 的第二个形参做成可选 `ext`：**无扩展名放行**——`wxfile://tmp_xxx` 一定是图片，按白名单硬拒就等于「头像永远传不上去」。
2. **`Limit.NICKNAME_MAX = 30`**（I1 缺口 3），与云端 `ServerLimit.NICKNAME_MAX`（`cloudfunctions/common/src/constants.ts:59`）同值，已核对。`UserHeader` 的 prop 默认值从 `-1`（不限长）翻成它：**超限不该等用户点完保存才由云端回 1001 告知**。
3. **`MY_FILTER_LABELS` 上收 `src/constants/plan.ts`**（I1 缺口 4），`FilterTabs`/`StatCards` 两处 import 改指 constants，顺带消掉了 business 组件之间那条横向依赖。
4. **`utils/blocks.ts` 导出 `LEVELS`/`ALIGNS`**（H2 缺口 1）。`EditorToolbar` 原来只能自己抄一份档位表；抄的那份与 `sanitizeBlocks` 白名单错开时的表现是「工具栏点得出、块里存不下，草稿恢复静默改回默认」。现在档位**取值**来自 blocks.ts，组件只留 `Record` 文案表（少一个键就编译不过）。
5. **`useUpload` 导出 `MAX_SIZE`/`DEFAULT_ACCEPT` + 新增组合句 `UPLOAD_HINT`**（H2 缺口 2）。「支持 jpg/png/webp，单张 ≤5MB」这句此前在 3 个组件里各抄一遍，改上限就是三条矛盾文案。
6. **上传失败把 `err.errMsg` 写进 `item.message`**（H2 缺口 3）。原恒为「上传失败」四字，页面分不清断网和存储权限。
7. **新增 `utils/format.ts` 的 `countChars()`，并把 `useForm.sizeOf` 从 `textWidth()` 换成它**（H3 缺口 2）—— **本轮最有价值的一条**。`textWidth` 是显示宽度（ASCII 记 0.5），拿来判 `max` 就是「40 字上限实际放行约 80 个 ASCII」：前端过了校验、云端 `maxLen` 按码点判、回 1001，用户看到的是「我点了发布却说字段太长」。规则定死了：**展示截断用 `textWidth`/`truncate`，限长一律 `countChars`**。`OptionEditorCard` 里内联的那份 `Array.from().length` 也改指它。
8. **`useEditor.blurIf(id)`**（H1 缺口 6 的第三种解法）。H1 论证容器判不准这个竞态（`props.focusId` 比同步写的 `editor.focusId` 慢一拍），我认；但让每个页面自己写 `if (focusId.value === id) blur()` 是第二条真相入口，所以收进 `useEditor`——它和 `setFocus` 写的是同一个字段。页面直接 `@blur="editor.blurIf"`。
9. **`DeadlinePicker` 的 `uid` 生成方式（我抓到的真缺陷）**。原码 `<script setup>` 里 `let instanceSeq = 0; instanceSeq += 1`，注释写「同页两个实例前缀必须唯一」——但 setup 函数体每次实例化都从头跑，那个计数器**永远等于 1**，两个实例都是 `dp1`，`scroll-into-view` 会跳到另一个实例的格子上。改 `getCurrentInstance()?.uid`（渲染器分配的全局递增实例号）。**通用教训：想要模块级唯一，`<script setup>` 里的 `let` 一定不对**；我按这条扫了全工程其余 `let`（`emittedFor`/`emittedImage`/`mounted` 三处，都是**应该**按实例独立的，无同类问题）。
10. **两个组件的 hint 改指 `UPLOAD_HINT`**、`clampNick` 注释随默认值改写。

### 裁决「不修」的（附理由，防止下一个人再提）

- **`BaseButton` 不加 `open-type` 透传**（I1 缺口 1）。`@chooseavatar` 必须挂在 `<button>` **节点本身**；套一层组件透传的是属性而不是事件绑定，把事件隔远一个节点的代价大于「外观统一」的收益。I1 现在的原生写法就是正确实现。
- ~~**`WARN_LEFT = 100` 保持两份**（H1 缺口 5）~~ —— **本轮翻案，已收口（见 §4.14-7）**。当时的理由是「只有两个兄弟组件用，漂了最多是引用块比正文块早一点变红；把它塞进 `constants/plan.ts` 是往数据契约层里混 UI 阈值」—— 前半没错，错在后半：真正的判据不是「UI 阈值该不该进 constants」，而是**同一个观感数字有没有第二份真相**。J1 接线时发现 `CURSOR_SPACING` 已经有五份、`readValue` 有四份，同一个坑的规模比 H1 报的大一个数量级，所以现在有了 `TextInput` 这一组（与 `Limit` 分开：`Limit` 回答「能不能提交」，`TextInput` 回答「长什么样」）。
- **`EditorImageBlock.update` 不带 id**（H1 缺口 1）。带 id 就要同时改 H1/H2 两侧已验收的签名，而收益只是消掉容器里那一处内联箭头。§11 的字面量契约保持不动。
- **子件事件仍走双参 `emit('input', id, text)`**（H1 主动偏离 §11，理由成立：容器转发全是具名方法、无每次渲染新建的闭包）。**留一条模拟器核对项**：`uni-mp-vue` 的 `__args__` 本来就是数组、设计上支持多参，但全工程已验收页面只走过 0/1 参（`BaseActionSheet` 的 `select(action, index)` 是唯一的 2 参先例且从未被页面消费）。编辑页冒烟第一件事就是**在块里打字，确认页面同时收到 id 和 text**；只收到一个就退化成单对象载荷。

### 一条被证伪的上报（值得留档）

H3 把「服务端 `validateOptions` 不校验最少 2 个选项，而 `OptionCardList` 在 `length<2` 时整块不渲染」报成**验收级 bug**。核对后**不成立**：`cloudfunctions/plan/src/handlers/writeShared.ts:76` 的 `assertOptionQuota` 早就在 `optionsEnabled` 时抛 `INVALID_PARAM`，且 `create.ts`/`update.ts` 都走 `validatePlanWrite` → 它。H3 只读了 `common/planPayload.ts` 没读 plan 域的包装层。**这条与「不采信 agent 自述」是同一条纪律的另一面：上报的缺口也要在盘上核实，尤其是要据此改冻结契约的那种。**

### 一个验收手段上的坑（以后每波都要防）

`npm run build:mp-weixin` **不会编译没有任何页面引用的组件**：本轮 `src/components/editor/**` 9 个目录全都没有进产物（`dist/build/mp-weixin/components/` 只有 `base`/`business`），所以「构建全绿」在这一轮**对编辑器组件的模板与 SCSS 等于没验**。我的补法：写一次性脚本把 40 个 `.vue` 的 `<style lang="scss">` 逐个喂给仓库自带的 sass（前置 `tokens.scss` + `mixins.scss`，即 `uni.scss` 注入的那两份）→ **0 失败**，token 拼写与 `$space-3 - $border-width-thin` 这类算术全部成立。脚本是 `/tmp` 里的一次性工具，不进仓库（等页面接线后 `build:mp-weixin` 自然覆盖）。**WXML 生成仍未经过验证，直到 T4.11 把这些组件接进编辑页。**

## 4.14 阶段 4/5 页面波（J1 编辑页 / J2 我的页）：已验收 + 八条收口、七条「不修」

两路都只写自己那一个页面目录（`src/pages/plan/edit/**`、`src/pages/mine/**`），共享层一行没碰 —— 上报缺口而不自己动手，这条纪律连续第二轮完整执行。J1 报 10 条、J2 报 8 条。验收手段：全量 `type-check` → `check:templates` → `build:mp-weixin`（**第一次**把编辑器 9 件 + 我的页 3 件接进页面一起编译，§4.13 说的「WXML 生成未验」到本轮才真正覆盖）→ 逐条对盘核实上报 → `check:docrefs`。

### 我落地的共享层收口（8 项，全部在无 agent 在飞时写入）

1. **`BaseNavbar` 新增 `guard-back`**（J1-9，T4.13 的第一条可用触发路径）。根因先说清：`onBackPress` 在 mp-weixin **从来不会被调用** —— 我把 `@dcloudio/uni-mp-weixin/dist` 扫过，没有任何 `ON_BACK_PRESS` 调用点，所以「靠 `onBackPress` 做离开确认」在小程序端是空头承诺（H5/App 才有）。现 `guardBack` 默认 false（首页/详情/我的三页行为逐字不变），为真时组件只 `emit('back')`、不再 `navigateBack`，把否决权交回页面。代价写在页面注释里：干净态的 `leave()` 必须页面自己补。**仍拦不住 iOS 侧滑与 Android 返回键**，那两条只能靠 `onUnload` 落盘 + 下次进入的二选一兜住。
2. **`useEditor.applyStyleTo(id, patch)`**（J1-2）。长按菜单的「设为标题」作用在**被长按的那一块**，而旧 `applyStyle` 只认 `focusId` —— 页面因此第一轮直接没做这个菜单项。现在 `applyStyle` 改为委托 `applyStyleTo`，`isStylable` 判定只剩一处实现；页面长按菜单五项已挂上「设为标题」（`disabled: !isStylable(block) || block.level === 1`，H1 已经是标题就不再给点）。
3. **`planStore.removePlan(planId)`**（J2-2）。从**五个桶**（首页 + 我的四个 filter）摘掉同一条，并 `delete voteCounts[planId]` / `delete myVotes[planId]` —— 计数也清的理由：本 store 不持久化，留着就是永远刷不新的僵尸条目（`absorbSummaries` 只填「尚不存在」的 key，而这条计划再也不会被任何列表返回）。**它不传导到屏幕**：`PlanList` 自己那份 `list.value` 是另一个数组，调用方必须成对调 `removeItem`，这条已写进 store 的必读注释。
4. **`src/constants/pages.ts` 的 `PAGE_KEYS`，而且是类型化的**（J2-3）。只给一张字符串表不够 —— 页面可以传任意 string，拼错静默失效。现在 `usePageRefresh` 的 `key?: PageKeyValue`，`invalidatePage(key: PageKeyValue | '*')`，传错编译不过。真实缺陷一起修掉：详情页 `onVoted` / `onServerClosed` 此前只失效首页，**「我的」滞后到 60s 过期**；参与者数/评论数是列表快照字段、状态一改还要在 ongoing/ended 两个桶之间搬家，所以两条 handler 都补了 home + mine。
5. **`usePageRefresh.runNow()`**（J2-7）。页面原先为了绕开 60s 门禁自己写 `loadPage()`，等于绕过 `refreshing` 锁与 ticker 订阅重做一遍刷新。`runNow` 收进 composable：若上一次刷新在飞，**由它自己补跑第二轮**，保证「调用之后开始的那一次」用的是事件之后的数据 —— 这个「在途那轮用的是旧数据」的处理如果留在页面，每个页面都要抄一遍 `if (!ran) markStale()`（我第一版就是这么写的，自己推翻重来）。
6. **`PlanList` 的 `empty-action-owned`**（J2-5）。空态按钮原先组件自己 `reload({force:true})`，「我发起的」且未登录时这是个死循环（重拉还是空）。新增 `emptyActionOwned?: boolean`（默认 false，其余列表页行为不变），为真时组件只 `emit('empty-action')`，由页面决定是「去发布第一条」。没用 attrs 探测事件监听器 —— 那是依赖编译产物的形状，属于 §2.8 零实测项。
7. **`TextInput` 与 `readInputValue`：重复常量收口**（J1-4，并**推翻 §4.13 那条「`WARN_LEFT` 保持两份」**）。实盘清点：`CURSOR_SPACING = 16` 五份（三个编辑器块 + `CommentInput` + 编辑页）、`WARN_LEFT = 100` 两份、`readValue(event)` 四份。现在分别是 `constants/plan.ts:68` 的 `TextInput` 一处与 `utils/event.ts:17` 的 `readInputValue` 一处。**没进 `Limit` 是刻意的**：`Limit` 回答「能不能提交」（与云端同源），这两个回答「长什么样」，混在一起等于给观感参数一个不存在的数据源。**两处看着像但故意没并进来**：`CommentInput.readDetail` 要整包 detail（`keyboardheightchange` 的 height/duration），`UserHeader.nickValueOf` 返回 `string | null`（null = 事件根本没带值，用来区分「不改草稿」）—— 用 `readInputValue` 替后者会把「没带值」变成「清空昵称」。产物核对：`CURSOR_SPACING:16` 全 dist 只出现一次、`function readValue` 零次、`readInputValue` 定义一处 + 四个消费者。附带把 `DRAFT_DEBOUNCE_MS` 从私有 `DEFAULT_DEBOUNCE` 改成具名导出（草稿防抖是「写盘节拍」，页面 `types.ts` 那份同值副本删掉）。
8. **两条文档裁决：字段分工判据 + 抄例 bug**（J1-1 / J1-3）。`title`/`blocks` 归 `useEditor`、其余归 `useForm`，**判据就是 `EditorExtra = Omit<PlanWritePayload, 'title' | 'blocks'>` 那一行**，不再另写散文规则（散文会漂移，类型不会）；`ImageUploader/README.md` 那份给页面抄的 `EditModel` 里的 `title` 已删，回填改走 `editor.setTitle()`，并补了与编辑页同款的 `validateContent()`。`EditorToolbar/README.md` 的抄例三处 `editor.focusId || undefined` 少 `.value`（`focusId` 是 `Ref<string>` → 恒真值且传出去是 Ref，`insertBlock` 的 `anchor` 恒 -1，**所有插入静默落到末尾**）已全量修正，并把那段里指错的锚点（把 `useEditor.ts:164-172` 说成 insertBlock）改成 `187-194`。

### 裁决「不修 / 推迟」的（附理由，防止下一个人再提）

- **J2-4 `src/api/*` 函数改 `as xxxApi` 命名**：拒绝。现在 `import { fetchPlanDetail }` 在读代码时比 `planApi.fetchDetail` 更靠近云端 action 名，而重命名只影响 8 个调用点、不影响任何缺陷。
- **J2-6 `closeNow()`（提前截止）想绕过 `plan.update` 的整单校验**：拒绝。服务端 `validatePlanWrite` 是整单校验，这是冻结契约；页面必须带完整 payload，打补丁式改字段是云端行为变更，属于用户审批项。
- **J2-8 多端资料同步（另一台设备改了昵称，本机列表不更新）**：v1 不做。需要的是订阅/推送，而 §2.8 里 `watch` 类实时通道零实测条目；现在的口径是 `onShow` + 60s 过期 + `UserHeader @updated` 失效，够用。
- **J1-6 键盘高度数据源（工具栏随键盘抬起）**：不做。`EditorTextBlock` 的 emits 只有 `focus/blur/input/long-press`，页面拿不到 `keyboardheightchange`；要解就得给块组件加一个 `keyboard-height` 事件，而 §11.2 那条验收在「`adjust-position` 是否已经连带抬起吸底条」实测之前不该先动契约。**列为真机核对项**。
- **J1-7 guest 孤儿草稿键（`plan_draft_` 前缀未导出 / 无 `renameDraft`）**：**有意推迟**。键迁移错了就是用户丢内容，比现在「登录后读不到 guest 草稿」这种可解释的残留更糟；且 §5.2 的入口弹窗已覆盖「二次编辑与发布新计划共用一把键」这条。留待真机确认翻转频率后再定。
- **J1-10 图注（`ImageBlock.caption`）写入口**：v1 不做。类型有、`sanitizeBlocks` 保留、云端允许 ≤60 字，但 `EditorImageBlock.update` 只带 `{fileID,w,h}`。现状是「已有 caption 会原样读回并写回、不会丢，只是不能编辑」，这是可交付的降级，不是缺陷。
- **`EditorToolbar` 想要 `setLevel/setAlign/setColor` 三个语义方法**：拒绝（已写进该 README 上报第 2 条）。补丁形状 `applyStyle({level, align})` 的价值就在于组合样式只产生一次 `replaceAt`；拆成三个方法会逼页面连调三次、生成三份中间块对象，还让同一件事有两条路径。

### 一条我自己写错的断言（最值得留档）

我在 `BaseNavbar/README.md` 与编辑页 README 里把「**mp-weixin 传不过去函数值 prop**」当事实写了下来，用来解释 `empty-action` 为什么要 `emit` 而不是接收回调。它**不成立**：`PlanList` 早就在跨组件边界传 `fetcher / seed / onPage / getId` 四个函数 prop 并且已验收，而《Skyline兼容清单》对这个话题**零条目** —— 那是我从「没实测」推出来的「不行」。两处已改写为真实设计理由（组件不该去 await 一个它既取消不了也打断不了的流程），并明确标注原判断属 §2.8 未验证推断。**教训比这条本身重要：我把推断写成事实的地方，下一个 agent 会当事实抄，而且抄得很像。**

### 验收手段的增量：`check:docrefs` 从此进每波自检

本轮共享层新增 4 个具名导出、删掉 11 处重复定义，README 里那些 `useEditor.ts:146` 式锚点**整体漂移**。`npm run check:docrefs` 从 **37 条疑似漂移**清到 **0**（127 条引用、0 硬错误）。这类漂移不报错，只会让下一个读文档的 agent 对着空行怀疑人生 —— 所以它和 `type-check` 一样是「改了共享层就要跑」的项，已写进 §13 的自检清单。

## 4.15 运行时收口波（无 agent 在飞）：模拟器实测取代静态验收

**起因是用户的一句质问**：「我现在在模拟器上都打不开这个项目，页面一直报错，你干了一天都干了什么？让你统筹，你不去看结果吗？」这句是对的。前 14 波的验收口径全是静态的 —— `type-check` / `check:templates` / `check:docrefs` / `build:mp-weixin` 产物对账，**没有一条证据来自程序真的跑起来**。§4.13 我已经发现「build 不编译没被页面引用的组件」，但当时的补救还是静态的（把 SCSS 单独喂给 sass），仍然没打开过一次模拟器。

### 这一波搭的实测回路

`npm run dev:mp-weixin`（监听、未压缩）→ `cli auto --project dist/dev/mp-weixin --auto-port 9222 --trust-project` → `miniprogram-automator.connect()` 收 `console` / `exception` 并 `screenshot()`。产物目录从 `dist/build` 换成 `dist/dev` 是必须的：build 产物 `"minified": true`，报错行号不可读。手段与边界已写进兼容清单 §0.2，后来人直接照抄，别再摸一遍端口和选择器。

### 实测结论：项目能打开，四页都渲染

用户说的「打不开」不成立（成立的是「看不到能跑的东西」）：首页、我的页、编辑页、详情页全部正常渲染 —— Skyline 全局开启、自定义导航、tabBar 图标、编辑器的工具栏/配图/截止时间/选项四段、我的页的骨架与空态、详情页的重试态，截图都在盘上。**唯一的运行时失败是五个云函数从来没部署过**：

```
cloud.callFunction:fail errCode: -501000  FunctionName parameter could not be found
```

`dist-cloud/{plan,user,vote,comment,scheduler}` 五个产物是齐的，缺的只是 `cli cloud functions deploy` 这一步，而这一步是用户闸门（写共享环境），我没做也没法做。

### 静态永远抓不到的两个真缺陷（这一波才浮出）

1. **`page-container` 单实例限制** —— 编辑页加载即报 `[Component] <page-container>: Only one instance can exist.`。`DeadlinePicker` 内一个 `BasePopup`、页面底部一个 `BaseActionSheet`，两个平时都 `visible=false`，但节点从加载起就常驻。兼容清单 §2.3 当年只测了「page-container 能不能渲染」（h=208 ✅），没测「能不能同时存在两个」，于是这条限制在清单外躲了几十波。修法：`BasePopup` 拆 `host`（节点是否存在）/`shown`（是否显示），`visible` 转 true 才挂载、下一帧翻 shown（进场动画路径与原写法完全一致），退场后卸载；卸载以 `afterleave` 为准，另加 `duration + 80ms` 兜底 —— 因为**实测发现关闭 page-container 会让 automator 连接直接断掉**，我无法证明 `afterleave` 一定送达，而它不触发的后果正是节点常驻、限制被重新踩破。已登记为兼容清单 §2.3.1 + `BasePopup/README.md` 的硬约束。
2. **传输层原文上屏** —— 详情页重试态把整条 `errMsg`（callId、trace、文档链接）当成用户文案渲染出来了。根因在共享层 `src/api/request.ts:90`：`new ApiError(5000, err.errMsg || '网络异常', action)` 把「日志该看的」和「用户该看的」塞进同一个字段，而 `toast(error.message)` 和 `errorTextOf(err)` 都读它。修法：`ApiError` 加 `detail` 存原文，`message` 一律给短句，原文改由 `logger.error` 落日志。修后详情页显示「网络异常，请稍后重试」，截图核对过。

### 三条我自己测错的东西（同「不采信自述」一样值得留档）

- **「我的页把日志打在 `[home]` 标签下」不成立**：`logger.warn('home', …)` 在 `src/pages/home/index.vue:50`，那条 warn 是 tabBar 下仍然存活的首页发的，是我那台扫描脚本用「当前导航目标」给日志贴页面标签造成的错归因。
- **「冷启动重复请求 `plan.list`」不成立**：单独 reLaunch 首页只发 1 次；两次是因为前一次的页面实例还没销毁。测量伪影，不是缺陷。
- **「automator 能按 class 选择器驱动 UI」不成立**：Skyline 下类选择器恒空、`attributes('class')` 取不到值，只有标签选择器和 `Element.tap()` 可用（点 `1 天` 档位实测改掉了截止时间并触发了草稿自动保存，这条是真验证）。

### 这一波没能验到的（别当成已验）

弹层的**开合动画与关闭后的状态回落**只验到「关闭后节点确实没有布局盒」；`afterleave` 是否真的触发、长按块菜单与 `empty-action`、`chooseAvatar`、双参 `emit('input', id, text)` 全部仍待手点。**云函数没部署之前，所有数据链路相关的验收项都无法开始。**

### 流程上的永久改动

以后每一波的验收清单末尾必须加一条：**跑一次运行时扫描并贴出报错原文与截图**，静态四项全绿不再算验收通过。这条已同步进 `docs/agent-prompts.md`。

## 4.16 云函数部署波（用户授权后）：五函数全部上云，阻塞收窄到「控制台建集合」

### 部署结果（2026-11-12 19:5x，用户明示授权后执行）

`cli cloud functions deploy --env cloud1-d2g9acyyhb220d834 --paths dist-cloud/<fn> --remote-npm-install --project dist/dev/mp-weixin`，五个全部成功（user 9.6KB / comment 12KB / plan 14.9KB / vote 9.5KB / scheduler 8.1KB）。

**必踩的瞬态**：每个新建函数第一次 deploy 必报 `FailedOperation.UpdateFunctionCode 当前函数处于Creating状态` —— CLI 是「先 create 再立刻 update code」，update 撞上云端初始化窗口。**对策就是等 45–60s 重试同一命令**，不是错误。批量部署时最后创建的函数初始化最慢，要单独再重试。

### 部署后模拟器实测（automator 直调 + 冷启动扫描）

- `FUNCTION_NOT_FOUND` 彻底消失；传输层、函数路由、openId 上下文全部正常。
- **夹逼证明故障在 DB 层**：调 `plan` 不存在的 action 返回 `3001 不支持的操作`（路由 ✓），真实 action（`plan.list` / `user.login`）全部 `5000 服务开小差了`（DB 访问 ✗）。
- 根因：**环境里一个集合都没建**。`plan.list` 走 `plans` 读路径、`user.login` 先读 `users`，集合不存在抛 `-502005`，被 router 的 `toFailure` 掩码成 5000（内部错误只进云函数日志，响应永不带细节——设计如此，[dist-cloud/plan/index.js](../dist-cloud/plan/index.js) `createRouter` catch 块）。
- **解法是 T2.1 的控制台人工步骤**：6 集合（users/plans/votes/comments/counters/participations）+ 索引（users.openId 唯一、votes planId+openId 唯一、comments planId+seq、participations openId+lastActionAt）+ 全部「仅管理端」。SDK 建不了索引，函数里也没写 createCollection，工具侧无替代手段。

### 顺手验到的一条

`user.login` 在集合缺失时同样 5000 —— 说明它**不是**纯写入路径（先读后写），「add 会自动建集合」的猜测对本项目无意义，别再拿它当绕过建表的指望。

### 建集合后的全链路实测（2026-11-12 20:2x–20:4x，全部走通）

用户建完 6 集合后逐项验证，error/warn 全程为零：

- `plan.list` 直调 `code 0`（空列表，2382ms 函数冷启动）；App 自身发起的请求同样成功（debug 级日志 `plan.list 2382ms 0`）。
- `user.login` 直调 `code 0`，新用户落库（openId `oprgZxj9...`，即模拟器身份，非脏数据）。
- 经 `evaluate` 拿 Pinia store 调 `userStore.login()`：`isLoggedIn` false→true 响应式翻转，`user.login 2646ms 0`。
- 首页空态「还没有计划，点右下角发布第一条」+ 缺省插画正常；我的页登录态（「众议用户」默认名 + 编辑资料）+ stats 0/0/0 + 空态「还没有发起过计划」+「去发布第一条」全部正常。

**这轮最大的坑：automator `screenshot()` 是合成器残影**（详见兼容清单 §0.2 新增两行）。reLaunch 后 DOM 早换了，截图连着几分钟回放旧帧，「加载失败，点击重试」的幽灵画面反复出现——它既是 19:44 集合缺失时代的真实终态，也是误导我连续三轮排查的残影。判真伪的唯一办法：选择器探 DOM + 全级别 console 日志。

**真实产品缺口（未修，待用户拍板）**：`App.onLaunch` 的静默登录只跑一次，失败后整个 App 生命周期不自动重试（reLaunch/切页都不触发 onLaunch）——本次模拟器里登录态卡在未登录 1 小时就是这么来的。恢复路径存在（「点击登录」走同一 store 方法，已实测走通）。若要兜底：App.onShow 加「未登录则重试静默登录」，约一行改动。

## 4.17 用户验收反馈波：刘海屏修复 + 登出入口（2026-11-12 21:0x）

用户模拟器实测后点名三个问题，处置如下：

### 刘海屏兼容：`initSystemInfo()` 定义了但全工程无人调用（真 bug，已修）

症状：首页「众议」标题画进刘海黑块、首页「消息」按钮压在胶囊按钮下面、详情/编辑页返回键同样在状态栏底下。
根因：[src/stores/app.ts](../src/stores/app.ts) 的 `initSystemInfo()` 是唯一测量入口，`BaseNavbar` README 写着「页面需先调用过」，但**没有任何页面调用过它** —— statusBarHeight 恒 0、胶囊矩形恒 null，导航栏从 y=0 画起。
修复：`App.vue` 的 `onLaunch` **最前面**统一调用（同步 API，先于一切页面首帧）。BaseNavbar README 同步改为「App 统一调用，页面不许再调」。
验证：修复后 appStore 实测 `statusBarHeight=47、navBarHeight=87、胶囊矩形非空`，两页截图标题/消息位全部正确。**教训与 §4.15 同源：README 写了「调用方必须做 X」的约定，静态检查抓不到没人做 X —— 这种约定要么代码里强制，要么运行时扫。**

### 登出：store 能力早就在，缺的是 UI 入口（已补）

`stores/user.ts` 的 `logout()` 一直存在（清 userInfo/stats/storage + planStore 桶，云开发 openId 无服务端会话可销毁），但全工程无入口。已在「我的」页列表下方补 `BaseCell 退出登录` 行（仅登录态渲染）+ `useModal.confirm` 二次确认（文案进 `CONFIRM_LABELS.logout`）。
已验证：store 路径登出 → isLoggedIn 翻转、列表桶清空、我的页切游客态、登出行随 v-if 消失；语义为「本生命周期保持登出，下次冷启动静默登录以同一 openId 自动回来」。
**未验的最后一环**：BaseCell 内部行 tap 无法被 automator 驱动（组件内部节点不可选，§0.2），`showModal` 确认弹窗也非自动化可点 —— 用户手点一次即可确认。
**新工具坑**：mock 的解除 API 是 `restoreWxMethod`，不是 `resetMockWxMethod`（后者不存在，报错时 mock 仍生效，会静默放行所有真实确认弹窗 —— 解除前别碰删除/截止流程）。

### 富文本「为什么不用三方 npm 包」：不是选择，是 T0 实测的排他结论（无代码改动）

技术方案 §8.1 与风险表已记录实测：Skyline 下微信原生 `<editor>` 能渲染盒子但 `bindready` 永不触发、`EditorContext` 取不到（无法读写内容）；`rich-text` 能渲染但**内联流被打断**（每个行内节点独占一行）；textarea 选区 API 缺失 → 段落级样式。wangEditor/Quill/TipTap 等 DOM 系编辑器与 mp-html（HTML→rich-text 节点）在 Skyline 下没有可用通道，且本产品内容模型是**结构化 JSON 块**（冻结契约 §8.1），不是 HTML。若 v2 要换渲染管线，先做 mp-html 的 Skyline spike 再动契约。

### 顺手收下的验收证据

用户本人在模拟器里发布了一条真实计划（「123123」），首页/我的页卡片、倒计时徽标、赞同/反对/评论计数、「没有更多了」分页脚、user.stats（1/0/1）全部正确渲染 —— **发布→列表→统计的写链路由真人操作闭环**。

## 4.18 富文本迁移 mp-html：用户裁定 + spike 复测 + 渲染层替换（2026-11-12 21:4x）

**用户指令**：「富文本使用现有成熟的npm三方库实现，不要自己写」（连续强调两次）。

**执行顺序**：先 spike 后迁移，绝不在未实测的库上动契约。

1. **spike（`pages/spike/richtext`，测完即删）**：SDK 3.17.6 实测四件事 ——
   - mp-html v2.5.2 块级标签（h2/h3/p/blockquote/ul/li/hr/a/img）**全部渲染正常**；
   - mp-html 行内样本每片段独占一行 —— 它对叶子节点走 `rich-text`（node.vue:76），T0 的内联流断裂**照样继承**；控制组（原生 text 兄弟拼接）同样堆叠，证明这是 Skyline 布局模型而非库的锅；
   - `<editor>` 复测：0×0、bindready 仍未触发，T0 结论维持，编辑侧不动；
   - **CSS 变量桥成立**：`var()` 在组件样式里生效，且**穿自定义组件边界**被 mp-html 的内联样式消费生效 —— tokens 可以喂进第三方组件。
2. **迁移**：`utils/blocks.ts` 新增 `blocksToHtml()`（text→h2/h3/p 每行一标签、quote→blockquote 内嵌 p、image→img 带宽高属性防顶跳、divider→hr；样式全部仍出自 `blockStyle()`，HTML 文本一律 escape）；`ContentRenderer` 重写为 sanitize → 序列化 → `<mp-html>`，tag-style 提供引用外框/分割线/图片圆角，颜色走 `--cr-*` 变量桥；`preview-img/show-img-menu` 关闭、`imgtap` 接 `uni.previewImage`（整组图可滑，失败 toast，行为与迁移前一致）。
3. **静态门**：type-check / check:templates / check:docrefs 全绿；checker 白名单补了 `editor` 内置标签；组件绑定名用 `MpHtml`（对账脚本认 Pascal 形式，Vue 运行时同形解析）。
4. **运行时验收**：详情页跑用户真实计划「123123」，plan.detail/comment.list 全 code 0、console 零错误零警告、正文渲染与迁移前一致。

**教训**：T0 的排除结论有时效性——测于 1.4.23、复测于 3.17.6，且「库 X 不用组件 Y」的推论必须落到源码行（node.vue:76）再验证；平台能力（var() 穿组件边界）清单里没有的，spike 一并测掉，避免迁移时二次踩坑。

**残留风险**：`cloud://` 直进 `<img>` 与 `previewImage` 真机表现仍未验（兼容清单真机复核清单已有同条）；mp-html 懒加载在详情 scroll-view 内的表现待长内容回归。

## 4.19 编辑器按参考样式改造 + automator 能力矩阵 + 设计板导出（2026-11-12 22:xx）

**用户裁定**：给了掘金 @Xchen 的编辑器截图（标题/创建人/详情 三段表单 + 两行图标工具栏 + WYSIWYG），要求「按这个样式实现富文本编辑」。在平台与冻结契约内能映射的全映射了：

| 参考稿控件           | 实现落点                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| B                    | 加粗当前聚焦块（TextBlock.bold）                                                                                          |
| 对齐三条横线 ×2      | 左/居中（右对齐契约 §8.1 没有，不做）                                                                                     |
| H1 / H2 / 正文       | level 1/2/3（字形文本，Skyline 无 SVG/pseudo）                                                                            |
| 四色板               | TEXT_COLORS 空心=默认 + 三实色                                                                                            |
| 引用 / 分割线 / 图片 | 既有 insert 动作                                                                                                          |
| 删除（新增）         | **删当前聚焦块**：`canRemove` prop → `remove` emit → 页面 `onToolbarRemove` → `useEditor.removeBlock`（焦点自动落邻居块） |

**不能映射的（有证据，不是偷懒）**：I/U 斜体/下划线 —— Skyline rich-text 内联流对全库皆坏（§2.4）且契约 §8.1 冻结为段落级；undo/redo/缩进 —— 契约无此通道。已向用户报备。

**实现**（全在 `src/components/editor/EditorToolbar/` 与 `src/pages/plan/edit/`）：工具栏两行重写（行1 B/对齐横条/H1·H2·正文，行2 色板+分隔+四个插入项；`canRemove && !disabled` 才点亮删除）；编辑页两卡合一（标题+计数 / 创建人 / 详情 同卡三段），EditorToolbar 吸底接线。四道静态门全绿：type-check、check:templates 41、check:docrefs 134/0/0、build:mp-weixin。

**miniprogram-automator 能力矩阵（本轮硬换来的，下次直接照用）**：

- **prod 构建 `setupState` 是空的**（inline 模式），不能靠它喂数据驱动页面。
- 类选择器在**页面级** 0 命中，但**自定义组件内部的作用域查询可用**：`page.$('editor-toolbar')` → `.$$('.editor-toolbar__item')` 拿得到元素；两跳 `ebl.$('editor-text-block').$$('textarea')` 也通。
- **组件内部节点的 `tap()`/`input()` 静默无效**（事件不进 handler）；**组件根元素 tap 能真实派发**（`et.tap()` 端到端触发过 insert-quote）。
- 页面级 `textarea.input()` 可用；`mini.callWxMethod('clearStorage')` 可用。
- **原生 `showModal`（草稿恢复弹窗）在截图里不可见且吞掉所有 tap** —— 编辑页自动化前必须先 clearStorage，否则所有交互「看起来坏了」。
- 工具栏状态可 `element.data()` 深挖（minified 键里读类字符串，如删除项是否带 `--off`）。

**运行时证据**：`/tmp/rt/ui-roottap.png`（根元素 tap 全链路插入引用）、`/tmp/rt/clean-title.png`（标题输入 9/40 + 草稿已自动保存）、`/tmp/rt/edit-toolbar.png`（两行工具栏布局）；全程 console 零错误。**留给用户手测**：聚焦块→工具栏点亮、删除按钮 tap（automator 按不了组件内部按钮，编译层绑定已在 dist 产物核对过）。

**设计板导出**（Canvas 预览受工作区边界限制时的兜底配方）：`canvases/decide-ios-redesign.canvas.tsx` 的 Phone 增加 `tab?` prop（tabBar 仅 ①④，②③ 按真实 pages.json 无 tabBar），③ 重写为参考样式编辑器；导出 = 工程自带 `tsc --jsx react` 编译 TSX（type-only import 自动擦除）+ 40 行 DOM 版 `h()` 运行时（style 对象→cssText、驼峰 SVG 属性转 kebab、数字补 px）+ 无头 Chrome `--screenshot`。产物：`/tmp/rt/decide-ios-redesign.png`（全板 1340×1879）、`/tmp/rt/decide-ios-editor-closeup.png`（③ 特写）。

## 4.20 真·单编辑面富文本重写 + WebView 运行时验收（2026-11-12 23:4x，本窗口）

**用户裁定（愤怒原话）**：「你知道什么叫富文本编辑框吗？？？？？有你这样写的吗，多个输入框组成，你糊弄谁呢？……我给你样式了你为什么不按照我的样式实现，有很多三方包能实现你为什么不用」。§4.19 的「多 textarea 拼块 + 段落级样式」被彻底否决。本窗口把正文换成**单一原生 `<editor>`（Quill 内核）真 WYSIWYG 编辑面**，按参考稿样式落地。

**架构（不重新部署云函数）**：

- 原生 `<editor>` 只在 **WebView 渲染页**可用（Skyline 不支持）。故 `pages.json` 给 edit + detail 两页加 `"renderer":"webview"`，全局仍 Skyline（首页/我的页是纯文本摘要，不受影响）。
- 线上契约仍是 `blocks`：已部署云函数 `validateBlock` 对 `block.text` 原样存储（asString 不消毒），所以**行内 HTML 标记直接住在 `block.text` 里**，无损往返。新增桥 `src/utils/richhtml.ts`：`blocksToEditorHtml`（加载→`setContents`）/ `editorHtmlToBlocks`（输入→`useEditor.replaceBlocks`，草稿/计数/提交沿用）。详情侧 `blocks.ts` 的 `cleanInline` 白名单消毒 + mp-html 渲染，编辑=发布一致。
- 行内样式规则：块级（text-align）落 p/h，行内（color/font-weight）必须落 span/strong。Quill 输出 color 为 `rgb(...)`，`COLOR_RE` 同时认 hex 与 rgb/rgba。对齐输出内联 `style="text-align:center"`，桥也认 `ql-align-center` class。
- 图片 temp↔fileID：编辑面显示 https 临时链，blocks/草稿/提交存 `cloud://` fileID，`imgMap` 映射。**云存储调用只在 `useUpload.ts`**：新增 `resolveTempUrls(fileIDs)`（useUpload.ts:66）与 `uploadInlineImage(localPath)`（:85），经 composables 桶导出。
- 工具栏两行页面级，`@touchend.stop` → 编译成 `catchtouchend`（官方保选区写法）。`onFormatTap` 对 bold/italic/underline/strike 用显式 `!isOn(name)` 布尔切换（与点亮态一致、SDK 稳定）。

**automator 能力矩阵更正（本轮硬换来，覆盖 §4.19 的一条）**：

- **WebView 渲染页里 `page.$('#rich-editor')` / `page.$$('.plan-edit__tb-item')` 这类元素句柄拿不到**（整页 DOM 在独立 WebView 上下文，逻辑层元素查询返回 null，`$$` 甚至会挂起超时）。§4.19 说「组件内部作用域查询可用」只对 Skyline 页成立。
- **正确姿势**：一切走 `mp.evaluate()` 在 app 上下文里跑 `wx.createSelectorQuery().select('#rich-editor').context(res=>res.context)` 拿 EditorContext，再 `ctx.setContents/getContents/format/insertText`；视觉证据用 `mp.screenshot()`。EditorContext 是逻辑层 API，webview 页照样可用。
- 工具栏真实 `catchtouchend` 路径在 Skyline 页用 `element.trigger('touchend')` 验过（§4.19）；webview 页改为直驱 `ctx.format(...)`（与工具栏同一 API）证明格式链路。

**运行时验收（本窗口新鲜复跑，SDK 3.17.6 / devtools）**：

- 单一编辑面：截图 `/tmp/rt/rt-relaunch.png` 显示「详情」是**一整块**编辑面（placeholder「写点什么，支持加粗 / 斜体 / 标题 / 对齐 / 插图…」），不再是多 textarea。
- EditorContext obtained: **true**。
- WYSIWYG 渲染（`/tmp/rt/rt-2-rich.png`，23:46 新鲜）：H1「众议富文本验收」大字、**加粗强调**、<span style="color:#e8544b">红色重点</span>、居中一行、分割线、结尾段落，全部在单面内实时渲染。
- `getContents` 往返无损：`<h1>…</h1><p>…<strong>加粗强调</strong>，<span style="color: rgb(232, 84, 75);">红色重点</span>…</p><p style="text-align: center;">居中一行</p><hr><p>结尾段落</p>`。
- `context.format` 全量证明：bold→`<strong>`、color→`<span style="color: rgb(43,109,232)">`。
- 桥单元测试 21 断言全过（`/tmp/rt/bridge-test.mjs`，esbuild 打包 TS 桥 + alias `@`→src）。
- 详情 webview 渲染既有计划干净（`/tmp/rt/rt-7-detail-existing.png`）。
- **全程 console 0 错误**。四道静态门全绿：type-check（仅既有 plugin 噪声）、check:templates 41、check:docrefs 62/0/0、build:mp-weixin DONE。

**已知限制（有证据，非偷懒）**：原生 editor 不支持 blockquote（拍平成 p），工具栏无引用按钮；右对齐契约 §8.1 没有，不做。云端「配图必填」是部署漂移（源码允许空），送审 5000 是环境性——两者都**未碰控制台**（长期闸门），故 live create→rich-detail 截图改用既有计划只读详情证明。

**改动文件**：`src/pages/plan/edit/index.vue`（重写为单 editor）、`src/pages/plan/edit/README.md`（重写）、`src/utils/richhtml.ts`、`src/composables/useUpload.ts` + `index.ts`、`src/pages.json`（两页 webview）。旧多 textarea 页备份 `/tmp/rt/edit.index.vue.bak`。**未 commit / 未 deploy / 未碰控制台**，等用户点头。

## 4.21 工具栏按用户参考图重做（2026-11-13 00:0x，本窗口）

**用户裁定（愤怒原话 + 掘金参考图）**：「我让你按照这个图来，工具栏呢？？？？」。§4.20 把工具栏**吸底**放错位置、图标集也不符（色板/H2/正文/分割线），首屏根本看不到 → 被否决。参考图的工具栏是**详情标签下、编辑面上方的圆角灰卡、两行图标**。

**按图落地**（全在 `src/pages/plan/edit/index.vue` + 新增 `src/static/editor/*.png`）：

- 位置：移进标题卡，「详情」标签与 `<editor>` 之间，圆角灰卡（`$color-fill`+`$radius-md`），随内容滚动、首屏可见。删除旧吸底工具栏与色板行。
- 行1：B/I/U（字形）+ 左/中/右/justify 四对齐；行2：撤销/重做/缩进减/缩进加/H1/图片/删除。与参考图逐一对应。
- 图标：PIL 4× 超采样 + LANCZOS 生成 14 个真透明线性 PNG（10 深色 + 4 对齐蓝色激活态），角落 alpha=0 验证过。
- 接线：`EditorCtx` 补 `undo/redo/clear`；`onFormatTap` 增 undo/redo/`format('indent',±1)`/trash（`useModal.confirm` 后 `clear()`）；align 扩到 right/justify。`isOn('align')` 默认左对齐不点亮（参考图初始全黑）。

**运行时复验（SDK 3.17.6，automator 直驱 EditorContext）**：首屏工具栏可见（`/tmp/rt/rt-toolbar-new.png`）；右对齐→`text-align:right`、justify→`text-align:justify`、缩进→`ql-indent-1`、undo 移除插入字、redo 恢复；0 console 错误。四道门全绿（type-check / templates 41 / docrefs 62/0/0 / build DONE）。

**如实限制**：右对齐/justify/缩进**仅编辑会话内生效**——冻结契约 `TextBlock.align` 只有 left|center，保存时桥收敛为 left、丢 `ql-indent-*`。持久化需扩契约+重新部署（用户闸门），未擅自改。左/中/加粗/颜色/标题/图片无损往返不变。

**automator 教训（覆盖 §4.19/§4.20 一条）**：WebView 渲染页 `page.$()`/`page.$$()` 元素句柄拿不到整页 DOM（null / 挂起超时）；验收一律 `mp.evaluate()` 内 `wx.createSelectorQuery().context()` 直驱 + `mp.screenshot()`。dev 有 watcher 自动重编 `dist/dev/mp-weixin`，改完即上屏。

## 4.22 滚动回归修复 + 工具栏浅色 + 全页卡片间距统一 40rpx（2026-11-13，本窗口）

**用户原话**：「这个页面上下滑动不了了，同时工具栏的背景颜色调浅一点，同时每个区域之间的间距调大一点，所有页面卡片与卡片之间的间距调整为一致的40rpx」。

**滚动回归根因**：WebView 渲染页里 `page-root`（flex 纵向 + overflow:hidden）中的 `flex:1` scroll-view 默认 `min-height:auto`＝内容高度，被内容撑出视口、外层裁掉，内部永远不滚。修复：`.plan-edit__scroll` 与 `.plan-detail__scroll` 补 `min-height: 0`（两页同坑同修）。

**间距单点**：`src/styles/tokens.scss` 新增 `$card-gap: 40rpx`。落点：编辑页 `__card/__section/__state`、详情页 `__card/__state/__comments`、我的页 `__stats/__tabs/__logout`、`PlanList.__item` 底部 padding（首页/我的两条列表共用）。编辑页区域间距加大：`__field-head--detail` $space-4/$space-2，`__creator`/工具栏/编辑面各 $space-3。

**工具栏浅色**：tokens 新增 `$color-fill-light: #f7f8fa`（比 `$color-fill` 浅一档），工具栏底色改用它；激活态底用 `$color-bg-card` 白保证对比。

**运行时复验（四页全覆盖）**：编辑页几何 732.5 < scrollHeight 1185、详情页 757 < 942 ⇒ 内部溢出恢复、可滚（`/tmp/rt/rt-scroll-gap.js`、`/tmp/rt/rt-gap-detail.js`）；截图 `/tmp/rt/rt-gap-top.png`（编辑页首屏浅色工具栏 + 40rpx 卡距）、`rt-gap-home.png`、`rt-gap-mine.png`、`rt-gap-detail.png` 布局完整、间距一致；全程 0 console 错误。四道门全绿（type-check / templates 41 / docrefs 62/0/0 / build DONE）。

## 4.23 溢出根因修复 + 全页间距审计 + 下拉刷新状态机（2026-11-13，本窗口）

**用户原话**（三张标注截图）：「其他页面的滑动和间距不改吗，首页和详情页？同时这间距呢，样式调整好了行吗，你整体检查一下样式，把间距不对的都调整好。同时下拉刷新有问题，一直处于刷新态，在刷新是清空数据，不要又展示loading骨架屏又展示一些真实数据」。截图标注：编辑页工具栏左右溢出（绿框）、选项卡开关 OFF 却露出「添加选项」按钮且卡右缘溢出、提示「点下面按钮」但按钮在上方。

**根因与修复（四组）**：

1. **盒模型分裂**（工具栏/按钮溢出根因）：Skyline 默认 border-box，WebView 渲染页（edit/detail）默认 content-box → `width:100% + 左右 padding` 只在 WebView 页溢出父容器。`src/styles/global.scss` 加标签选择器 `box-sizing: border-box` 重置（view/scroll-view/button/input/editor/image/text 等）；组件运行时 `styleIsolation: 'apply-shared'`（dist common/vendor.js 证实），app.wxss 能进组件内部，一条规则修掉 BaseButton/工具栏/选项卡全部溢出。
2. **v-show/hidden 在 WebView 被覆盖**（选项收不起根因）：v-show 编译为 `hidden="{{!x}}"`，WebView 下类 `display:flex` 与框架 `[hidden]` 同优先级、后写赢 → body 永不收起（Skyline 原生处理 hidden，故只有 WebView 页暴露）。OptionsSection 改显式类名 `options-section__body--off { display:none }`（两渲染器都收得起；保活 useUpload 实例，不用 v-if）；提示文案改「还没有选项，点上方按钮加第一个」（按钮在提示上方）。
3. **下拉刷新状态机**（卡刷新态 + 骨架/真数据同屏根因）：`usePagingList.reload()` 旧版立即复位 refreshing=false，原生 scroll-view 的 `refresher-triggered` 拿不到 true→false 过渡，spinner 永不收回；`refresh()` 还在 busy 时忽略下拉手势，同样卡死。现：reload 全程保持 refreshing=true（继承下拉态），run() finally 的 true→false 才是收回信号；refresh() 不再查 busy（reload 以 seq 作废在途请求接管）；reload 请求路径清空 `list.value=[]` + `error.value=''`，PlanList 模板用 `<template v-else>` 包真列表 + BaseLoadMore ⇒ 骨架独占整屏，与真数据永不同屏（用户裁定）。
4. **全页间距审计**：PlanList 滚动内容首子加真实节点 `.plan-list__top { height: $card-gap }`（滚动内容里 :first-child 不可靠），提供首页 navbar→首卡 / 我的 tabs→首卡的 40rpx；我的页 `__tabs` margin-bottom 删除（间距单点由 spacer 提供，避免叠加）；首页 `__list`、我的 `__list` 补 `flex:1 + min-height:0`（§4.22 同款滚动坑）。编辑/详情卡距 §4.22 已统一，本轮复验无漂移。

**运行时验收（SDK 3.17.6，automator，本窗口新鲜跑）**：

- 溢出几何：工具栏 L/R 24→366、外卡 12→378 ⇒ 左右对称收容；选项 ON 按钮 24→366 H45 contained=true；OFF section H61、无按钮无提示（`/tmp/rt/rt-fix-options-on.png` / `rt-fix-options-off.png`）。
- 下拉刷新：首页与我的均 mid `{triggered:"true", skeleton:true, items:false}`（`/tmp/rt/rt-fix-refreshing.png` 仅骨架卡 + 原生刷新点）、after `{triggered:"false", skeleton:false, items:true}`（`rt-fix-refreshed.png` / `rt-fix-mine.png`）⇒ spinner 收回、不卡、不同屏。
- 间距：首页 navbar→首卡、我的 tabs→首卡实测 20.8px ≈ 40rpx（截图宽 750、逻辑 375）；详情页滚动 + 卡距复验（`rt-fix-detail.png`，滚动条可见 ⇒ 可滚）。
- 全页 0 console 错误。四道门全绿（type-check / templates 41 / docrefs 62/0/0 / build DONE，OptionsSection 改动后复跑）。

**automator 教训（增补进兼容清单 §0.2）**：`page.$` 不跨自定义组件边界 → 两级 `host.$('.plan-list')`；页面级 createSelectorQuery 看不到组件内部 → `>>>` 跨组件选择器，**一个 `>>>` 只穿一层边界**，page→OptionsSection→BaseButton 链两个；`page.callMethod` 调不了 setup 函数（uni-app vue3），状态级验证改走草稿种子（键带 `decide:` 前缀：`decide:plan_draft_<openId>`）+ 真导航；`ScrollViewElement.scrollTo(x,y)` 在 WebView scroll-view 可用（`.context()` 的 ScrollViewContext 不滚）。

**改动文件**：`src/styles/global.scss`、`src/composables/usePagingList.ts`、`src/components/business/PlanList/index.vue`（+README）、`src/components/editor/OptionsSection/index.vue`、`src/pages/home/index.vue`、`src/pages/mine/index.vue`、`src/pages/plan/edit/README.md`、`docs/Skyline兼容清单.md`。**未 commit / 未 deploy / 未碰控制台**，等用户点头。

## 4.24 编辑页模块标题统一 + 发布置底 + 导航标题真居中（2026-11-13，本窗口）

**用户原话**（两张编辑页标注截图，绿框圈 标题/配图/截止时间/添加选项 四个模块头）：「把这些每一个小模块里的标题字体大小颜色和上下间距统一一下 同时编辑页面的发布按钮放到页面底部，标题栏的文字剧中对齐，包括首页」。

**规格与修复（三组）**：

1. **模块标题统一规格**：`src/styles/mixins.scss` 新增 `section-head`（flex-between + width:100% + min-height:$tap-min-height=88rpx）与 `section-title`（$font-md=30rpx、$font-weight-semibold=600、$line-tight=1.3、$color-text-1）。编辑页标题行、ImageUploader、OptionsSection 直接 include；DeadlinePicker 走 BaseCell 新增 `section` 变体（padding:0，标题节点挂 `base-cell__title--section` 修饰类：semibold + line-tight——Skyline 无后代选择器，修饰类必须挂节点自身）。卡内衬统一 $space-3=24rpx，标题行→内容间距 0，纵向留白由行高自身提供。
2. **发布按钮置底**：编辑页 BaseNavbar 不再放 #right 按钮；页脚 `plan-edit__footer`（flex-shrink:0 + safe-area-bottom + hairline-top）内 BaseButton primary/lg/block，`:disabled="!canSubmit" :loading="submitting"`，状态行留在页脚上方。
3. **导航标题真居中**：BaseNavbar body `position:relative`，标题 `absolute left:50% translateX(-50%) max-width:50%`，right 插槽 `margin-left:auto`。左右插槽不对称（返回键 vs 胶囊/消息）时 flex:1 居中必偏，绝对定位与两侧宽度解耦；首页/我的/详情/编辑共用同一组件一次修全。

**运行时验收（SDK 3.17.6，automator，/tmp/rt/rt-unify.js + rt-final.js）**：

- 四标题 computed 全同：15px / 600 / rgb(26,29,36)，行高统一后 h 全 19.5；四标题行 h45 / left24 / w342；卡与 section 内衬 12px。
- 导航标题 centerX：首页 195.0、编辑页 195（=390/2）；旧导航栏提交按钮 count 0；底栏按钮 366×49 全宽、截图完整可见（`rt-unify-home.png` / `rt-unify-edit-top.png` / `rt-unify-edit-bottom.png`）。
- 置底按钮接线证明：空内容触发点击回调 → toast「先给计划起个标题」（`rt-final-toast.png`）。WebView 页 automator 合成 tap（宿主或内层 view 句柄）不派发 Vue @tap，改走逻辑层事件槽直调（兼容清单 §0.2 新增）。
- 0 console error / exception。四道门全绿（type-check / templates 41 / docrefs 62/0/0 / build DONE）。

**automator / watcher 教训（增补进兼容清单 §0.2）**：dev watcher 对 types.ts 有内容级缓存——BaseCell 渲染已引用 `_ctx.section` 但编译 props 声明缺 `section`，prop 运行时被丢；touch 不失效缓存，**重启 dev watcher** 后 grep 编译产物 props 确认。dev wxss 是多行格式化输出，单行 `selector{...}` grep 假阴性，用 `grep -rl`/带上下文匹配。

**改动文件**：`src/styles/mixins.scss`、`src/components/base/BaseCell/{types.ts,index.vue,README.md}`、`src/components/base/BaseNavbar/{index.vue,README.md}`、`src/components/editor/{ImageUploader,DeadlinePicker,OptionsSection}/index.vue`、`src/pages/plan/edit/{index.vue,README.md}`、`docs/Skyline兼容清单.md`。**未 commit / 未 deploy / 未碰控制台**，等用户点头。

## 4.25 模块标题行去 min-height 改 padding 撑开（2026-11-13，本窗口，#36）

**用户原话**：「标题这一行不要给 min-height: 88rpx这个属性了，全部有内边距撑开改成padding: 0 0 24rpx;，所有卡片的这样改」。

**改动**：`section-head` mixin 去 `min-height:$tap-min-height` 改 `padding: 0 0 $space-3`（覆盖编辑页标题行、ImageUploader head）；OptionsSection `__row` 自带的 min-height 同样替换；BaseCell `--section` 变体 `min-height:0 + padding: 0 0 $space-3`（覆盖 tappable 的 min-height）。标题→内容间距单点由 head 的 padding-bottom 提供（各内容区均无 margin-top，不叠加）。详情页 section-head 是另一套已验收规格（本就没有 min-height、自有间距），不扩 scope。

**运行时复验（automator）**：四 head pb 全 12px；行高内容撑开 h 31.5/31.5/34.5/47.8（标题/配图/截止/选项，后两者含值文本行盒与 switch 高度）；四标题仍 15px/600/rgb(26,29,36)；导航 centerX 195；底栏按钮不变；0 console 错误。截图 `/tmp/rt/rt-unify-edit-top.png` / `rt-unify-edit-bottom.png`。四道门全绿（type-check / templates 41 / docrefs 0 漂移 / build DONE）。

**改动文件**：`src/styles/mixins.scss`、`src/components/base/BaseCell/{index.vue,README.md}`、`src/components/editor/OptionsSection/index.vue`、`src/pages/plan/edit/README.md`。**未 commit / 未 deploy / 未碰控制台**，等用户点头。

## 4.26 详情页卡片标题行并入 padding 规格 + 修详情页滚动（2026-11-13，本窗口，#37）

**用户原话**：「包括详情页面的卡片，同时详情页面滚动不了」。

**改动（两组）**：

1. **滚动根因**：`type="list"` 是 Skyline 专属虚拟列表属性（官方 scroll-view 文档），详情页恒 WebView 渲染（pages.json）——留着触摸滚不动（程序化 `scrollTo` 仍可用，§4.22/§4.23 的几何验收因此漏检）。详情页 scroll-view 移除 type 属性，编译产物 `grep -c 'type="list"'` = 0。首页/我的（Skyline，PlanList 根节点）保留 type="list" 不变。
2. **标题行规格并入详情页**（#36 当时明确不扩 scope，本轮用户补裁）：投票卡 `__section-head/__section-title` 改 include `section-head/section-title` mixin（padding: 0 0 $space-3、无 min-height；30rpx/600/1.3/主文本色），`__ratio` 的 margin-top 删除（间距单点在 head pb）；评论卡 `__comments-head` 同规格 + 上/左右衬 $space-3；CommentItem 新增 `first` prop（CommentList 传 `:first="index === 0"`）首项顶 padding 归零，避免与 head pb 双倍。

**运行时复验（automator，/tmp/rt/rt-detail.js）**：表决 head pb 12px、标题 15px/600/rgb(26,29,36)；ratio.top == head.bottom（677.42，间距不双叠）；评论 head pt/pb/pl 12px；scrollHeight 952 > 视口 757，scrollTo(0,600) → scrollTop 195 ⇒ 内部溢出恢复；截图 `/tmp/rt/rt-detail-top.png` / `rt-detail-prog.png` 视觉正确；0 console 错误。四道门全绿（type-check / templates 41 / docrefs 62/0/0 / build DONE）。

**如实限制**：automator 合成触摸拖动（touchstart/move/end）在详情页与编辑页对照都驱动不了 WebView 原生滚动（scrollTop 恒 0）——是 automator 边界，不是 app bug 证据；**真手指拖动验收需用户在模拟器做**。种子计划 0 评论，首项归零规则只验到编译产物 `comment-item--first` 存在，真实评论目检待补。

**改动文件**：`src/pages/plan/detail/{index.vue,types.ts,README.md}`、`src/components/business/CommentItem/{types.ts,index.vue}`、`src/components/business/CommentList/{index.vue,types.ts,README.md}`、`技术方案.md` §8.4、`docs/Skyline兼容清单.md` §0.2。**未 commit / 未 deploy / 未碰控制台**，等用户点头。

## 4.27 发布校验修复：桥接层空文本块被云端拒收 + 云端配图契约违例（2026-11-13，本窗口，#38）

**用户原话**：「全部填写完之后，发布提示第5个内容块正文不能为空」。

**根因（四条，前三客户端、第四云端）**：

1. **p 包 img 被桥接吞掉**：Quill 把 `<img>` 包在 `<p>` 里，`cleanInline` 白名单不含 img → 该段剥行内后成空文本块且图丢失。修 `src/utils/richhtml.ts`：新增 `splitImages/parseImage`，段落级把 img 抽成独立 image 块，文本部分仅在有可见文字时产块。
2. **空段落 / 纯 br 段产块**：编辑面空段、`<p><br></p>` 经桥接成空正文文本块，云端 `validateBlock→required()` 拒收。`src/utils/blocks.ts` 新导出 `hasVisibleText`（剥标签与占位实体后判可见文字），桥接对空段 / 空引用不产块。
3. **末尾光标占位随提交发送**：`useEditor.replaceBlocks→ensureTrailingTextBlock` 末尾垫空文本段给光标（草稿保留是对的），提交原样带上。修 `src/pages/plan/edit/index.vue` `writeAction` payload：滤掉空文本块（image/divider 保留）。连带修：Quill 序列化把 src 的 `&` 转义成 `&amp;`，`withCloudSrc` 查 imgMap 前先解转义，否则临时链换不回 fileID。
4. **云端配图必填违反契约**：契约 §5.2 `images` 长度 ≤3 无下限、§8.6 明说配图可选，但 `normalizePlanWrite` 的 `asArray→required()` 拒空数组 → 空块修好后无配图用户必撞「计划配图不能为空」。修 `cloudfunctions/common/src/planPayload.ts:123-124`：空列表放行、非空仍全量校验。**§4.20「源码允许空」的断言当时即错**（那时源码也拒空），本轮才让源码真正符合契约。

**运行时证据（automator，/tmp/rt/rt-emptyblock.js）**：

- 修复前直调提交槽复现用户原话「第 5 个内容块正文不能为空」（彼时草稿 = 4 文本 + 空文本块，图被旧桥接吞）。
- 修复后包 `wx.cloud.callFunction` 抓真实提交 payload：4 非空文本 + 1 `cloud://` 图、**无空文本块**；配图经 v-model 槽写入；toast 不再出现空正文措辞（`rt-emptyblock-post-toast.png`）。
- 桥接回归扩到 26 断言全过（`bridge-test.mjs`：p 包 img / 空段 / 文图混排顺序 / 往返稳定）。
- 当前云源码 `validatePlanWrite` 5 断言全过（`cloud-validate-test.mjs`，esbuild bundle + wx-server-sdk stub）：旧桥接形态→用户原话；末尾占位→第 6 块拒收；修复后 payload→通过；配图空列表→通过。

**live create 残余 5000 的排查（「旧快照」假设已被 #39 证伪，真根因见 §4.28）**：

- 修复后提交仍失败，toast 为通用兜底「服务开小差了」，抓得 `ApiError code 5000 detail 空`。二分探针：`plan.create` 纯文本块 + 配图（与用户昨日成功计划 123123 同形态）→5000；`comment.create`→5000；`plan.list/detail` 读正常；无配图→1001「计划配图不能为空」。
- 当时假设「云上跑的是更旧快照」。**#39 重部署后证伪**：探针 C（无配图）从 1001 变 5000，说明新代码已生效、空配图过了校验；5000 来自校验之后的 DB 写入。临时诊断（toFailure 透出裸异常）抓得真根因：**控制台错建唯一索引**（plans.openId / comments.planId），详见 §4.28。
- 排查教训：dist-cloud 中文串是 `\uXXXX` 转义，按中文原文 grep 假阴性（一度误判 bundle 无容错），须按转义形搜或直读调用点；「读正常 + 写 5000 + detail 空」优先怀疑 DB 约束（索引/权限），而不是审核或快照漂移。

**automator 教训（补兼容清单 §0.2）**：

- 组件 v-model 事件槽（如 ImageUploader `bindupdateModelValue`）直调时真实参来自 `detail.__args__` 数组（vendor `createInvoker` 解包），喂 `{detail:{__args__:[[fileID]]}}` 才能写 `model.images`。
- 判「代码旧还是报错真」**先读 toast 截图**再看草稿：草稿末尾空段是预期（滤除只作用于 payload），别误判修复未生效。
- 包 `wx.cloud.callFunction` 抓提交 payload 是客户端修复的直接证据，比草稿推断强。

**门禁**：前端四道门全绿（type-check 仅既有 plugin 噪声 / templates 41 / docrefs 62/0/0 / build DONE）；`build:cloud` 全绿。

**改动文件**：`src/utils/richhtml.ts`、`src/utils/blocks.ts`、`src/pages/plan/edit/index.vue`、`cloudfunctions/common/src/planPayload.ts`、`src/pages/plan/edit/README.md`、`src/components/editor/ImageUploader/README.md`（行号引用 122→124）、本文档、`docs/Skyline兼容清单.md` §0.2。**未 commit / 未碰控制台**；部署在 #39 获用户「部署啊」授权后执行（见 §4.28）。

## 4.28 重部署五函数 + live 5000 真根因：控制台错建唯一索引（2026-11-13，本窗口，#39）

**用户授权**：「部署啊」——重部署 `dist-cloud/` 五函数获明确授权；commit / 控制台仍闸门。

**部署执行**：`cli cloud functions deploy --env cloud1-d2g9acyyhb220d834 --paths dist-cloud/<fn> --remote-npm-install --project dist/dev/mp-weixin`，五函数逐个部署全部 success（注意：`--paths` 逗号分隔多路径不被 CLI 接受，报 "cloudfunction path not found"，必须单路径逐次调用）。

**「旧快照」假设证伪**：重部署后 live create 仍 5000；探针 C（无配图）从 1001「计划配图不能为空」变 5000 ⇒ 新代码已生效（空配图过校验），裸抛在校验之后。§4.27 的旧快照结论作废。

**定位方法（TEMP-DIAG，已撤）**：云端日志读不到（控制台闸门），静态排查又穷尽 SDK 序列化路径（`@cloudbase/database` 的 flatten 对 undefined 键直接 delete、add 走 serialize+EJSON 不抛普通值）⇒ 临时改 `common/src/router.ts` `toFailure`：非 BizError 时把 `name/message/stack` 放进 `data.diag` 透出 → build:cloud → 部署 plan/comment → 探针抓真实报错 → **撤诊断、重建、重部署干净版**（产物 grep diag=0）。内部错误串只在定位窗口短暂可见，未留生产。

**真根因（E11000 duplicate key，两条写路径各一条）**：

- `plan.create`：`collection: plans index: openId dup key: { openId: "oprg…" }` —— plans 上建了 **openId 单字段唯一索引**，同一用户第 2 条计划起必撞。用户已有 123123 ⇒ 之后所有发布全 5000。
- `comment.create`：`collection: comments index: planId dup key: { planId: "0b8a…" }` —— comments 上建了 **planId 单字段唯一索引**，同一计划第 2 条评论起必撞。
- 读路径 / user.login 不受影响（不同集合或首条写入），与全部观测吻合。代码无问题，**索引只能控制台建/删（SDK/CLI 均不可，§5 前言 T0.2 实测）**，修复归用户闸门。

**正确索引规格（技术方案 §5.1/5.2/5.3/5.4/§8.7，控制台照此核对全部六集合）**：

| 集合           | 应有索引                                                        | 唯一性                               |
| -------------- | --------------------------------------------------------------- | ------------------------------------ |
| users          | `openId`                                                        | **唯一**                             |
| plans          | `status + createdAt(desc)`；`openId + status + createdAt(desc)` | 均非唯一（现 openId 唯一索引需删除） |
| votes          | `planId + openId`                                               | **唯一**（防重复投票兜底）           |
| comments       | `planId + seq(asc)`                                             | 非唯一（现 planId 唯一索引需删除）   |
| counters       | 仅 `_id`                                                        | —                                    |
| participations | `openId + lastActionAt(desc)`                                   | 非唯一                               |

**状态：已闭环（2026-11-13 用户控制台修索引后复验）**。用户删改错索引后复跑：

- `rt-createprobe.js`：C 无配图 / A 文本+配图 / B 正文图块 **三探针全 code 0**，remove 清理全 0；
- `rt-writeprobe.js`：comment.create code 0（seq=4，counters 事务正常）+ remove code 0；探针脚本曾取错 commentId 路径（`data.commentId` 应为 `data.comment.commentId`）漏清理，已补删并修脚本，123123 commentCount 回落 1（用户自有评论未动）；
- `rt-emptyblock.js post` 完整 UI 链路：payload 4 非空文本 + 1 cloud 图无空块 → 发布成功跳详情（`rt-emptyblock-post-detail.png` 目检：标题/作者/倒计时/封面/四段正文+插图块/评论区全渲染）→ remove/deleteFile/清草稿全清理；
- 唯一捕获 warn 为既有缺陷（草稿恢复弹窗 cancelText 超 4 字），见 §4.29，与发布链路无关。
  **未 commit / 未碰控制台**（索引由用户本人修改）。

## 4.29 草稿恢复弹窗 cancelText 超微信上限致静默丢草稿（2026-11-13，本窗口，#40）

**发现**：#39 冒烟 console 捕获 `showModal:fail cancelText length should not larger than 4 Chinese characters`。
**根因**：`src/pages/plan/edit/index.vue` 草稿恢复弹窗 `cancelText: '从空白开始'`（5 字）超微信 showModal 4 汉字硬上限 → 弹窗**必然 fail**；
`useModal.nativeConfirm` 的 fail 路径按「宁可不执行」resolve(false)，编辑页 `if (!keep) discardDraft()` ⇒ **每次带草稿进编辑页都静默丢弃草稿**（数据丢失级）。
**修复**：cancelText 改「空白开始」（4 字，语义不变）；fail 路径的保守语义保留不动（对其余确认场景是正确的）。
**运行时验收**（dev watcher 曾死、产物停更，重启 `npm run dev:mp-weixin` 后复验）：`/tmp/rt/rt-draftmodal.js` 种草稿→进编辑页→
弹窗真实弹出（`/tmp/rt/rt-draftmodal.png`：标题「发现未发布的草稿」、按钮「空白开始/继续编辑」、草稿标题回填）、
showModal fail 0 条、console error 0 条、弹窗期间草稿仍在 storage（未静默丢弃）→清草稿收尾。
**教训**：微信 showModal 的 confirmText/cancelText 均 ≤4 汉字；「fail 当取消」的保守兜底遇上「取消=破坏性动作」的调用点会把兜底变成数据丢失，调用点文案必须守上限。

## 5. 主 agent 串行工作

- 已完成（第一窗口）：git 基线；契约 8 文件（`src/types/{api,models,cloud}.ts`、`src/constants/{error-code,plan}.ts`、`src/utils/logger.ts`、`src/stores/app.ts`、`src/api/request.ts`）。
- **tabBar 图标（本窗口完成）**：`src/static/tabbar/{home,home-active,user,user-active}.png`，81×81，未选中 `#8A8F99` 描边 / 选中 `#2B6DE8` 实心，已接入 `src/pages.json` 的 `iconPath`/`selectedIconPath`。
  **纠正第一窗口的一条结论**：`qlmanage -t -s 162 -o <dir> x.svg` 产出的 PNG 虽然 `sips -g hasAlpha` 报 `yes`，实际**整幅是不透明白底**（所有像素 alpha=255），且内容偏在画布左上角——`hasAlpha` 只表示色彩类型带 alpha 通道，**不代表背景透明**。改用 PIL 在 4× 超采样画布上矢量绘制、再 LANCZOS 降采样，得到角落 alpha=0 的真透明图，脚本 `/tmp/make_tabbar.py`。**验证透明性要看角落 alpha 或 `getbbox()`，不能只看 `hasAlpha`。**
- **技术方案 §8.3 / §12 措辞修订（本窗口完成）**：见 §4 裁决。
- **契约与文档的 2 处不一致（本窗口裁决，均已写入技术方案）**：核对 `src/types/models.ts` 时发现文档落后于冻结契约。
  1. **列表只有首图**：§8.5 的卡片 mock 画了「[图1][图2][图3]」，正文也写列表返回 `images`，但契约里 `PlanSummary` 只有 **`cover`**。裁决：v1 列表卡片只显示封面，三图并排归详情页——这正好是 §11.1「单条 payload < 1KB」的实现前提。若之后要「+N」角标，需给 `PlanSummary` 补 `imageCount` 并同步 `planDao` 投影，**留到 T3.3 前做，不在云函数 agent 飞行中改契约**。
  2. **`FilterTabs` 去掉「全部」**：§8.7 原来列了 5 个 tab（含「全部」），但 `MyFilter` 只有 `created|joined|ongoing|ended` 四个值。「全部」语义上要 `created ∪ joined` 的并集查询，与游标分页和 3s 超时都不友好。裁决：4 个 tab，默认「我发起的」。影响 T5.4 的页面编排（我所有），不影响 D 的实现。
- **阶段 3 收口期的跨路裁决（本窗口，全部由我动手）**：`ratioPercent` 进 format.ts、`imageBlockRatio` 单位改回 `w/h`、`$ratio-bar-*` 三个专用 token、`VoteActions.showRatio`→`showCount`、OptionCard/OptionCardList 按 §8.6 重写（撤回我的错误指令）。理由都一样：**问题出在跨路共享的语义或单位上，让任何一条 E 路自己改都会造成两端不一致**。
- **一条「假事实」已从技术方案 §8.6 删除（本窗口）**：原文写「v2 可扩展为多选一表决（**数据结构已预留 `options[].voteCount`**）」。核对冻结契约：`PlanOption` 只有 `{ id, name, image, order }`，`vote.submit` 的 req 只有 `{ planId, type }`，`VoteTypeValue` 只有 `1|2`——**根本没有选项计票的通道，也没有任何预留字段**。这句话正是我给 E2 下错指令（「选项卡显示票数、点选项卡投票」）的根源：我以为是「v2 已经埋好字段」，就把它当成可以提前做的展示层。**教训：文档里凡出现「已预留 / 已支持 / 数据结构里有」这类断言，必须在冻结契约上核对一次再引用**；已在 §8.6 原位留了带删除线的更正与真正的契约变更成本，防止下一个人再踩。
- **云函数产物治理（D4 之后）**：删 4 个旧 emit 残留、`.gitignore` 改通用规则、6 个 tsconfig 用 `noEmit` 取代 `outDir`、删 `common` 的 emit 脚本、技术方案 §6.6 改写为 `dist-cloud` 口径。见 §4.10。
- **阶段 4 前置的三件页面活（F1/G1 派发前由我做完，agent 才不至于互相踩）**：
  1. `src/pages.json` 加 `pages/plan/detail/index`、`pages/plan/edit/index` 两条路由，并把技术方案 §4 的目录树从 `plan/detail.vue` 改成 `plan/detail/index.vue`——**页面与组件同构：一页一个目录**，将来页面要放 co-located `types.ts`/`README.md`，扁平 `.vue` 装不下。
  2. 两个占位页（`src/pages/plan/detail/index.vue`、`src/pages/plan/edit/index.vue`）。原因很实际：路由先注册而文件不存在时 `uni build` 会打印 `pages/plan/detail/index not found` 并静默少一页，**基线必须是全绿的**，否则 agent 报「构建通过」我无从对照。占位页同时给首页 FAB 一个真实跳转目标。
  3. **冷启动静默登录（T5.1 上半，我自己接的）**：`App.vue` 的 `onLaunch` 里 `userStore.hydrate()` + `void userStore.login(undefined, { silent: true })`，并给 `stores/user.ts` 的 `login()` 加了可选 `options: RequestOptions` 透传。**为什么必须传 silent**：`api/request.ts` 默认对失败 `uni.showToast`，冷启动那次登录在云函数还没部署时必然失败，不 silent 就是每次打开小程序先弹一条错误提示。代价：`userInfo.openId` 是异步晚到的，所以详情页的 `isAuthor`/`canRemove` 一律写成 computed，允许先按游客视角渲染再收敛。
- **页面波（F1/G1）收口期的共享层改动（本窗口，全部我动手，都在无 agent 在飞时落盘）**：PlanList 转发 `scroll`、`usePageRefresh.onRefresh(ctx.first)`、`planStore.homePage()/myPage()`、`$fab-size`、`useVote.toStoreVote()`、`CommentStatusValue`、`stores/feedback.ts` 的 `SheetAction` 删除改渲染侧类型、`scripts/check-templates.mjs`。逐条理由与裁决见 §4.11 / §4.12。**共同判断标准还是那一条：语义或单位跨路共享的东西，让任何一条线自己改都会造成两端不一致。**
- **阶段 4/5 组件线派发前的两件共享活（本窗口 15:59，全部我动手、派发前落盘，与 §5 上一条同样的原则）**：
  1. `useEditor` 新增 `updateImage(id, {fileID,w,h})` —— T4.4 的「空图块先落地、上传成功后落定」这条流程在既有 controller 里没有入口；不给它一个方法，H1/H2 就只能直接 mutate 裸 `Ref<Block[]>`，绕过 `ensureTrailingTextBlock` 与草稿 debounce 两个不变量（§2 表格里记了完整理由）。
  2. `constants/plan.ts` 新增 `TEXT_COLORS` —— §9.1-5 禁止硬编码色值，而 SCSS 变量在 TS 里读不到，所以「允许哪几个正文色」必须有一个 TS 侧单点，否则 `EditorToolbar` 会自己写一份、渲染侧将来又要认一份。
     派发前基线已复跑：`npm run type-check` 全绿（只有既有的 `[Vue] Load plugin failed: @dcloudio/uni-app-types` 噪声）、`npm run check:templates` 28 个 .vue 全绿。
- **技术方案随阶段 4/5 下发同步回写（本窗口 16:00~16:06，四路在飞期间由我做，agent 不许动这个文件）**：把本轮 prompt 里的裁决写回它该在的位置，免得下一轮再靠 prompt 口头传。
  1. §8.1 页面结构 + 交互与选区：标题路径改 `pages/plan/edit/index.vue`（与 §4 的「一页一目录」一致）；新增 4 条口径修正（`EditorBlockList` 不嵌 scroll-view / 定位只用 `scroll-into-view` 不测量 / 工具栏的吸底由页面做 / **禁用原生 `picker`、`picker-view`**）；补齐 `blk-` id 前缀契约、ActionSheet 归页面、`ensureTrailingTextBlock` 三条路径、`stylable=false` 置灰而非隐藏、`TEXT_COLORS` 单点、图片块「空 fileID 落块 → `updateImage` 落定」的完整链路、截止时间的校准时间与两层过去拦截。
  2. §8.2 新增第 5→6 条：**提交门禁用 `!uploading` 而不是 `done`**（`done` 要求「至少一张」，配图可选，用错就是空表单永远提交不了）。这条现在只写在 prompt 里，页面 agent 一漏就会写出静默 bug，所以进文档。
  3. §8.6 编辑态：`display:none` 取代作废的 worklet 方案；`order` 由编辑侧维护 + 为什么写错就线上顺序错；`OptionImagePicker` 标为**不存在的目录**（同 §8.6 `voteCount` 那一类「文档里提到但工程里没有」的东西）；校验归页面。
  4. §8.7：`FilterTabs` **四项 flex、不横向滚动**（§5 裁决 2 删掉「全部」之后的自然结论）；`stats` 不发独立请求；选中态单一来源 + `UserHeader` 为什么是唯一的 store 例外；`chooseAvatar`/`nickname` 列为真机复核项与「只改昵称」兜底要求。
  5. §9.2 editor 表：标题「6 个」更正为 **9 个组件目录**（原口径把配对组件算一条），并加「`src/components/editor/` 禁止桶文件」—— 这条纪律从 business 推广到 editor，说明它是通用的。
  6. **三处过期能力断言已就地更正**（与 §8.6 那条 `options[].voteCount` 同类的「文档说有、契约里没有」）：§10 与 WBS T3.6 的「`utils/blocks.ts` 提供 **mark 分片**」——`Block` 结构里根本没有 marks，样式是段落级；WBS T3.2 的「含 **worklet 动画**」——T0 已作废，实交付是 CSS `transition`；WBS **T4.3「区间样式（marks）实现 —— 若 T0.5 通过」** 标为**已废弃、不排期**并保留原行（T0.5 实测未通过；这行留着是为了防止下一个人把它当成「还没做的待办」重新排进来，删掉反而失去这条判断的出处）。
- **`docs/Skyline兼容清单.md` 新增 §2.8「清单里没有 ≠ 可以用」（本窗口）**：这是本轮真正沉淀下来的一条**规则**而不是结论。清单是「已知集合」，不是「全部可能」；凡清单查不到的原生组件按**未验证**处理 —— 既不许当成支持，也不许当成不支持。表里两个实例的区别必须留着：`list-view`/`grid-view` 是**实测过且坏**（0×0，禁用有证据），`picker`/`picker-view` 是**从没测过**（「不用它」是风险判断，不是实测结论）—— 不把这两类分开写清楚，下一个人就会把「Skyline 不支持 picker」当成一条不存在的事实引用。同批把 `chooseAvatar` / `nickname` / `BasePopup` 内两列 `scroll-view` / `cloud://` 图片四条加进 §4 的真机复核待办，并在 §4 的落地清单里补上本轮的三处文档更正。
- 验收闸加了一条扫描：`/tmp/decide-verify.sh` 的 Skyline 禁用项 pattern 列表补 `picker-view` / `<picker`，所以就算哪个 agent 没听话用了原生 picker，收口时会被数出来（它的注释过滤逻辑依赖「不用/禁止」措辞，正是组件里会写的说明词，不会误伤）。
- **部署仍等用户点头**（长期约束：不 commit / 不 push / 不 deploy，除非当轮明确同意）。仓库目前已具备部署条件：`npm run build:cloud` 连跑产物 md5 全等，`dist-cloud/` 不含 `file:../common`，`--paths` 指过去即可。
- 刻意延后：**ESLint/Prettier/husky**（要动根 `package.json` 并 `npm install`，会与运行中 agent 的 type-check 抢 node_modules）。同批要补的是 `esbuild` 显式进 `devDependencies`——`build-cloud.mjs` 现在靠 vite 提升上来的传递依赖，npm 扁平安装满足，换 pnpm 就会 `MODULE_NOT_FOUND`。

- 本窗口任务表：#1 A 补组件、#2 C 工具层、#3 D 云函数上半、#4 B 验收、#5 tabBar、#6 文档措辞、#7 集成验收（未完，等用户批准部署/提交）、#8 D1 plan 域、#9 D2 vote/comment/scheduler、#10/#11/#12 E1/E2/E3 组件、#13 D3 participations 收敛、#14 D4 打包、#15 F1 首页、#16 G1 详情页、**#17 H1 编辑器块组件、#18 H2 图片块与工具栏、#19 H3 截止与选项、#20 I1 我的页三件套（四路已交付并验收，见 §4.13）**。**#1~#6、#8~#20 全部完成并验收**；#7 剩下的只有「用户批准后的部署 + 模拟器冒烟 + 分路 commit」。
- **阶段 4/5 组件波收口期（本窗口，四路全部返回后由我动手，见 §4.13）**：共享层落了 10 项 —— `useUpload.uploadLocal` + `validate` 放行无扩展名、`Limit.NICKNAME_MAX`、`MY_FILTER_LABELS` 上收 constants、`blocks.ts` 导出 `LEVELS/ALIGNS`、`MAX_SIZE/DEFAULT_ACCEPT/UPLOAD_HINT` 导出、上传失败带 `errMsg`、**新增 `countChars` 并把 `useForm.sizeOf` 从显示宽度改成码点计数**、`useEditor.blurIf`、`DeadlinePicker` 的 `uid` 缺陷修复、两处 hint 改指单一来源。另有 4 条「裁决不修」与 1 条**被证伪的上报**（H3 报的服务端不校验 min-2，实际 `writeShared.ts:76` 一直在校验）。

## 6. 集成验收清单（任务 #7，全路完成后我做）

验收工具：`/tmp/decide-verify.sh`（不是交付物，是我这轮的独立核查脚本）——全工程 type-check、Skyline 禁用项扫描、列表节点测量调用扫描、`setInterval` 归属审计、`wx.cloud` 出现位置审计、裸 toast 扫描、base 层越界 import、硬编码色值计数、逐函数 `tsc`、云函数入口/配置对账、契约 action ↔ 云函数 router action 对账。**15:50 全量重跑：阻塞项 0**；`line-clamp` / `boundingClientRect` / `SelectorQuery` / `setInterval` 的命中**全部在注释里**（唯一真 `setInterval` 仍是 `utils/ticker.ts:86`）；一条长期提示项：`BaseNavbar` 引 `useAppStore` 取安全区/状态栏高度，属 base→store 的越层，是有意为之（导航栏拿不到这两个值就只能靠页面传参）。

1. `git status` 逐文件过一遍，确认没有越界改动（对照 §2/§3 所有权）。**15:50 已跑**：31 条改动全部对得上所有权，`src/pages/**` 只有 home / plan/detail 两个交付目录 + mine / plan-edit 两个占位。
2. 读每个 agent 的实际 diff（不信自述）。已完成的重点：C 的 ticker 单例与「不测视口外节点」、D 的游标编码与事务边界、A 的 Skyline 禁用项、E 三路的比例/单位/命名一致性、**F1 首页（§4.11）与 G1 详情页（§4.12）**。
3. `npm run type-check` 全绿 → `npm run check:templates` 全绿（28 个 .vue）→ `npm run build:mp-weixin` 全绿（产物现在应有 home/mine/plan-detail/plan-edit 四页 + `static/tabbar/` 四个图标，**且没有 `not found` 告警**）。15:50 三条全绿。
4. `npm run build:cloud` 全绿（内含 6 个 `tsc --noEmit`）→ 由我部署：`cli cloud functions deploy --env cloud1-d2g9acyyhb220d834 --paths <绝对路径>/dist-cloud/<fn> --remote-npm-install --project <绝对路径>/dist/build/mp-weixin`。首次部署函数不存在会报 `Creating 状态`，**重试归我，构建脚本不做部署**。
5. **部署这一步要等用户明确同意**（长期约束：不 commit / 不 push / 不 deploy）。同理，模拟器冒烟 `cli auto --auto-port 9420` + automator 调 `plan.list`/`vote.submit` 也会真实打到云端，放在部署之后、批准之后。
6. 每路一个 commit（Conventional Commits，带任务 ID），同样等用户点头。

## 7. 仍等用户操作的事项（控制台，我做不了）

1. 确认云环境套餐/有效期（现标「微信体验版」，换正式环境 env ID 会变）。
2. T2.1：6 个集合的自定义安全规则「仅管理端可读写」+ 索引（`votes` 的 `planId+openId` 唯一、`plans` 的 `status+createdAt`、`participations` 的 `openId+lastActionAt(desc)`）+ 云函数超时从 3s 调高。
   - **`participations` 目前是「只写不读也写不进去」的状态**：集合不存在时 upsert 只 warn、joined 会走容错空态（D3 已要求），所以建表前功能不崩，但「我参与的」会一直是空的。**部署后先建表再验收 joined。**
   - **超时调高优先级**：`plan.create`/`plan.update`（文本送审 + 图片送审，D1 已经把预算硬编码成 600ms 余量）与 `vote.submit`（事务 + commit 后回读 + participations 两次往返）。CLI 改不动超时，必须控制台。
   - `scheduler/config.json` 里声明了 2 个 timer trigger（每分钟 expire、每日 04:00 对账）与 `timeout: 15`。**部署后要确认触发器真的被注册**（D2 说 timeout 经 CLI 不生效，trigger 是否生效同样需要在控制台核对）；没注册的话过期状态只能靠前端惰性折算，`user.stats` 的「进行中」会长期偏。
3. T4：消息推送 → 云函数（`mediaCheckAsync` 回调）。
4. M0：真机扫码复核（选择器、worklet、share-element、`chooseMedia`、头像昵称填写能力、**`@keyframes` 动画**——见 §4.1）。
5. T6.6：公众平台隐私保护指引。

## 8. 批次 #41–#47 验收与 plan 重部署（2026-11-13）

七项用户反馈全部修复并运行时验收（automator 几何 + 截图 + 直连云探针）：

- **#41 发布后删草稿**：edit 页加 `published` 沿，拦 `onEditorInput` 与 `persistBeforeLeave`，`afterWritten` 先置位再 `clearDraft`。实测：发布前草稿在 → 发布跳详情 → 草稿立即消失 → +2s 不回写 → 测试计划清理 code 0。
- **#42 详情排版**：作者行（头像+昵称+CountDown）置顶 → 标题 → 正文同卡；配图独立卡。几何 author<title<body、sameCard、gallerySeparate 全 true。
- **#43 详情滚到底**：tail 改 `safe-area-bottom($tap-min-height + $space-4 + $space-2)`（实测 104px=136rpx+env），末条评论+「没有更多了」完整露在输入条上方。
- **#44 评论输入条**：field/send 同 88rpx、row 垂直居中、删除计数行 → 聚焦整条恒高。
- **#45 首页 FAB**：PlanList 新增 `fabClearance` prop，让位垫进滚动内容尾部（实测 100.6px），视口吃满全高；FAB 落 footer 旁不压卡。**automator 的 scrollTo/touch 均驱动不了 Skyline type=list 滚动**，滚到底让位用几何判定（内容底 845.6−视口 762=83.6 scrollTop → 末卡底 615.6 < FAB 顶 695.5）。
- **#46 已截止筛选**：`planDao.listByAuthor` 增 deadline 口径（expired=status2 ∪ status1∧deadline≤now；active=status1∧(deadline=0∨>now)），myList 传 mode；**plan 单函数重部署（用户当轮授权）**，ended/ongoing 双桶零重叠、过期计划进 ended。退出登录改独立圆角卡按钮（88rpx、danger 色、居中）。
- **#47 选项间距**：OptionsSection `__desc` margin-top 归 `$space-1`（对齐 BaseCell）。

工程坑（本轮新增，供后续窗口）：

1. **dev watcher 内存类型缓存会丢新增 prop**：types.ts/index.vue 都加了 fabClearance，但编译产物 props 块没有它（渲染读 `_ctx.fabClearance` 恒 undefined）→ touch 无效，**重启 watcher 才愈**。加 prop 后行为不生效，先 grep dist props 块再怀疑源码。
2. **automator Element 无 boundingBox**，用 `offset()+size()`（字符串需 parseFloat）；跨组件 = `page.$('组件标签')` 再 `Element.$`，**仅 Skyline 页有效；webview 页（detail/edit）组件内部量不到，只能截图验收**。
3. **不要 wrap `wx.cloud.callFunction`**：request.ts 走 success/fail 回调，wrap 会致客户端报「网络异常」但服务端已创建 → 留孤儿计划。取 planId 从跳转路由读，别 wrap。本轮两条孤儿「草稿删除验证」已清理，用户 123123 未动。

## 9. 批次 #48–#49 验收（2026-11-13）

两项用户反馈修复并运行时验收（automator 几何 + 首页/我的/详情截图）：

- **#48 详情排版**：作者行下加浅色分割线（Skyline 无伪元素 → 真实节点 `.plan-detail__author-divider` + `hairline-bottom`，width:100% 落在卡内衬里故两边各留 $space-3 不顶边）；标题→正文 `margin-top` $space-3→$space-4；配图 `.plan-detail__gallery` 加 `padding: $space-1 0`，使四边距与每格左右 $space-1 对齐（以左右为准）。截图确认分割线/放大间距/四边等距。
- **#49 我的页 + PlanList**：退出登录改 `position:absolute` 页底透明浮层（wrapper 无底色、`flex-center` + safe-area；按钮改紧凑 pill：去 width:100%、radius-round + shadow），列表 flex:1 延伸页底从按钮四周透出（「被遮住的列表」）。PlanList 删 `plan-list__top` 占位节点（上间距改容器 margin-top），容器 `margin: $card-gap $space-3 0` + `border-radius: $radius-lg` + `overflow:hidden`，卡片行去左右内缩贴容器边 → 滚动时进出顶/底被遮的卡片被容器圆角裁切。首页同组件同口径一致生效（FAB 是 fixed 兄弟节点不受容器 overflow 影响）。
- **工程坑（本轮新增）**：Skyline `scroll-view type=list` **不吃 flex stretch 减 margin**——去掉 `width:100%` 后仍按视口宽（390）算，`margin-left` 把容器整体右推、右缘被宿主 overflow 裁掉（左右不对称、倒计时 chip 被切）。必须显式 `width: calc(100% - 左右margin)`。修后实测容器 x=12.5 / w=365.1（右缘 377.6=390−12.4）对称。
- 验收几何：`__top` 不存在；logout wrapper 全宽透明带 y=669.8、pill 居中（x=138.8/w=112.5，中心≈195=页宽半）；容器与卡片行同宽 365.1。详情为 webview 只截图验收。用户 123123 仅只读打开，未做任何写操作。

## 10. 批次 #73–#77：选择器滚动/震感/评论同高 + 投票 5000 真根因（2026-11-13，本窗口）

- **#73 选择器弹窗不能滚动**：`DeadlinePicker` 两列 `scroll-view` 去 `type="list"` + `:scroll-y="true"`（webview 页与 #37 同口径：`type=list` 触摸滚动失效但程序化 `scrollTo` 仍可用 ⇒ 静态/automator 验收抓不到）。编译产物 wxml 两列 `scroll-y="{{true}}"`+`bindscroll`、`type="list"` 计数 0。
- **#74 滚动震感**：`onColScroll` 100ms 节流 `wx.vibrateShort({ type:'light', fail:()=>{} })`（iOS 时钟拨轮式轻震）。用 `wx` 不用 `uni`：legacy `VibrateShortOptions` 无 `type` 字段过不了 TS strict，wx patch 类型有。
- **#76 输入框与发送按钮不等高**：`CommentInput` 行 `align-items:stretch` + 发送按钮 `height:auto`（`min-height` 兜底）→ 按钮跟随原生 textarea 自动增高的真实高度（取整误差是旧固定高度的病根）。截图 b3-14/b3-15 目视同高。
- **#75 真机滚到底复核**：模拟器已验可滚到底；真机若仍不行优先怀疑旧预览包未含 #37/#66/#70 修复，重新生成预览/真机调试包再复验（待用户）。
- **#77 赞同/反对一直失败（真根因 + 用户控制台修复 + 复验闭环）**：控制台在 `votes` 误建 **openId 单字段唯一索引**——§4.28 同类错误第三次（plans.openId、comments.planId、votes.openId）。机理：首条票（选项票）落库后，同 openId 任何后续 insert 撞 E11000 → `isDuplicateKeyError` 判可重试 → 两次事务均失败且回读无票 → `correctOrFail` 抛 5000「投票未能完成，请稍后重试」；选项票先落库所以选项路径看似正常、简单票全灭。代码/构建/部署三者均无问题（dist-cloud 与源码一致）。**用户 2026-11-13 控制台删除 openId 索引**后复验（`/tmp/rt/b3-vote-recheck.js`，live `wx.cloud.callFunction`）：`vote.submit type=1` → code 0 `{agree:1,myVote:1}`；再投 `type=2` → 3003「已经投过票，不能修改」带权威计数（#60 锁定，设计行为非故障）；`plan.detail` 回读 `myVote=1/agree=1`。UI 侧（`b3-vote-ui.js` + b3-15 截图）：store 锁定态正确、赞同「已选」高亮/反对置灰、锁定后不再渲染可点 `base-button`、console 0 报错。**无代码改动、无重部署**（索引是 DB 侧变更）。
- **索引规格重申（防第四次复发）**：以 §4.28 表为准。`votes` 只允许 `planId+openId` **复合**唯一（与确定性 `_id=planId#openId` 同口径，不会误伤，作兜底）；**严禁 openId / planId 单字段唯一**。若复合唯一也被一并删除，功能不受影响（事务内查重 + 确定性 _id 已防重），建议补回作兜底。
- **验收边界（不宣称已真机通过）**：#73/#74/#76 的触摸滚动/震感手感/精确像素高度，automator 跨不过自定义组件边界（`<script setup>` setupState 为空、`__file` 被剥离、webview 组件内部量不到），需真机复验，与 #37「真手指拖动待用户复验」同口径。三门禁（type-check / check:templates 41 / check:docrefs）全绿。
- **探针副作用登记**：测试计划「11」`d91919ce6af6a4b6008a9b3357275635` +1 赞同票（我投，已锁定）；用户 123123 未做任何写操作。

## 11. 批次 #78–#79：弹层穿透/选择器滚不动 + WebView 页文档级滚动（2026-11-13，本窗口）

用户反馈：「时间选择器滚动不到底部，同时弹层展示时很容易滚动页面而选择器没滚动；详情页还是不能滚动到底」。本轮不再补 padding，直接换结构。无 agent 在飞，共享层改动全部由我做。

### 11.1 #79 根因与修法（详情/编辑改文档级滚动）

- **根因**：`global.scss` 的 `page{height:100%;overflow:hidden}`（Skyline 形状）在 WebView 渲染页把文档钉死一屏，内层 scroll-view 百分比高度链被裁剪 ⇒ 永远滚不到底。#37/#66/#70 的 padding 修补都没碰到这条，所以真机反复复发。
- **修法**：detail/edit 整页文档级滚动 —— 页面级**非 scoped** `page{height:auto;overflow:visible}`（scoped 会让 page 选择器死信；页面 wxss 晚于 app.wxss、同优先级后写赢）；`BaseNavbar` 新增 `fixed` prop + 页面等高占位（`appStore.navBarHeight`，模拟器 87px）；`onReachBottom`（pages.json `onReachBottomDistance:120`）取代 `@scrolltolower`；`uni.pageScrollTo({selector})` 取代 `scroll-into-view`；编辑页底部状态+发布 fixed 叠层 + tail 占位 `calc(217rpx + env(safe-area-inset-bottom))`；根 mixin `page-root-doc`（不带 height/overflow）。
- **模拟器实测**（automator `selectViewport().scrollOffset()` + 节点矩形；长内容计划「111」`0b8a77d76af683130095db9b464ac8ac`，**非用户 123123**）：detail scrollHeight 1591 → maxScrollTop 747.5（=1591−843.5 精确到底），`#planDetailTail` bottom 844.2≈视口底；edit 1248 → 404.5 精确到底，nav-space 滚出（top −404.5）、导航钉住；底部叠层 rect top 719.5/bottom 844/height 124.5，tail≈144.8px>124.5px ⇒ 不遮内容。console 0 报错。截图 b4-01…06（/tmp/rt/shots/）。

### 11.2 #78 根因与修法（BasePopup 弃 page-container）

- **用户真机反馈**：弹层内两列滚不到底 + 触摸弹层外层页面跟着滚。**两层根因**：列走百分比高度链（WebView 不可靠，拿不到确定高度就没有内部滚动，触摸落到文档）；page-container 在 WebView 页的遮罩/手势从未实测（§2.8 未验证组合）。
- **修法**：BasePopup 重写为 fixed 全屏根+遮罩+面板；遮罩 `@touchmove.stop.prevent`→编译 `catchtouchmove`；host/shown 两态生命周期保留（30ms 起过渡、duration+80ms 卸载）；编辑页 `<page-meta :page-style>` 首节点，picker/ActionSheet 任一开 → `overflow:hidden`；DeadlinePicker 两列**显式 440rpx**（`$tap-min-height*5`），初始定位仍 scroll-into-view 只给一次；**BaseActionSheet 内 scroll-view 去 `type="list"` 改 `:scroll-y="true"`**（唯一宿主=编辑页 WebView，#73 同根因；普通 scroll-view 不给 scroll-y 完全不滚）。详情页菜单/确认走原生 `uni.showActionSheet`/`uni.showModal`，无 BasePopup 宿主，不需要锁。
- **连带**：page-container 单实例限制（§2.3.1）对 BasePopup 系不再成立。
- **验收边界**：automator 打不开弹层（setupState 空/vnode 空/`>>>` 0 命中，b4-picker-diag 实证）⇒ 弹层内触摸滚动/穿透/震感**只能真机复验**。模拟器已验：产物形状（catchtouchmove、components 产物 page-container 计数 0、page-meta 接线、440rpx 列高）、文档滚动数字、Skyline 首页/我的回归（b4-07/08/09；b4-08 是合成器残影，b4-09 复测渲染正常）。**不宣称弹层交互已真机通过。**

### 11.3 工具链坑：dev-watch 的 TS 类型缓存（重要，防误诊）

- **现象**：BaseNavbar `types.ts` 加了 `fixed?: boolean`、index.vue 也用了，但编译产物 props 里**没有 fixed**，运行时 `_ctx.fixed` undefined → 导航不吸顶。touch .vue/.ts 触发重编也没用。
- **根因**：长跑的 `npm run dev:mp-weixin` watch 进程把**启动那一刻**的 types.ts 快照缓存在 TS type program 里，.ts-only 改动不刷新 props 解析。
- **解法**：**重启 watch 进程**（本轮 kill 自己的构建链后重起，产物 props 立刻出现 `fixed:{type:Boolean,default:false}`）。以后「源码有、产物没有」的 props 缺口，先重启 watch 再怀疑代码。

### 11.4 门禁、文档同步与探针副作用

- 三门禁全绿：type-check / check:templates（41 ok；`page-meta` 进 BUILTIN 白名单 —— uni-app 内置组件无需 import，是工具缺口不是绕过）/ check:docrefs。
- **文档同步**（本轮落盘）：兼容清单 §2.3.1 标历史 + 新增 §2.3.2/§2.6.2 + §2.7 结论 2/§2.8 表改口径；`BasePopup/README.md` 重写为 fixed 架构；`BaseActionSheet/README.md`、`UserHeader`/`DeadlinePicker` 的注释与 README 日期注记、`mine/index.vue` 注释、`global.scss` 头注同步。**技术方案 §9.2 BasePopup 行**做事实性更正（props 契约一字未动；冻结文件按 §2 惯例由我改、出处即本节，无 agent 在飞）。mine/OptionsSection README 里的 page-container 叙述按历史记录读。
- **探针副作用登记**：云端只读（plan.list/plan.detail 选长计划）；清过本地 `plan_draft_*` 存储；用户 123123 零写操作。
- **真机待复验（需新预览包）**：#73/#74/#78 弹层触摸滚动+穿透+震感；#75/#79 详情/编辑滚到底+底部安全区；#76 评论条精确高度。
