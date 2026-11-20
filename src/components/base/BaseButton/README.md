# BaseButton

四类按钮：主 / 次 / 文字 / 危险。`loading` 或 `disabled` 时吞掉点击并置灰（opacity 0.5）。文案一律走默认 slot（Skyline 下文字必须包 `<text>`，slot 内容由调用方提供 `<text>`）。

## Props

| prop       | 类型                                             | 默认        | 说明                                                |
| ---------- | ------------------------------------------------ | ----------- | --------------------------------------------------- |
| `type`     | `'primary' \| 'secondary' \| 'text' \| 'danger'` | `'primary'` | 视觉类型                                            |
| `size`     | `'sm' \| 'md' \| 'lg'`                           | `'md'`      | sm/md 高度同为 88rpx（最小可点击高度），lg 为 96rpx |
| `loading`  | `boolean`                                        | `false`     | 显示旋转指示器并禁止点击                            |
| `disabled` | `boolean`                                        | `false`     | 置灰并禁止点击                                      |
| `block`    | `boolean`                                        | `false`     | 宽度撑满父容器                                      |

## Emits

| 事件    | 说明             |
| ------- | ---------------- |
| `click` | 可交互状态下点击 |

## Slots

| slot    | 说明                              |
| ------- | --------------------------------- |
| default | 按钮内容，调用方需自行包 `<text>` |

## 示例

```vue
<BaseButton type="primary" :loading="submitting" block @click="onSubmit">
  <text class="page__btn-text">发布</text>
</BaseButton>
```
