<script setup lang="ts">
// 我的页占位（真实实现见 T5.5）
</script>

<template>
  <view class="mine">
    <view class="mine__bar">
      <text class="mine__title">我的</text>
    </view>
    <scroll-view class="mine__scroll" type="list">
      <view class="mine__placeholder">
        <text class="mine__placeholder-text">用户信息与筛选列表将在 T5.5 实现</text>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.mine {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.mine__bar {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 32rpx;
  background-color: #ffffff;
}

.mine__title {
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1d24;
}

.mine__scroll {
  flex: 1;
}

.mine__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120rpx 32rpx;
}

.mine__placeholder-text {
  font-size: 26rpx;
  color: #8a8f99;
}
</style>
