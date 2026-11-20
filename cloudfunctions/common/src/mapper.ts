/**
 * 文档 → DTO 映射（技术方案 §5 的库字段与 src/types/models.ts 的出参在这里对齐）。
 *
 * 集中放在 common 的原因：列表 / 详情 / 评论三个域都要拼 author，
 * 字段改名（如库内 `vote` → 出参 `votes`）只能有一个出口，否则三个函数各写一份必然漂移。
 */
import { Limit, PlanStatus } from './constants'
import type {
  Block,
  CommentDoc,
  CommentItem,
  PlanDetail,
  PlanDoc,
  PlanOption,
  PlanRow,
  PlanSummary,
  UserDoc,
  UserInfo,
  UserStats,
  VoteCounts
} from './types'

const EMPTY_STATS: UserStats = { created: 0, joined: 0, ongoing: 0 }

/** 查不到作者（历史脏数据 / 未登录过的老作者）时的兜底展示，不能让整页列表 500 */
export function fallbackAuthor(openId: string): UserInfo {
  return {
    openId,
    nickName: '点子商量局用户',
    avatarUrl: '',
    status: 0,
    stats: { ...EMPTY_STATS },
    createdAt: 0,
    updatedAt: 0
  }
}

export function toUserInfo(doc: UserDoc): UserInfo {
  return {
    openId: doc.openId,
    nickName: doc.nickName ?? '',
    avatarUrl: doc.avatarUrl ?? '',
    status: doc.status ?? 0,
    stats: {
      created: doc.stats?.created ?? 0,
      joined: doc.stats?.joined ?? 0,
      ongoing: doc.stats?.ongoing ?? 0
    },
    createdAt: doc.createdAt ?? 0,
    updatedAt: doc.updatedAt ?? 0
  }
}

/**
 * 选项 DTO 装配（#61）：把库内 options[] 与权威计数 optionVotes 合并成带 count 的出参。
 * 简单表决模式（enabled=false）恒返回 []，与契约「options 在简单模式为 []」一致；
 * 计数只认 optionVotes（options[] 里的 count 是占位），缺失的 key 按 0 兜底。
 * 列表 / 详情 / vote.submit 三处共用这一份，避免逐选项票数口径漂移。
 */
export function toPlanOptions(
  enabled: boolean,
  options: readonly PlanOption[] | undefined,
  optionVotes: Record<string, number> | undefined
): PlanOption[] {
  if (!enabled) return []
  const counts = optionVotes ?? {}
  return (options ?? []).map((option) => ({ ...option, count: counts[option.id] ?? 0 }))
}

/** 列表投影不含 blocks 全量；options 因 #61 逐选项进度条需要而带上（单条 payload 略增，契约要求） */
export function toPlanSummary(
  row: PlanRow,
  author: UserInfo,
  now: number,
  myOption: string
): PlanSummary {
  return {
    planId: row._id,
    title: row.title ?? '',
    summary: row.summary ?? '',
    cover: row.images?.[0] ?? '',
    deadline: row.deadline ?? 0,
    optionsEnabled: row.optionsEnabled === true,
    optionCount: row.optionCount ?? 0,
    options: toPlanOptions(row.optionsEnabled === true, row.options, row.optionVotes),
    votes: { agree: row.vote?.agree ?? 0, disagree: row.vote?.disagree ?? 0 },
    myOption,
    commentCount: row.commentCount ?? 0,
    status: effectiveStatus(row.status, row.deadline, now),
    author,
    createdAt: row.createdAt ?? 0
  }
}

export function toPlanDetail(
  doc: PlanDoc,
  author: UserInfo,
  myVote: number,
  now: number,
  myOption: string
): PlanDetail {
  return {
    planId: doc._id ?? '',
    title: doc.title ?? '',
    summary: doc.summary ?? '',
    cover: doc.images?.[0] ?? '',
    deadline: doc.deadline ?? 0,
    optionsEnabled: doc.optionsEnabled === true,
    optionCount: doc.optionCount ?? doc.options?.length ?? 0,
    options: toPlanOptions(doc.optionsEnabled === true, doc.options, doc.optionVotes),
    votes: { agree: doc.vote?.agree ?? 0, disagree: doc.vote?.disagree ?? 0 },
    myOption,
    commentCount: doc.commentCount ?? 0,
    status: effectiveStatus(doc.status, doc.deadline, now),
    author,
    createdAt: doc.createdAt ?? 0,
    blocks: doc.blocks ?? [],
    images: doc.images ?? [],
    myVote,
    updatedAt: doc.updatedAt ?? 0
  }
}

export function toCommentItem(doc: CommentDoc, author: UserInfo): CommentItem {
  return {
    commentId: doc._id ?? '',
    planId: doc.planId,
    content: doc.status === 0 ? doc.content : '',
    seq: doc.seq ?? 0,
    status: doc.status ?? 0,
    author,
    createdAt: doc.createdAt ?? 0
  }
}

/**
 * 惰性截止态：scheduler 每 1 分钟才翻转 status，中间窗口里读到的仍是 status=1 的过期计划。
 * 出参按 deadline 现场折算成「已截止」，前端倒计时归零与按钮置灰才对得上；
 * 写库仍然只交给 scheduler，避免读路径产生写放大。
 */
export function effectiveStatus(status: number, deadline: number, now: number): number {
  if (status === PlanStatus.Ongoing && deadline > 0 && deadline <= now) return PlanStatus.Ended
  return status
}

/** 计划是否还能投票 / 评论：软删与已截止都要挡（§8.3 第 1 步） */
export function isOpenForAction(status: number, deadline: number, now: number): boolean {
  const effective = effectiveStatus(status, deadline, now)
  return effective === PlanStatus.Ongoing
}

/**
 * 由 blocks 生成列表摘要：拼接 text / quote 的纯文本，截前 60 字。
 * §11.1 实测 Skyline 下 line-clamp 不生效，摘要必须由云端按字数截断，前端只做单行 ellipsis。
 */
export function buildSummary(blocks: readonly Block[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'quote') {
      const text = block.text.trim().replace(/\s+/g, ' ')
      if (text) parts.push(text)
    } else if (block.type === 'image' && block.caption) {
      const caption = block.caption.trim()
      if (caption) parts.push(caption)
    }
    if (parts.join(' ').length >= Limit.SUMMARY_MAX) break
  }
  const joined = parts.join(' ')
  const chars = Array.from(joined)
  if (chars.length <= Limit.SUMMARY_MAX) return joined
  return `${chars.slice(0, Limit.SUMMARY_MAX - 1).join('')}…`
}

export function emptyVotes(): VoteCounts {
  return { agree: 0, disagree: 0 }
}
