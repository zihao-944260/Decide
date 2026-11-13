<script setup lang="ts">
/**
 * EditorImageBlock —— 正文图片块（T4.4，技术方案 §8.1「图片块」/ §8.2）。
 *
 * 受控边界（§11）：块的真相只有 `props.block` 一份。组件内那台 `useUpload({ max: 1 })` 是
 * §11 点名的**唯一例外**（上传状态机就长在组件里，宿主不知道也不需要知道上传的存在）；
 * 上传成功后把 `{fileID,w,h}` 通过 `emit('update')` 交回宿主，由页面调
 * `editor.updateImage(block.id, $event)` 落定（见 useEditor.ts:196 的注释）。
 * 本文件不 import useEditor / useForm / store / api。
 *
 * 四态：
 * - `empty`：`block.fileID === ''` 且无本地条目 → 「点击选择图片」卡片，**点它才 pick()**。
 *   绝不在 onMounted 自动弹选图：那会被编辑态回填与草稿恢复误触发，而空 fileID 的块本来也
 *   过不了 `sanitizeBlocks`（utils/blocks.ts:200-202 直接 continue），选图必须由用户发起。
 * - `uploading`：本地临时路径先渲染占位 + 进度条（§8.2 第 2 步，T0.7 实测小程序端只有
 *   tempFilePath、没有 fileContent，「本地路径 → fileID」是唯一不闪的路线）。
 * - `error`：失败遮罩 = 重试入口（整块可点，满足 §9.1-8 的 88rpx 最小可点尺寸）。
 * - `ready`：出 `block.fileID`，与详情页 ContentRenderer 走同一个 BaseImage + imageBlockRatio。
 */
import { computed, ref, watch } from 'vue'
import BaseImage from '@/components/base/BaseImage/index.vue'
import type { BaseImageMode } from '@/components/base/BaseImage/types'
import { useUpload, type UploadItem, UPLOAD_HINT } from '@/composables/useUpload'
import { imageBlockRatio } from '@/utils/blocks'
import type { Emits, Props } from './types'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 一块一图：max=1 让「上限/格式/体积」的提示口径与块语义完全一致（提示由 useUpload 内部弹） */
const { files, pick, retry, clear } = useUpload({ max: 1 })

type ImageState = 'empty' | 'uploading' | 'error' | 'ready'

/** 本块拥有的上传条目 id（pick() 成功后写入；一个组件实例只服务一个块） */
const itemId = ref('')
/** 已回抛过 update 的条目 id：宿主重渲染 / 条目对象换新时不重复 emit */
let emittedFor = ''

const item = computed<UploadItem | undefined>(() => {
  if (!itemId.value) return undefined
  return files.value.find((entry) => entry.id === itemId.value)
})

const isRunning = computed<boolean>(() => {
  const status = item.value?.status
  return status === 'pending' || status === 'uploading'
})
const isError = computed<boolean>(() => item.value?.status === 'error')

/** 在途/失败显本地临时路径；完成后优先用宿主写回的 fileID，宿主没写回（漏接事件）时兜本地 fileID，图不会消失 */
const src = computed<string>(() => {
  const entry = item.value
  if (entry && entry.status !== 'done') return entry.localPath
  return props.block.fileID || (entry ? entry.fileID : '')
})

const state = computed<ImageState>(() => {
  if (isError.value) return 'error'
  if (isRunning.value) return 'uploading'
  return src.value ? 'ready' : 'empty'
})

/** 上传中不显示删除（点了会把在途任务对应的块摘掉，容易误操作） */
const showClose = computed<boolean>(() => state.value === 'ready' || state.value === 'error')

const progress = computed<number>(() => {
  const value = item.value?.progress ?? 0
  if (!Number.isFinite(value) || value <= 0) return 0
  return value > 100 ? 100 : Math.round(value)
})
const fillStyle = computed<string>(() => `width: ${progress.value}%;`)

/**
 * 比例只从 `imageBlockRatio()` 出来（与 ContentRenderer / BaseImage 同单位：**宽/高**）。
 * 上传中 w/h 还留在本地条目里（宿主尚未写回），这里按同一个函数算，绝不另写一份倒数公式。
 */
const ratio = computed<number>(() => {
  const entry = item.value
  if (!entry) return imageBlockRatio(props.block)
  return imageBlockRatio({ ...props.block, w: entry.width || props.block.w, h: entry.height || props.block.h })
})
/** 有 w/h 先按比例占位（§11.1 防加载顶跳），没有则让图片自撑 —— 与 ContentRenderer 一致 */
const mode = computed<BaseImageMode>(() => (ratio.value > 0 ? 'aspectFill' : 'widthFix'))

const rootClass = computed<string>(() =>
  props.focused ? 'editor-image-block editor-image-block--focused' : 'editor-image-block',
)

/**
 * 上传完成 → 回抛宿主。
 * 监听的是 **fileID 这个原始值**而不是条目对象：`useUpload.patch()` 用 Object.assign 原地改条目，
 * 对象引用不变，`watch(item)` 的 hasChanged 判等会直接吞掉回调（useUpload.ts:73-77 的注释就是这件事的另一面）。
 */
const doneFileID = computed<string>(() =>
  item.value && item.value.status === 'done' ? item.value.fileID : '',
)

watch(doneFileID, (fileID) => {
  const entry = item.value
  if (!fileID || !entry || emittedFor === entry.id) return
  emittedFor = entry.id
  emit('update', { fileID, w: entry.width, h: entry.height })
})

function onFocus(): void {
  emit('focus', props.block.id)
}

function onLongPress(): void {
  emit('long-press', props.block.id)
}

/** 空卡点它才选图。取消选图 / 超限 / 格式体积不符 → pick() 返回空数组，提示由 useUpload 弹，这里不补第二条 */
async function onPick(): Promise<void> {
  if (props.block.fileID || isRunning.value) return
  const added = await pick()
  const first = added[0]
  if (!first) return
  itemId.value = first.id
  emittedFor = ''
}

function onRetry(): void {
  const entry = item.value
  if (entry) retry(entry.id)
}

/** 摘掉块：本地图 + 状态一起清空；云端文件不删（§8.2 第 4 条，v2 由 scheduler 清孤儿） */
function onRemove(): void {
  clear()
  itemId.value = ''
  emittedFor = ''
  emit('remove', props.block.id)
}
</script>

<template>
  <view :class="rootClass" @tap="onFocus" @longpress="onLongPress">
    <!-- 空态：点击选择图片 -->
    <view
      v-if="state === 'empty'"
      class="editor-image-block__picker"
      hover-class="editor-image-block__picker--hover"
      @tap="onPick"
    >
      <view class="editor-image-block__plus">
        <view class="editor-image-block__plus-h" />
        <view class="editor-image-block__plus-v" />
      </view>
      <text class="editor-image-block__picker-text">点击选择图片</text>
      <text class="editor-image-block__picker-hint">{{ UPLOAD_HINT }}</text>
    </view>

    <view v-else class="editor-image-block__frame">
      <BaseImage :src="src" :mode="mode" :ratio="ratio" :lazy="false" radius="md" />

      <!-- 上传中：遮罩 + 自绘进度条（Skyline 未实测原生 progress，用 width: % 的真实节点，同 VoteRatioBar 口径） -->
      <view v-if="state === 'uploading'" class="editor-image-block__mask">
        <text class="editor-image-block__mask-text">上传中 {{ progress }}%</text>
        <view class="editor-image-block__track">
          <view class="editor-image-block__fill" :style="fillStyle" />
        </view>
      </view>

      <!-- 失败：整块可点重试（点面积 = 图块本身，天然满足 88rpx 最小可点尺寸） -->
      <view v-else-if="state === 'error'" class="editor-image-block__mask" @tap="onRetry">
        <text class="editor-image-block__mask-title">上传失败</text>
        <text class="editor-image-block__mask-text">点击重试</text>
      </view>

      <view v-if="showClose" class="editor-image-block__close" @tap.stop="onRemove">
        <text class="editor-image-block__close-text">×</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.editor-image-block {
  @include flex-column;
  width: 100%;
  // 常驻 2rpx 透明描边：聚焦只换颜色，加边框不会把块顶宽（Skyline 无 outline/box-shadow spread 实测）
  border: $border-width-thin solid transparent;
  border-radius: $radius-md;
}

.editor-image-block--focused {
  border-color: $color-primary;
}

.editor-image-block__picker {
  @include flex-column;
  align-items: center;
  justify-content: center;
  min-height: $tap-min-height * 2;
  padding: $space-3;
  background-color: $color-fill;
  border-radius: $radius-md;
}

// 「+」用两个真实节点拼（Skyline 无伪元素）
.editor-image-block__picker--hover {
  background-color: $color-fill-deep;
}

.editor-image-block__plus {
  position: relative;
  width: $space-5;
  height: $space-5;
}

// 「+」用两个真实节点拼（Skyline 无伪元素）：48rpx 盒 + 4rpx 粗的横竖条，
// 居中等价于 (48 - 4) / 2 = 22rpx，用 token 相减写出来（$space-3 - $border-width-thin），避免除法/calc。
.editor-image-block__plus-h {
  position: absolute;
  top: $space-3 - $border-width-thin;
  left: 0;
  width: $space-5;
  height: $border-width-thick;
  background-color: $color-text-3;
  border-radius: $radius-round;
}

.editor-image-block__plus-v {
  position: absolute;
  top: 0;
  left: $space-3 - $border-width-thin;
  width: $border-width-thick;
  height: $space-5;
  background-color: $color-text-3;
  border-radius: $radius-round;
}

.editor-image-block__picker-text {
  margin-top: $space-2;
  font-size: $font-md;
  color: $color-text-2;
}

.editor-image-block__picker-hint {
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-text-3;
}

.editor-image-block__frame {
  position: relative;
  width: 100%;
  border-radius: $radius-md;
}

.editor-image-block__mask {
  @include flex-column;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: $color-mask;
  border-radius: $radius-md;
}

.editor-image-block__mask-title {
  font-size: $font-sm;
  color: $color-text-inverse;
}

.editor-image-block__mask-text {
  font-size: $font-xs;
  color: $color-text-inverse;
}

.editor-image-block__track {
  width: 60%;
  height: $ratio-bar-sm;
  margin-top: $space-1;
  overflow: hidden;
  background-color: $color-fill-deep;
  border-radius: $radius-round;
}

.editor-image-block__fill {
  height: 100%;
  background-color: $color-primary;
  border-radius: $radius-round;
  transition: width $duration-base ease-out;
}

// 删除钮压在图上右上角（用户裁定 #54）：top/right 同取 $space-1 让上右边距一致，48rpx 半透明深底白叉
// 在任意正文插图上都可读；属「图上覆盖图标按钮」，是 §9.1-8 最小可点尺寸的例外（同 OptionEditorCard 删除角标）
.editor-image-block__close {
  @include flex-center;
  position: absolute;
  top: $space-1;
  right: $space-1;
  width: $space-5;
  height: $space-5;
  background-color: $color-mask;
  border-radius: $radius-round;
}

.editor-image-block__close-text {
  font-size: $font-md;
  line-height: $line-tight;
  color: $color-text-inverse;
}
</style>
