<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import BaseEmpty from '@/components/base/BaseEmpty/index.vue'
import BaseLoadMore from '@/components/base/BaseLoadMore/index.vue'
import BaseSkeleton from '@/components/base/BaseSkeleton/index.vue'
import type { BaseLoadMoreStatus } from '@/components/base/BaseLoadMore/types'
import PlanCard from '@/components/business/PlanCard/index.vue'
import { Limit } from '@/constants/plan'
import { usePagingList } from '@/composables'
import type { PageResult } from '@/types/api'
import type { PlanSummary } from '@/types/models'
import type { Emits, PlanListScrollEvent, Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  pageSize: Limit.PAGE_SIZE,
  autoLoad: false,
  emptyText: '还没有计划',
  emptyActionText: '',
  emptyActionOwned: false,
  animated: true,
  lowerThreshold: 60,
  floatClearance: false,
  innerTopGap: false,
})
const emit = defineEmits<Emits>()

/** 主键：页面可覆盖，默认 planId。v-for 的 key 与 patch/remove/去重共用同一个口径 */
function itemId(item: PlanSummary): string {
  return props.getId ? props.getId(item) : item.planId
}

/**
 * options 里全部走「读 props 的包装函数」而不是快照：
 * usePagingList 在 setup 期就握住这些引用，之后每次调用都取当前 props，
 * 页面换 fetcher / 换 seed（我的页切 filter）不必重建列表实例。
 */
const paging = usePagingList<PlanSummary>((cursor, size) => props.fetcher(cursor, size), {
  pageSize: props.pageSize,
  getId: itemId,
  seed: () => (props.seed ? props.seed() : null),
  onPage: (page: PageResult<PlanSummary>, append: boolean) => {
    props.onPage?.(page, append)
  },
  onError: (err: unknown) => {
    props.onError?.(err)
  },
})

// usePagingList 返回的都是顶层 Ref/函数，模板里 Ref 自动解包，页面通过 defineExpose 拿同一批引用
const {
  list,
  loading,
  refreshing,
  hasMore,
  loaded,
  error,
  loadMore,
  reload,
  refresh,
  appendItem,
  patchItem,
  removeItem,
  setList,
  reset,
} = paging

// 三态互斥（§11.2）：骨架屏 → 空态 → 列表 + 底部状态条
const showSkeleton = computed(() => !loaded.value && !error.value)
const showEmpty = computed(() => loaded.value && list.value.length === 0 && !error.value)

const footerVisible = computed(() => {
  if (loading.value) return list.value.length > 0
  // 首屏失败时列表是空的，也要把重试入口摆出来
  if (error.value) return true
  if (!hasMore.value) return list.value.length > 0
  return false
})

const footerStatus = computed<BaseLoadMoreStatus>(() => {
  if (loading.value) return 'loading'
  if (error.value) return 'error'
  return 'nomore'
})

function onRefresher(): void {
  void refresh()
}

function onLower(): void {
  void loadMore()
}

function onFooterRetry(): void {
  // 空列表的失败是首屏失败 → 整屏重取；有数据的是加载更多失败 → 只补下一页
  if (list.value.length === 0) void reload({ force: true })
  else void loadMore()
}

function onEmptyAction(): void {
  // 页面接管时只转发、不并发一次注定还是空的重试（「我发起的」空态要的是「去发布」）
  if (props.emptyActionOwned) {
    emit('empty-action')
    return
  }
  void reload({ force: true })
}

function onCardClick(planId: string): void {
  emit('click', planId)
}

function onCardLongPress(planId: string): void {
  emit('long-press', planId)
}

function onCardExpire(planId: string): void {
  emit('expire', planId)
}

/**
 * 滚动事件转发：页面要响应滚动（如首页 FAB 收起）只能靠这一条 —— 原生事件不跨自定义组件边界。
 * 这里只重建 `{ detail: { scrollTop } }` 而不透传原始 event：uni-mp-vue 的 emit 走
 * `triggerEvent(name, { __args__: args })`，父级拿到的是转发的值而不是原生 event 对象，
 * 原对象上的 target/timeStamp 之类字段页面一个都不需要，透传过去只是把无关字段拖过边界。
 */
function onScroll(event: PlanListScrollEvent): void {
  emit('scroll', { detail: { scrollTop: event.detail?.scrollTop } })
}

/** 顶部锚点的 id，模板里那个 view 的 id 必须与它逐字相同 */
const TOP_ANCHOR = 'plan-list__top-anchor'
const intoView = ref('')

/**
 * 把滚动位置归零（切 tab / 切 filter 都要它）。
 * 走 `scroll-into-view` 而不是 `scroll-top`：前者 Skyline 实测生效、后者不生效（兼容清单 §2.2）。
 * `scroll-into-view` 只在**值发生变化**时动作，同一个 id 再写一次是不动的 —— 所以先清空再挂回，
 * 中间隔一帧，连续两次归零才都有效（第一次归零后值仍停在 id 上，不这么做第二次就没了）。
 */
function scrollToTop(): void {
  intoView.value = ''
  nextTick(() => {
    intoView.value = TOP_ANCHOR
  })
}

onMounted(() => {
  if (props.autoLoad) void reload()
})

// 页面编排（T3.5/T5.5）要的状态与动作：切 filter 用 reload、乐观插入用 appendItem、
// 投票/评论回填用 patchItem、删除用 removeItem。defineExpose 里 Ref 会自动解包。
defineExpose({
  list,
  loading,
  refreshing,
  hasMore,
  loaded,
  error,
  reload,
  refresh,
  loadMore,
  appendItem,
  patchItem,
  removeItem,
  setList,
  reset,
  scrollToTop,
})
</script>

<template>
  <scroll-view
    :class="['plan-list', innerTopGap ? 'plan-list--flush-top' : '']"
    type="list"
    :scroll-y="true"
    :scroll-into-view="intoView"
    :show-scrollbar="false"
    :lower-threshold="lowerThreshold"
    :refresher-enabled="true"
    :refresher-triggered="refreshing"
    @refresherrefresh="onRefresher"
    @scroll="onScroll"
    @scrolltolower="onLower"
  >
    <!-- 滚动归零的靶子：0 高、不吃间距，scroll-into-view 把它对齐到容器顶就是回到顶部 -->
    <view :id="TOP_ANCHOR" class="plan-list__anchor" />

    <!-- 首页（innerTopGap）：顶留白垫在滚动内容里，容器本身不上外边距；我的页走容器 margin-top，不垫 -->
    <view v-if="innerTopGap" class="plan-list__top" />

    <view v-if="showSkeleton" class="plan-list__skeleton">
      <BaseSkeleton type="card" :rows="3" :avatar="true" :animated="animated" />
    </view>

    <view v-else-if="showEmpty" class="plan-list__empty">
      <BaseEmpty :text="emptyText" :action-text="emptyActionText" @action="onEmptyAction" />
    </view>

    <!-- 与骨架/空态互斥：刷新或重取期间不允许骨架屏与真数据同屏 -->
    <template v-else>
      <view v-for="item in list" :key="itemId(item)" class="plan-list__item">
        <PlanCard
          :summary="item"
          :animated="animated"
          @click="onCardClick"
          @long-press="onCardLongPress"
          @expire="onCardExpire"
        />
      </view>

      <BaseLoadMore v-if="footerVisible" :status="footerStatus" @retry="onFooterRetry" />
    </template>

    <!-- 底部悬浮层让位垫在滚动内容尾部（#45）：视口不被压矮，末卡滚到底时落在胶囊与 pill 之上 -->
    <view v-if="floatClearance" class="plan-list__float-space" />
  </scroll-view>
</template>

<style lang="scss" scoped>
// 页面根节点必须 @include page-root（flex 纵向），否则这里 flex: 1 拿不到高度
.plan-list {
  flex: 1;
  min-height: 0;
  // 外边距替代原 __top 占位节点：上 $card-gap 接导航/筛选，左右 $space-3 让圆角容器内缩于页面边缘。
  // Skyline 的 scroll-view 不吃 flex stretch 减 margin（实测仍按视口宽），必须显式 calc 宽度，
  // 否则 margin-left 把容器右推、右缘被宿主裁掉（左右不对称）
  margin: $card-gap $space-3 0;
  width: calc(100% - #{$space-3 * 2});
  // 四角圆角 + overflow:hidden：滚动时进出顶/底边的卡片被容器圆角裁切（用户裁定 2026-11-13）
  border-radius: $radius-lg;
  overflow: hidden;
}

// 首页：容器顶贴导航（不上外边距），顶留白改由滚动内容里的 __top 提供
.plan-list--flush-top {
  margin-top: 0;
}

// 滚动归零锚点：必须真的 0 高，否则它自己就成了内容里多出来的一段间距
.plan-list__anchor {
  height: 0;
}

// 内部顶留白（仅 innerTopGap）：与卡间一致的 $card-gap，首卡不被容器顶圆角裁切
.plan-list__top {
  height: $card-gap;
}

// 底部悬浮层让位 = 胶囊带（含胶囊高 + 与屏底的间距）+ pill 与胶囊的间距 + pill 自身高 + 一格呼吸间距。
// 前三项与 `above-tabbar($space-3)` 严格同口径：pill 底边就在「$space-3 + 胶囊带 + 安全区」处，
// 顶边还要再高一个 $fab-size —— 只算这三段，滚到底时末卡底正好接在 pill 顶边（0 间距，贴脸），
// 所以再补一格 $space-2。只垫滚动内容，不压视口。
.plan-list__float-space {
  width: 100%;
  @include safe-area-bottom($tabbar-band + $space-3 + $fab-size + $space-2);
}

// 卡片贴容器左右边（不再内缩 $space-3）：容器圆角 + overflow:hidden 才能裁切到卡片本身；
// 纵向卡片间距统一 $card-gap（40rpx），与 edit/detail/mine 的卡片间距同源
.plan-list__item {
  padding: 0 0 $card-gap;
}

// 骨架与真卡同口径：通栏（不内缩）+ 卡间 $card-gap，避免骨架比真卡窄/边距不一致（#64）
.plan-list__skeleton {
  padding: 0 0 $card-gap;
}

.plan-list__empty {
  padding: 0 $space-3;
}
</style>
