import { logger } from '@/utils/logger'

/**
 * 命令式 toast：直接封 uni.showToast（原生 API）。
 * 小程序没有 DOM，运行时挂组件做全局 toast 这条路走不通（技术方案 §9.2 的 BaseToast
 * 只做受控展示，命令式这层必须由原生 API 承担）。
 */

export type ToastIcon = 'none' | 'success' | 'error' | 'loading'

export interface ToastOptions {
  duration?: number
  icon?: ToastIcon
  mask?: boolean
}

const DEFAULT_DURATION = 2000

function show(title: string, options: ToastOptions = {}): void {
  if (!title) return
  uni.showToast({
    title,
    icon: options.icon ?? 'none',
    duration: options.duration ?? DEFAULT_DURATION,
    mask: options.mask ?? false,
  })
}

export function useToast() {
  return {
    show,
    success: (title: string, options?: ToastOptions) => show(title, { icon: 'success', ...options }),
    error: (title: string, options?: ToastOptions) => show(title, { icon: 'none', duration: 2500, ...options }),
    loading: (title = '加载中…') => uni.showLoading({ title, mask: true }),
    hide: () => {
      try {
        uni.hideLoading()
      } catch (err) {
        // 没弹过 loading 时 hideLoading 会抛，忽略即可，不该冒泡打断业务流程
        logger.debug('toast', 'hideLoading without showing', err)
      }
    },
  }
}

export { show as showToastMsg }
