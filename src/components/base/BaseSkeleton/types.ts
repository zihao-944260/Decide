export type BaseSkeletonType = 'card' | 'list' | 'detail' | 'comment'

export interface Props {
  /** 每组文本行数 */
  rows?: number
  /** 是否显示头像占位（尺寸随 type 变化） */
  avatar?: boolean
  /**
   * 形态：card=带白底圆角的单块；list=多组带分隔线的行；detail=带大标题块的整页骨架。
   * §11.1「骨架屏代替白屏」
   */
  type?: BaseSkeletonType
  /** list 形态的重复组数；card/detail 恒为 1 */
  count?: number
  /** 关闭脉冲动画（低端机或长列表批量渲染时降载） */
  animated?: boolean
}
