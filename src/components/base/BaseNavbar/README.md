# BaseNavbar

自定义导航栏。状态栏高度、胶囊位置、导航栏总高全部取自 `useAppStore()`（base 组件禁 store 的唯一例外，§9.1-4）。`initSystemInfo()` 由 `App.vue` 的 `onLaunch` **统一调用**，页面不许再调（漏调的后果实测过：statusBarHeight=0、胶囊矩形=null，导航栏整体画进刘海）。

页面使用 `navigationStyle: custom` 时，将本组件作为页面 flex 纵向根节点的第一个子节点（常规流，非 fixed）。

## Props

| prop          | 类型      | 默认    | 说明                                                                                                      |
| ------------- | --------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `title`       | `string`  | `''`    | 标题，单行省略                                                                                            |
| `backable`    | `boolean` | `true`  | 显示返回按钮；点击后 emit `back`，`guardBack` 为 false 时再自动 `navigateBack`（页面栈只剩 1 层时不动作） |
| `transparent` | `boolean` | `false` | 透明背景（沉浸式头图）                                                                                    |
| `guardBack`   | `boolean` | `false` | 返回拦截：true 时组件**只 emit、不返回**，是否离开完全由页面的 `@back` 决定                               |

## Emits

| 事件   | 参数 | 说明                                                                                                                                                          |
| ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `back` | —    | 返回点击。`guardBack=false`（默认）时组件随后自动返回，事件只供埋点/附加逻辑；`guardBack=true` 时**页面必须自己决定走不走**（不调 `navigateBack` 就停在原地） |

### `guardBack` 存在的理由

mp-weixin 不触发 `onBackPress`（`@dcloudio/uni-mp-weixin` 的 dist 里没有 `ON_BACK_PRESS` 调用点），
所以「离开前确认」在小程序端只能挂在这个按钮上——编辑页是第一个使用者（`src/pages/plan/edit/README.md` §6）。

形状选**布尔开关 + emit**，不是当初上报时提的 `before-back: () => Promise<boolean>`：
拦截之后要不要走、什么时候走，页面自己已经有 `sheet.openNative` 的三态结果，组件把返回动作交出去就够了；
再包一层异步回调等于让导航栏去等一个它无法取消、也无法取消别人的过程。
（另注：本项目已有组件在传函数值 props —— `PlanList` 的 `fetcher/seed/onPage/getId`，
而 `docs/Skyline兼容清单.md` 对「函数值 props 能否跨自定义组件边界」**零条目**，
属于清单没写 ≠ 可用（§2.8），要等真机/模拟器一并验；本组件不新增这类未验证用法。）

**拦不住的仍是 iOS 侧滑与 Android 返回键**——那是原生手势，组件层无入口；需要「别丢内容」的页面请用
`onUnload` 落盘兜底（编辑页 §5.6），`wx.enableAlertBeforeUnload` 属 Skyline 清单零条目、待真机验证。

## Slots

| slot    | 说明                                                      |
| ------- | --------------------------------------------------------- |
| `right` | 右侧操作区，自动避让胶囊按钮，`margin-left:auto` 保持靠右 |

## 标题真居中（2026-11-13 用户裁定）

左右插槽宽度天然不对称（左返回键 vs 右胶囊避让/消息入口），`flex:1 + text-align:center` 会把标题挤偏。
现 body `position:relative`，标题 `position:absolute; left:50%; transform:translateX(-50%); max-width:50%`，
与两侧宽度解耦；首页/编辑页实测标题 centerX=195（屏宽 390 的一半）。
标题过长时单行省略、最大占半屏，不会压到两侧操作区。

## 示例

```vue
<BaseNavbar title="计划详情">
  <template #right>
    <text class="page__nav-action" @tap="onShare">分享</text>
  </template>
</BaseNavbar>
```
