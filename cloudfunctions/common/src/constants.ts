/**
 * 与 `src/constants/plan.ts` 保持同步（镜像副本，勿单独改数值）。
 *
 * 为什么要镜像：云函数打包后是独立运行目录，模块解析不到工程 `src/`（技术方案 §4 约定），
 * 所以常量在 common 里复制一份。前端会做同样的校验，这里的服务端二次校验是权威判定（§11.3）。
 */

export const PlanStatus = {
  Draft: 0,
  Ongoing: 1,
  Ended: 2,
  Removed: 3,
} as const

/** 列表查询一律带 status in [1,2]（§11.3：软删除 3 不出现在任何列表里） */
export const LISTABLE_PLAN_STATUS: readonly number[] = [PlanStatus.Ongoing, PlanStatus.Ended]

export const VoteType = {
  Agree: 1,
  Disagree: 2,
} as const

export type VoteTypeValue = 1 | 2
export const VOTE_TYPES: readonly number[] = [VoteType.Agree, VoteType.Disagree]

export const CommentStatus = {
  Normal: 0,
  Removed: 1,
} as const

export const UserStatus = {
  Normal: 0,
  Muted: 1,
  Banned: 2,
} as const

export type MyFilter = 'created' | 'joined' | 'ongoing' | 'ended'
export const MY_FILTERS: readonly MyFilter[] = ['created', 'joined', 'ongoing', 'ended']

export const Limit = {
  TITLE_MAX: 40,
  SUMMARY_MAX: 60,
  OPTION_NAME_MAX: 20,
  COMMENT_MAX: 500,
  IMAGE_MAX: 3,
  OPTION_IMAGE_MAX: 1,
  OPTION_MAX: 10,
  BLOCK_TEXT_MAX: 2000,
  PAGE_SIZE: 10,
  PAGE_SIZE_MAX: 20,
  COMMENT_PAGE_SIZE: 20,
} as const

/** 以下为服务端侧附加上限（前端不感知，故不在 src/constants 里） */
export const ServerLimit = {
  /** blocks 数量上限：编辑器分块，正常写作远达不到，仅防构造请求 */
  BLOCK_MAX: 100,
  /** 昵称/签名长度上限 */
  NICKNAME_MAX: 30,
  /** deadline 距当前时间最大跨度：1 年（§11.3） */
  DEADLINE_MAX_DAYS: 365,
  /** msgSecCheck v2 单次调用最大字符数（官方 2500，留余量） */
  SEC_CHECK_CHUNK: 2000,
  /** 一次请求内最多做的文本检测次数，配合 3s 超时截断 */
  SEC_CHECK_MAX_CHUNKS: 4,
  /** 单次云函数调用的自我时间预算（默认超时 3s，留 800ms 给响应链路） */
  TIME_BUDGET_MS: 2200,
  /** scheduler 单批处理条数（§6.7） */
  SCHED_BATCH: 100,
  /** scheduler 对账单次最多处理的计划数 */
  RECONCILE_MAX_PLANS: 40,
  /** 限流：写操作 5 次 / 10 秒（§11.3） */
  RATE_LIMIT_COUNT: 5,
  RATE_WINDOW_MS: 10000,
  /** 集合内单页最多取多少条评论（评论专用上限 20） */
  COMMENT_PAGE_SIZE_MAX: 20,
} as const

/** 内容安全场景值（§11.3：1 资料 / 2 评论 / 3 论坛 / 4 社交） */
export const SecScene = {
  Profile: 1,
  Comment: 2,
  Forum: 3,
  Social: 4,
} as const

/**
 * 集合名（技术方案 §5 / T2.1）。云数据库集合名不能以下划线开头、≤96 字符，
 * 这里集中一份，避免各处字符串字面量打错；实际建表与索引在控制台完成。
 */
export const Collection = {
  Users: 'users',
  Plans: 'plans',
  Votes: 'votes',
  Comments: 'comments',
  Participations: 'participations',
  Counters: 'counters',
} as const
