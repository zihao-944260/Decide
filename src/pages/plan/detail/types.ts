import type { VoteTypeValue } from '@/constants/plan'
import type { Block, PlanOption, VoteCounts } from '@/types/models'

/**
 * 详情页（T3.11 / T3.12）的页面私有类型。
 * 只放「这一页」的形状：跨页复用的类型一律走冻结契约 `@/types/models`，不在这里另立一份。
 */

/** 首屏三态（技术方案 §11.2）：骨架 → 内容 → 错误重试 */
export type LoadPhase = 'loading' | 'ready' | 'error'

/**
 * onLoad 的 query 形状。参数名 `planId` 是首页 ↔ 详情页之间的唯一契约
 * （docs/agent-prompts.md §10），改名要两头一起改，不许单边兼容。
 */
export interface DetailQuery {
  planId?: string
}

/**
 * 详情页视图模型：脚本层把 `PlanDetail` + `planStore` + 校准时间收成这一份**非空**对象，
 * 模板只读字段。这样模板里不出现判空、类型断言与可选链 —— uni-app 的模板表达式是
 * 编译产物里最不稳定的部分，少一层表达式就少一处真机差异面。
 * detail 尚未到位（首屏 / 失败）时整体退回 `EMPTY_DETAIL_VIEW`，模板不会碰到 undefined。
 */
export interface DetailView {
  title: string
  authorName: string
  authorAvatar: string
  /** 计划创建时间：CountDown 的起点，传了它剩余占比才是真实值（CountDown/types.ts） */
  createdAt: number
  deadline: number
  /** `deadline > 0` 才画倒计时；0 是脏数据，画出来会立刻显示「已截止」误导用户 */
  hasDeadline: boolean
  /** 原样透传给 ContentRenderer（它内部再 sanitizeBlocks，页面不清洗第二遍，§8.1） */
  blocks: Block[]
  /** 原样透传给 OptionCardList（开关关闭 / 不足 2 个时组件自己不渲染，页面不判空第二层，§8.6） */
  options: PlanOption[]
  /** 计划配图（≤ Limit.IMAGE_MAX）；列表侧只有 cover，多图并排是详情页职责（§8.5 契约缺口那条） */
  images: string[]
  /** 来自 useVote → planStore，不是 detail 快照：投完票比例条要立刻跟着动 */
  votes: VoteCounts
  /** undefined = 未投票（VoteRatioBar 不画「我的选择」标记）。store 的值域里没有 0 */
  myVote?: VoteTypeValue
  /** 选项表决：我投的选项 id（'' = 未投），来自 useVote → planStore，投完立刻高亮（#58/#60） */
  myOption: string
  /** 投过即锁定（简单表决或选项表决皆然）：其余选项置灰、赞同/反对封死（#60） */
  locked: boolean
  commentCount: number
  /** 投票区与评论输入是否置灰（status 非进行中 / 过了校准时间的 deadline / 倒计时归零沿） */
  closed: boolean
  /** 当前用户是否发起人（§8.3 v1 禁止自投；openId 异步晚到时先按游客视角渲染） */
  isAuthor: boolean
}

/** 首屏未就绪时的兜底视图：全部是非空值，组件拿到只是「空渲染」，不会抛错 */
export const EMPTY_DETAIL_VIEW: DetailView = {
  title: '',
  authorName: '',
  authorAvatar: '',
  createdAt: 0,
  deadline: 0,
  hasDeadline: false,
  blocks: [],
  options: [],
  images: [],
  votes: { agree: 0, disagree: 0 },
  myOption: '',
  locked: false,
  commentCount: 0,
  closed: true,
  isAuthor: false,
}

/**
 * 触底锚点节点 id。滚到底只用 `scroll-into-view`：
 * 兼容清单 §2.2 实测 Skyline 下 `scroll-top` 设置后不滚动，而取矩形在
 * `scroll-view type="list"` 里会永久挂起（§2.3）。本页为 WebView 普通 scroll-view
 * （#37 移除 type="list"），scroll-into-view 约定保留，与 Skyline 页同口径。
 */
export const DETAIL_TAIL_ID = 'planDetailTail'

/**
 * 配图缩略格的容器比例（宽/高，与 BaseImage.ratio、utils/blocks.imageBlockRatio 同口径）。
 * 三宫格取方图：详情配图没有稳定尺寸，方格最不容易在 aspectFill 下切掉主体。
 */
export const GALLERY_RATIO = 1
