# 计划详情页（`pages/plan/detail/index`）

WBS **T3.11**（详情页整体编排：滚动容器 / 评论区触底加载 / 分享）+ **T3.12**（详情页 ↔ 列表页的 store 联动）。
本页只吃已验收的 11 个业务组件 + base 组件，**不新增组件、不改共享层**。

## 1. 结构（§8.4 硬约束：整页只有一个 scroll-view）

```
view.plan-detail                        ← @include page-root（页面本身不滚动，flex 纵向）
├─ BaseNavbar                           ← navigationStyle: custom，可返回
├─ scroll-view（不带 type）             ← ★ 全页唯一滚动流（WebView 渲染；type="list" 是 Skyline 专属，#37 移除）
│   ├─ [loading] BaseSkeleton type="detail"
│   ├─ [error]   BaseEmpty（文案 + 重新加载）
│   ├─ [ready]   头部卡：标题 / BaseAvatar + 昵称 / CountDown(tone=chip,size=lg) / 配图三宫格
│   ├─ [ready]   正文卡：ContentRenderer :blocks（组件内部 sanitizeBlocks，页面不清洗第二遍）
│   ├─ [ready]   选项区：OptionCardList :options（组件自己判空，页面不包第二层）
│   ├─ [ready]   投票卡：VoteRatioBar(size=lg,show-count) + VoteActions
│   ├─ [ready]   评论区：CommentList :comments :now :can-remove
│   └─ 尾部锚点（id=planDetailTail）：给吸底条腾高 + 键盘高度叠加 + scroll-into-view 目标
└─ CommentInput                         ← ★ scroll-view 的兄弟节点，fixed 吸底在滚动流之外
```

- 触底加载：页面 `@scrolltolower` → `commentListRef.loadMore()`（`CommentList` 内部**不嵌** scroll-view）。
  `:lower-threshold` 绑 `COMMENT_LOWER_THRESHOLD`（`@/components/business/CommentList/types` 导出），页面里没有魔法数。
- 状态分支用 `v-if="ready"` 挂在**每个区块自己**身上，不用 `<template v-else>` 包多格：
  scroll-view 的直接子节点就是平铺区块，中间不插 `<block>` 包装（历史上为 `type="list"` 的单元格；
  本页现为 WebView 普通 scroll-view，平铺结构保留）。

## 2. 接线一览（都来自已验收源码的 types.ts，不是猜的）

| 位置       | 接法                                                                                                           | 依据                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 取数       | `onLoad` 只取 `query.planId`；首屏加载挂在 `usePageRefresh` 的首次 `onShow`                                    | §7.3；页面不手写 onShow/onHide/pauseTick                                                                                                                                                |
| 写回 store | `applyVoteResult(planId, detail.votes, toStoreVote(detail.myVote))` + `patchPlan(...)`                         | §10「状态复用」                                                                                                                                                                         |
| `myVote`   | 契约是 `number`，只有 `1\|2` 认作已投，其它值 → `null` → store 删键                                            | 收窄只有 `useVote.toStoreVote` 一处（本轮从本页提上去的，`NO_VOTE` 哨兵从不进 store，§4.3 裁决 2）                                                                                      |
| 截止判定   | `status !== Ongoing` 或 `deadline > 0 && deadline <= now`（`useServerNow` 的校准时间）或倒计时归零沿           | §8.5「前端只置灰，真实状态以云函数为准」                                                                                                                                                |
| 主态       | `isAuthor = userInfo?.openId === detail.author.openId`（computed，允许 openId 晚到）→ `VoteActions` 整块不渲染 | §8.3 v1 禁止自投；本轮裁决不显示提示文案                                                                                                                                                |
| 投票后     | `voted` → `invalidatePage('home')` + `invalidatePage('mine')`；`closed` → 同样两页 + 重拉详情整页置灰          | `useVote` 内部已 `applyVoteResult` + 回滚 + 3003 纠偏；失效「我的」是因为卡片的**参与人数/评论数是列表快照字段**，写穿 store 到不了它们（key 取自 `constants/pages.ts` 的 `PAGE_KEYS`） |
| 删除权限   | `canRemove = 本人 \|\| 计划作者` 由页面注入 `CommentList`                                                      | §4.9 缺口 1 的裁决：不改 `useComments`                                                                                                                                                  |
| 评论入口   | `publish` 返回 `{ ok, toast: false }`                                                                          | `useComments.post` 的 ApiError 已由 `api/request` 统一 toast（§7.1），双弹会串成两条                                                                                                    |
| 评论成功   | `useComments({ onPosted })` 里 `bumpCommentCount(+1)` + `scrollToBottom()`                                     | 乐观 append 在 composable 内部已完成；计数**同时写穿 `planStore.patchPlan`**，首页卡片那个「评论 N」才是同步的                                                                          |
| 键盘避让   | 组件自己 `avoidKeyboard`（fixed + translateY），页面**只**接 `keyboard-height` 给滚动区尾部加高                | §4.9 三条硬规则；页面不再叠 `adjust-position`                                                                                                                                           |
| 分享       | `useShare(() => ({ title, path: '/pages/plan/detail/index?planId=…', imageUrl: cover, query }))`               | `useShare` 内部注册 `onShareAppMessage` / `onShareTimeline`                                                                                                                             |

## 3. T3.12：为什么返回首页能立刻看到新比例

`useVote` 成功后写 `planStore.voteCounts[planId]` / `myVotes[planId]`，`PlanCard` 优先读这两张表
（§4.7 第 2 条）。所以本页：

1. 加载成功后立刻用详情接口的权威值 `applyVoteResult`（顺带 `patchPlan` 把列表侧的
   `title/summary/cover/deadline/optionsEnabled/optionCount/status/commentCount` 对齐）；
2. **不在 `onUnload` 里清 `voteCounts[planId]`** —— 清了之后首页就退回进详情前的列表快照，
   T3.12 的验收标准直接失效；
3. 不改 `home.list` 的整体顺序、不重新请求列表。

## 4. 刻意没做

| 项                              | 原因                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `share-element` 跨页转场        | M0 真机复核项；本轮 F1/G1 都不做，免得两路各自发明一套（§10 指令）                          |
| 详情页下拉刷新（`refresher-*`） | 需求未列；`usePageRefresh` 的 `refreshing` 只服务它自己的 `run()`，页面自拉会把状态拆成两处 |
| 取消投票入口                    | v1 已裁决不做（`VoteTypeValue` 只有 `1\|2`）                                                |
| 「这是你发起的计划」提示        | §8.3 原文有这句，本轮裁决明确不显示；`VoteActions` 在 `isAuthor` 时整块不渲染               |
| 选项卡点投 / 选项票数           | §8.6：v1 选项只展示，冻结契约的 `vote.submit` 没有 `optionId`                               |
| 页面自己清洗 blocks             | `ContentRenderer` 内部已过 `sanitizeBlocks`，重复清洗是第二处真相                           |
| 摘要 `summary` 展示             | 它是云端从 blocks 折出来的**列表用**字段，详情页有全文，摆出来必然重复                      |

## 5. 待人工在模拟器 / 真机验证（我跑不了的部分）

1. **真手指上下拖动**（automator 合成触摸驱动不了 WebView 原生滚动，兼容清单 §0.2 #37）；区块高度与 `margin` 节奏已用 automator 几何实测。
2. `@scrolltolower` 是否真的调到 `loadMore()`：评论 > 20 条（`Limit.COMMENT_PAGE_SIZE`）时滚到底应加载下一页。
3. `scroll-into-view="planDetailTail"`：发表成功后是否滚到最后一条（兼容清单只实测过跳列表项，没测过跳尾部锚点）。
4. 键盘弹起时最后一条评论不被输入条遮住（尾部锚点静态高 = `$space-5 + $tap-min-height`，是按吸底条量级估的，真机可能要调）；收起后是否复位。
5. `uni.showActionSheet`（长按评论）在 Skyline 下的表现 —— 兼容清单未覆盖原生弹窗；这也是本页不用 `BaseActionSheet` 的原因，见 §6 第 1 条。
6. 分享卡片图：`imageUrl` 给的是云存储 `fileID`（`cloud://`），取不到时微信会退回页面截图，需真机确认可接受。
7. `<image src="cloud://…">` 与 `uni.previewImage({urls:[fileID]})` 在真机是否直接可图（§8.2 已标为待复核）。

## 6. 共享层缺口与主 agent 裁决（本页交付后由主 agent 收口）

| 上报项                                                                                                                                                            | 裁决                                                                                                                                                                                                                                                                                                                           | 落点                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `useActionSheet().open()` 的 `SheetAction{label}` 与 `BaseActionSheet` 的 `ActionSheetItem{text,desc,disabled,key}` 字段名不一致，页面用受控菜单必须自己 map 一层 | **已修**：单一真相放渲染侧。`stores/feedback.ts` 改为 `import type { ActionSheetItem }`，`SheetAction` 整个删掉；`open(request)` 直接透传，`SheetRequest \| { actions }` 那个多余联合参数也删了。页面现在可以把同一份数组同时喂给 `open()` 和 `<BaseActionSheet :actions>`                                                     | `src/stores/feedback.ts`、`src/composables/useActionSheet.ts` |
| `PlanDetail.myVote` 是 `number` 而非 `VoteTypeValue \| 0`，窄化逻辑在 `useVote` 与本页各写一份                                                                    | **契约不动**（冻结契约 + 云端镜像 `cloudfunctions/common/src/types.ts` 都返回 `number`），**第三处真相删掉**：窄化收成 `useVote.toStoreVote()` 并从 `@/composables` 出口，本页的 `myVoteOf` 已删                                                                                                                               | `src/composables/useVote.ts`                                  |
| `CommentStatus` 没有配套值 union（E3 已在 `CommentItem/types.ts` 就地窄化一份）                                                                                   | **已修**：`constants/plan.ts` 补 `CommentStatusValue`，与 `PlanStatusValue` / `VoteTypeValue` 同构；组件里那份窄化删掉                                                                                                                                                                                                         | `src/constants/plan.ts`                                       |
| 模板里用了未 import 的组件时 vue-tsc 不报（`strictTemplates` 未开 + `@dcloudio/uni-app-types` 插件 `Load plugin failed`）                                         | **不开 `strictTemplates`**：那个插件加载失败时，内置标签全会被判成未知元素，打开就是几千条噪音，等于把检查废掉。改为**静态对账脚本** `scripts/check-templates.mjs`（`npm run check:templates`）：模板标签必须能对上 `<script setup>` 的 import 或内置清单。已用负样例验证它真的会拦（PascalCase 与 kebab-case 两种写法都测过） | `package.json`、`scripts/check-templates.mjs`                 |
| `useComments.canRemove` 只判「本人」，§8.4 的「计划作者可删」要页面注入                                                                                           | **保留不改**：`useComments` 不认识计划详情，注入即为正解（§4.9 同一裁决）。组件 README 的缺口条目已同步                                                                                                                                                                                                                        | `CommentList/README.md`                                       |
| `OptionCardList` 判 `options.length >= 2` 而不是 `optionsEnabled`                                                                                                 | **不改组件也不改页面**：两者在 v1 恒等，闸门在写入侧（`planPayload.validateOptions(raw, false) → []`、开关为假时不写 options）。依据已写进组件 README —— 将来出现允许不一致的写路径，改组件，不要让每个页面各判一层                                                                                                            | `OptionCardList/README.md`                                    |

## 7. 2026-11-13 #37：标题行规格并入 + 滚动修复

- **滚动根因**：本页恒 WebView 渲染（`pages.json`），而 `type="list"` 是 Skyline 专属虚拟列表属性——留着触摸滚不动（程序化 `scrollTo` 仍可用，此前验收因此漏检）。已移除 type 属性；首页/我的（Skyline，PlanList）保留不变。
- **标题行规格**（与编辑页 #35/#36 同口径）：投票卡 `__section-head` / `__section-title` include `section-head` / `section-title` mixin——`padding: 0 0 $space-3`、无 min-height；标题 30rpx / 600 / 1.3 / `$color-text-1`。`__ratio` 的 margin-top 删除，标题→内容间距单点在 head 的 padding-bottom。评论卡 `__comments-head` 同规格，上/左右衬对齐卡内衬 `$space-3`。
- **评论首项**：`CommentItem` 新增 `first` prop，`CommentList` 传 `:first="index === 0"` 把首项顶 padding 归零——head 的 pb 已提供间距，叠加会双倍。
- 运行时实测：head pb 12px、标题 15px/600/rgb(26,29,36)、ratio.top == head.bottom；scrollHeight 952 > 视口 757、scrollTo 可用；截图 `/tmp/rt/rt-detail-top.png` / `rt-detail-prog.png`。真手指拖动待用户验收。
