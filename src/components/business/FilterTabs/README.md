# FilterTabs（T5.4）

「我的页」四条筛选标签：我发起的 / 我参与的 / 进行中 / 已截止（`MY_FILTERS` 四项全给）。
**纯受控**：不 import store、不发请求、不缓存 tab 状态，选中态由页面喂。

## Props（逐字抄自 `types.ts`）

```ts
export interface Props {
  active: MyFilter
  filters?: readonly MyFilter[]
  disabled?: boolean
}
```

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `active` | `MyFilter` | **必填** | 当前选中的 filter。**唯一真相在页面**，且必须是与 `StatCards` 的 `active` 同一个值 |
| `filters` | `readonly MyFilter[]` | `MY_FILTERS` | 渲染哪几项、什么顺序。默认四项全给，页面不必覆盖 |
| `disabled` | `boolean` | `false` | 整条禁点（切 tab 请求在途时防连点）。只拦点击，选中态显示不变 |

## Emits（逐字抄自 `types.ts`）

```ts
export type Emits = {
  (e: 'change', filter: MyFilter): void
}
```

点**已选中**的项不发事件（页面因此不用判重，也不会因重复点同一 tab 触发第二次 reload）。

## 接线（完整示例在 `../UserHeader/README.md`）

```vue
<FilterTabs :active="activeFilter" @change="activeFilter = $event" />
```

页面在 `activeFilter` 变化后做两件事（T5.5 的活，组件不涉及）：换 `fetcher` 里的 filter、
用 `seed: () => planStore.myPage(filter)` 让切回来的桶直接命中缓存。

## 缓存语义不归组件（§8.7）

「切回不重新请求」这件事的实现者是 `planStore.myLists[filter]` + 页面的 `seed`/`onPage` + `PlanList.reload()`。
`FilterTabs` 只做一件事：把用户想看的 filter 报出去。所以它**没有** `loaded`/`dirty` 之类的内部标记，
也不会在 change 时顺手清缓存 —— 组件里藏一份 tab 状态就等于给页面埋一个私有约定，
而 §4.11 已经裁决过一次同类问题（「一个列表实例服务四个 filter 桶，`loaded` 分不清桶」）。

## 为什么不做横向滚动（本轮裁决，覆盖 §8.7 原文「横向滚动筛选卡片」）

1. **内容算得过**：最长标签「我发起的」4 个中文字 × `$font-sm`(26rpx) ≈ 104rpx；
   750rpx 下减去组件左右 `$space-3` 内衬与各项对称边距，每项仍有 ≥150rpx。
   「放不下」这个问题在 v1 的数据形状下不存在。
2. **平台代价**：Skyline 的 `scroll-view` 必须显式声明 `type`，而 `grid-view`/`list-view`/`sticky-*`
   实测渲染 0×0（兼容清单 §2.3）；`scroll-view type="list"` 还会虚拟化视口外节点
   （对未渲染节点取矩形会永久挂起）。为一个不存在的问题引入一个未验证的风险，收益为零。
3. **体验**：横滚会让人怀疑「右边还有没有第五项」，而四项一行不需要滚动条就能读完。

实现：`view` + `display: flex` + 每项 `flex: 1; min-width: 0`，一行等分。
将来 v2 若真出现第五、第六个 filter，改法是在**这一个组件里**换成受控滚动容器并补一条兼容清单实测，
而不是让每个页面各自拼一行。

## 文案单一来源

`MY_FILTER_LABELS`（`created/joined/ongoing/ended` → 四个中文标签）在 `types.ts` 里导出，
`StatCards` 的卡片标签也从这一份取 —— 同一个词写两遍，早晚有一天会对不上（「我参与的」vs「我参加过的」）。
已上报缺口：建议主 agent 把它上收到 `src/constants/plan.ts`（与 `MY_FILTERS` 同域），届时通知我改两处 import。

## Skyline

无 `inline-block`、无后代/子代/伪元素选择器（高亮文字色挂在 `filter-tabs__label--active` 自己的类名上）、
结构伪类 `:last-child` 按不支持处理（项间距离用对称 `margin`）、无 `list-view`/`grid-view`/`sticky-*`、
无 `boundingClientRect`/`SelectorQuery`、文字全包 `<text>`、每项 `min-height: $tap-min-height`、
样式 `scoped` + BEM + 全 token。
