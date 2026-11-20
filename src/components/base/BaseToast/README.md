# BaseToast

居中浮层提示，**受控展示组件**（`v-model:visible`）。小程序运行时不能动态 mount 节点，因此不提供 `Toast.show()` 这类命令式挂载能力：命令式那层由业务侧用 `uni.showToast` 或「页面内常驻本组件 + 状态位」实现，本组件只负责按 props 画。

`duration > 0` 时组件自己计时并在到时 emit `update:visible=false` + `closed`；`duration <= 0` 交给调用方关闭（`loading` 场景）。

## Props

| prop       | 类型                                          | 默认     | 说明                          |
| ---------- | --------------------------------------------- | -------- | ----------------------------- |
| `visible`  | `boolean`                                     | 必填     | 受控显隐                      |
| `type`     | `'text' \| 'success' \| 'error' \| 'loading'` | `'text'` | 图标类型，`text` 无图标       |
| `message`  | `string`                                      | `''`     | 文案；有默认插槽时以插槽为准  |
| `duration` | `number`                                      | `2000`   | 自动收起 ms，`<=0` 不自动收起 |

## Emits

| 事件             | 参数      | 说明                                      |
| ---------------- | --------- | ----------------------------------------- |
| `update:visible` | `boolean` | v-model                                   |
| `closed`         | —         | 到时自动收起（调用方主动置 false 不触发） |

## Slots

| slot    | 说明                                                 |
| ------- | ---------------------------------------------------- |
| default | 替换 `message` 的自定义内容（调用方自行包 `<text>`） |

## 示例

```vue
<BaseToast
  v-model:visible="toast.show"
  :type="toast.type"
  :message="toast.message"
  :duration="1500"
/>
```

## 注意

- 定位用 `position: fixed` + `top: 45%`（`$toast-offset-top`）的**全宽窄条**，不是全屏蒙层：兼容清单未验证 `pointer-events`，用「条带高度=气泡高度」把误吞点击的区域压到最小。
- 进场用 CSS `@keyframes` 淡入（节点挂载即触发，不需要 JS 掐帧）；`v-if` 直接销毁节点，**无退场动画**。
- 图标：`success` 是边框 + `transform` 旋转的真实节点，`error` 沿用 BasePopup 关闭按钮的「✕」字形，`loading` 是 BaseButton 同款描边环——都不依赖伪元素。
