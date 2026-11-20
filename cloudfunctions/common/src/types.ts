/**
 * 云函数侧的类型定义。
 *
 * 为什么不 import `src/types/*`：云函数运行目录独立，模块解析不到工程 `src/`（技术方案 §4），
 * 所以 DTO / Block 结构在此镜像一份，字段必须与 `src/types/models.ts`、`src/types/api.ts` 保持一致。
 *
 * 为什么手写数据库返回类型：wx-server-sdk 4.0.2 的 `add/get/count/remove` 把回调与 Promise
 * 重载混写成 `string | void | IXxxResult` 联合，await 后无法收窄，而 IXxxResult 又没被 export
 * （只在 index.d.ts 的私有 namespace 里）。所以只在 dao 边界按真实返回形状断言一次。
 */
import { database } from 'wx-server-sdk'

// === SDK 实例类型（经 ReturnType 取出，避开私有 namespace） ===
export type Db = ReturnType<typeof database>
export type DbCollection = ReturnType<Db['collection']>
export type DbDocument = ReturnType<DbCollection['doc']>
export type DbCommand = Db['command']
export type DbQueryCommand = ReturnType<DbCommand['gt']>
export type DbLogicCommand = ReturnType<DbCommand['or']>
export type DbUpdateCommand = ReturnType<DbCommand['inc']>

/** where 条件值：字面量或 command（gt/in/or…） */
export type QueryValue =
  string | number | boolean | null | DbQueryCommand | DbLogicCommand | readonly (string | number)[]

export type Condition = Record<string, QueryValue>

/** where(...) 的合法实参：普通条件对象，或顶层逻辑命令（_.and / _.or 组合） */
export type WherePart = Condition | DbLogicCommand

/** 更新载荷：字段值或原子命令（_.inc 等） */
export type UpdatePayload = Record<
  string,
  string | number | boolean | null | DbUpdateCommand | object
>

// === 事务 ===
/**
 * `db.startTransaction()` 返回 `Promise<any>`（4.0.2 类型缺失，实测能力见 docs §3.1）。
 * 这里按 wx-server-sdk 运行时真实形状收窄，只在 dao 边界断言一次。
 * get 的返回沿用「普通查询 data 是数组、事务查询 data 是对象」的差异，统一交给 rowsOf。
 */
export interface TxDocument {
  get(): Promise<unknown>
  update(options: { data: UpdatePayload }): Promise<unknown>
  set(options: { data: object }): Promise<unknown>
  remove(): Promise<unknown>
}

export interface TxCollection {
  doc(id: string): TxDocument
  add(options: { data: object }): Promise<unknown>
}

export interface Transaction {
  collection(name: string): TxCollection
  commit(): Promise<unknown>
  rollback(reason?: unknown): Promise<unknown>
}

// === 查询返回形状 ===
export interface GetResult<T> {
  data: T[]
}

export interface CountResult {
  total: number
}

export interface AddResult {
  _id: string
}

export interface UpdateResult {
  stats?: { updated?: number; created?: number }
  updated?: number
}

export interface RemoveResult {
  stats?: { removed?: number }
  removed?: number
}

// === 线格式与统一响应（对齐 src/types/api.ts / cloud.ts） ===
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
  serverTime: number
}

export interface PageResult<T> {
  list: T[]
  nextCursor: string
  hasMore: boolean
}

export interface CloudEvent<P = unknown> {
  action: string
  payload: P
}

// === 内容块（与 src/types/models.ts 的 Block 联合一致） ===
export interface TextBlock {
  id: string
  type: 'text'
  text: string
  level: 1 | 2 | 3
  align: 'left' | 'center'
  bold?: boolean
  color?: string
}

export interface ImageBlock {
  id: string
  type: 'image'
  fileID: string
  w: number
  h: number
  caption?: string
}

export interface QuoteBlock {
  id: string
  type: 'quote'
  text: string
}

export interface DividerBlock {
  id: string
  type: 'divider'
}

export type Block = TextBlock | ImageBlock | QuoteBlock | DividerBlock

export interface PlanOption {
  id: string
  name: string
  image: string
  order: number
  /**
   * 该选项的支持票数（与 src/types/models.ts 的 PlanOption.count 对齐）。
   * 权威计数存在 plan.optionVotes（见 PlanDoc），出参由 mapper.toPlanOptions 折算；
   * 库内 options[] 里的 count 只是占位（创建/编辑时恒 0），不作为计数来源。
   */
  count: number
}

export interface VoteCounts {
  agree: number
  disagree: number
}

export interface UserStats {
  created: number
  joined: number
  ongoing: number
}

export interface UserInfo {
  openId: string
  nickName: string
  avatarUrl: string
  status: number
  stats: UserStats
  createdAt: number
  updatedAt: number
}

export interface PlanSummary {
  planId: string
  title: string
  summary: string
  cover: string
  deadline: number
  optionsEnabled: boolean
  optionCount: number
  /** 选项表决模式的逐选项票数（首页卡片每选项一行进度条，#61）；简单表决模式为 [] */
  options: PlanOption[]
  votes: VoteCounts
  /** 我投的选项 id（'' = 未投）；选项模式的锁定/高亮依据（#60） */
  myOption: string
  commentCount: number
  status: number
  author: UserInfo
  createdAt: number
}

export interface PlanDetail extends PlanSummary {
  blocks: Block[]
  images: string[]
  options: PlanOption[]
  myVote: number
  updatedAt: number
}

export interface CommentItem {
  commentId: string
  planId: string
  content: string
  seq: number
  status: number
  author: UserInfo
  createdAt: number
}

// === 写入载荷（对齐 CloudContract 的 PlanWritePayload） ===
export interface PlanWritePayload {
  title: string
  blocks: Block[]
  images: string[]
  deadline: number
  optionsEnabled: boolean
  options: PlanOption[]
}

export interface PlanWriteInput extends PlanWritePayload {
  planId: string
}

// === 集合文档类型（字段命名与技术方案 §5 一致） ===
export interface UserDoc {
  _id?: string
  openId: string
  nickName: string
  avatarUrl: string
  status: number
  stats: UserStats
  createdAt: number
  updatedAt: number
}

/**
 * plans 文档。`vote` 是库内计数冗余字段名（§5.2），出参 DTO 里叫 `votes`，
 * 由 mapper 负责改名，避免前端契约随库字段漂移。
 * `optionCount` 是创建/更新时落库的派生标量（选项数），列表可直接展示而无需数 options 长度；
 * `options` 数组本身也随列表投影返回（#61 逐选项进度条），逐选项票数的权威值在 `optionVotes`。
 */
export interface PlanDoc {
  _id?: string
  openId: string
  title: string
  summary: string
  blocks: Block[]
  images: string[]
  deadline: number
  optionsEnabled: boolean
  options: PlanOption[]
  optionCount: number
  vote: VoteCounts
  /**
   * 选项表决的逐选项支持票数（权威计数，key = optionId，由 vote.submit 用 _.inc 原子自增）。
   * 与 options[] 分开存：编辑计划整组替换 options 时不会抹掉已投的计数。
   * 简单表决模式为空对象；历史文档可能缺省，读取处一律按 {} 兜底。
   */
  optionVotes?: Record<string, number>
  commentCount: number
  status: number
  createdAt: number
  updatedAt: number
}

/** 列表投影出的精简行（不含 blocks / images 全量；options 因 #61 逐选项进度条需要而保留） */
export interface PlanRow {
  _id: string
  openId: string
  title: string
  summary: string
  images: string[]
  deadline: number
  optionsEnabled: boolean
  optionCount: number
  options?: PlanOption[]
  vote: VoteCounts
  optionVotes?: Record<string, number>
  commentCount: number
  status: number
  createdAt: number
}

export interface VoteDoc {
  _id?: string
  planId: string
  openId: string
  /** 1=赞成 2=反对（简单表决）；0=选项表决（此时 optionId 非空，不计入 vote.agree/disagree） */
  type: number
  /** 选项表决所投的选项 id；简单表决缺省。投过即锁定（#60），不存在改票更新 */
  optionId?: string
  createdAt: number
  updatedAt: number
}

export interface CommentDoc {
  _id?: string
  planId: string
  openId: string
  content: string
  seq: number
  status: number
  createdAt: number
}

/**
 * counters 文档复用两类数据：`value` 是评论 seq，`marker` 是 scheduler 的对账游标。
 * 共用一张表而不再新建集合，省一次控制台配置。
 */
export interface CounterDoc {
  _id: string
  value: number
  marker?: string
  updatedAt?: number
}
