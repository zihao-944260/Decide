import { MY_FILTER_LABELS, type MyFilter } from '@/constants/plan'
import type { UserStats } from '@/types/models'

/**
 * 一张统计卡的定义。数字怎么来由 `count` 自己说，
 * 所以「卡片显示的数字」与「点它跳去的 filter」在类型层面仍然是同一件事的两面 ——
 * 新增一张卡必须先答得出「这个数从哪来」，答不出来就不该加（上一版三张卡直接绑 `UserStats` 字段名，
 * 加第四张时就卡住了：契约里没有 `ended` 这个数）。
 */
export interface StatCard {
  /** 点击后 emit 的 filter 值，四个 MyFilter 取值都能出现在这里 */
  filter: MyFilter
  label: string
  /** 从 `stats` 算出这张卡的数字 */
  count: (stats: UserStats) => number
}

/**
 * 四张卡的顺序 = 展示顺序，也是 §8.7 页面结构图里的顺序。
 * 标签从 `constants/plan` 的 `MY_FILTER_LABELS` 取（同一个词在两处写两遍早晚会对不上，
 * 「我参与的」vs「我参加过的」这种漂移在真机上会直接被读成 bug）。
 */
export const STAT_CARDS: readonly StatCard[] = [
  { filter: 'created', label: MY_FILTER_LABELS.created, count: (s) => s.created },
  { filter: 'joined', label: MY_FILTER_LABELS.joined, count: (s) => s.joined },
  { filter: 'ongoing', label: MY_FILTER_LABELS.ongoing, count: (s) => s.ongoing },
  // 「已截止」没有独立计数，但**不需要为此动后端**：它是 created 集合里扣掉 ongoing 剩下的那一块。
  // 云端三条口径（planDao.countByAuthor 与 myList.ts 的 deadline 分支）是这么咬合的 ——
  //   created = 我发起 且 status ∈ {进行中(1), 已截止(2)}
  //   ongoing = 我发起 且 status = 1 且 (deadline = 0 或 deadline > now)
  //   ended   = 我发起 且 (status = 2 或 (status = 1 且 0 < deadline ≤ now))      ← #46 的现算口径
  // 于是 created − ongoing = status=2 ∪ (status=1 且已过期) = ended，一字不差，
  // 而且 ongoing ⊂ created，差值恒 ≥ 0。scheduler 还没把 1 翻成 2 的窗口期也落在这条减法里。
  { filter: 'ended', label: MY_FILTER_LABELS.ended, count: (s) => s.created - s.ongoing }
]

export interface Props {
  /**
   * 四张卡的数字的唯一来源（「已截止」由 `created − ongoing` 推出，见 STAT_CARDS 的口径推导）：
   * 页面从 `useUserStore().stats` 传下来，**组件自己不取数**。
   * 但这份数字不是「随 userInfo 白送的」——`users.stats` 只是冗余镜像，云端唯一会重算它的是
   * `user.stats`（`cloudfunctions/user/src/handlers/stats.ts:32`），所以页面要在自己的刷新节奏里
   * 调一次 `useUserStore().refreshStats()`；口径与理由见 `技术方案.md` §8.7 与 `stores/user.ts` 的 refreshStats 注释。
   */
  stats: UserStats
  /**
   * 当前 filter，由页面持有（我的页 `activeFilter`）。命中哪张卡就高亮哪张；
   * 四个 MyFilter 取值都有对应的卡，所以任何时刻恰好一张亮。
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
   * 点了一张卡。载荷是 `@/constants/plan` 的 `MyFilter`，四个取值都可能发出来。
   * 页面把它写进自己那个 `activeFilter`，**不要**在这里再存一份。
   */
  (e: 'select', filter: MyFilter): void
}
