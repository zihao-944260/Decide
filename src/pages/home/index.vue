<script setup lang="ts">
// 首页占位（真实实现见 T3.5）
</script>

<template>
  <view class="home">
    <view class="home__bar">
      <text class="home__title">众议</text>
    </view>
    <scroll-view class="home__scroll" type="list">
      <view class="home__placeholder">
        <text class="home__placeholder-text">计划列表将在 T3.5 实现</text>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.home {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.home__bar {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 32rpx;
  background-color: #ffffff;
}

.home__title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1d24;
}

.home__scroll {
  flex: 1;
}

.home__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120rpx 32rpx;
}

.home__placeholder-text {
  font-size: 26rpx;
  color: #8a8f99;
}
</style>
