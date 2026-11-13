# OptionCardList / OptionCard（T3.7）

详情页选项卡（§8.6）。`OptionCardList` 管「渲染与否 + 顺序 + 锁定态翻译」，`OptionCard` 管单卡视觉与点击。

## 两态：展示态 / 选项表决态

冻结契约已补齐选项表决（`PlanOption.count`、`PlanSummary.myOption`、`vote.submit.req.optionId`），
所以这两个组件现在有两种形态，由 `votable` 切换：

- **展示态（`votable=false`，默认）**：不显示票数/比例，唯一交互是配图大图预览（`BaseImage` 的 `preview`）。
- **选项表决态（`votable=true`，#60）**：整卡可点，点中 `emit('vote', option.id)`；
  `selected` 的那一项主色描边/底色高亮并带「已选」，`disabled` 的其余项置灰。
  此时配图预览让位给投票点击（否则点图会吞掉这一票）。

**投过即锁定**：`locked=true` 时除 `myOption` 外全部 `disabled`；`closed=true` 时全部 `disabled`。
锁定裁决与提交都在页面/composable，组件只翻译 props、不持状态、不算票。

逐选项票数与占比的唯一展示出口是 `VoteRatioBar` 的逐选项行（#61）；
`VoteActions` 在 `optionsEnabled=true` 时整块不渲染，避免出现第二个投票入口。

> 历史口径（已作废）：v1 曾规定「选项不参与投票统计」，并撤回过「计划级 agree/disagree 按位次贴到选项卡」
> 的错误映射。那条映射至今仍然错误 —— 现在用的是 `PlanOption.count` 这份**选项自己的**票数，
> 不是把计划级计数硬贴上来。

## Props

| 组件 | prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| OptionCardList | `options` | `PlanOption[]` | 必填 | `PlanDetail.options`；`length < 2` 时整块不渲染也不占位（§8.6 开关关闭） |
| OptionCardList | `previewable` | `boolean` | `true` | 透传给每张卡的配图预览开关（表决态下让位给投票点击） |
| OptionCardList | `votable` | `boolean` | `false` | 选项表决态：卡片可点投票 |
| OptionCardList | `myOption` | `string` | `''` | 我投的选项 id；命中的卡 `selected=true` |
| OptionCardList | `locked` | `boolean` | `false` | 已投过即锁定：除 `myOption` 外全部 `disabled` |
| OptionCardList | `closed` | `boolean` | `false` | 已截止/软删：全部 `disabled`（含我投的那一项） |
| OptionCard | `option` | `PlanOption` | 必填 | 单条选项 |
| OptionCard | `index` | `number` | 必填 | 0 基序号，徽标显示 `pad2(index + 1)` → 01/02/03 |
| OptionCard | `previewable` | `boolean` | `true` | 配图可点击放大（`uni.previewImage`） |
| OptionCard | `votable` | `boolean` | `false` | 整卡可点，点中 `emit('vote', option.id)` |
| OptionCard | `selected` | `boolean` | `false` | 主色描边/底色 + 名称主色加粗 + 「已选」；优先于 `disabled` |
| OptionCard | `disabled` | `boolean` | `false` | 置灰不可点（`selected` 时不置灰） |

Emits：`OptionCardList` 与 `OptionCard` 各发一个 `vote(optionId: string)`，容器原样上抛子卡事件。Slots：无。

## 为什么 `length < 2` 就足以代表 §8.6 的「开关关闭」

§8.6 展示态的闸门写的是 `optionsEnabled=false → 整块不渲染`，组件判的却是 `options.length < 2`。
v1 里两者恒等，因为闸门在**写入侧**：`cloudfunctions/common/src/planPayload.ts` 的 `validateOptions(raw, false)`
直接 `return []`，`handlers/writeShared.ts` 也只在开关为真时写 options。
「开关关了但 options 还留着」的数据在云端不存在，所以页面不必再判第二层（详情页 T3.11 因此只给留白、不给底色）。
将来若出现允许两者不一致的写路径，闸门要搬回 `optionsEnabled` —— 改这个组件，不要让每个页面各自补一层。

## 顺序

直接 `v-for` 云端数组，不 `sort()`、不 `reverse()` —— T3.7 的验收项就是顺序与 `options[].order` 一致。

## 配图

统一 16:9（§8.6），`ratio` 语义与 `BaseImage`、`utils/blocks.ts` 一致，都是**宽/高**（CSS `aspect-ratio`）。
无图时渲染纯文字卡，不留空图位。

## 用法

```vue
<OptionCardList :options="detail.options" />
```
