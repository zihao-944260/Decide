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
}

export interface PlanSummary {
  planId: string
  title: string
  summary: string
  cover: string
  deadline: number
  optionsEnabled: boolean
  optionCount: number
  votes: VoteCounts
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
