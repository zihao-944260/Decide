export type BaseAvatarSize = 'sm' | 'md' | 'lg'
export type BaseAvatarShape = 'circle' | 'square'

export interface Props {
  /** 为空或加载失败时显示缺省头像（默认插槽可覆盖） */
  src?: string
  size?: BaseAvatarSize
  shape?: BaseAvatarShape
}
