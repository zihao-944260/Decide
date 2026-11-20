import {
  fetchStats as fetchStatsApi,
  login as loginApi,
  updateProfile as updateProfileApi
} from '@/api/user'
import { setUnauthorizedHandler, type RequestOptions } from '@/api/request'
import { usePlanStore } from '@/stores/plan'
import type { UserInfo, UserStats } from '@/types/models'
import { logger } from '@/utils/logger'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const TAG = 'userStore'
const STORAGE_KEY = 'decide:user'
/**
 * 缓存 7 天过期：openid 会话本身长期有效，过期只是为了强制刷新云端资料/封禁态，
 * 过期或损坏即丢弃，走下次 login 重建（技术方案 §7.2「持久化带过期」）。
 */
const TTL = 7 * 24 * 60 * 60 * 1000

interface PersistedUser {
  userInfo: UserInfo
  savedAt: number
  expiresAt: number
}

const EMPTY_STATS: UserStats = { created: 0, joined: 0, ongoing: 0 }

/**
 * 1002 静默重登防死循环（技术方案 §7.1 第 4 条）：
 * handler 内部的 user.login 自身也可能返回 1002，若再次触发 handler 会互相等待成环，
 * 因此重登进行中时 handler 直接 no-op 返回，由 request.ts「仅重试一次」机制自然终止并抛出干净的 ApiError。
 */
let relogging = false

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  const stats = ref<UserStats>({ ...EMPTY_STATS })
  const isLoggedIn = computed(() => userInfo.value !== null)

  function applyUserInfo(info: UserInfo): void {
    userInfo.value = info
    // users 文档里的 stats 只是冗余镜像，权威值只有 user.stats 会算（见下面的 refreshStats）；
    // 这里同步是为了冷启动有一秒内的可读数字，不保证它和列表条数一致
    stats.value = info.stats
  }

  function persist(): void {
    if (!userInfo.value) return
    // 本地 TTL 用本地钟：冷启动首次请求前 timeOffset 尚未校准，serverNow 此刻等价于 Date.now
    const now = Date.now()
    const data: PersistedUser = { userInfo: userInfo.value, savedAt: now, expiresAt: now + TTL }
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(data))
  }

  /** 登录（或补全昵称头像），成功后落 storage。options 透传给 api，冷启动静默登录用 `{ silent: true }` */
  async function login(
    profile?: { nickName?: string; avatarUrl?: string },
    options?: RequestOptions
  ): Promise<UserInfo> {
    const { userInfo: info } = await loginApi(profile ?? {}, options)
    applyUserInfo(info)
    persist()
    return info
  }

  /** 契约没有 getProfile，user.login 幂等，重放即拉取最新 userInfo + stats */
  async function refresh(): Promise<void> {
    const { userInfo: info } = await loginApi({})
    applyUserInfo(info)
    persist()
  }

  /**
   * 三个数字的权威来源，也是唯一会重算它们的地方。
   * 为什么必须单独调：`user.login` 明确**不重算** stats
   * （cloudfunctions/user/src/handlers/login.ts:9-10，理由是冷启动多三条 count 会让首屏多等 100~200ms），
   * 而 `login.ts:66` 建档时写死 `{0,0,0}`；全云端唯一改写 `users.stats` 的是
   * cloudfunctions/user/src/handlers/stats.ts:32。所以不调它 = 我的页三张卡永远停在 0 或建档值。
   *
   * 代价可控：它是 read-kind（不占 §11.3 写限流桶），且云端算完顺手回写 `users.stats`，
   * 下一次 `login`/`refresh` 带回来的就是这份新值。调用频次由页面挂在 `usePageRefresh` 的
   * 差异化刷新上决定 —— 未过期或被缓存命中时一次都不发。
   * 失败让调用方自己兜（数字旧着不该把整页刷新说成失败），这里不吞异常。
   */
  async function refreshStats(): Promise<void> {
    const next = await fetchStatsApi()
    stats.value = next
    if (userInfo.value) {
      userInfo.value.stats = next
      persist()
    }
  }

  async function updateProfile(profile: {
    nickName: string
    avatarUrl: string
  }): Promise<UserInfo> {
    const { userInfo: info } = await updateProfileApi(profile)
    applyUserInfo(info)
    persist()
    return info
  }

  function logout(): void {
    // 云开发无服务端会话可销毁，登出只清本地；投票态/列表缓存与用户绑定，一并清空
    userInfo.value = null
    stats.value = { ...EMPTY_STATS }
    uni.removeStorageSync(STORAGE_KEY)
    usePlanStore().clear()
  }

  /** 冷启动时从 storage 恢复，过期或损坏即清除 */
  function hydrate(): void {
    const raw: unknown = uni.getStorageSync(STORAGE_KEY)
    if (!raw || typeof raw !== 'string') return
    try {
      const data = JSON.parse(raw) as PersistedUser
      if (!data.userInfo || typeof data.expiresAt !== 'number' || data.expiresAt <= Date.now()) {
        uni.removeStorageSync(STORAGE_KEY)
        return
      }
      applyUserInfo(data.userInfo)
    } catch {
      logger.warn(TAG, '本地用户缓存损坏，已丢弃')
      uni.removeStorageSync(STORAGE_KEY)
    }
  }

  setUnauthorizedHandler(async () => {
    if (relogging) return
    relogging = true
    try {
      // noDedupe 必需：触发本 handler 的往往正是 user.login({})（login() 无 profile 或 refresh()），
      // 它已在 inflight 表里且正在 await 本 handler，同 key 复用会自等待成死锁。
      const { userInfo: info } = await loginApi({}, { silent: true, noDedupe: true })
      applyUserInfo(info)
      persist()
      logger.info(TAG, '1002 静默重登成功')
    } catch (err) {
      // 吞掉错误让 request.ts 对原 action 做最后一次重试，错误面收敛为单个 ApiError
      logger.warn(TAG, '1002 静默重登失败', err)
    } finally {
      relogging = false
    }
  })

  return {
    userInfo,
    stats,
    isLoggedIn,
    login,
    refresh,
    refreshStats,
    updateProfile,
    logout,
    hydrate
  }
})
