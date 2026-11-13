import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { toQuery } from '@/utils/format'
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'

/**
 * 分享配置（技术方案 §7.3）。onShareAppMessage / onShareTimeline 必须在页面 setup 里同步注册，
 * 所以这里只是把「标题/路径/图」的组装逻辑收成一份：详情页与卡片共用，避免两处标题不一样。
 */

export interface ShareConfig {
  title: string
  /** 缺省分享当前页（小程序默认行为），带 id 的详情页要显式给 */
  path?: string
  imageUrl?: string
  /** 朋友圈分享只认 query，不能给整页 path */
  query?: Record<string, string | number | undefined>
}

export interface AppShareMessage {
  title: string
  path: string
  imageUrl?: string
}

function currentPagePath(): string {
  const pages = getCurrentPages()
  const top = pages[pages.length - 1]
  return top && top.route ? `/${top.route}` : '/pages/home/index'
}

export function buildShareMessage(config: ShareConfig): AppShareMessage {
  const path = config.path ?? currentPagePath()
  const message: AppShareMessage = { title: config.title, path }
  if (config.imageUrl) message.imageUrl = config.imageUrl
  return message
}

export function useShare(config: MaybeRefOrGetter<ShareConfig>): {
  current: ComputedRef<ShareConfig>
  /** 页面里的自定义分享按钮（button open-type="share"）也能复用同一份文案 */
  appMessage: () => AppShareMessage
} {
  const current = computed(() => toValue(config))

  function appMessage(): AppShareMessage {
    return buildShareMessage(current.value)
  }

  onShareAppMessage(() => appMessage())

  onShareTimeline(() => {
    const share = current.value
    return { title: share.title, query: toQuery(share.query ?? {}), imageUrl: share.imageUrl }
  })

  return { current, appMessage }
}
