<script setup lang="ts">
/**
 * Great Ideas（底部导航中间那一项）—— 按用户 2026-11-17 的口径，**这一页目前什么都不放**：
 * 只有顶部导航与底部胶囊导航之间的空白区，用来把「三 tab + 滑块滑动」这条链路先接上。
 *
 * 页面本身仍然按 tab 页的规矩接：`page-root` 的 flex 纵向 + `overflow: hidden`，
 * BaseNavbar 是普通流节点（宿主 `flex-shrink: 0`），BaseTabBar 则 fixed 悬浮在页底、不占这一列。
 * 中间那块 `.ideas__body { flex: 1 }` 是**布局占位**而不是内容：没有它，flex 列里没有任何一项
 * 吃剩余高度，页面底色就只铺到导航下沿。
 */
import BaseNavbar from '@/components/base/BaseNavbar/index.vue'
import BaseTabBar from '@/components/base/BaseTabBar/index.vue'
</script>

<template>
  <view class="ideas">
    <BaseNavbar class="ideas__nav" title="Great Ideas" :backable="false" />

    <!-- 空页面：只吃剩余高度，把页面底色铺满到视口底 -->
    <view class="ideas__body" />

    <BaseTabBar active="ideas" />
  </view>
</template>

<style lang="scss" scoped>
.ideas {
  @include page-root;
  background-color: $color-bg-page;
}

.ideas__nav {
  // 组件宿主节点在页面 flex 列里不参与伸缩（首页/我的页同口径）
  flex-shrink: 0;
}

.ideas__body {
  flex: 1;
  min-height: 0;
}
</style>
