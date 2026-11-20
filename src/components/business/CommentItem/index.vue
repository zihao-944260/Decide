<script setup lang="ts">
import BaseAvatar from '@/components/base/BaseAvatar/index.vue'
import { peekNow } from '@/composables'
import { CommentStatus } from '@/constants/plan'
import { collapseSpace, relativeTime, truncate } from '@/utils/format'
import type { Props, Emits } from './types'
import { computed } from 'vue'

const props = withDefaults(defineProps<Props>(), {
  isSelf: undefined,
  deletable: undefined,
  now: 0,
  separated: true,
  first: false
})
const emit = defineEmits<Emits>()

/** format.ts 没有昵称兜底函数（缺口已上报），这里就地补一层：空白昵称 → 匿名 */
const NICK_FALLBACK = '匿名用户'
/** 昵称单行预算（中文字宽，§11.1 不用 line-clamp，单行 ellipsis + JS 截字双保险） */
const NICK_MAX_WIDTH = 12

const removed = computed(() => props.comment.status !== CommentStatus.Normal)
const removedText = computed(() =>
  props.comment.status === CommentStatus.Removed ? '该评论已删除' : '该评论不可见'
)
const canDelete = computed(() => props.deletable ?? props.isSelf ?? false)
const nickText = computed(() => {
  const nick = collapseSpace(props.comment.author.nickName)
  return nick ? truncate(nick, NICK_MAX_WIDTH) : NICK_FALLBACK
})
/**
 * now 优先用外层注入的单一时间源（页面一个 useServerNow 订阅，§11.1 禁止每条评论挂定时器）；
 * 未注入时兜底读一次校准时间，只在本次渲染算一次，不订阅 ticker。
 */
const timeText = computed(() =>
  relativeTime(props.comment.createdAt, props.now > 0 ? props.now : peekNow())
)

function onDelete(): void {
  emit('delete', props.comment.commentId, props.comment)
}

function onLongPress(): void {
  if (!canDelete.value) return
  emit('long-press', props.comment)
}
</script>

<template>
  <view
    class="comment-item"
    :class="{ 'comment-item--separated': separated, 'comment-item--first': first }"
  >
    <!-- 已删除 / 被拦截：内容不可见但整条仍占位，seq 时间线不塌陷（§8.4） -->
    <view v-if="removed" class="comment-item__removed">
      <text class="comment-item__removed-text">{{ removedText }}</text>
    </view>

    <view v-else class="comment-item__body" @longpress="onLongPress">
      <BaseAvatar class="comment-item__avatar" :src="comment.author.avatarUrl" size="sm" />
      <view class="comment-item__main">
        <view class="comment-item__head">
          <text class="comment-item__nick">{{ nickText }}</text>
          <text v-if="timeText" class="comment-item__time">{{ timeText }}</text>
        </view>
        <!-- 内容不截行数：自然多行 + word-break 断长串（Skyline 无 line-clamp，兼容清单 §2.2） -->
        <text class="comment-item__content">{{ comment.content }}</text>
      </view>
      <view
        v-if="canDelete"
        class="comment-item__delete"
        hover-class="comment-item__delete--hover"
        @tap="onDelete"
      >
        <text class="comment-item__delete-text">删除</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.comment-item {
  @include flex-column;
  // 上下衬降一档（#52 整体评论组件降高）：$space-3 → $space-2
  padding: $space-2 0;
}

.comment-item--first {
  padding-top: 0;
}

.comment-item--separated {
  @include hairline-bottom;
}

.comment-item__body {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.comment-item__avatar {
  margin-right: $space-2;
}

.comment-item__main {
  @include flex-column;
  flex: 1;
  overflow: hidden;
}

.comment-item__head {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.comment-item__nick {
  @include ellipsis-1;
  max-width: 60%;
  font-size: $font-sm;
  color: $color-text-2;
}

.comment-item__time {
  margin-left: $space-2;
  font-size: $font-xs;
  color: $color-text-3;
}

.comment-item__content {
  margin-top: $space-1;
  font-size: $font-md;
  line-height: $line-normal;
  color: $color-text-1;
  word-break: break-all;
}

.comment-item__delete {
  @include flex-center;
  flex-shrink: 0;
  min-width: $tap-min-height;
  min-height: $tap-min-height;
  margin-left: $space-1;
  transition: opacity $duration-fast;
}

.comment-item__delete--hover {
  opacity: 0.5;
}

.comment-item__delete-text {
  font-size: $font-sm;
  color: $color-text-3;
}

.comment-item__removed {
  @include flex-center;
  justify-content: flex-start;
  min-height: $tap-min-height;
  // 与正文列对齐：头像宽 + 头像右间距，占位不至于顶到最左边
  padding-left: $avatar-sm + $space-2;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.comment-item__removed-text {
  font-size: $font-sm;
  color: $color-text-3;
}
</style>
