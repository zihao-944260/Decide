# BaseCell

列表项：左图标（`icon` 地址或 `icon` 插槽）+ 标题/描述 + 右值（`value` 或 `right` 插槽）+ 可选箭头。最小高度 88rpx。行间细线由调用方在外层用 `hairline-bottom` mixin 或分隔节点实现（组件间不假设组合场景）。

## Props

| prop      | 类型      | 默认    | 说明                                                                                                                                                                                                             |
| --------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`   | `string`  | `''`    | 主标题，单行省略                                                                                                                                                                                                 |
| `desc`    | `string`  | `''`    | 标题下灰色说明，单行省略                                                                                                                                                                                         |
| `value`   | `string`  | `''`    | 右侧值文本                                                                                                                                                                                                       |
| `arrow`   | `boolean` | `false` | 右侧箭头                                                                                                                                                                                                         |
| `icon`    | `string`  | `''`    | 左侧图标 image 地址（48rpx）                                                                                                                                                                                     |
| `section` | `boolean` | `false` | 卡内模块标题行变体：min-height:0、`padding: 0 0 24rpx`（内衬归外层卡，标题→内容间距由 padding-bottom 撑开）、标题 semibold + 紧行高；规格见 `mixins.scss` 的 `section-head`/`section-title`，DeadlinePicker 在用 |

## Emits

| 事件    | 说明     |
| ------- | -------- |
| `click` | 整行点击 |

## Slots

| slot    | 说明                                                             |
| ------- | ---------------------------------------------------------------- |
| `icon`  | 覆盖 `icon` prop 的左侧区域                                      |
| `right` | 值区域自定义内容（如 switch、徽标），排在 `value` 之后、箭头之前 |

## 示例

```vue
<BaseCell title="账号与安全" value="已实名" arrow @click="goSecurity" />
```
