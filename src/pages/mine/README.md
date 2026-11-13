# 我的页（`pages/mine/index`）

WBS **T5.5**（我的页编排：`UserHeader` + `StatCards` + `FilterTabs` + `PlanList` + `plan.myList` 游标分页 + 三态 + 下拉刷新）
+ **T5.6**（我发起的计划长按管理：编辑 / 提前截止 / 删除）。
结构依据 `技术方案.md` §8.7 与 §11，接线依据 §12 J2 的六条硬约束。**本页不新增组件、不改共享层。**

文件：`index.vue`（编排）+ `types.ts`（页面局部常量/类型）+ 本 README。

---

## 1. 页面结构与「为什么头部三块不在滚动流里」

```
view.mine                                 ← @include page-root（Skyline 下页面本身不滚动）
├─ BaseNavbar(title=我的, backable=false) ← tabBar 页 + navigationStyle: custom
├─ view.mine__head                        ← ★ 静态块，flex-shrink: 0，在滚动流之外
│   ├─ UserHeader                         未登录「点击登录」/ 已登录 + 编辑资料弹层
│   ├─ StatCards  :active="activeFilter"  三张卡（created/joined/ongoing）
│   └─ FilterTabs :active="activeFilter"  四条 tab（+ ended）
├─ PlanList（v-if=isLoggedIn）            ← ★ 全页唯一的 scroll-view type="list"，flex:1
└─ BaseEmpty（v-else）                    未登录出口（点它 = 同一条登录链路）
```

§8.7 的结构图把四块都画在同一个 `scroll-view` 里，**这张图与已验收的组件源码冲突**：
`PlanList/index.vue` 的模板根节点自己就是一个 `scroll-view type="list"`（还带 `refresher-enabled` + `scrolltolower`）。
照图接就会得到「虚拟列表里套一个虚拟列表」，直接违反 §12-5「整页唯一的滚动流是一个 `scroll-view type='list'`」，
而嵌套滚动在兼容清单里是零条目（§2.8：清单没写 ≠ 可用）。

本页按**源码**接：头部三块是滚动流的兄弟静态节点，列表吃剩余高度 —— 与首页（`BaseNavbar` 静态 + `PlanList` 滚动）
同一条接法。附带两个好处：

- 头部（约 380~420rpx）常驻不滚走，切 filter 时筛选条一直在视野里，不需要吸顶（`sticky-*` 实测渲染 0×0，本来也做不了）；
- `UserHeader` 的编辑弹层是 `page-container`（`BasePopup`），不再落在 `scroll-view type="list"` 的后代里 ——
  `UserHeader/README.md` 自己列的那条「page-container 嵌在 list 容器里能否全屏覆盖 = 未验证组合」在本页不成立。

代价：小屏（iPhone SE）上列表可视高度少约 1/4 → 列入待真机复核第 6 条。

## 2. `activeFilter` 只有一个真相（§12 J2-1）

```ts
const activeFilter = ref<MyFilter>('created')

/** ★ 唯一写入点：StatCards 的 @select 与 FilterTabs 的 @change 都落在这一个函数上 */
function setActiveFilter(filter: MyFilter): void {
  if (filter === activeFilter.value) return
  activeFilter.value = filter
}
```
```vue
<StatCards :stats="stats" :active="activeFilter" :disabled="!isLoggedIn" :loading="!isLoggedIn" @select="setActiveFilter" />
<FilterTabs :active="activeFilter" :disabled="!isLoggedIn" @change="setActiveFilter" />
```

- 两个组件都是**纯受控**（不 import store、不持有选中态），高亮一律从这一个 ref 读回来。
  分成两份就必然出现「卡片亮 A、tab 亮 B、列表是 C」。
- 去重放在 setter 而不是依赖组件：`FilterTabs` 点已选中项不发事件，`StatCards` **会**发
  （`StatCards/index.vue:54-56` 只判 `disabled`，不判重复）。少了这层，多点一次同一张卡 = 一次多余的 `reload()`。
- 默认 `'created'`。**没有「全部」这个 tab**：`MyFilter` 只有四个值（`constants/plan.ts:27`），
  「全部」要 `created ∪ joined` 并集，而两个桶的游标锚点不同（`plan/src/handlers/myList.ts` 头注释：
  created 锚 `createdAt`、joined 锚 `lastActionAt`），并集与游标分页和 3s 预算都不友好 —— 已裁决不做。

切 filter 的取数：

```ts
const fetcher: PageFetcher<PlanSummary> = (cursor, pageSize) =>
  fetchMyPlans({ cursor, pageSize, filter: activeFilter.value })   // 调用时读 ref，不是快照

watch(activeFilter, async () => {
  await nextTick()
  await planListRef.value?.reload()   // 不 force：seed 命中该桶就秒出（§8.7「切回不重新请求」）
})
```
`seed: () => planStore.myPage(activeFilter.value)` + `onPage: planStore.setMyPage(activeFilter.value, page, append)`
—— 缓存主人是 `planStore.myLists[filter]`（四个桶），页面只在 `onPage` 里写、在 `seed` 里读。
竞态由 `usePagingList` 的 `seq` 代次挡（切桶时在途旧请求整条作废，`onPage` 不会被旧结果调用，
所以 `activeFilter.value` 在 `onPage` 里读是安全的）。

## 3. stats 读一处、刷新一次（主 agent 验收时改写的口径）

```ts
const stats = computed(() => userStore.stats)                 // 唯一读数的地方，不 import api/user
// loadPage 内：void userStore.refreshStats().catch(...)       // 唯一发请求的地方
```

本页**不直接 import `api/user`**：数字只从 `useUserStore().stats` 读，重算走 `refreshStats()`（= `user.stats`），
所以页面仍然只有一条取数路径，只是这条路径不再指望 `userInfo` 白送。

**为什么必须发这一次**：`users.stats` 只是冗余镜像 —— 建档时写死 `{0,0,0}`（`cloudfunctions/user/src/handlers/login.ts:66`）、
登录路径明确不重算（同文件 `:9-10`）、全云端唯一改写它的是 `handlers/stats.ts:32`。
所以「随 `userInfo` 一并到位」拿到的一直是那份 0（原 §12 J2-2 与 §8.7 都这么裁决，两处已在验收时改掉；
本页上报的缺口 1 就是这条，见 §8）。

**为什么挂在 `loadPage` 而不是 onShow 必刷**：进入 `loadPage` 的前提是 `usePageRefresh` 判定过期或被 `invalidatePage`，
最多约 60s 一次；`user.stats` 是 read-kind，不占 §11.3 的写限流桶，且云端算完顺手回写库。
**不 await**：数字旧着只是不好看，列表拉不到才是真问题，所以它失败只留日志、不把整页标脏。

`useUserStore().refresh()`（= `user.login({})`）本页**仍然不调**：它拉回的是库里那份旧镜像，换不到新数字，
却多一次 write-kind 往返。

`loading` 只在未登录时给：已经登录时手里就有上一次的数字，刷新期间把它闪成占位条是纯噪音
（`refreshStats` 落地时是原地换数字，不走 loading 态；这一条与 `UserHeader/README.md` 示例的 `:loading="refreshing"` 不同，是本页的裁决）。

## 4. 未登录路径（§12 J2-3）

```ts
async function loadPage({ first }: PageRefreshContext): Promise<void> {
  await nextTick()
  if (!isLoggedIn.value) return                 // ← 不发列表请求（游客调 plan.myList 只会吃 1002）
  const list = planListRef.value
  if (!list) throw new Error('planList instance not mounted')
  await list.reload({ force: !first })
}
const { markStale } = usePageRefresh({ key: PAGE_KEY, onRefresh: loadPage })
```

```ts
async function onLogin(): Promise<void> {
  if (loggingIn.value || isLoggedIn.value) return
  loggingIn.value = true
  try {
    await userStore.login(undefined, { silent: true })   // 全工程唯一登录链路（与 App.vue 同一个方法）
    markStale()
    await loadPage({ first: true })
  } catch (err) {
    showToastMsg('登录失败，请检查网络后重试')
  } finally { loggingIn.value = false }
}
```

- **只有一条登录链路**：`useUserStore().login(profile, options)`。`UserHeader` 不自登录，只 `emit('login')`；
  本页不调 `uni.login`、不 import `@/api/user`、不在组件里另起一次。
- `silent: true` 必须有：不传时 `request.ts` 会给失败弹一条 toast，而冷启动（App.vue）要求静默。
  用户**主动**点登录失败需要反馈，所以页面自己弹那一条 —— silent 已经掐掉了 api 层那条，**不会双弹**。
- 未登录时 `PlanList` **整块不渲染**（`v-if`），换成 `BaseEmpty` + 「点击登录」。
  否则组件会永久停在骨架屏（`loaded=false` 且没人发请求），那是个假「加载中」。
  `StatCards`/`FilterTabs` 保留但传 `disabled`（拦点击）+ `loading`（画占位条而不是 0）。
- 未登录态点登录只是**静默建档**（`user.login({})` 拿 openId），昵称头像仍靠 `UserHeader` 的「编辑资料」填。

`UserHeader @updated`（§12 J2-4）：

```ts
function onProfileUpdated(): void {
  invalidatePage(PAGE_KEYS.home)   // 首页那些卡片也挂着同一个作者名
  void runNow()                    // 本页立刻重拉，走 usePageRefresh 的锁（缺口 7 的落点）
}
```
必须重拉的原因不是「保守起见」而是字面事实：`plan.author` 是**读时 join `users` 文档**拼出来的
（`cloudfunctions/common/src/mapper.ts:71` 的 `toPlanSummary(row, author, now, myOption)`），不是写在计划里的快照，
所以昵称改了之后旧值只剩在**前端缓存**里 —— 不重拉就一直是旧名字。
`runNow()` 里 `first` 由 `lastLoadedAt !== 0` 算出，本页此时必然已经加载过 → `first: false` →
`loadPage` 走 `reload({ force: true })` 绕过 `myLists` 的桶缓存，拿到的才是服务端重新 join 的作者名。

## 5. T5.6：长按管理（编辑 / 提前截止 / 删除）

`PlanList` 只 `emit('long-press', planId)`，菜单归页面。

```ts
function onLongPress(planId: string): void {
  if (activeFilter.value !== 'created') return      // 只在「我发起的」里给入口（§12 J2-5）
  if (mutationInFlight) return
  const summary = planStore.myLists[activeFilter.value].list.find((i) => i.planId === planId)
  if (!summary) { showToastMsg('这条计划已不在当前列表，请下拉刷新'); return }
  void openManageSheet(summary)
}
```

- **为什么只在 `created`**：`ongoing` / `ended` 都是 `created` 的子集（同一条 `listByAuthor`，只差状态集合），
  四个桶各给一遍入口 = 「能不能管」有四种答案；`joined` 里根本不是我的计划。
  云端 `assertAuthor` 才是最终防线，页面这层只是不给误入口。
- **为什么读 store 桶而不是 `planListRef.value.list`**：桶与组件列表是**两个数组**（§6），
  但每条写路径都成对更新（`onPage`/`seed` 同时灌两边、`closeEarly` 是 `patchPlan` + `patchItem`、
  删除是 `dropPlanEverywhere` 里 filter + `removeItem`），所以取到的内容一致；
  而 store 这边类型是干净的 `PlanSummary[]`，组件暴露的 ref 只是渲染态的顺带出口。
- 找不到条目时**必须给一句话**：静默 return 的表现就是「长按没反应」且零报错，是这一带最难查的缺陷形状。

### ActionSheet 的两条路，本页选 `openNative`

| | `sheet.openNative()`（`uni.showActionSheet`） | `sheet.open()` + `<BaseActionSheet>` |
| --- | --- | --- |
| 宿主节点 | **不需要** | 必须在页面渲染 `<BaseActionSheet>`，漏了就是 Promise 永不 resolve + 零报错（§12 J2 点名） |
| 能力 | 纯文案 ≤6 项，不能置灰、不能 danger 配色、无副标题 | 受控、可 `disabled`/`danger`/`desc` |
| 渲染成本 | 0（原生弹窗，不进页面节点树） | 页面多一个常驻节点 |
| 本页动作 | 三项纯文案，够用 | 用不上增量能力 |

选 `openNative`。理由：① 三项菜单没有一项需要 `desc`/`danger`/置灰，`open()` 的能力全部落空；
② 本页是第一次接长按，用原生弹窗把「忘渲染宿主 → 点了没反应」这个坑整个绕掉；
③ 与详情页（`pages/plan/detail/index.vue:276`）同一条路，两页不会长出两套菜单口径；④ 零渲染成本。
**代价**：原生菜单不能把「已截止」的项置灰 → 本页改成**不把做不了的动作摆出来**（见下）。
真机若发现 `showActionSheet` 在 Skyline 下弹不出来，退路是切到 `sheet.open()` 并在 `.mine` 根下、
`scroll-view` 的兄弟位置渲染 `<BaseActionSheet>`（markup 已隔离，改动是单点）。

菜单内容按当前状态生成：

```ts
function manageActionsFor(summary: PlanSummary): ManageAction[] {
  const actions: ManageAction[] = []
  if (!isClosed(summary)) {
    actions.push({ label: MANAGE_LABELS.edit, run: () => goEdit(summary.planId) })
    actions.push({ label: MANAGE_LABELS.closeEarly, run: () => void closeEarly(summary.planId) })
  }
  actions.push({ label: MANAGE_LABELS.remove, run: () => void removeFlow(summary) })
  return actions
}
```
`isClosed()` = `status !== Ongoing` 或 `deadline > 0 && deadline <= peekNow()`。
已截止的计划只剩「删除」：编辑与改期都会被云端 `assertPlanUpdatable` 回 3002，
摆一个必然报错的菜单项是用一次报错当交互。

### 三个动作各走哪个 api

| 动作 | api | 云端 | 确认 |
| --- | --- | --- | --- |
| 编辑 | 无（纯跳转） | — | 无（编辑页自己管退出确认） |
| 提前截止 | `fetchPlanDetail` + `updatePlan` | `plan.detail` → `plan.update` | `modal.confirm` |
| 删除 | `removePlan` | `plan.remove`（软删 `status=3`） | `modal.confirm`（写明「不可恢复、票与评论一并失效」） |

**编辑**：`uni.navigateTo({ url: '/pages/plan/edit/index?planId=' + planId })`。
跳转前调 `markStale()`：编辑页改了什么、有没有记得 `invalidatePage('mine')` 都不该影响本页的正确性，
「从编辑页回来必重拉」由本页自己保证（一次列表往返，换掉一条跨页字符串契约）。

**提前截止 = 一次读 + 一次写，不是单次调用。**

```ts
const current = await fetchPlanDetail(planId, { silent: true }).catch(() => null)
if (!current) { showToastMsg('没读到计划内容，未做改动'); return }
const deadline = peekNow() + EARLY_CLOSE_GRACE_MS
await updatePlan({
  planId,
  title: current.title,
  blocks: current.blocks,
  images: current.images,
  deadline,
  optionsEnabled: current.optionsEnabled,
  options: current.options,
})
```

为什么必须是完整 payload：`plan.update` 的 req 是 `PlanWritePayload & { planId }`（`src/types/cloud.ts:47`），
而 `plan.update` 走的是 `validatePlanWrite`（`cloudfunctions/plan/src/handlers/writeShared.ts:67`，
它先调用 `cloudfunctions/common/src/planPayload.ts:116` 的 `normalizePlanWrite`，再叠 `assertOptionQuota`
与 `assertImagesInThisEnv`），这是**整单校验** ——
title 必填非空、`blocks` 必须非空数组且逐块校验、`images` 走 `asFileIDList`、`optionsEnabled` 必填布尔、
`options` 逐条校验。**没有任何打补丁式只改一个 field 的口子**，少带任何一项都是 1001 或「正文内容不能为空」。
所以只能先 `plan.detail` 拿全量、换掉 `deadline` 原样回提。
副作用（已确认是云端既定行为，不是本页的 bug）：`update.ts` 会重新 `reviewText` + `reviewImages`，
即提前截止会把整篇内容再送审一次。

时间基准：`peekNow()`（校准时间，`composables/useServerNow.ts:7`）而**不是 `Date.now()`** ——
倒计时与截止判定全走校准时间，用本地钟会出现「用户钟快 1 分钟 → 提交即被云端判成过去 → 1001」
或反过来「本地还没到就显示已截止」。
目标值取 `now + 60_000` 而不是「立刻」：云端 `resolveDeadline` 只接受「与库里原值相同」或「严格晚于 now」，
`deadline <= now` 直接 1001，而 0 的语义是「不限截止」（完全相反）。**v1 云端没有「立即截止」这个写入口**，
所以文案必须写「约 1 分钟后截止」而不是「立即截止」（缺口 6）。

写成功后的本地收敛**只 patch deadline、不写 status**：`update.ts` 刻意不翻状态（1→2 只归 scheduler，§6.7）。
卡片的「已截止」由 60s 后 `CountDown` 的归零沿 → `@expire` → `onExpire` 落地，与首页同一条路，不抢跑云端裁决。

**删除**：

```ts
const confirmed = await modal.confirm({ title: '删除计划', content: `「${truncate(...)}」删除后不可恢复…`, confirmText: '删除' })
if (!confirmed || !beginMutation()) return
await removePlanApi(summary.planId)     // 失败文案由 request.ts 统一 toast，页面不补第二条
dropPlanEverywhere(summary.planId)
invalidatePage(DETAIL_PAGE_KEY)
showToastMsg('已删除')
```
`modal.confirm` 是 `uni.showModal` 的封装出口 —— 页面里不出现裸 `uni.showModal` / `uni.showToast`（§12-6）。
`mutationInFlight` 是普通 `let` 而不是 `ref`：它只拦事件、模板不读，做成响应式状态是假装它参与渲染。

## 6. 删除 / 截止之后跨页怎么收敛（§12 J2-6）

| 消费方 | 读什么 | 本页怎么让它收敛 |
| --- | --- | --- |
| 本页 `PlanList` 屏幕上那张卡 | **组件内部**的 `list` ref | `planListRef.removeItem(planId)` / `patchItem(planId, { deadline })` |
| 首页 `PlanList` | `planStore.home.list`（桶） | `dropPlanEverywhere` 里 filter 掉；截止由 `patchPlan(planId, { deadline })` |
| 下次进「我的」某桶 | `planStore.myLists[filter].list`（桶） | 同上，四个桶一起 filter（`MY_FILTERS` 枚举，不手写四个 key）；`seed()` 下次直接把它端出来 |
| 页面栈里那个详情页 | 它自己的 `detail` ref | **写穿 store 到不了它** → `invalidatePage('plan-detail')`，下次 onShow 重拉，被删的那条自然走它的错误重试态 |
| `voteCounts` / `myVotes` | `planStore` | **刻意不清**（与详情页 README §3 第 2 条同口径：清了会退回旧快照） |

**为什么每件事都要做两遍（桶 + 组件）**：这两份是**两个数组**，不是一份数据的两个视图 ——
`usePagingList.applyPage` 每次都新建组件的容器（`src/composables/usePagingList.ts:83` 的
`list.value = [...incoming]`），`planStore.writeBucket` 另建一份桶（`src/stores/plan.ts:57` 的
`bucket.list = [...page.list]`），两边各自展开，**元素是同一批对象、容器不是同一个**。
所以 `patchLists` 里 `bucket.list[idx] = { ...bucket.list[idx], ...partial }`（`src/stores/plan.ts:97-103`）只换桶里那一格（还是新对象），
组件那份数组既看不到替换、也看不到属性写入。少了 `patchItem`，屏幕上的倒计时不会重排；
少了 `patchPlan`，`isClosed()`（读桶）和下次 `seed()` 会把旧 deadline 端回来。
首页同一条口径（`src/pages/home/README.md:17`：`@expire` 只 `patchPlan`，「卡片置灰由 `PlanCard` 自理」）——
差别只在首页没有第二处要改：它不需要屏幕上的倒计时立刻按新 deadline 重排，而本页的提前截止需要。
这条「每个页面都要记得改两遍」本身就是共享层缺口，见 §8 第 9 条。

`dropPlanEverywhere` 直接给 `planStore.home.list` / `myLists[f].list` 赋值，是因为 **store 没有 `removePlan()`**
（缺口 2，已上报，本波不许改 store）。除这一处以外页面不写 store 内部状态。

删除**不** `invalidatePage('home')`：五个桶都已在原地摘掉，再标脏只会让首页多一次无收益的整表重拉
（还会把滚动位置抖回顶部，§7.3 的原话）。`plan.remove` 不在 `IDEMPOTENT_ACTIONS` 里，超时不会自动重试，
所以失败路径必须让用户自己再长按一次 —— 这是选择「不自动重试」的已知代价。

## 7. 三态 / 下拉刷新 / 触底：一条都不在页面里重写

骨架屏 → 空态 → 列表 + 底部 `BaseLoadMore`（loading / nomore / error 重试）全在 `PlanList` 内部
（组件 README「三态」表），触底由组件自己的 `scrolltolower` 驱动，下拉刷新由组件的
`refresher-enabled` + `refresh()` 驱动。页面只做三件事：`usePageRefresh` 的 onShow 差异化重拉、
`seed`/`onPage` 与 store 的接线、`emptyText` 按 filter 换文案。

- `emptyActionText` **不给**：`PlanList` 的空态按钮语义固定是内部 `reload({force:true})`，
  挂在「还没有发布过计划」旁边是一次无意义的重取，而按钮文案改不成「去发布」（缺口 7）。
- 页面**不挂任何定时器**：倒计时心跳归 `utils/ticker`（`CountDown` 订阅），
  onShow/onHide 的 `resumeTick`/`pauseTick` 归 `usePageRefresh`。
- 页面**零测量**：没有 `boundingClientRect` / `createSelectorQuery`（`scroll-view type="list"` 内视口外节点
  取矩形会永久挂起，兼容清单 §2.3）。本页也不需要 —— 没有滚动定位诉求，没有吸底栏。
- 页面**不接 `@scroll`**：我的页没有 FAB，接了只会白白把逐帧事件变成逐帧 setData（§11.1）。
- 选择器口径：一个节点一个类名 + 平铺 class，无后代/子代/伪元素/结构伪类；
  尺寸与颜色全走 token（`$space-*`/`$color-*`/`$tap-min-height`），无字面量。

## 8. 上报的共享层缺口（一条都没动，等主 agent 收口）

1. **`users.stats` 自建档起永远不会变** —— 三张卡的数字与列表条数必然不一致（T5.3 验收标准直接失效）。
   证据链：`cloudfunctions/user/src/handlers/login.ts:9-10` 明写「登录路径**不重算** stats，权威统计由 `user.stats` 负责」；
   而全云端唯一写 `users.stats` 的地方是 `cloudfunctions/user/src/handlers/stats.ts:32`；
   前端 `src/api/user.ts:25` 的 `fetchStats` **零调用方**（`§8.7` 裁决 v1 不调）；store 侧
   `src/stores/user.ts:37` 的 `applyUserInfo` 只是把 `userInfo.stats` 原样搬进去（第 41 行）。结果：它同步的永远是建档时那份 `{0,0,0}`。
   本页按 §12 J2-2 的硬约束**没有**自己去调 `user.stats`（那正是被点名禁止的「第二份真相」）。
   建议（三选一，都在共享层/云端，不在页面）：① `user.login` 命中已有用户且距上次统计超过 N 分钟时并发三条 count；
   ② `plan.create/remove` 与 `vote.submit`/`comment.create` 对 `users.stats` 做原子 `$inc`；
   ③ 由主 agent 改裁决：我的页 `onRefresh` 里调一次 `userStore.refreshStats()`（`user.stats` 顺带回写库，
   这条最省，但要把 §8.7 那句「v1 前端不调它」改掉）。**这条需要产品口径确认，页面不自作主张。**
   **主 agent 验收处置：取 ③，已落地。** 根因确认在主 agent 的派发指令与 §8.7 的旧裁决，不在页面 ——
   页面按约束不越权是对的。选 ③ 而非 ①/② 的三条理由：
   ① 要改 `user.login`（冷启动首屏多等 100~200ms，且云函数改动撞上「部署需用户审批」这道门）；
   ② `$inc` 要把 `plan.create/remove`、`vote.submit`、`comment.create`、scheduler 翻状态四条路径全部配平，
   **漏一条就永久漂移且没有自愈手段**，而 `user.stats` 每次全量重算 = 天然自愈；
   ③ 零云端改动、read-kind 不占写限流桶、调用频次由 `usePageRefresh` 的 60s 过期卡住。
   落点：`src/stores/user.ts` 的 `refreshStats()` + 本页 `loadPage` 里的非阻塞调用。
   `ongoing` 与列表仍有 §8.7 记过的 ≤1 分钟窗口差（stats 现算 deadline，列表按 status），不影响本条结论。
2. **`src/stores/plan.ts` 没有 `removePlan(planId)`** —— **主 agent 验收处置：已落地，口径一并定下。**
   store 现在有 `removePlan(planId)`（`src/stores/plan.ts:151`）：首页 + 我的四个 filter 一次摘干净，
   并**同时清掉 `voteCounts`/`myVotes` 里那条**。为什么跟着清：本 store 不持久化，留着只会是一条
   永远刷不新的僵尸条目 —— `absorbSummaries` 只填「尚不存在」的 key，而这条计划再也不会被任何列表返回。
   本页 `dropPlanEverywhere` 因此缩成两行：`planStore.removePlan()` + `planListRef.removeItem()`
   （后者仍必须调，理由见第 9 条）。
3. **页面失效 key（`'home'` / `'mine'` / `'plan-detail'`）没有单一来源** ——
   **主 agent 验收处置：已落地，外加一条行为修正。**
   新增 `src/constants/pages.ts`：`PAGE_KEYS = { home, mine, planDetail } as const` + `PageKeyValue`。
   `usePageRefresh` 的 `key` 与 `invalidatePage` 的参数**改成 `PageKeyValue` 类型**（`invalidatePage`
   另接 `'*'` 通配），所以四个页面里再写陌生串就编译不过 —— 光有常量表挡不住抄错，类型才挡得住。
   本页 `types.ts` 里那两个自抄的 key 已删除，四个页面（首页/详情/我的/编辑）统一 import。
   **只收在用的三个**：编辑页只失效、不注册 key，给它留一项就是给未来留一个没人维护的串。
   顺带把上面那句「已经踩到的后果」修掉：详情页 `onVoted` / `onServerClosed` 现在都补了
   `invalidatePage(PAGE_KEYS.mine)`（`src/pages/plan/detail/index.vue:324` 与 `:339`）——
   票数写穿了 store，但参与人数/评论数是列表快照字段，只有重拉才追得上；
   `onServerClosed` 更必须补，因为状态一改，这条计划要在 ongoing / ended 两个桶之间搬家。
   「投票后该失效哪些页」从此有了口径：**改了这条计划的计数字段或状态 → 首页 + 我的都要脏**。
4. **`src/api/plan.ts:24` 的导出名 `removePlan` 与页面语义撞车** —— **主 agent 验收处置：不改名，改成一条消歧口径。**
   api 层的函数名与云端 action 名一一对应（`plan.remove` → `removePlan`）是这一层的既定映射，
   换成 `removePlanById` / `deletePlan` 会把「前端动词 ↔ 云 action」的对账成本转给每个读 `src/api/plan.ts` 的人，
   而调用点全在页面里，改名带来的收益只是省下一次 `as` 别名。
   本页的删除流程函数定稿为 `removeFlow`（不与两者同名），api 侧保留
   `import { removePlan as removePlanApi }` —— **口径：api 导入与 store/页面动词撞名时一律 `as xxxApi`**，
   别名本身就是「这是 RPC、那是缓存操作」的注释。
   现在确实有三个 `removePlan` 语义（`api/plan.ts` 的 RPC、`planStore.removePlan` 的摘桶、曾经的页面函数），
   前两个一个是网络调用一个是纯本地，`Api` 后缀已足够区分。
5. **`PlanList` 的空态按钮不能由页面接管** —— **主 agent 验收处置：已落地。**
   组件新增 `emptyActionOwned?: boolean`（默认 false，首页与其余调用方行为不变）+ `empty-action` 事件：
   true 时点按钮只转发、组件不再 `reload({force:true})`。
   本页现在 `created` 一个 tab 开这条：按钮文案「去发布第一条」→ `goCreate()` 进新建形态（不带 planId），
   其余三个 filter 的 `EMPTY_ACTION_TEXTS` 留空 = 不显示按钮（它们的空成因在页面之外，任何按钮都是误导）。
   `EMPTY_TEXTS` 四条同时收短：原来把「去首页点右下角「+」」写在文案里，现在动作由按钮承担。
   `goCreate` 与 `goEdit` 同一条口径：出页面之前自己 `markStale()`。
6. **云端没有「立即截止」的写入口**：`cloudfunctions/common/src/planPayload.ts:97-107` 的 `resolveDeadline`
   要求 `deadline > now`（或等于库里原值），而 `deadline = 0` 的语义是「不限截止」。
   于是「提前截止」只能写成 `now + 60s`，文案被迫说「约 1 分钟后截止」。
   建议 `plan.update` 增一个 `closeNow: true` 分支（服务端自己盖 `deadline = now` + `status = Ended`），
   或单开 `plan.close` —— 属于云端契约变更，本波只上报。
7. **`usePageRefresh` 不暴露「立刻跑一次」的出口** —— **主 agent 验收处置：已落地。**
   controller 现在有 `runNow(): Promise<void>`（`src/composables/usePageRefresh.ts`），
   内部仍走同一个私有 `run()`，所以自动在 `refreshing` 锁的保护伞下。
   它还多保证了一件事：撞上「别的页面发起的在途刷新」时先等那一次落地、再自己跑一趟 ——
   那一次是**登录前 / 改昵称前**发出的，结果不能用。
   本页两处（`onLogin` 尾部、`onProfileUpdated`）因此不再直接调 `loadPage()`，也不再需要 catch：
   `runNow()` 不 reject，失败时新鲜度戳不盖、下次 onShow 自动重试。
8. **昵称/资料在多设备改了不会自动同步**：这是第 1 条的同一根因的另一面（本页不主动 `refresh()`），
   本地 TTL 7 天（`stores/user.ts:15`）。若产品要求「进我的页就同步一次昵称」，正解是给 `user.login`
   加 `?fresh=1` 或在 store 里加一个明确的 `refreshProfile()`，而不是页面各自决定要不要 `refresh()`。
9. **`planStore` 与 `usePagingList` 是两份独立数组，`patchPlan` 不会传导到屏幕**（本轮自己踩到的，值得收口）：
   `usePagingList.applyPage` 每次新建组件容器（`src/composables/usePagingList.ts:83`），
   `planStore` 的 `writeBucket` 另建一份桶（`src/stores/plan.ts:57-62`），而 `patchLists` 只替换桶里那一格（`src/stores/plan.ts:97-103`）。
   任何页面调 `patchPlan`（`src/stores/plan.ts:134`）之后，屏幕上那张卡**不会自己变**。
   本页的做法是每次成对调（`patchItem` / `removeItem`），但这是「每个页面都得知道这条暗契约」的解法。
   两个正解（都在共享层，本波不许动）：① `usePagingList` 增加 `watch` 订阅对应桶，桶变即重挂 `list.value`；
   ② store 提供 `patchPlan(planId, partial, { target })` 之类显式广播。
   **在收口之前，请把它写进任何后续列表页的必读口径**，否则「改完 store 界面不动」会以最难查的缺陷形状重现。
   **主 agent 验收处置：口径已上收，两条正解暂不做。** 这条契约现在写在它必须被读到的地方 ——
   `src/stores/plan.ts` 的 `patchLists` 上方（改 store 的人一定看见），并进了 `docs/agent-prompts.md` §13
   的「任何列表页派发前必读」。**为什么不选 ①**：`usePagingList` 里 `watch` 桶会让「组件容器」与「桶」
   变成双向同步，翻页 append、下拉刷新、页面自己 `patchItem` 三处都会重挂列表，
   等于把一次性成本换成每次刷新都触发的响应式环路；
   **为什么不选 ②**：`{ target }` 参数把「哪些视图要跟着变」重新变成调用方的手工选择，
   与现在成对调用的差别只是写法，漏调的失败形状一模一样。

## 9. 待真机 / 模拟器复核（清单没写 ≠ 可用，§2.8）

1. **`uni.showActionSheet`（长按菜单）在 Skyline 下的表现**：兼容清单零条目。详情页 README §5-5 已列同一条，
   两页共用一次复核结论。退路：`sheet.open()` + 在 `.mine` 根下渲染 `<BaseActionSheet>`（`scroll-view` 的兄弟节点）。
2. **`uni.showModal`（两个二次确认）**：同上，原生弹窗，零条目。退路：`modal.confirmCustom()` + `<BaseModal>`。
3. **`uni.showLoading` / `hideLoading`（提前截止的两个往返）**：零条目。
   去掉它不影响正确性，只影响「点了之后 2~16s 没有任何反馈」的观感 —— 真机若表现异常就直接删掉这一段。
4. **`refresher-enabled` 的下拉刷新头**：`PlanList/README.md` 已列未实测；本页额外要看的是一处新组合 ——
   下拉手势**只在列表区域**有效，头部三块在 `scroll-view` 之外，从头部往下拽不会触发刷新（是否符合预期需产品点头）。
5. **`activeFilter` 连点与刷新并发**：`usePagingList.reload()` 会 `seq += 1` 抢下状态机，
   而页面直调 `loadPage()` 那条路曾归 `usePageRefresh.run()` 的 `refreshing` 锁管不到（缺口 7）——
   **现已收口：页面两处都改走 `runNow()`，本页没有任何一条绕锁的取数路径**，
   所以真机要看的是「锁确实生效」，而不是「绕锁会造成几次多余往返」。
   理论结果：显示永不会错（旧请求被代次作废），最坏是少一次即时刷新。
   真机快速连点四个 tab + 下拉一次 + 改一次昵称，确认无重复数据、无两次并发列表请求。
6. **小屏高度分配**：`mine__head` 约 380~420rpx 常驻，iPhone SE / 打开系统大字体时列表还剩多少，
   需实测；不够就把 `StatCards` 与 `FilterTabs` 的纵向 margin 各收一档（都在页面侧，不动组件）。
7. **`UserHeader` 的 `button open-type="chooseAvatar"` / `input type="nickname"`**：组件侧已列真机复核，
   本页额外贡献一条正向证据 —— 弹层（`page-container`）现在挂在静态头部而不是 `scroll-view` 后代里，
   组件 README 里那条「未验证组合」在本页不成立，真机若能正常全屏覆盖就把那条改掉。
8. **页面切走再回来的倒计时**：`onHide → pauseTick`、`onShow → resumeTick + 强广播一次`（`usePageRefresh` 内部）。
   看「提前截止」后切到首页再切回来，卡片是否已按归零沿置灰（60s 这个窗口正好是最容易看出问题的地方）。
9. **集成首跑 `npm run build:mp-weixin`**（本波两路都被禁止跑构建）：`UserHeader`/`StatCards`/`FilterTabs`
   三个 I1 路组件此前从未进过构建，本页是它们的 WXML 第一次被真正编译。
   重点看：`UserHeader` 里原生 `<button>` 嵌自定义组件（`BaseAvatar`）的产物、`BasePopup` 的 `page-container` 位置。

## 10. 与组件 README 不一致的地方（一律以源码为准）

| 文档 | 说法 | 源码事实 | 本页做法 |
| --- | --- | --- | --- |
| `UserHeader/README.md` §Props + 缺口 3 | `nickNameMaxlength` 默认 **`-1` = 不限长**，前端没有昵称上限 | `UserHeader/index.vue:37` 默认已是 `Limit.NICKNAME_MAX`(30)，`constants/plan.ts:52` 的 `NICKNAME_MAX` 也有了这个值；`types.ts` 注释已改，README 没跟上 | 页面**不注入**这个 prop（用组件默认值即可） |
| `UserHeader/README.md` §接线示例 | `UserHeader`/`StatCards`/`FilterTabs`/`PlanList` 全放进页面自己的 `<scroll-view type="list">` | `PlanList/index.vue` 的根节点**自己就是** `scroll-view type="list"` → 照抄就是嵌套滚动容器 + 两个滚动流 | 头部三块静态在滚动流之外（§1） |
| `FilterTabs/README.md` §文案单一来源 | 「`MY_FILTER_LABELS` 在 `types.ts` 里导出」+「已上报缺口：建议上收到 `constants/plan.ts`」 | 已经上收了：`constants/plan.ts:36`；消费方 `FilterTabs/index.vue:17` 与 `StatCards/types.ts:1` 都从 `@/constants/plan` import（`FilterTabs/types.ts` 只留了 `type MyFilter` 那一行） | ——（纯文档过期，建议删那条缺口） |
| `StatCards/README.md` §接线 | 「`StatCards` 只从 `FilterTabs/types.ts` 取文案常量」 | 同上，取自 `@/constants/plan` | —— |
| `UserHeader/README.md` §接线示例 | `onRefresh` 里 `await userStore.refresh()`；`:loading="refreshing"` | `user.login` 不重算 `stats`（`login.ts:9-10`）→ 这次往返拉不回新数字，要拉数字得用 `user.stats` | 不调 `refresh()`；改在 `loadPage` 里非阻塞调 `refreshStats()`（理由见 §3）；`loading` 只在未登录时给 |
| `UserHeader/README.md` §未登录口径 | 推荐 `v-if="isLoggedIn"` 整块不渲染 `StatCards` | 组件本身支持 `disabled` + `loading` 两个 prop | 保留渲染但 `disabled` + `loading`：§12 J2-3 明确要求「传 `disabled`」，且不渲染会让登录前后版式跳一大块 |

## 11. 刻意没做

| 项 | 原因 |
| --- | --- |
| 「全部」tab | `MyFilter` 只有四个值；并集查询与两套游标锚点冲突（已裁决，§2） |
| 个人主页 / 关注 / 消息 / 设置 | §1.3 非目标 |
| 自己发 `user.stats` 拉数字 | §12 J2-2 点名禁止；改为上报缺口 1 |
| 「立即截止」 | 云端不接受 `deadline <= now`（缺口 6） |
| 页面自己写 `onShow` / `onHide` / 定时器 | 全部归 `usePageRefresh` + `utils/ticker` |
| 长按菜单接 `<BaseActionSheet>` | 见 §5 的取舍表；详情页同一条路 |
| 编辑页返回后读它的返回值 diff | 没有返回值可读（`navigateTo` 不回传），统一 `markStale()` 重拉 |
| 列表项动画 / worklet | 兼容清单 §2.5：SharedValue 无法经 Vue 模板承载 |
