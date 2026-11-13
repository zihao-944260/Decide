# PlanList（T3.4）

首页与「我的」共用的分页列表容器（技术方案 §8.7 / §10）。内部只用 `usePagingList`，
**不 import api、不 import store**：数据源与缓存落点由页面通过 props 注入。

## 契约

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| prop | `fetcher: PageFetcher<PlanSummary>` | 必填。签名 `(cursor, pageSize) => Promise<PageResult<PlanSummary>>` |
| prop | `pageSize?` | 默认 `Limit.PAGE_SIZE`（10） |
| prop | `seed?: () => PageResult<PlanSummary> \| null` | 首屏缓存回填，命中不发请求（我的页切 filter） |
| prop | `onPage?: (page, append) => void` | 每页成功回吐，页面写 store 缓存 |
| prop | `onError?: (err) => void` | 取数失败透传（toast/埋点），组件自身只渲染重试态 |
| prop | `getId?: (item) => string` | 主键，默认 `item.planId`；同时用作 `v-for :key` |
| prop | `autoLoad?: boolean` | 默认 **false**：组件不自己发请求，首屏由页面调 `reload()` |
| prop | `emptyText?` / `emptyActionText?` | 空态文案 / 空态按钮（留空不显示按钮；默认点按钮 = `reload({force:true})`） |
| prop | `emptyActionOwned?: boolean` | 默认 **false**。true 时点按钮**只 emit `empty-action`**、组件不再内部 reload —— 动作归页面 |
| prop | `animated?` | 透传给 PlanCard 的比例条动画开关 |
| prop | `lowerThreshold?` | 触底预加载距离（px），默认 60 |
| emit | `click(planId)` / `long-press(planId)` / `expire(planId)` | 原样转发 PlanCard |
| emit | `empty-action()` | 空态按钮点击，仅在 `emptyActionOwned=true` 时发出（`emptyActionText` 得同时给，否则没有按钮可点） |
| emit | `scroll(event)` | 转发内部 `scroll-view` 的滚动事件（页面做 FAB 收起等滚动响应） |

`emptyActionOwned` 存在的理由：我的页四个空态里 `created` 的按钮是「去发布」（跳编辑页），
不是一次注定还是空的重试。为什么不靠组件嗅探「页面挂没挂 `@empty-action`」：
`useAttrs()` 在 mp-weixin 能否看见事件监听器属兼容清单零条目（§2.8 清单没写 ≠ 可用），
显式布尔开关不欠这个验证。代价是 `emptyActionOwned` 与 `@empty-action` 必须成对给，
只给 prop 会造出一个死按钮。

### defineExpose（给 T3.5 / T5.5 编排用，Ref 自动解包）

`list` `loading` `refreshing` `hasMore` `loaded` `error`
`reload(options?)` `refresh()` `loadMore()` `appendItem(item, position?)` `patchItem(id, patch)` `removeItem(id)` `setList(items)` `reset()`

典型用法：`planListRef.value?.patchItem(planId, { commentCount: n + 1 })`、
新建计划成功回来 `appendItem(summary, 'head')`、切 filter `reload()`。

## 三态（§11.2）

| 条件 | 呈现 |
| --- | --- |
| `!loaded && !error` | `BaseSkeleton type="card" :rows="3" :avatar` |
| `loaded && list 空 && !error` | `BaseEmpty`（可带操作按钮） |
| `error`（首屏失败） | 骨架屏收起，底部 `BaseLoadMore status="error"` 点击重试 |
| `loading` 且已有数据 | `BaseLoadMore status="loading"` |
| `!hasMore` 且有数据 | `BaseLoadMore status="nomore"` |
| 空闲且还有下一页 | 底部不显示（等 `scrolltolower`） |

**骨架独占（用户裁定 2026-11-13）**：reload（含下拉刷新）请求路径先清 `list`/`error`，模板用
`<template v-else>` 包真列表 + BaseLoadMore ⇒ 骨架屏与真数据永不同屏；刷新期间整屏只有骨架。

## 页面接线示例

```ts
// 首页：fetcher 要包一次，api 的入参是 PageQuery，PageFetcher 要的是 (cursor, pageSize)
const fetcher: PageFetcher<PlanSummary> = (cursor, pageSize) =>
  fetchPlanList({ cursor, pageSize })

const planListRef = ref<InstanceType<typeof PlanList> | null>(null)
function onPage(page: PageResult<PlanSummary>, append: boolean): void {
  planStore.setHomePage(page, append)   // 也有的页面用 seed 回填：() => planStore.home
}
onLoad(() => planListRef.value?.reload())
```

```ts
// 我的页：filter 变了换 fetcher 引用即可，seed 指向对应 bucket
const fetcher: PageFetcher<PlanSummary> = (cursor, pageSize) =>
  fetchMyPlans({ cursor, pageSize, filter: activeFilter.value })
// :seed="() => planStore.myLists[activeFilter]"  :on-page="(p, append) => planStore.setMyPage(activeFilter, p, append)"
```

## Skyline / 性能注意

- 根节点是 `scroll-view type="list"`，**页面根必须 `@include page-root`（flex 纵向）**，否则 `flex: 1` 拿不到高度。
- 列表内零测量：不碰 SelectorQuery / boundingClientRect（虚拟化视口外节点会永久挂起，兼容清单 §2.3）。
- 下拉刷新用 `refresher-enabled` + `:refresher-triggered="refreshing"`。状态机口径：`refresh()` 不忽略
  busy 时的下拉手势（reload 以 seq 作废在途请求接管）；reload 全程保持 refreshing=true，run() finally 的
  true→false 才是原生 spinner 的收回信号——提前复位会永久卡在刷新态（2026-11-13 实测修复）。
- 卡片间距挂在 `.plan-list__item` 行上而不是容器上（底部 padding `$card-gap: 40rpx`），页面想通栏不必覆盖组件样式。
  首卡**上**间距由滚动内容首节点 `.plan-list__top { height: $card-gap }` 提供（滚动内容里 :first-child 不可靠，垫真实节点）；
  首页 navbar→首卡 / 我的 tabs→首卡实测 20.8px≈40rpx。页面侧不要再给列表上方叠 margin（我的页 `__tabs` margin-bottom 已删）。
- `scroll` 必须由组件显式 `triggerEvent` 转发：小程序的原生事件**不跨自定义组件边界**，
  页面写 `@scroll` 只会在组件宿主标签上生成一个 `bindscroll`，内部 `scroll-view` 不转发就永远不触发。
  页面侧自带节流（首页 120ms + 4px 死区），组件这里逐帧透传、不做判定，免得两处节流口径不一致。
- `refresher` 在 Skyline 下的默认刷新头表现未实测（兼容清单只验过 `type="list"` 滚动本身），真机阶段随 M0 一起复核。
