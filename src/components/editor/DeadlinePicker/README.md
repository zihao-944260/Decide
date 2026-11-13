# DeadlinePicker（T4.9）

截止时间的「快捷三项 + 自定义弹层」。技术方案 §8.1 页面结构里 `scroll-view` 的第五个子块，§12 T4.9 的交付物。

受控组件：**只读 `props.deadline`，只 `emit('change', deadline)`**。校验规则不在这里（归页面 T4.11 的 `useForm`），本组件只负责「把值选出来、发出去」和「明显不该出现的档位不出现」。

## 接线示例（页面照这段抄）

```vue
<script setup lang="ts">
import DeadlinePicker from '@/components/editor/DeadlinePicker/index.vue'
import { deadlineText } from '@/components/editor/DeadlinePicker/types'
import { peekNow, useForm } from '@/composables'
import type { PlanOption } from '@/types/models'
import { computed } from 'vue'

interface EditModel {
  title: string
  deadline: number
  optionsEnabled: boolean
  options: PlanOption[]
}

// 页面唯一的表单状态源：deadline 是 ms 时间戳，0 = 未设置
const form = useForm<EditModel>(() => ({ title: '', deadline: 0, optionsEnabled: false, options: [] }))
const deadline = computed(() => form.model.value.deadline)

function onDeadlineChange(value: number): void {
  form.model.value.deadline = value
  form.clearError('deadline')
}

// 组件自己会显示「2026-11-13 20:30」，页面不需要再拼文案。
// 只有别处（草稿摘要 / 提交确认弹窗）要复用时才用这个出口：
const summaryLine = computed(() => `截止：${deadlineText(deadline.value)}`)

// 提交门禁（页面侧，组件不做）：0 是合法值（云端「不限截止」），非 0 必须是校准时间之后
function deadlineOk(): boolean {
  const value = deadline.value
  return value === 0 || value > peekNow()
}
</script>

<template>
  <scroll-view type="list" class="edit__scroll">
    <DeadlinePicker :deadline="deadline" @change="onDeadlineChange" />
  </scroll-view>
</template>
```

- `:deadline` 传 **number**，不是 Ref：setup 顶层的 `computed` 在模板里自动解包，所以 `:deadline="deadline"` 直接写。
- 想要改行标题：`<DeadlinePicker :deadline="deadline" label="截止日期" @change="onDeadlineChange" />`（默认 `截止时间`）。
- 示例里的 `summaryLine` / `deadlineOk` 是给页面抄的形状，不是本组件的 API。

## Props / Emits（与 `types.ts` 逐字一致）

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `deadline` | `number` | 必填 | 当前截止时间 ms；`0` = 未设置（云端 `resolveDeadline` 对 0 直接放行，表示不限截止） |
| `label` | `string?` | `'截止时间'` | 行标题 |

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `change` | `(deadline: number)` | 快捷项点击 / 弹层点确定。**没有第二个事件**：文案、索引、档位结构都不往外发 |

导出的辅助（同一个 `types.ts`）：`DEADLINE_UNSET_TEXT`、`deadlineText(ts)`、结构类型 `DeadlineDay` / `DeadlineSlot`。

## 为什么不用原生 `<picker>` / `<picker-view>`

《docs/Skyline兼容清单》§2.3 对 Skyline 下的组件逐个做了实测：`scroll-view type=list`、`page-container`、`root-portal`、`draggable-sheet`、`snapshot`、`open-container`、`list-view`、`grid-view`、`sticky-*` 都有明确的「可用/不可用」结论，**但 `picker` 和 `picker-view` 一条都没有**。没有条目 = 未验证，不是「默认可用」。本轮四路共用的纪律（`docs/agent-prompts.md` §11）是「兼容清单没写的平台行为不能当成已确认的事实写进代码」，所以这里不赌。

**性质**：这是**被禁止项**（按 §11 的口径，无实测条目就不许进正式代码），不是「先写了等真机复核」。如果后续真机把 `picker-view` 验通了，替换的是本组件内部（弹层那段 markup + 三个 index 状态），**对外 props/emits 一字不改**，页面不受影响 —— 这就是把它封在组件里的理由。

替代实现用的全是已实测的零件：

| 零件 | 清单条目 |
| --- | --- |
| `BasePopup` → fixed 遮罩+面板 | #78 起弃 page-container（兼容清单 §2.3.2）；fixed/transform 过渡两渲染器 §2.2 ✅ |
| 两列普通 `scroll-view :scroll-y="true"`（显式定高 440rpx） | WebView 页 `type="list"` 触摸滚动失效（#37/#73）；百分比高度链不可靠（#78），故定高 |
| 点格选中（`@tap` + index） | §2.2 `position/tap` 常规能力 |
| 定位到当前值 `scroll-into-view` | §2.2 ✅ |

**不测高、不用 `scroll-top`**（§2.2 实测 `scroll-top` 在 Skyline 下设置 99999 页面都不动），也不对视口外节点取矩形（§2.3 实测会**永久挂起**，不是返回 null）。选中态纯粹由 `dateIndex` / `timeIndex` 决定。

## 档位形状

- 日期列：今天起 **14 天**（`DATE_SPAN`），每格 `formatDate(dayStart)`（MM-DD）+ 副文案「今天 / 明天 / 周X」。
- 时间列：**00:00 ~ 23:30 每 30 分钟一档**（48 档），标签由 `pad2` 拼 `HH:mm`。
- 年月日时分一律走 `utils/format.ts`（`formatDate` / `formatDateTime` / `pad2`），组件里不出现第二套拼法。

## 为什么 `now` 必须是校准时间

组件里所有时间都取 `peekNow()`（`@/composables` → `appStore.serverNow()` = `Date.now() + timeOffset`），**没有一处裸 `Date.now()`**。原因不是洁癖：

1. 快捷项算的是 `now + days * 86400_000`，用的必须是校准时间，否则用户把系统钟往前调 1 小时，就会设出一个「前端以为还有 25 小时、云端认为只剩 24 小时」的截止点。
2. 截止判定与倒计时（`CountDown` / `useCountdown` / 详情页置灰）全部走校准时间。**如果这里用本地钟，就会出现「还没到就显示已截止」或反过来**——同一个 plan 在两端各算各的。
3. 云端 `resolveDeadline` 用**服务端** `now` 校验 `deadline > now`，前端只有走校准时间才能和它对齐。

## 过去时间的两层拦截

1. **档位层**：`buildSlots` 只保留 `ts > now + 60_000` 的格子；今天如果连 23:30 都已过期，这一整天不进日期列。**被拒的档位根本不出现，用户点不到**。
2. **确认层**：`confirm()` 用**新鲜**的 `peekNow()` 再判一次 `slot.ts > now + 60_000`；不满足就 `showToastMsg('该时间已过，请重新选择')` 并**留在弹层**（同时用新的 now 重建档位、把 index 收敛回有效范围），不 emit、不关闭。

`60_000` 是时钟抖动余量：档位过滤和确认校验**刻意用同一个常量**。两个数分开写就会出现「格子里能选、点确定被弹回」的诡异体验。

弹层打开时 `pinnedNow` 冻结一份 now，整列档位由它派生（每分钟重算会让格子整体上移、`setData` 白烧，用户正在点的那一格还会换日期）。**冻结带来的过期风险正是由第二层拦兜住的**，这两条要一起读。

## 快捷项与弹层的取值不重合

`DeadlinePreset` 的 1/3/7 天算出的时刻带当前时分，不落在 30 分钟格网上。所以：

- 用快捷项设值后**再打开弹层**，会吸附到**最近的一档**（差值相同取更早），弹层顶部显示「将设为 …」；
- **只有点「确定」才会改写表单值**，直接划走 / 点遮罩 / 返回手势关闭都不 emit，`props.deadline` 原样不变。

## 页面该用什么判据（组件不做，这里给现成的）

- 合法性：`deadline === 0 || deadline > peekNow()`。`0` 在冻结契约里合法（云端 `resolveDeadline` 对 0 直接放行 = 不限截止）；**v1 发布是否允许「不限」是产品决策，不由本组件替页面决定**。
- 上限：云端 `resolveDeadline` 还要求 `deadline <= now + 365 天`（`ServerLimit.DEADLINE_MAX_DAYS`）。本组件最长 14 天，结构上不可能越界；页面若把跨度放宽，记得补这条。
- 服务端返回 `1001 截止时间必须晚于当前时间` 时不要静默：重新读一次校准时间再提示（用户系统钟被改过时，前端算的「未来」可能是过去）。

## Skyline 约束落地

- 无 `inline-block` / 无 `-webkit-line-clamp` / 无伪元素 / 无 `::before`、`:last-child` 这类伪类（§1.4：Skyline 只认 class / ID / 标签选择器）→ 末位去间距用真实修饰类 `--last`。
- 选中态颜色**不用后代选择器**，子节点自己挂 `--active` 修饰类。
- 快捷行用 `flex: 1` 等分（实测可用），**不用 `flex-wrap`**（清单无条目）。
- 动画只有 `transition: opacity`（清单外，但与全工程 base 组件同一条口径）；没有 worklet。
- 全部文字包在 `<text>` 内；可点击节点最小 `min-height: $tap-min-height`。
- 色值/间距/圆角/字号一律 tokens，零硬编码。

## 待真机复核（模拟器过 ≠ 真机过）

1. ~~page-container 弹层套在 scroll-view 里~~ **已消解（#78，2026-11-13）**：BasePopup 改 fixed 遮罩+面板（兼容清单 §2.3.2）；编辑页同时改文档级滚动（§2.6.2），并以 page-meta 在弹层打开时锁滚动。
2. **弹层内两列的手势（#78 后新形状）**：列已显式定高 440rpx + 普通 scroll-view；真机复核「列内滚动顺畅、滚得到底、触摸弹层不带动页面」。原「与 page-container 下拉关闭抢手势」一条随 page-container 移除而消解。
3. **`scroll-into-view` 在 fixed 弹层内**是否生效（只在打开时给一次）。不生效的表现只是「打开时没滚到当前值」，功能不受损，可接受。
4. 弹层定高 `5 × $tap-min-height`（440rpx）在矮屏（iPhone SE）是否与 Home 指示条安全区打架。

## 上报的共享层缺口（本目录未动，见报告正文）

- `Limit` 没有截止时间相关的键，`DATE_SPAN` / `SLOT_STEP` / `MIN_FUTURE_MS` 三个是本组件内的产品常量，写在组件里是刻意的（只有一个消费者）。
- 无 `utils/time.ts`：`startOfDay` 这类日历原语在本目录本地实现。`OptionsSection` 不需要它，若将来多处要再收口。
