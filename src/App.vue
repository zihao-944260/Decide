<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { CLOUD_ENV } from '@/config/cloud'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'

onLaunch(() => {
  if (wx.cloud) {
    wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
  }
  // 状态栏/胶囊测量必须先于任何页面首帧：BaseNavbar/BasePopup 全读这份值，
  // 不量的话 statusBarHeight=0、胶囊矩形=null，导航栏整体画进刘海（实测过）。
  useAppStore().initSystemInfo()
  // T5.1 的上半：先秒回本地缓存，再静默建档。login() 失败不提示、不重试 ——
  // 未登录不影响读链路，只有「主态」（是否发起人、能否删他人评论）会退化成游客视角。
  const userStore = useUserStore()
  userStore.hydrate()
  void userStore.login(undefined, { silent: true }).catch(() => undefined)
})

onShow(() => {
  console.log('[Decide] onShow')
})
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
