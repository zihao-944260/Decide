# CommentList（T3.8）

评论列表：按 `seq` 升序渲染 `CommentItem`，首屏骨架 / 空态 / 触底加载 / 失败重试四态齐备。
分页、发表、删除的逻辑全在已交付的 `useComments`（内部是 `usePagingList`）里，本组件只做渲染与编排转发。

## 接线方式（页面层照这段写）

组件**只接一个 `comments` prop**，值就是 `useComments(planId)` 的返回对象（`CommentsController`）。
选它而不是让组件自己 `import '@/api/comment'`：`useComments` 已经把「游标分页 + 并发锁 + 乐观追加去重 + 删除回滚 + `plans.commentCount` 联动」全包了，组件再拼一遍必然两处漂移（技术方案 §10 的复用意图）。

```vue
<script setup lang="ts">
import { COMMENT_LOWER_THRESHOLD } from '@/components/business/CommentList/types'
import CommentList from '@/components/business/CommentList/index.vue'
import CommentInput from '@/components/business/CommentInput/index.vue'
import { useComments, useModal, useServerNow } from '@/composables'
import { computed, ref } from 'vue'

const comments = useComments(planId) // 页面唯一的评论状态源
const now = useServerNow() // 整页一个时间订阅（§11.1），列表与条目共用
const modal = useModal()
const listRef = ref<InstanceType<typeof CommentList> | null>(null)
// posting 是嵌套在普通对象里的 Ref，模板不解包 → 这层 computed 就是解包点
const posting = computed(() => comments.posting.value)

// CommentInput 的注入式发表：成功 → 组件自己清空；失败 → 保留原文 + 透出错误码。
// useComments.post 里 ApiError 文案已由 api/request 统一 toast，所以返回 toast:false 关掉组件的二次提示。
async function publish(content: string): Promise<{ ok: boolean; toast?: boolean }> {
  const ok = await comments.post(content) // post 内部已 appendItem 到列表尾部
  return ok ? { ok: true } : { ok: false, toast: false }
}

async function onDelete(commentId: string): Promise<void> {
  if (await modal.confirm({ content: '删除这条评论？' })) await comments.remove(commentId)
}

// 触底加载：详情页整页只有一个 scroll-view（§8.4），评论区在滚动流内，
// 所以 CommentList 自己不再嵌 scroll-view，由页面的 scrolltolower 调 exposed.loadMore
function onScrollToLower(): void {
  void listRef.value?.loadMore()
}
</script>

<template>
  <scroll-view
    class="detail__scroll"
    :lower-threshold="COMMENT_LOWER_THRESHOLD"
    @scrolltolower="onScrollToLower"
  >
    <PlanHeader />
    <ContentRenderer :blocks="detail.blocks" />
    <CommentList
      ref="listRef"
      :comments="comments"
      :now="now"
      @delete="onDelete"
      @long-press="onLongPress"
      @error="onCommentError"
    />
  </scroll-view>
  <!-- 吸底条是 scroll-view 的兄弟节点，position: fixed（§8.4 / 兼容清单 §2.2） -->
  <CommentInput :publish="publish" :posting="posting" @error="onPublishError" />
</template>
```

详情页是 WebView 渲染，scroll-view **不带 `type="list"`**（那是 Skyline 专属虚拟列表，留着触摸滚不动，2026-11-13 #37 移除）；首页/我的（Skyline）保留。

模板里的 Ref 只有 **setup 顶层绑定**才自动解包：`now` 是 `useServerNow()` 的顶层 Ref，直接 `:now="now"`；
而 `comments.posting` 是普通对象里的嵌套 Ref，**不解包**，写成 `:posting="comments.posting"` 就是把一个 Ref 对象当布尔传过去，恒为真。
所以页面要为它补一层 `const posting = computed(() => comments.posting.value)`（详情页 T3.11 就是这么接的）。

`COMMENT_LOWER_THRESHOLD`（120px）从本目录 `types.ts` 导出，页面里不要写魔法数，也不要自己挂定时器做「快到底了预加载」。
`business/index.ts` 汇总出口属冻结文件（本 agent 无权创建），页面层目前按上面这样 deep-import 路径即可。

## Props

| prop           | 类型                   | 默认                       | 说明                                                                                                         |
| -------------- | ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `comments`     | `CommentsController`   | 必填                       | `useComments(planId)` 返回值整体注入（`list/loading/refreshing/hasMore/loaded/error` + 分页方法）            |
| `now`          | `number`               | `0`                        | 相对时间基准（ms）。传 0 时组件不订阅 ticker，只兜底读一次校准时间                                           |
| `canRemove`    | `(comment) => boolean` | 未传                       | 删除权限覆盖。不传用 `comments.canRemove`（只判「本人可删」）；§8.4 的「计划作者也能删别人的评论」由页面注入 |
| `autoload`     | `boolean`              | `true`                     | 挂载即 `reload()`；页面自己在 `onLoad` 编排时关掉                                                            |
| `emptyText`    | `string`               | `'还没有评论，来说两句吧'` | 空态文案                                                                                                     |
| `skeletonRows` | `number`               | `2`                        | 首屏骨架每条几行                                                                                             |
| `separated`    | `boolean`              | `true`                     | 条目间分隔线（最后一条自动不画）                                                                             |

## Emits

| 事件         | 载荷                                        | 说明                                                                                                                                                |
| ------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delete`     | `(commentId: string, comment: CommentItem)` | 删除按钮点击。组件不碰 api，调不调 `comments.remove` 由页面决定                                                                                     |
| `long-press` | `(comment: CommentItem)`                    | §8.4 的 ActionSheet 入口：`useActionSheet().open({ actions: [{ text: '删除', danger: true }] })`（`ActionSheetItem` 就是 BaseActionSheet 的项类型） |
| `error`      | `(message: string)`                         | 分页失败从无到有抛一次，页面埋点/提示只写一处                                                                                                       |

## defineExpose（`CommentListExpose`）

`reload()` / `refresh()` / `loadMore()` / `append(comment)` / `remove(commentId)` / `patch(commentId, changes)`

- `loadMore()`：给页面 `@scrolltolower` 调；首屏未就绪、在途、`hasMore=false` 时全部 no-op。
- `append / remove / patch`：只动本地列表（转发 `appendItem/removeItem/patchItem`），**不发请求**。发表走 `comments.post`（它自己会 append），这里给的是页面已有服务端事件时的手动补位口子。
- 组件内**不使用** `SelectorQuery` / `boundingClientRect`：Skyline 列表页的 `scroll-view type="list"` 会虚拟化视口外节点，取矩形会永久挂起（兼容清单 §2.3）；详情页现为 WebView 普通 scroll-view（#37），零测量约定不变，滚动定位走 `scroll-into-view`。

## 四态与顺序

- 首屏未 `loaded` 且无错误 → `BaseSkeleton type="list" avatar`。
- `loaded` 且空 → `BaseEmpty`。
- 首屏就失败（`error` 且未 `loaded`）→ 只画底部 `BaseLoadMore status="error"`，点它 `reload({ force: true })` 重试。
- 渲染前对 `list` 按 `seq` 升序排一次副本：服务端本身升序，本地乐观插入落尾，排序保证时间线不跳位、已删除占位不塌陷（`CommentItem` 见 `status !== Normal` 渲染灰色占位）。
- `CommentItem` 的 `first` prop：本组件传 `:first="index === 0"`，把首项顶 padding 归零——详情页评论标题行的 `padding-bottom: 24rpx` 已提供标题→内容间距，首项自带顶 padding 再叠就双倍（#37）。

## 已知缺口（上报主 agent，勿在本目录自行修）

1. `useComments.canRemove` 只判「本人」，不含 §8.4 的「计划作者可删」→ 现由 `canRemove` prop 注入；裁决是**不改 composable**（它不认识计划详情），页面注入即为正解。
2. ~~`constants/plan.ts` 的 `CommentStatus` 没有配套的值联合类型~~ → 已补齐 `CommentStatusValue`（与 `PlanStatusValue` / `VoteTypeValue` 同构）；`CommentItem/types.ts` 里那份就地窄化已删。
3. `utils/format.ts` 无昵称兜底函数 → `CommentItem` 内本地兜底 `'匿名用户'`。
