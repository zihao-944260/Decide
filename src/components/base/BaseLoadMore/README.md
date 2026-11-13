# BaseLoadMore

列表底部状态条（`scroll-view type="list"` 的最后一项）。整行最小高度 88rpx，仅 `error` 态可点并 emit `retry`，其余状态点击不响应。

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `status` | `'loading' \| 'nomore' \| 'error'` | 必填 | 三态；「什么都不显示」由调用方 `v-if` 控制 |
| `loadingText` | `string` | `'加载中…'` | 可覆盖 |
| `nomoreText` | `string` | `'没有更多了'` | 可覆盖 |
| `errorText` | `string` | `'加载失败，点击重试'` | 可覆盖 |

## Emits

| 事件 | 说明 |
| --- | --- |
| `retry` | `error` 态点击整行；语义是「重试这一页」，由 `usePagingList` 一类重新拉当前游标 |

## Slots

无。

## 示例

```vue
<scroll-view class="page__scroll" type="list" @scrolltolower="loadMore">
  <PlanCard v-for="p in list" :key="p.id" :plan="p" />
  <BaseLoadMore :status="footerStatus" @retry="loadMore" />
</scroll-view>
```

## 注意

- 旋转指示器与 `nomore` 两侧的短线都是真实节点（Skyline 无伪元素），`hover-class` 只在 `error` 态开启。
- 本组件不含「首屏骨架」职责，loading 首屏请用 `BaseSkeleton`；这里只服务分页。
