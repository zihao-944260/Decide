# BaseAvatar

头像。`src` 为空或加载失败时显示内置缺省人形（灰底 + 两个真实节点拼成，Skyline 无伪元素），默认插槽可自定义缺省内容（如昵称首字）。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `src` | `string` | `''` | fileID / https / 本地路径 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 56 / 80 / 112 rpx |
| `shape` | `'circle' \| 'square'` | `'circle'` | square 用 `$radius-md` 圆角 |

## Emits

无。

## Slots

| slot | 说明 |
| --- | --- |
| default | 自定义缺省内容，仅在无图/加载失败时渲染 |

## 示例

```vue
<BaseAvatar :src="author.avatarUrl" size="sm" />
<BaseAvatar size="lg"><text class="page__avatar-char">议</text></BaseAvatar>
```
