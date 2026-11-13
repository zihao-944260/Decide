# BaseModal

居中确认弹窗。基于 `BasePopup`（`position="center"` 的 600rpx 白卡），受控组件（`v-model:visible`）。删除类操作传 `danger` 让确认按钮走危险色。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `visible` | `boolean` | 必填 | 受控显隐 |
| `title` | `string` | `''` | 标题，居中 |
| `content` | `string` | `''` | 正文；有默认插槽时以插槽为准 |
| `confirmText` | `string` | `'确定'` | 确认按钮文案 |
| `cancelText` | `string` | `'取消'` | 取消按钮文案 |
| `showCancel` | `boolean` | `true` | 是否显示取消按钮 |
| `danger` | `boolean` | `false` | 确认按钮用危险色 |
| `maskClosable` | `boolean` | `false` | 点蒙层关闭（确认类弹窗默认关闭，避免误触） |

## Emits

| 事件 | 参数 | 说明 |
| --- | --- | --- |
| `update:visible` | `boolean` | v-model（蒙层关闭时也会触发） |
| `confirm` | — | 点确认；**不自动关闭**，由调用方决定（如异步提交成功后再关） |
| `cancel` | — | 点取消，组件已同时置 `visible=false` |

## Slots

| slot | 说明 |
| --- | --- |
| default | 替换 `content` 的自定义主体（表单、勾选框等），调用方自行包 `<text>` |

## 示例

```vue
<BaseModal
  v-model:visible="delVisible"
  title="删除计划"
  content="删除后不可恢复，确认删除？"
  confirm-text="删除"
  danger
  @confirm="onDelete"
/>
```

## 注意

- 底部两个按钮各占 `flex: 1`，用 `margin-left` 撑开间距并给首个按钮归零（flex 下 margin 不折叠，兼容清单 §2.2）。
