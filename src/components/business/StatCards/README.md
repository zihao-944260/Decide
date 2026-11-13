# StatCards（T5.3）

「我的页」三张数据卡：我发起的 / 我参与的 / 进行中（§8.7 页面结构图的第二层）。
**纯受控**：不 import store、不发请求、不持有选中态。数字全来自 `props.stats`，高亮全来自 `props.active`。

## Props（逐字抄自 `types.ts`）

```ts
export interface Props {
  stats: UserStats
  active?: MyFilter
  loading?: boolean
  disabled?: boolean
}
```

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `stats` | `UserStats`（`@/types/models`） | **必填** | 三个数的唯一来源。页面从 `useUserStore().stats` 传 —— **不要再发一次 `user.stats`**，stats 是 users 文档内的冗余字段，随 `userInfo` 一并同步（`stores/user.ts` 的 `applyUserInfo` 注释） |
| `active` | `MyFilter` | 未传 | **必须与 FilterTabs 的 `active` 是页面里同一个 ref**。命中那张卡高亮；`'ended'` 时三张都不高亮（stats 没有「已截止」这个数） |
| `loading` | `boolean` | `false` | 数字位置画占位条而**不显示 0** |
| `disabled` | `boolean` | `false` | 只拦点击，不改显示 |

## Emits（逐字抄自 `types.ts`）

```ts
export type Emits = {
  (e: 'select', filter: MyFilter): void
}
```

载荷是 `@/constants/plan` 的 `MyFilter`，取值只可能是 `'created' | 'joined' | 'ongoing'`（卡片不认识 `ended`）。
页面写进自己那个 `activeFilter` 就完事，别再存一份。

## 接线（完整示例在 `../UserHeader/README.md`，这里只贴自己这两行）

```vue
<StatCards
  v-if="userStore.isLoggedIn"
  :stats="stats"
  :active="activeFilter"
  :loading="refreshing"
  @select="activeFilter = $event"
/>
<FilterTabs :active="activeFilter" @change="activeFilter = $event" />
```

`@select` 与 `@change` 写的是**同一个** `activeFilter` —— 这是「点统计卡联动下方筛选」的全部实现，
组件之间没有任何直接关系（`StatCards` 只从 `FilterTabs/types.ts` 取文案常量 `MY_FILTER_LABELS`，不 import 组件）。

## 三条口径（页面容易接错的地方）

1. **0 与「还没拿到」是两件事。** 数字用 `utils/format` 的 `compactCount`（万/亿口径，非 `999+`），
   真的是 0 就显示 `0`；`loading` 期间显示占位条。`stats` 里出现 `undefined`/`NaN`/负数（云端冗余计数允许短暂不一致，
   §5.1）时组件收成 `0` 显示，不显示空白。
2. **未登录时显示什么**：`EMPTY_STATS` 全 0，而 0 是对「你一条都没发起过」的假陈述。
   推荐 `v-if="userStore.isLoggedIn"` 整块不渲染；要保留版式就传 `:loading="true"`（+ `disabled`）。
   不要直接把全 0 的 stats 传上去，也不要只 `v-show` 隐藏却仍让它可点。
3. **`ongoing` 的语义**是「我发起的且未截止」（§8.7），点它会跳到 filter `'ongoing'`，
   列表口径由云函数 `plan.myList` 决定，卡片数字与列表条数不一致时**以云端为准**，组件不做二次校对。

## Skyline

三卡 `view` + `flex: 1` 等分一行（`flex:1` 实测可用，兼容清单 §2.2）；不做横向滚动（裁决见 `../FilterTabs/README.md`）；
无后代选择器 —— 高亮的文字色挂在文字自己的类名 `stat-cards__value--active` 上；
结构伪类 `:last-child` 按不支持处理，所以项间距用对称 `margin` 而不是 gap/末项归零；
无 `boundingClientRect`/`SelectorQuery`；样式 `scoped` + BEM + 全 token。
