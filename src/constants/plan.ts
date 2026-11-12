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

export const UserStatus = {
  Normal: 0,
  Muted: 1,
  Banned: 2,
} as const

export type MyFilter = 'created' | 'joined' | 'ongoing' | 'ended'
export const MY_FILTERS: MyFilter[] = ['created', 'joined', 'ongoing', 'ended']

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

export const DeadlinePreset = [
  { label: '1 天', days: 1 },
  { label: '3 天', days: 3 },
  { label: '7 天', days: 7 },
] as const
