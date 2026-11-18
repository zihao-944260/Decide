# StatCards（T5.3）

「我的页」四张数据卡：我发起的 / 我参与的 / 进行中 / 已截止（§8.7 页面结构图的第二层）。
2026-11-18 起**这一排卡就是筛选切换器**（原 `FilterTabs` 下线，见「接线」），所以「点卡片 = 切列表筛选」
是它的本职，不是附加联动。
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
| `stats` | `UserStats`（`@/types/models`） | **必填** | 四个数的唯一来源（「已截止」= `created − ongoing`，见下「四条口径」第 4 条）。页面从 `useUserStore().stats` 传 —— **不要再发一次 `user.stats`**；但也**别以为它随 `userInfo` 白送**：`users.stats` 只是冗余镜像，云端唯一会重算它的是 `user.stats`，所以页面的刷新节奏里必须调一次 `useUserStore().refreshStats()`（理由见 `stores/user.ts` 的 `refreshStats` 注释与 `技术方案.md` §8.7） |
| `active` | `MyFilter` | 未传 | 页面里那个 `activeFilter`。四个取值各有一张对应卡，所以任何时刻**恰好一张亮** —— 这就是本页唯一的筛选 UI，不存在第二个控件要跟它对质 |
| `loading` | `boolean` | `false` | 数字位置画占位条而**不显示 0** |
| `disabled` | `boolean` | `false` | 只拦点击，不改显示 |

## Emits（逐字抄自 `types.ts`）

```ts
export type Emits = {
  (e: 'select', filter: MyFilter): void
}
```

载荷是 `@/constants/plan` 的 `MyFilter`，`'created' | 'joined' | 'ongoing' | 'ended'` 四个取值都可能发出来。
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
```

`@select` 写的就是页面那个 `activeFilter`，`watch(activeFilter)` 里做两件事、**顺序不能反**：
先 `list.scrollToTop()` 再 `await list.reload()` —— 反过来会让重拉的第一帧停在旧滚动位，
用户看到「换了筛选但列表还停在半路」。组件之间没有任何直接关系，`FilterTabs` 已从页面移除。

## 四条口径（页面容易接错的地方）

1. **0 与「还没拿到」是两件事。** 数字用 `utils/format` 的 `compactCount`（万/亿口径，非 `999+`），
   真的是 0 就显示 `0`；`loading` 期间显示占位条。`stats` 里出现 `undefined`/`NaN`/负数（云端冗余计数允许短暂不一致，
   §5.1）时组件收成 `0` 显示，不显示空白。
2. **未登录时显示什么**：`EMPTY_STATS` 全 0，而 0 是对「你一条都没发起过」的假陈述。
   推荐 `v-if="userStore.isLoggedIn"` 整块不渲染；要保留版式就传 `:loading="true"`（+ `disabled`）。
   不要直接把全 0 的 stats 传上去，也不要只 `v-show` 隐藏却仍让它可点。
3. **`ongoing` 的语义**是「我发起的且未截止」（§8.7），点它会跳到 filter `'ongoing'`，
   列表口径由云函数 `plan.myList` 决定，卡片数字与列表条数不一致时**以云端为准**，组件不做二次校对。
4. **「已截止」不需要后端加字段**，它是 `created` 集合里扣掉 `ongoing` 剩下的那一块。云端三条口径这样咬合：
   `created` = 我发起 且 status ∈ {1,2}；`ongoing` = 我发起 且 status=1 且 (deadline=0 或 >now)；
   `ended` = 我发起 且 (status=2 或 (status=1 且 0<deadline≤now)) ⇒ `created − ongoing = ended`，
   且 `ongoing ⊂ created` 保证差值恒 ≥ 0（scheduler 还没把 1 翻成 2 的窗口期也落在这条减法里）。
   2026-11-18 模拟器实测：某账号 `created 4 / ongoing 3` ⇒ 卡面显示 1，点它 `myList(filter:'ended')`
   恰好返回 1 条，减法与云端口径逐条对上。**这条数是从两个已有计数推出来的**，所以 `stats` 陈旧时
   它会跟着陈旧，别拿它当实时状态。

## Skyline

四卡 `view` + `flex: 1`（配 `min-width: 0`）等分一行（`flex:1` 实测可用，兼容清单 §2.2）；
不做横向滚动，也不给标签加省略号 —— 四张卡的文案（我发起的/我参与的/进行中/已截止）在 402px 屏宽下
实测一行放得下，加滚动条就是为不存在的问题写代码；
无后代选择器 —— 高亮的文字色挂在文字自己的类名 `stat-cards__value--active` 上；
结构伪类 `:last-child` 按不支持处理，所以项间距用对称 `margin` 而不是 gap/末项归零；
无 `boundingClientRect`/`SelectorQuery`；样式 `scoped` + BEM + 全 token。
