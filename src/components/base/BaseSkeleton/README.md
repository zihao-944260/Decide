# BaseSkeleton

骨架屏（§11.1「骨架屏代替白屏」）。只画形状不画内容，尺寸全部取自 tokens，因此和真实卡片/列表/详情页的留白节奏一致。

三种形态：

| type | 结构 | 典型场景 |
| --- | --- | --- |
| `card` | 1 组，带白底 + `$radius-lg` 外框（同 `card` mixin），可选小头像 + `rows` 行 | 首页首屏计划卡片 |
| `list` | `count` 组，行间 1px 分隔线，无外框，可选小头像 + `rows` 行 | 评论区、我的列表 |
| `detail` | 1 组，无外框，大标题块 + `rows` 行，头像用大号 | 计划详情页 |

## Props

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `rows` | `number` | `3` | 每组文本行数，末行缩短为 60% 打破等宽节奏 |
| `avatar` | `boolean` | `false` | 头像占位圆；尺寸随 type 取 `$avatar-sm` / `$avatar-lg` |
| `type` | `'card' \| 'list' \| 'detail'` | `'card'` | 形态 |
| `count` | `number` | `3` | `list` 形态的组数，其余形态恒为 1 |
| `animated` | `boolean` | `true` | 脉冲动画开关（`opacity` 呼吸，纯 CSS） |

## Emits

无。

## Slots

无。

## 示例

```vue
<scroll-view class="home__scroll" type="list">
  <!-- 首屏骨架与真实卡片同宽同圆角，替换时不跳版 -->
  <BaseSkeleton v-if="loading" type="card" :rows="2" avatar />
  <BaseEmpty v-else-if="list.length === 0" text="还没有计划" action-text="去发起" @action="goCreate" />
  <view v-else>
    <PlanCard v-for="p in list" :key="p.id" :plan="p" />
    <BaseLoadMore :status="footerStatus" @retry="loadMore" />
  </view>
</scroll-view>

<!-- 评论区分页加载中 -->
<BaseSkeleton type="list" :count="5" :rows="1" avatar />
```

## 注意

- 动画是 CSS `@keyframes` + `opacity`（兼容清单 §2.2 实测可用），不用 worklet；长列表可传 `:animated="false"` 降载。
- 骨架节点是纯 `view`，不含文字，因此不受「文字必须包 `<text>`」约束；宽度用百分比、高度用 `$skeleton-bar-height*` token。
