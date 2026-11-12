<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { CLOUD_ENV } from '@/config/cloud'

onLaunch(() => {
  if (wx.cloud) {
    wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
  }
})

onShow(() => {
  console.log('[Decide] onShow')
})
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
