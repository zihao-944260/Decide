/**
 * plan.create / plan.update 共用的写路径（技术方案 §11.3 / §6.4）。
 *
 * 为什么单独一份文件：这两个接口必须用**同一套**上限判定和同一套审核时序，
 * 各写一遍就会出现「从 update 绕过 create 的限制」或「改一次文案把违规图片洗白」。
 * 长度/数量/fileID/deadline 的权威判定在 `common/planPayload`，这里只补三件事：
 * 1. common 没覆盖的 plan 域规则（开启选项后至少 2 个，§8.6 的提交校验；图片必须属本环境云存储）；
 * 2. 送审范围（标题 + 正文 + 图注 + 选项名 合并成一次 msgSecCheck，图片去重后送审）；
 * 3. 写库之后是否还值得送审图片（3s 超时的自我预算）。
 */
import * as cloud from 'wx-server-sdk'
import {
  BizError,
  ErrorCode,
  PlanStatus,
  SecScene,
  ServerLimit,
  assertPlanEditable,
  assertWritable,
  asString,
  buildSummary,
  checkText,
  emptyVotes,
  log,
  normalizePlanWrite,
  planDao,
  submitImagesForReview,
  userDao,
  type ActionContext,
  type NormalizedPlanWrite,
  type PlanDoc,
  type PlanWritePayload,
  type UpdatePayload,
} from 'common'

/**
 * 选项最少 2 个：§8.6 的提交校验。
 * `src/constants/plan.ts` 的 `Limit` 只有 OPTION_MAX，没有 OPTION_MIN 可镜像，
 * 所以这条规则暂留 plan 域内（若 vote/comment 也要用，应上提到 common 的 planPayload）。
 */
const OPTION_MIN = 2

/** 计划标识长度上限：云数据库 _id 是 32 位十六进制串，64 已足够宽，再长就是构造请求 */
const PLAN_ID_MAX = 64

/**
 * 写库之后留给「图片送审」的最小时间余量（ms）。
 * 为什么要这个门槛：图片是**先发后审**，送审本身要一次 getTempFileURL + N 次 mediaCheckAsync，
 * 一旦把总耗时顶过 3s，callFunction 在客户端就是超时失败 —— 用户以为没发出去、再发一次，
 * 于是多出一条重复计划。宁可这一版图片没送审（记 warn 留痕），也不能让写成功的请求翻车。
 */
const REVIEW_MIN_LEFT_MS = 600

export interface PlanContentFields extends PlanWritePayload {
  summary: string
  optionCount: number
}

export function readPlanId(payload: Record<string, unknown>): string {
  return asString(payload.planId, '计划标识', PLAN_ID_MAX)
}

/**
 * 服务端权威校验（§11.3）。
 * `keepDeadline` 只在编辑时传：允许原样保留旧截止时间，改个错别字不该被迫重新选日期。
 */
export function validatePlanWrite(payload: unknown, now: number, keepDeadline?: number): NormalizedPlanWrite {
  const normalized = normalizePlanWrite(payload, now, keepDeadline)
  assertOptionQuota(normalized.payload)
  assertImagesInThisEnv(normalized.payload)
  return normalized
}

function assertOptionQuota(payload: PlanWritePayload): void {
  if (!payload.optionsEnabled) return
  if (payload.options.length < OPTION_MIN) {
    throw new BizError(ErrorCode.INVALID_PARAM, `开启选项后至少需要 ${OPTION_MIN} 个选项`)
  }
  // 「每个选项最多 1 张配图」由 PlanOption.image 的字段形状（单串，common 已校验 fileID）天然保证，
  // 数量上限 ≤10 与名称 ≤20 字、名称非空都在 normalizePlanWrite 里判过。
}

/**
 * 图片必须来自**本环境云存储**：`cloud://<envId>.<bucketHash>/path`。
 * 为什么在 plan 域补这一层（common 只校验 `cloud://` 前缀 + 长度）：
 * 1. 外链 / 跨环境 fileID 拿不到临时 URL，`mediaCheckAsync` 就永远不会审到它 —— 等于留了个审核绕过口；
 * 2. 跨环境 fileID 在详情页只会渲染成坏图。
 * 正文块图同样要收：`common/planPayload` 的 validateBlock 目前允许 `https://`，
 * 而编辑器（useUpload）产出的 fileID 一定是本环境 cloud://，收紧不会误伤真实路径。
 * 拿不到环境 ID 时（本地 cli 直调）只跳过同环境判定，前缀判定照常。
 */
function assertImagesInThisEnv(payload: PlanWritePayload): void {
  const env = currentEnv()
  payload.images.forEach((fileID, index) => assertOwnFileID(fileID, env, `第 ${index + 1} 张计划配图`))
  payload.blocks.forEach((block, index) => {
    if (block.type === 'image') assertOwnFileID(block.fileID, env, `第 ${index + 1} 个内容块图片`)
  })
  payload.options.forEach((option, index) => {
    if (option.image) assertOwnFileID(option.image, env, `第 ${index + 1} 个选项配图`)
  })
}

function assertOwnFileID(fileID: string, env: string, field: string): void {
  if (!fileID.startsWith('cloud://')) throw new BizError(ErrorCode.INVALID_PARAM, `${field}请使用本小程序上传的图片`)
  if (env && !fileID.startsWith(`cloud://${env}.`)) {
    throw new BizError(ErrorCode.INVALID_PARAM, `${field}不属于当前云环境`)
  }
}

/** 环境 ID 优先取本次调用上下文，退到运行环境变量；两者都空则不做同环境判定 */
function currentEnv(): string {
  const context = cloud.getWXContext() as unknown as { ENV?: string }
  if (typeof context.ENV === 'string' && context.ENV) return context.ENV
  return typeof process.env.TCB_ENV === 'string' ? process.env.TCB_ENV : ''
}

/** summary 只有这一个生成点：列表页展示用，纯文本前 60 字（§5.2 / §11.1） */
export function planContentFields(normalized: NormalizedPlanWrite): PlanContentFields {
  return { ...normalized.payload, summary: buildSummary(normalized.payload.blocks), optionCount: normalized.optionCount }
}

export function buildPlanDoc(openId: string, now: number, fields: PlanContentFields): PlanDoc {
  // 契约里没有草稿发布动作，create 即公开（status=1）；计数冗余从 0 起步，后续由 vote/comment 原子自增。
  // optionVotes 是选项表决的逐选项权威计数（#61），与 options[] 分开存，编辑整组替换 options 时不会被抹掉。
  return {
    ...fields,
    openId,
    vote: emptyVotes(),
    optionVotes: {},
    commentCount: 0,
    status: PlanStatus.Ongoing,
    createdAt: now,
    updatedAt: now,
  }
}

/** 编辑载荷：content 字段整组替换，status / 计数冗余 / openId / createdAt 一律不碰 */
export function buildPlanPatch(fields: PlanContentFields, now: number): UpdatePayload {
  return { ...fields, updatedAt: now }
}

/** 读作者档案并判定可写；禁言拦发布（mutedIsEnough=true），封禁由 assertWritable 内部拦 */
export async function requireWritableUser(openId: string): Promise<void> {
  const user = await userDao.getByOpenId(openId)
  if (!user) throw new BizError(ErrorCode.UNAUTHORIZED, '登录状态已失效，请重新进入小程序')
  assertWritable(user.status, true)
}

/**
 * 编辑准入：在 common 的 assertPlanEditable 之上补「惰性截止」窗口。
 * scheduler 每 1 分钟才把过期计划翻成 status=2，出参早已按 deadline 折算成「已截止」
 * （mapper.effectiveStatus），写路径必须同一口径，否则用户会看到「已截止」却还能提交编辑。
 */
export function assertPlanUpdatable(doc: PlanDoc, now: number): void {
  assertPlanEditable(doc.status)
  if (doc.status === PlanStatus.Ongoing && doc.deadline > 0 && doc.deadline <= now) {
    throw new BizError(ErrorCode.PLAN_CLOSED, '计划已截止，不能再编辑')
  }
}

/**
 * 文本送审（先审后发）：整篇合并成一次 checkText，而不是逐块调用。
 * 为什么合并：3s 里每次 msgSecCheck 都是一个外网往返，100 个块就是 100 次往返；
 * checkText 内部已按 2000 字分片、最多 4 片，合并后既省往返又仍在预算内。
 * scene 取 3（论坛）：计划正文对外可见，和配图送审用的是同一个场景值。
 */
export async function reviewText(openId: string, payload: PlanWritePayload, startedAt: number): Promise<void> {
  await checkText(openId, textForReview(payload), SecScene.Forum, startedAt)
}

function textForReview(payload: PlanWritePayload): string {
  const parts: string[] = [payload.title]
  for (const block of payload.blocks) {
    if (block.type === 'text' || block.type === 'quote') parts.push(block.text)
    else if (block.type === 'image' && block.caption) parts.push(block.caption)
  }
  for (const option of payload.options) parts.push(option.name)
  return parts.filter((item) => item.trim() !== '').join('\n')
}

/**
 * 图片送审（先发后审）：必须在写库之后调用，且只花时间预算够时才调。
 * 送审范围是「本篇出现过的全部图片」= 配图 + 正文块图 + 选项图；
 * 去重是因为同一 fileID 可能同时出现在配图与正文块里，重复提交只会白烧配额。
 */
export async function reviewImages(openId: string, payload: PlanWritePayload, ctx: ActionContext): Promise<void> {
  const fileIDs = collectImages(payload)
  if (fileIDs.length === 0) return
  if (ServerLimit.TIME_BUDGET_MS - (Date.now() - ctx.startedAt) < REVIEW_MIN_LEFT_MS) {
    log.warn('计划图片未送审（超出时间预算）', { fn: ctx.fn, action: ctx.action, openId, count: fileIDs.length })
    return
  }
  await submitImagesForReview(openId, fileIDs, ctx.startedAt)
}

function collectImages(payload: PlanWritePayload): string[] {
  const ids: string[] = []
  const push = (fileID: string): void => {
    if (fileID && !ids.includes(fileID)) ids.push(fileID)
  }
  for (const fileID of payload.images) push(fileID)
  for (const block of payload.blocks) {
    if (block.type === 'image') push(block.fileID)
  }
  for (const option of payload.options) push(option.image)
  return ids
}

/** dao 拿不到 _id 说明 add 就没成功，不能把空 planId 当成功返回给前端 */
export function assertPlanCreated(planId: string): string {
  if (!planId) throw new BizError(ErrorCode.SERVER_ERROR, '保存失败，请稍后重试')
  return planId
}

/** 详情/编辑/删除共用的「取活着的计划」 */
export async function getLivePlan(planId: string): Promise<PlanDoc> {
  const doc = await planDao.getById(planId)
  if (!doc || doc.status === PlanStatus.Removed) {
    throw new BizError(ErrorCode.NOT_FOUND, '该计划不存在或已被删除')
  }
  return doc
}
