export type TextBlock = {
  id: string
  type: 'text'
  text: string
  level: 1 | 2 | 3
  align: 'left' | 'center'
  bold?: boolean
  color?: string
}

export type ImageBlock = {
  id: string
  type: 'image'
  fileID: string
  w: number
  h: number
  caption?: string
}

export type QuoteBlock = {
  id: string
  type: 'quote'
  text: string
}

export type DividerBlock = {
  id: string
  type: 'divider'
}

export type Block = TextBlock | ImageBlock | QuoteBlock | DividerBlock

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

export interface VoteCounts {
  agree: number
  disagree: number
}

export interface PlanOption {
  id: string
  name: string
  image: string
  order: number
  /** 该选项的支持票数（选项表决模式的比例条来源；简单表决模式恒 0） */
  count: number
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
