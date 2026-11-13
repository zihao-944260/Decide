import type { BaseImageRadius } from '../../base/BaseImage/types'
import type { Block } from '@/types/models'

/**
 * ContentRenderer 只做一件事：把 `Block[]` 渲染成只读视图（技术方案 §8.1「内容渲染器」/ T3.6）。
 * 没有 emits：块内不可交互（图片预览除外），编辑态由 subpkg-editor 的 Editor* 组件负责。
 */
export interface Props {
  /** 正文块（PlanDetail.blocks）。组件内再过一遍 sanitizeBlocks 兜脏数据，页面可直接喂云端返回值 */
  blocks: Block[]
  /** 图片块圆角，透传 BaseImage.radius；'none' 时由外层容器负责裁剪 */
  radius?: BaseImageRadius
  /** 图片懒加载（详情页在 scroll-view 内，保持 true） */
  lazy?: boolean
  /** 点击图片放大预览（uni.previewImage，即 wx.previewImage） */
  preview?: boolean
  /** blocks 为空数组时的兜底文案 */
  emptyText?: string
}
