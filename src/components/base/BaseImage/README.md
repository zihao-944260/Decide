# BaseImage

图片包装：`cloud://` fileID / https / 本地路径都直接透传给 `<image>`，无需转换。加载前显示灰底占位（配合 `ratio` 预设容器比例，避免列表加载时跳动，§11.1）；失败显示「点击重试」，点击占位重建 image 节点重新加载。

## Props

| prop      | 类型                                                                        | 默认           | 说明                                                                            |
| --------- | --------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `src`     | `string`                                                                    | `''`           | fileID / https / 本地路径；空串只显示占位                                       |
| `mode`    | `'scaleToFill' \| 'aspectFit' \| 'aspectFill' \| 'widthFix' \| 'heightFix'` | `'aspectFill'` | 同原生 image                                                                    |
| `ratio`   | `number`                                                                    | `0`            | 宽/高比，经 CSS `aspect-ratio` 生效（**未在 T0 实测，真机需复核**；0 表示不设） |
| `lazy`    | `boolean`                                                                   | `true`         | 原生 lazy-load                                                                  |
| `radius`  | `'none' \| 'sm' \| 'md' \| 'lg' \| 'round'`                                 | `'none'`       | 圆角，overflow hidden 裁剪                                                      |
| `preview` | `boolean`                                                                   | `false`        | 点击调 `uni.previewImage`（fileID 预览请先换临时 URL）                          |

## Emits

`click` / `load` / `error`，均无参数。

## 注意

- 未传 `ratio` 且 mode 非 `widthFix` 时，容器高度为 0，调用方必须在外层给定高度。
- 组件宽度恒为 100%，由外层容器控制实际宽度。

## 示例

```vue
<BaseImage :src="plan.images[0]" :ratio="16 / 9" radius="md" preview @click="onTapImage" />
```
