# BasePopup

弹层容器：**fixed 遮罩 + fixed 面板**（#78 起弃用 `page-container`，原因见兼容清单 §2.3.2），受控组件（`v-model:visible`）。Skyline / WebView 两种渲染器通用。

## 为什么不用 page-container

- 它在 **WebView 渲染页**的手势/高度行为从未实测，用户真机反馈：弹层内滚不动、触摸弹层却滚动外层页面（#78）。
- 它要求一页单实例（兼容清单 §2.3.1）：编辑页 `DeadlinePicker` + `BaseActionSheet` 常驻两个就报 `Only one instance can exist.`。
- fixed 遮罩+面板是两渲染器都实测可用的形状（清单 §2.2 fixed ✅、transform/opacity 过渡 ✅）。

## 结构与时序

- 根节点 `position:fixed` 全屏；遮罩 `@touchmove.stop.prevent`（编译为 `catchtouchmove`）断掉触摸冒泡，防滚动穿透；面板按 `position` 走 transform/opacity 过渡。
- **host/shown 两态**：`visible=true` 才挂节点（host），30ms 后翻 `shown` 让过渡有起点；退场 `shown=false`，`duration+80ms` 后卸载节点并发 `closed`。`visible=false` 时整个容器连同 slot 内容都不在页面里。
- 进/退场终态按位置各挂一个类（`--on-bottom` 等）：Skyline 不认多类名复合选择器（清单 §1.5）。
- WebView 页的文档级滚动另由页面 `<page-meta :page-style>` 在弹层打开时锁 `overflow:hidden`（编辑页已接，#78）；Skyline 页无文档滚动，不需要。
- 同页可常驻多个 BasePopup 系组件（单实例限制已随 page-container 一起移除）；仍建议同一时刻只开一个。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `visible` | `boolean` | 必填 | 受控显隐 |
| `position` | `'top' \| 'bottom' \| 'center' \| 'right'` | `'bottom'` | 弹出方向 |
| `round` | `boolean` | `true` | 圆角（面板 border-radius） |
| `closable` | `boolean` | `false` | 右上角关闭按钮（88rpx 点击区） |
| `duration` | `number` | `300` | 进/退场过渡 ms |
| `zIndex` | `number` | `1000` | 同 `$z-popup` |
| `maskClosable` | `boolean` | `true` | 点蒙层关闭 |

## Emits

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `update:visible` | `boolean` | v-model |
| `opened` / `closed` | — | 进/退场动画结束 |
| `click-overlay` | — | 蒙层点击（关闭动作之前触发） |

## Slots

| slot | 说明 |
| --- | --- |
| default | 弹层内容。bottom/top 自带白底与底部安全区；center 为 600rpx 宽白卡 |

## 示例

```vue
<BasePopup v-model:visible="show" position="bottom" closable>
  <view class="page__sheet"><text>内容</text></view>
</BasePopup>
```