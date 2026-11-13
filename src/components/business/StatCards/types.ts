import { MY_FILTER_LABELS, type MyFilter } from '@/constants/plan'
import type { UserStats } from '@/types/models'

/**
 * 一张统计卡的定义。`key` 直接绑到 `UserStats` 的字段名，
 * 所以「卡片显示的数字」与「点它跳去的 filter」在类型层面就是同一件事的两面 ——
 * 新增第四张卡必须先动 `UserStats`（冻结契约），改不动就说明 v1 只有这三个数。
 */
export interface StatCard {
  /** 点击后 emit 的 filter 值；只可能是 created / joined / ongoing（stats 里没有 ended 这个数） */
  filter: MyFilter
  label: string
  key: keyof UserStats
}

/**
 * 三张卡的顺序 = 展示顺序，也是 §8.7 页面结构图里的顺序。
 * 标签从 `constants/plan` 的 `MY_FILTER_LABELS` 取（与 FilterTabs 同源，同一个词在两处写两遍早晚会对不上，
 * 「我参与的」vs「我参加过的」这种漂移在真机上会直接被读成 bug）。
 */
export const STAT_CARDS: readonly StatCard[] = [
  { filter: 'created', label: MY_FILTER_LABELS.created, key: 'created' },
  { filter: 'joined', label: MY_FILTER_LABELS.joined, key: 'joined' },
  { filter: 'ongoing', label: MY_FILTER_LABELS.ongoing, key: 'ongoing' },
]

export interface Props {
  /**
   * 三个数字的唯一来源：页面从 `useUserStore().stats` 传下来，**组件自己不取数**。
   * 但这份数字不是「随 userInfo 白送的」——`users.stats` 只是冗余镜像，云端唯一会重算它的是
   * `user.stats`（`cloudfunctions/user/src/handlers/stats.ts:32`），所以页面要在自己的刷新节奏里
   * 调一次 `useUserStore().refreshStats()`；口径与理由见 `技术方案.md` §8.7 与 `stores/user.ts` 的 refreshStats 注释。
   */
  stats: UserStats
  /**
   * 当前 filter，**与 FilterTabs 的 active 必须是页面里的同一个值**。
   * 命中哪张卡就高亮哪张；`active === 'ended'` 时三张卡都不高亮（stats 里没有「已截止」这个数）。
   */
  active?: MyFilter
  /**
   * 加载中：数字位置画占位条而**不是 0**。
   * 0 是一个诚实的陈述（「你一条都没发起过」），把「还没拿到数」显示成 0 就是在撒谎。
   */
  loading?: boolean
  /** 不可点（未登录 / 页面正在重拉）。只拦点击，不影响显示 */
  disabled?: boolean
}

export type Emits = {
  /**
   * 点了一张卡。载荷是 `@/constants/plan` 的 `MyFilter`，取值只可能是
   * `'created' | 'joined' | 'ongoing'`（不会发 `'ended'`）。
   * 页面把它写进自己那个 `activeFilter`，**不要**在这里再存一份。
   */
  (e: 'select', filter: MyFilter): void
}
