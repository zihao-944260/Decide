# VoteActions（T3.10）

详情页投票区：赞同 / 反对两颗按钮 + 在途锁 + 截止置灰 + 发起人主态整块隐藏（§8.3）。
**所有票数状态只有一个来源 —— `useVote(planId)`**：乐观更新、失败回滚、3003 纠偏、3002 已截止
全部在 composable 里，组件不缓存票、不改 store、不写第二份错误码映射。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `planId` | `string` | 必填 | 以 getter 传给 `useVote`，页面换 id 时状态自动跟随 |
| `closed` | `boolean` | `false` | 已截止（`status=2` / 过了 `deadline`）或软删（`status=3`）：禁用置灰，点击提示 |
| `isAuthor` | `boolean` | `false` | 发起人主态：**整块不渲染**（不是禁用）。v1 禁止自投 |
| `showCount` | `boolean` | `false` | 按钮内票数 + 底部「共 N 人表态 / 我的选择」脚注。详情页若已摆 `VoteRatioBar`，保持关闭：比例与计数的唯一展示出口是 §8.3 的比例条 |
| `closedText` | `string` | `'该计划已截止'` | 截止态点击提示文案 |
| `optionsEnabled` | `boolean` | `false` | 选项表决模式（#60）：**整块不渲染**，投票入口改由 `OptionCardList` 的卡片承担 |
| `locked` | `boolean` | `false` | 已投过：两颗按钮禁用置灰，但「已选」标记照常显示（投过不能改票） |

## Emits

| 事件 | 载荷 | 页面层要做什么 |
| --- | --- | --- |
| `voted` | `myVote: VoteTypeValue`（1/2） | 服务端权威计数已写入 `planStore`；用来刷「我参与的」统计（`user.stats`） |
| `closed` | 无 | 服务端判定已截止/已删除 → 重拉 `plan.detail`，把 `closed` 置 true 并刷新倒计时 |

## Slots

无。按钮文案与计数由组件固定，避免与 `VoteRatioBar`（E1 路）抢同一块视觉。

## 状态到 UI 的映射

- `myVote === VoteType.Agree/Disagree` → 对应按钮加「已选」标记（`primary` / `danger` 实底本身即高亮）。
- `voting` → 被点的那颗出 spinner，另一颗禁用；`pending` 只决定 loading 落在哪颗按钮上。
- 点已选中的那颗：`useVote.cast()` 自己 return（同票不重复提交，服务端会回 3003），UI 不再另加逻辑、不弹提示。
- 改票 = 直接点另一颗，走同一条 cast 路径 → 首投/改票两条路径都收敛到 `useVote`。
- **没有取消投票入口**（已裁决：`VoteType` 只有 `1|2`，不存在 `type: 0` 分支）。

## 已截止的点击提示为什么挂在行容器

`BaseButton` 在 `disabled` 时不 emit `click`，所以「该计划已截止」的提示只能由外层 `view` 的 `@tap`
捕获（tap 会冒泡）。未截止时该处理函数直接 return —— 投票入口只有按钮那一条路，不可能被点两下。

## 用法

```vue
<!-- 比例条 + 按钮是两件事：条展示共识，按钮负责改票，计数不要在两处各显示一遍 -->
<VoteRatioBar :votes="planStore.voteCounts[detail.planId] ?? detail.votes" :my-vote="myVote" show-count />
<VoteActions
  :plan-id="detail.planId"
  :closed="isClosed"
  :is-author="isAuthor"
  @voted="refreshStats"
  @closed="reloadDetail"
/>
```

## 上报的点

- `BaseButton.type` 只有 `primary | secondary | text | danger`，**没有对应 `$color-agree`（绿）的档**；
  赞同目前用 `primary`（蓝）近似。若设计要「赞同绿 / 反对红」，需要 base 层加 variant，
  business 层无权改 `BaseButton`，也不该用自定义按钮节点复刻它。
