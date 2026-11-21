<script setup lang="ts">
/**
 * 首页（技术方案 §8.8 / WBS T3.5）—— 只做编排，不做实现。
 *
 * 分工边界：骨架/空态/错误重试三态、下拉刷新、触底加载更多全部在 PlanList 内部（§4.7 已验收口径），
 * 页面一行都不重复写；倒计时心跳与 onShow/onHide 归 usePageRefresh（§7.3），切 tab 回来把列表归零
 * 归 useTabScrollReset —— 页面自己一行 onShow/onHide 都不写，也不挂任何定时器。
 */
import { nextTick, ref } from 'vue'
import BaseNavbar from '@/components/base/BaseNavbar/index.vue'
import BaseTabBar from '@/components/base/BaseTabBar/index.vue'
import PlanList from '@/components/business/PlanList/index.vue'
import type { PlanListScrollEvent } from '@/components/business/PlanList/types'
import { fetchPlanList } from '@/api/plan'
import { usePageRefresh, useTabScrollReset, type PageFetcher } from '@/composables'
import { PlanStatus } from '@/constants/plan'
import { PAGE_KEYS } from '@/constants/pages'
import { usePlanStore } from '@/stores/plan'
import type { PageResult } from '@/types/api'
import type { PlanSummary } from '@/types/models'
import { logger } from '@/utils/logger'

/** 滚动切 FAB 的最小间隔：scroll 事件是逐帧的，不节流就是把 setData 打成刷屏（§11.1） */
const FAB_THROTTLE_MS = 120
/** 方向判定死区（px）：小于这个位移算手指抖动，不翻转 FAB 状态 */
const FAB_DEAD_ZONE = 4

const planStore = usePlanStore()
const planListRef = ref<InstanceType<typeof PlanList> | null>(null)

/**
 * api 的入参是 PageQuery 对象，PageFetcher 要的是 (cursor, pageSize)，两者形状不同 → 必须包一层。
 * 首页与我的页只差这一个函数（§10），组件不认识 api。
 */
const fetcher: PageFetcher<PlanSummary> = (cursor, pageSize) => fetchPlanList({ cursor, pageSize })

/**
 * 首屏缓存回填（§8.7「切 tab 不重查」）：口径在 store 里（homePage 决定「空桶算没加载过」），
 * 页面不再自己判 `list.length > 0` —— 我的页四个 filter 桶共用同一条规则，写两处就会分叉。
 */
function seed(): PageResult<PlanSummary> | null {
  return planStore.homePage()
}

/** 每页成功回吐给 store：列表态在组件里，跨页一致的状态在这里（§7.2） */
function onPage(page: PageResult<PlanSummary>, append: boolean): void {
  planStore.setHomePage(page, append)
}

/** 失败提示由 api 层统一 toast（§7.1，request.ts 非 silent 分支已弹），这里只留日志，绝不弹第二条 */
function onError(error: unknown): void {
  logger.warn('home', 'plan.list failed', error)
}

// —— FAB：滚动时节流收起/半透明（§8.8「不跟手」：T0 实测 SharedValue 无法经 Vue 模板承载，见兼容清单 §2.5）
const fabCollapsed = ref(false)
let lastScrollTop = 0
let lastToggleAt = 0

/**
 * 事件来自 PlanList 转发的内部 scroll-view（小程序原生事件不跨自定义组件边界，组件已显式 triggerEvent）。
 * scroll 是逐帧的，所以判定全部留在页面这一侧：组件只透传，不设第二套节流口径。
 */
function onListScroll(event: PlanListScrollEvent): void {
  const top = event.detail?.scrollTop ?? 0
  const now = Date.now()
  const elapsed = now - lastToggleAt
  // elapsed < 0 说明用户改了本地时钟，按「到点」放行，不能让节流条件永远为假把 FAB 冻住
  if (elapsed >= 0 && elapsed < FAB_THROTTLE_MS) return

  const delta = top - lastScrollTop
  if (delta > -FAB_DEAD_ZONE && delta < FAB_DEAD_ZONE) return

  lastToggleAt = now
  lastScrollTop = top
  // 向下滚（正文优先）收起，向上滚或已回到顶部恢复
  fabCollapsed.value = top > 0 && delta > 0
}

function onPublish(): void {
  // T4.11 才做真编辑器，当前是占位页；路由已在 pages.json 注册
  uni.navigateTo({ url: '/pages/plan/edit/index' })
}

function onCardClick(planId: string, openContainer?: unknown): void {
  // query 参数名固定为 planId；openContainer 为卡片 open-container 的实例（Skyline 容器转场动画），
  // 拿不到时（查询失败 / 基础库 < 3.12.2）走普通跳转，不报错
  const options = {
    url: `/pages/plan/detail/index?planId=${planId}`
  } as Parameters<typeof uni.navigateTo>[0] & { withOpenContainer?: unknown }
  if (openContainer) options.withOpenContainer = openContainer
  uni.navigateTo(options)
}

/**
 * 倒计时归零：只把状态写进 store，让其他消费方（我的页 / 统计）看到一致口径。
 * 卡片自身置灰由 PlanCard 的 expired 负责，这里不整表刷新、不重新请求（§8.5「视觉归前端、真状态归云端」）。
 * 长按不接：首页没有管理入口，那是我的页 T5.6 的职责。
 */
function onExpire(planId: string): void {
  planStore.patchPlan(planId, { status: PlanStatus.Ended })
}

/**
 * 首屏加载与差异化刷新都挂在 onRefresh 上（§7.3）：
 * usePageRefresh 已经接管 onShow/onHide 的 resumeTick/pauseTick、60s 新鲜度判定和跨页失效（invalidatePage），
 * 页面不写 onShow/onHide，也不自己数时间。nextTick 兜住「首次 onShow 早于子组件挂载」这一帧。
 *
 * force 用 usePageRefresh 递过来的 first，这是 seed 与 invalidatePage 的交界处：
 * - 首次加载 → 非 force，seed 命中缓存就不发请求（§8.7 冷启动/切回来秒出）；
 * - 非首次 → 这次进到这里只可能是数据过期或被跨页失效（发布/编辑/删除后回来），必须绕过 seed 真请求，
 *   否则 invalidatePage('home') 会被缓存吞掉，新发的计划要等用户手拽下拉刷新才出现。
 *   不用组件的 `loaded` 代替 first：那是**实例级**状态，一个列表实例服务多个数据桶时（我的页四个 filter）分不清桶。
 */
usePageRefresh({
  key: PAGE_KEYS.home,
  onRefresh: async ({ first }) => {
    await nextTick()
    const list = planListRef.value
    // 组件实例还没挂上（首帧竞态）→ 抛给 usePageRefresh 的 catch：它不盖新鲜度戳，下次 onShow 会自动重试，
    // 而不是把页面永久停在骨架屏上。这条分支正常情况下不应该命中。
    if (!list) throw new Error('planList instance not mounted')
    await list.reload({ force: !first })
  }
})

// 切 tab 回到本页 → 列表回到顶部（用户 2026-11-18 口径）。从详情页返回那一次不动位置，
// 区分两种 onShow 的口径在 composable 里，这里只管「归零归谁」。
useTabScrollReset(() => {
  planListRef.value?.scrollToTop()
})
</script>

<template>
  <view class="home">
    <BaseNavbar class="home__nav" title="点子商量局" :backable="false" />

    <PlanList
      ref="planListRef"
      class="home__list"
      :fetcher="fetcher"
      :seed="seed"
      :on-page="onPage"
      :on-error="onError"
      :auto-load="false"
      :float-clearance="true"
      :inner-top-gap="true"
      empty-text="还没有计划，点下方发布第一条"
      @click="onCardClick"
      @expire="onExpire"
      @scroll="onListScroll"
    />

    <!-- 发布按钮与我的页退出登录同款：底部居中透明浮层 + 白底 pill，列表从四周透出 -->
    <view class="home__fab-bar">
      <view
        :class="fabCollapsed ? 'home__fab home__fab--collapsed' : 'home__fab'"
        hover-class="home__fab--hover"
        @tap="onPublish"
      >
        <text class="home__fab-plus">+</text>
        <text class="home__fab-text">发布</text>
      </view>
    </view>

    <!-- 底部导航：fixed 悬浮，不占这一列的空间；滚动到底的让位由 PlanList 在内容尾部垫（float-clearance） -->
    <BaseTabBar active="home" />
  </view>
</template>

<style lang="scss" scoped>
// 根节点必须 flex 纵向 + overflow hidden，否则 PlanList 的 flex: 1 拿不到高度（组件 README 同条）
.home {
  @include page-root;
  background-color: $color-bg-page;
}

.home__nav {
  // 组件宿主节点（`<base-navbar>` 这个标签本身）在页面 flex 列里，不参与伸缩
  flex-shrink: 0;
}

// 组件宿主节点的兜底：小程序里自定义组件是一个真实节点，`.plan-list` 的 flex: 1 是相对它算的。
// 这里把宿主节点也做成「撑满剩余空间 + flex 列」，页面根 → 宿主 → scroll-view 三段才连得上高度；
// 若运行时组件是虚节点（virtualHost），这几条落在不存在的节点上，无副作用。
.home__list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 发布浮层与我的页退出登录同口径（#62）：fixed 底部居中透明带 + 白底 pill，列表从四周透出。
// fixed 是 T0 实测可用项（兼容清单 §2.2），故浮层是 scroll-view 的兄弟节点而不是子节点。
// 置底改为让位给悬浮胶囊（above-tabbar），胶囊占掉的那条带 + 安全区不能再压一次浮层。
// $space-3 而不是 $space-2：胶囊为容纳加厚的色块内衬长到 124rpx，带高多了 12rpx，
// 间距不跟着抬就会贴到胶囊沿上。
.home__fab-bar {
  position: fixed;
  left: 0;
  right: 0;
  @include flex-center;
  @include above-tabbar($space-3);
}

.home__fab {
  @include flex-center;
  min-height: $tap-min-height;
  padding: 0 $space-5;
  background-color: $color-bg-card;
  border-radius: $radius-round;
  box-shadow: $shadow-popup;
  // 动效只走 CSS transition（兼容清单 §2.5：worklet 跟手在本工程不可用）
  transition:
    opacity $duration-base,
    transform $duration-base;
}

.home__fab--collapsed {
  opacity: 0.5;
  transform: scale(0.85);
}

.home__fab--hover {
  opacity: 0.85;
}

.home__fab-plus {
  margin-right: $space-1;
  font-size: $font-lg;
  font-weight: $font-weight-medium;
  line-height: $line-tight;
  color: $color-primary;
}

.home__fab-text {
  font-size: $font-md;
  font-weight: $font-weight-medium;
  color: $color-primary;
}
</style>
