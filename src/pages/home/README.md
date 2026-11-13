# 首页编排（技术方案 §8.8 / WBS T3.5）

页面只做编排：列表内部（三态、下拉刷新、触底加载更多）在 `PlanList`，分页状态机在 `usePagingList`，
生命周期与心跳在 `usePageRefresh`，缓存在 `planStore.home`。页面里没有任何定时器、没有第二套刷新、
没有骨架屏/空态的重写。

## 接线

| 位置 | 接到哪 | 口径 |
| --- | --- | --- |
| `fetcher` | `(cursor, pageSize) => fetchPlanList({ cursor, pageSize })` | api 收 `PageQuery` 对象，`PageFetcher` 要位置参数，形状不同必须包一层 |
| `seed` | `planStore.homePage()` | 空桶算「没加载过」的口径收在 store 里，我的页四个 filter 桶共用同一条 |
| `onPage` | `planStore.setHomePage(page, append)` | 每页成功回吐，组件持列表态、store 持跨页一致态 |
| `onError` | `logger.warn('home', ...)` | 提示由 `api/request.ts` 统一 toast（§7.1），这里不弹第二条 |
| `autoLoad` | `false` | 首屏挂在 `usePageRefresh` 的 `onRefresh` → 组件 `reload()` |
| `@click` | `uni.navigateTo('/pages/plan/detail/index?planId=')` | query 参数名固定 `planId`（详情页 T3.6 并行） |
| `@expire` | `planStore.patchPlan(planId, { status: PlanStatus.Ended })` | 不整表刷新；卡片置灰由 `PlanCard` 自理，这里只保证其他消费方看到一致状态 |
| `@long-press` | **不接** | 首页没有管理入口，ActionSheet 归我的页 T5.6 |

`onRefresh` 里的 `reload({ force: !first })` 是 `seed` 与 `invalidatePage('home')` 的交界处，`first` 由
`usePageRefresh` 给（它才知道本次是首次加载还是过期/跨页失效回来）：
- 首次 → 非 force，让 seed 命中缓存，冷启动与页面重建秒出（§8.7）；
- 非首次 → 强制真请求，否则新发的计划要等用户手拽下拉刷新才出现。
不用组件的 `loaded` 当判据：那是实例级状态，一个列表实例服务多个数据桶时（我的页四个 filter）分不清「这个桶加载过没有」。

## 布局（Skyline）

- 根节点 `@include page-root`：Skyline 下页面不滚动，flex 纵向 + `overflow: hidden`，否则列表拿不到高度。
- `BaseNavbar` 用 `:backable="false"`：首页是 tabBar 页，没有返回箭头；「消息」走 `right` 插槽，点击只给未开放提示。
- 给组件标签加 `class="home__list"`（宿主节点 `flex: 1` + flex 列）：小程序里自定义组件是一个真实节点，
  `PlanList` 内部 `.plan-list { flex: 1 }` 只相对宿主节点生效；宿主节点不接高度，列表就会塌成 0。
  同一口径见 `CommentItem` 的 `.comment-item__avatar`。若运行时组件是虚节点，这几条落在不存在的节点上，无副作用。
- FAB 是 `scroll-view` 的**兄弟节点**，`position: fixed`（兼容清单 §2.2 实测可用）；直径走 `$fab-size`，
  让位用 `.home__fab-space`（padding-bottom = `$fab-size + $space-4` + 安全区）垫在列表下面，
  最后一张卡片滚到底不会被 FAB 压住 —— 不需要测量、不需要改组件样式（禁 `boundingClientRect`，兼容清单 §2.3）。
  两处同源一个 token，改尺寸不会只改一半。
- FAB 收起用 `scroll` 事件 + 时间戳节流（120ms）+ 方向死区（4px），**不用 worklet**：T0 实测 SharedValue
  无法经 Vue 模板承载（兼容清单 §2.5），CSS transition 可用。

## scroll 转发（共享层已补齐）

`PlanList` 现在显式转发内部 `scroll-view` 的滚动事件（`emits` 里有 `scroll`，`@scroll` → `triggerEvent`），
页面 `@scroll="onListScroll"` 拿到的就是它，事件载荷类型直接用组件契约 `PlanListScrollEvent`，页面不再自带一份形状。
补齐前这段代码是待命状态：小程序原生事件不跨自定义组件边界，父级 `@scroll` 只会在组件宿主标签上生成 `bindscroll`。
**滚动收起的实际手感仍未在模拟器/真机验证过**（见下一条 6）。

## 待人工验证（模拟器/真机，页面侧无法自证）

1. 列表是否真的撑满剩余高度（宿主节点那条兜底是否必要/是否够用）。
2. 下拉刷新头在 Skyline 下的表现（组件 README 也标了未实测）。
3. FAB 与安全区/原生 tabBar 的间距观感（tabBar 页 `env(safe-area-inset-bottom)` 预期为 0）。
4. 冷启动首屏：`onRefresh` 是否命中 `planListRef`（命中不了会抛错并留下一次 onShow 重试，日志 tag `usePageRefresh`）。
5. 切 tab、从详情页返回、发布后返回三条路径的刷新语义。
6. 滚动收起 FAB 的实际手感：`scroll` 事件在 Skyline 的 `scroll-view type="list"` 下是否逐帧到达、
   120ms 节流是否够（事件跨组件边界靠的是 `triggerEvent`，机制与卡片 `click` 同一条，但滚动频率高两个量级）。
7. 键盘/时钟异常兜底：节流里 `elapsed < 0`（用户改本地时钟）按到点放行，真机上把时间往前调再滚动，FAB 不应冻住。
