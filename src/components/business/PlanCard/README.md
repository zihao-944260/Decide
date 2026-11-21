# PlanCard（T3.3）

首页 / 我的页 / 详情相关推荐共用的计划卡片，严格按技术方案 §8.5 的布局落地。

## 契约

| 类型 | 名称                   | 说明                                                                                                 |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------- |
| prop | `summary: PlanSummary` | 列表契约单条数据（必填）                                                                             |
| prop | `status?: number`      | 外层已知的 PlanStatus，覆盖 `summary.status`；只用于置灰，组件不判真实状态                           |
| prop | `animated?: boolean`   | 默认 true，比例条宽度过渡开关（整屏降级用）                                                          |
| emit | `click(planId)`        | 点击进详情                                                                                           |
| emit | `expire(planId)`       | 倒计时归零沿（挂载时已截止不触发）                                                                   |
| slot | `footer`               | 覆盖底部统计行（默认「赞同 N / 反对 N / 评论 N」）；`optionsEnabled`、`optionCount` 想上卡片就走这里 |

## 容器转场动画（open-container）

卡片根节点是 `<open-container>`（Skyline 组件，基础库 3.4.0+；`withOpenContainer` 显式触发需 3.12.2+）：
点卡片后由框架把卡片位置无缝放大成详情页并渐显，返回时反向收回。
组件不接收任何 ID（文档没有 `container-id` 属性）；`@tap` 挂在 `open-container` 上。

当前参数：底色取页面灰 `#f5f6f8`（closed 态与页面融为一体、open 态衔接详情页底色）、
closed 圆角 12px（= 卡片 24rpx 的 375 屏实际值）、open 直角无影、`fade` 300ms；
阴影由卡片自身 `box-shadow` 提供，容器不再叠一层。

入场上升的位移挂在 **open-container 外层的普通 view**（`.plan-card__wrap`）上，不能放在容器里的卡片上：
open-container 会按自身圆角裁切子树，位移放在内部会变成「每张卡在自己的盒子内上滑」，
不再是相对列表容器上升（真机实测）。

触发方式（2026-11-21 真机口径修正）：「点容器 → navigateTo」的隐式关联在 组件 → PlanList → 页面
这条链路上**不触发**动画（能跳转、无放大转场），改为显式 API：点击时用 SelectorQuery
（`.in(组件 proxy)` + `.select('.plan-card__open')`）拿 OpenContainer 实例，随 `click` 事件
交给页面，页面调 `uni.navigateTo({ withOpenContainer })`。基础库 3.12.2+ 生效，低版本忽略该参数；
查询 200ms 超时兜底，拿不到实例也照常跳转。

前置条件：转场只在**连续 Skyline 页面**间生效 —— 列表页与详情页都必须是 Skyline
（详情页 2026-11-21 已切回，见 `pages/plan/detail/README.md` §8）。

## 与 §8.5 mock 的差异（均为已裁决项）

1. **封面只有 1 张**：冻结契约 `PlanSummary` 用 `cover` 而非 `images[3]`（协作记录 §5 裁决 1），三图并排属详情页。要 `+N` 角标需先给 `PlanSummary` 补 `imageCount`。
2. **标题 / 摘要都只单行 ellipsis**：`overflow:hidden + white-space:nowrap + text-overflow:ellipsis`（`@include ellipsis-1`）。Skyline 下 `-webkit-line-clamp` 实测不生效（兼容清单 §2.2），摘要已由云端 `buildSummary` 截到 60 字，前端不再裁字、不挂测量。

## 状态同步（§10 的实现点）

```ts
const votes = computed(() => planStore.voteCounts[planId] ?? props.summary.votes)
const myVote = computed(() => planStore.myVotes[planId])
```

详情页 `useVote` 投票成功后写 `planStore.applyVoteResult`，返回这张卡片时 computed 立即重算，**不需要重新请求列表**。刻意用 computed 派生而非 watch/副作用：滚动时卡片重渲染只读值，不留第二份状态。

选项表决（#61）：`summary.options.length >= 2` 时比例条改走**逐选项行**（每行「名称 + 进度条 + 占比」，
我投的那一行主色加粗），透传 `:options="summary.options"` `:my-option="summary.myOption"`；
`< 2` 时仍是原来的赞同/反对双色条。闸门在 `VoteRatioBar` 内部，卡片只负责透传。
`applyVoteResult` 会把权威 `options`/`myOption` patch 回缓存的 summary，所以直接绑快照字段也能投票后即时同步。
首次出现上升动画（`plan-card--rise`）与其余卡片内容不受影响：入场前只挂一段
`transform: translateY(64rpx)`，挂载后 50ms 起按**挂载顺序错峰 100ms 逐张开播**（第一张先起、第二张随后，
不再同时动），由 800ms `transition` 缓慢回到原位；批次 120ms 内没有新卡挂载就归零，
所以「加载更多」追加的一批会重新从头错峰。批次序号存在模块作用域的 `<script>` 块里
（`<script setup>` 的变量是每实例一份，放那里序号恒为 0，会退化成「一起做动画」）。
`type="list"` 会虚拟化视口外节点，卡片挂载 ≈ 首次接近视口，因此不用 IntersectionObserver
（上一版真机上回调未触发，卡片会停在偏移态）；每张卡各自持有状态与一次性定时器（闭包不共享），播完必摘类，
不会残留位移。不拿 `opacity: 0` 起步，动画期间卡片始终可见；不改 padding / margin 等基础样式。

## 性能

- 不挂常驻定时器：倒计时经 `CountDown → useCountdown → utils/ticker`，全局最多一个 `setInterval`，且按档位分级降频（>7 天与已截止两档根本不订阅）；入场动画每卡只用一个一次性定时器（错峰开播），卸载即清理；另有模块级一个批次计数定时器（120ms 归零）。
- 封面 `BaseImage` 预设 `ratio = 16/9` + `lazy-load`（§11.1 防抖动）。
- 无 SelectorQuery / boundingClientRect。

## 用法

```vue
<PlanCard :summary="item" @click="goDetail" @expire="onExpire" />
```
