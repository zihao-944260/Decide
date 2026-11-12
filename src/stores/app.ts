import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface SafeArea {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export const useAppStore = defineStore('app', () => {
  const timeOffset = ref(0)
  const statusBarHeight = ref(0)
  const safeArea = ref<SafeArea | null>(null)
  const windowWidth = ref(375)
  const windowHeight = ref(667)
  const pixelRatio = ref(3)
  const menuButtonRect = ref<{ top: number; height: number; right: number; width: number } | null>(null)
  const globalLoading = ref(false)

  function initSystemInfo(): void {
    const info = uni.getSystemInfoSync()
    statusBarHeight.value = info.statusBarHeight ?? 0
    windowWidth.value = info.windowWidth
    windowHeight.value = info.windowHeight
    pixelRatio.value = info.pixelRatio
    const area = info.safeArea
    if (area) {
      safeArea.value = {
        top: area.top,
        bottom: area.bottom,
        left: area.left,
        right: area.right,
        width: area.width,
        height: area.height,
      }
    }
    const rect = uni.getMenuButtonBoundingClientRect?.()
    if (rect && rect.height) {
      menuButtonRect.value = { top: rect.top, height: rect.height, right: rect.right, width: rect.width }
    }
  }

  /** 校准后的服务端当前时间（倒计时唯一时间源，见技术方案 §8.5） */
  function serverNow(): number {
    return Date.now() + timeOffset.value
  }

  const navBarHeight = computed(() => {
    const rect = menuButtonRect.value
    if (!rect) return 44 + statusBarHeight.value
    return (rect.top - statusBarHeight.value) * 2 + rect.height + statusBarHeight.value
  })

  return {
    timeOffset,
    statusBarHeight,
    safeArea,
    windowWidth,
    windowHeight,
    pixelRatio,
    menuButtonRect,
    globalLoading,
    navBarHeight,
    initSystemInfo,
    serverNow,
  }
})
