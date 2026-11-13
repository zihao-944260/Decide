<script setup lang="ts">
import BaseEmpty from '@/components/base/BaseEmpty/index.vue'
import BaseLoadMore from '@/components/base/BaseLoadMore/index.vue'
import BaseSkeleton from '@/components/base/BaseSkeleton/index.vue'
import CommentItem from '@/components/business/CommentItem/index.vue'
import type { BaseLoadMoreStatus } from '@/components/base/BaseLoadMore/types'
import type { CommentItem as CommentDTO } from '@/types/models'
import type { CommentListExpose, Props, Emits } from './types'
import { computed, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<Props>(), {
  now: 0,
  canRemove: undefined,
  autoload: true,
  emptyText: '还没有评论，来说两句吧',
  skeletonRows: 2,
  separated: true,
})
const emit = defineEmits<Emits>()

const list = computed(() => props.comments.list.value)
const loading = computed(() => props.comments.loading.value)
const loaded = computed(() => props.comments.loaded.value)
const hasMore = computed(() => props.comments.hasMore.value)
const errorText = computed(() => props.comments.error.value)

/** 服务端本身按 seq asc 返回；本地乐观插入会落到尾部，这里统一按 seq 稳定排序，时间线不会跳位 */
const ordered = computed(() => [...list.value].sort((a, b) => a.seq - b.seq))

const showSkeleton = computed(() => !loaded.value && !errorText.value)
const isEmpty = computed(() => loaded.value && ordered.value.length === 0)
const loadStatus = computed<BaseLoadMoreStatus | ''>(() => {
  if (errorText.value) return 'error'
  if (loading.value) return 'loading'
  if (!hasMore.value && ordered.value.length > 0) return 'nomore'
  return ''
})

function deletable(comment: CommentDTO): boolean {
  return props.canRemove ? props.canRemove(comment) : props.comments.canRemove(comment)
}

function onDelete(commentId: string, comment: CommentDTO): void {
  emit('delete', commentId, comment)
}

function onLongPress(comment: CommentDTO): void {
  emit('long-press', comment)
}

async function reload(): Promise<void> {
  await props.comments.reload()
}

async function refresh(): Promise<void> {
  await props.comments.refresh()
}

/**
 * 触底加载：详情页整页一个 scroll-view（§8.4），所以这里由页面的
 * `@scrolltolower` 调本方法。首屏没就绪 / 在途 / 没有下一页时全部 no-op，
 * 组件内不挂定时器、不用 SelectorQuery（兼容清单 §2.3 对视口外节点取矩形会永久挂起）。
 */
async function loadMore(): Promise<void> {
  if (!loaded.value || loading.value || !hasMore.value) return
  await props.comments.loadMore()
}

function append(comment: CommentDTO): void {
  props.comments.appendItem(comment, 'tail')
}

function remove(commentId: string): void {
  props.comments.removeItem(commentId)
}

function patch(commentId: string, changes: Partial<CommentDTO>): void {
  props.comments.patchItem(commentId, changes)
}

async function onRetry(): Promise<void> {
  await props.comments.reload({ force: true })
}

// 分页失败只在「从无到有」这一刻往外抛一次，页面埋点/提示只写一处
watch(
  () => props.comments.error.value,
  (message, previous) => {
    if (message && message !== previous) emit('error', message)
  },
)

onMounted(() => {
  if (props.autoload) void reload()
})

const exposed: CommentListExpose = { reload, refresh, loadMore, append, remove, patch }
defineExpose(exposed)
</script>

<template>
  <view class="comment-list">
    <view v-if="showSkeleton" class="comment-list__skeleton">
      <BaseSkeleton type="comment" avatar :rows="skeletonRows" :count="3" />
    </view>

    <BaseEmpty v-else-if="isEmpty" :text="emptyText" />

    <view v-else class="comment-list__items">
      <CommentItem
        v-for="(item, index) in ordered"
        :key="item.commentId"
        :comment="item"
        :now="now"
        :deletable="deletable(item)"
        :separated="separated && index < ordered.length - 1"
        :first="index === 0"
        @delete="onDelete"
        @long-press="onLongPress"
      />
      <BaseLoadMore v-if="loadStatus" :status="loadStatus" @retry="onRetry" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.comment-list {
  @include flex-column;
  padding: 0 $space-3;
}

.comment-list__skeleton {
  // 与真评论首条 padding-top:0 对齐（#67），不再多一截上衬
  padding-top: 0;
}

.comment-list__items {
  @include flex-column;
}
</style>
