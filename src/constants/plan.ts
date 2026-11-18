export const PlanStatus = {
  Draft: 0,
  Ongoing: 1,
  Ended: 2,
  Removed: 3,
} as const
export type PlanStatusValue = (typeof PlanStatus)[keyof typeof PlanStatus]

export const VoteType = {
  Agree: 1,
  Disagree: 2,
} as const
export type VoteTypeValue = (typeof VoteType)[keyof typeof VoteType]

export const CommentStatus = {
  Normal: 0,
  Removed: 1,
} as const
export type CommentStatusValue = (typeof CommentStatus)[keyof typeof CommentStatus]

export const UserStatus = {
  Normal: 0,
  Muted: 1,
  Banned: 2,
} as const

export type MyFilter = 'created' | 'joined' | 'ongoing' | 'ended'
export const MY_FILTERS: MyFilter[] = ['created', 'joined', 'ongoing', 'ended']

/**
 * 四个筛选项的文案 —— **单一来源**。
 * `StatCards`（T5.3）四张卡的标签和 `FilterTabs`（T5.4）的标签必须逐字相同：用户点了「我参与的」卡片、
 * 下面高亮的却是「我参加过的」，在真机上读起来就是 bug。两处共用这张表，漂移只可能发生在一处改动里。
 * 键集与 `MyFilter` 用 `Record` 绑死 —— 新增 filter 值时这里不补就编译不过。
 */
export const MY_FILTER_LABELS: Record<MyFilter, string> = {
  created: '我发起的',
  joined: '我参与的',
  ongoing: '进行中',
  ended: '已截止',
}

export const Limit = {
  TITLE_MAX: 40,
  SUMMARY_MAX: 60,
  OPTION_NAME_MAX: 20,
  COMMENT_MAX: 500,
  /**
   * 昵称上限，与云端 `ServerLimit.NICKNAME_MAX`（cloudfunctions/common/src/constants.ts:59）同值。
   * 前端必须自己限：`user.updateProfile` 超限直接回 1001，而那时用户已经点完了保存。
   */
  NICKNAME_MAX: 30,
  IMAGE_MAX: 3,
  OPTION_IMAGE_MAX: 1,
  OPTION_MAX: 10,
  BLOCK_TEXT_MAX: 2000,
  PAGE_SIZE: 10,
  PAGE_SIZE_MAX: 20,
  COMMENT_PAGE_SIZE: 20,
} as const

/**
 * 原生输入组件（textarea / input）的两个 **UI 观感**口径，全项目一份。
 * 此前 `CURSOR_SPACING = 16` 有五份、`WARN_LEFT = 100` 有两份逐字复制 ——
 * 观感参数最不该出现第二份真相：调一次要挨个找，漏一个就是一块与旁边不一致。
 * 与 `Limit` 分工清楚：`Limit` 是**能不能提交**（与云端同源），这里是**长什么样**。
 */
export const TextInput = {
  /** 光标与键盘的间距（px）。真机键盘高度不一，留的就是「别把光标顶进键盘」那口气 */
  CURSOR_SPACING: 16,
  /** 剩余字数 ≤ 该值时计数器进入「将满」态（染警告色），与云端上限无关 */
  WARN_REMAINING: 100,
} as const

export const DeadlinePreset = [
  { label: '1 天', days: 1 },
  { label: '3 天', days: 3 },
  { label: '7 天', days: 7 },
] as const

/**
 * 编辑器正文色板（§8.1 段落级 `color`）。色值在这里而不是组件里，是为了满足 §9.1-5「禁止硬编码色值」：
 * 工具栏（EditorToolbar）是这份色板唯一的**生产者**，blocks.color 是数据、由 ContentRenderer /
 * EditorTextBlock 原样写进内联 style，两边都不需要知道有几个色。
 * `value: ''` 是「跟随默认正文色」的复位项，写回块时删除 color 字段，不是第六种颜色。
 * 后三个值与 tokens.scss 的 $color-text-1 / $color-primary / $color-danger 一一对应，改一处要改两处。
 */
export const TEXT_COLORS = [
  { label: '默认', value: '' },
  { label: '墨黑', value: '#1a1d24' },
  { label: '主题蓝', value: '#2b6de8' },
  { label: '强调红', value: '#e8544b' },
] as const
