<script setup lang="ts">
/**
 * ContentRenderer —— blocks 只读渲染（T3.6，技术方案 §8.1 / §8.6）。
 *
 * 渲染走 mp-html（成熟三方库，2026-11-12 起替代手写渲染器）：
 * 本组件只做三件事 —— sanitizeBlocks 兜脏数据、blocksToHtml 序列化
 * （与编辑器共用 utils/blocks.ts 这一份样式源）、图片预览编排
 * （整组图一次喂 uni.previewImage，可左右滑，失败有 toast）。
 *
 * 平台事实（docs/Skyline兼容清单.md §2.6 + spike 2026-11-12）：
 * - Skyline 行内流断裂对一切走 rich-text 的库都成立（mp-html 叶子节点同样继承），
 *   契约 §8.1 的段落级样式恰好碰不到这条限制；块级标签（p/h/引用/列表/分割线/图）实测全部正常；
 * - mp-html 内部只能用内联样式与 tag-style，SCSS 变量够不着 —— 下方根节点把 tokens
 *   挂成 CSS 变量，tag-style 与内联样式用 var() 消费（穿组件边界已实测），不出现第二套色值。
 */
import { computed } from 'vue'
// 绑定名用 PascalCase：Vue 解析 <mp-html> 时会尝试 capitalize(camelize(tag))，
// check:templates 的对账也只认这三种形式
import MpHtml from 'mp-html/dist/uni-app/components/mp-html/mp-html.vue'
import { showToastMsg } from '@/composables/useToast'
import { blocksToHtml, sanitizeBlocks } from '@/utils/blocks'
import type { ImageBlock } from '@/types/models'
import type { Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  radius: 'md',
  lazy: true,
  preview: true,
  emptyText: '暂无内容'
})

const blocks = computed(() => sanitizeBlocks(props.blocks))
const html = computed(() => blocksToHtml(blocks.value))

/** 预览时把全文图片一次性喂给 previewImage，用户可左右滑动连续看图 */
const imageURLs = computed(() =>
  blocks.value
    .filter((block): block is ImageBlock => block.type === 'image')
    .map((block) => block.fileID)
)

/** radius 档位 → rpx：TS 侧拿不到 SCSS 变量，与 tokens.scss 的 $radius-* 同值（改动需两处同步） */
const RADIUS_CSS: Record<NonNullable<Props['radius']>, string> = {
  none: '0',
  sm: '8rpx',
  md: '16rpx',
  lg: '24rpx',
  round: '999rpx'
}

/** 容器级样式（引用块外框/分割线/图片圆角）；颜色一律 var() 桥接 tokens */
const tagStyle = computed(() => ({
  blockquote:
    'margin:0 0 16rpx;padding:16rpx 24rpx;background-color:var(--cr-fill);' +
    'border-left:4rpx solid var(--cr-primary);border-radius:8rpx;',
  hr: 'width:100%;margin:24rpx 0;border:none;border-top:2rpx solid var(--cr-border);',
  img: `margin:0 0 8rpx;border-radius:${RADIUS_CSS[props.radius] ?? RADIUS_CSS.md};`
}))

function onImageTap(attrs: { src?: string }): void {
  if (!props.preview || !attrs.src) return
  uni.previewImage({
    urls: imageURLs.value,
    current: attrs.src,
    // 云端 fileID 直喂 previewImage 在真机仍可能失败（BaseImage README 同口径），失败要有反馈
    fail: () => showToastMsg('图片预览失败，请稍后重试')
  })
}
</script>

<template>
  <view class="content-renderer">
    <view v-if="blocks.length === 0" class="content-renderer__empty">
      <text class="content-renderer__empty-text">{{ emptyText }}</text>
    </view>
    <mp-html
      v-else
      :content="html"
      :tag-style="tagStyle"
      :lazy-load="lazy"
      :preview-img="false"
      :show-img-menu="false"
      @imgtap="onImageTap"
    />
  </view>
</template>

<style lang="scss" scoped>
.content-renderer {
  // CSS 变量桥：mp-html 内部样式只能经 tag-style/内联样式进入，
  // 这里把用到的 tokens 挂成变量（SCSS 插值仍是编译期、tokens.scss 仍是唯一源）
  --cr-fill: #{$color-fill};
  --cr-primary: #{$color-primary};
  --cr-border: #{$color-border};
  --cr-text-3: #{$color-text-3};

  @include flex-column;
}

.content-renderer__empty {
  @include flex-center;
  min-height: $tap-min-height;
}

.content-renderer__empty-text {
  font-size: $font-sm;
  color: $color-text-3;
}
</style>
