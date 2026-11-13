export type BaseImageMode = 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix'
export type BaseImageRadius = 'none' | 'sm' | 'md' | 'lg' | 'round'

export interface Props {
  /** 支持云存储 fileID（cloud://）、https、本地路径，三者都可直接喂给 <image> */
  src?: string
  mode?: BaseImageMode
  /** 宽高比（宽/高），预设容器比例避免加载时列表跳动；0 表示不设置 */
  ratio?: number
  lazy?: boolean
  radius?: BaseImageRadius
  /** 点击时用 uni.previewImage 预览（fileID 需调用方自行换临时 URL） */
  preview?: boolean
}

export type Emits = {
  (e: 'click'): void
  (e: 'load'): void
  (e: 'error'): void
}
