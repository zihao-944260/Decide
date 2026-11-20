<script setup lang="ts">
/**
 * ImageUploader —— 计划配图九宫格（T4.8，技术方案 §8.2「最多 3 张」）。
 *
 * 与正文图片块（EditorImageBlock）的分工：这里管 `plans.images`（列表封面 / 详情页配图位），
 * 那里管正文里的一个块。两者各持一台 `useUpload` 实例（§11 点名的受控例外），
 * 都不碰 api/store，也不各自调 wx.cloud / uni.chooseMedia —— 上传只有 useUpload 一个出口。
 *
 * 九宫格用 `view` + flex wrap：Skyline 下 `grid-view` 渲染为 0×0（兼容清单 §2.3），不能用。
 *
 * 提示口径：超出上限 / 格式不符 / 体积超限的 toast 由 useUpload 内部弹（useUpload.ts:112-116、83-87），
 * 组件一律不补第二条，否则一次操作串两条提示。
 */
import { computed, watch } from 'vue'
import BaseImage from '@/components/base/BaseImage/index.vue'
import { Limit } from '@/constants/plan'
import { useUpload, type UploadItem, UPLOAD_HINT } from '@/composables/useUpload'
import type { Emits, Props, UploaderChange } from './types'

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  max: Limit.IMAGE_MAX,
  disabled: false,
  label: '配图'
})
const emit = defineEmits<Emits>()

const {
  files,
  pick,
  retry,
  remove: dropItem,
  addExisting,
  fileIDs,
  uploading,
  done,
  isFull,
  failedIds
} = useUpload({ max: props.max })

/** 一行三格：32% + 2% 间隙 ×3 = 100%，末格不留右距（Skyline 无后代选择器，间距只能算在节点自己身上） */
const COLS = 3
const CELL_WIDTH = '32%'
const CELL_GAP = '2%'

const countText = computed<string>(() => `${files.value.length}/${props.max}`)
const hintText = computed<string>(() =>
  isFull.value ? `最多 ${props.max} 张，点右上角 × 可移除` : UPLOAD_HINT
)

/** 上传中显本地临时路径（T0.7：小程序端只有 tempFilePath，这条路不闪）；完成后换成 fileID */
function srcOf(entry: UploadItem): string {
  if (entry.status === 'done' && entry.fileID) return entry.fileID
  return entry.localPath || entry.fileID
}
function isRunning(entry: UploadItem): boolean {
  return entry.status === 'pending' || entry.status === 'uploading'
}
function progressOf(entry: UploadItem): number {
  const value = entry.progress
  if (!Number.isFinite(value) || value <= 0) return 0
  return value > 100 ? 100 : Math.round(value)
}
function fillStyle(entry: UploadItem): string {
  return `width: ${progressOf(entry)}%;`
}
function cellStyle(index: number): string {
  return `width: ${CELL_WIDTH}; margin-right: ${index % COLS === COLS - 1 ? '0' : CELL_GAP};`
}

async function onAdd(): Promise<void> {
  if (props.disabled) return
  // 满员时也放行到 pick()：由 useUpload 自己弹「最多 N 张」，组件不再判一遍、不再补提示
  await pick()
}

function onRetry(id: string): void {
  if (props.disabled) return
  retry(id)
}

function onRemove(id: string): void {
  if (props.disabled) return
  // 只摘本地条目；云端文件不删（§8.2 第 4 条，v2 由 scheduler 清孤儿文件）
  dropItem(id)
}

function hasFileID(id: string): boolean {
  return files.value.some((entry) => entry.fileID === id)
}

/**
 * v-model → 组件状态。两条动作都只在「编辑态回填 / 外部重置」时发生：
 * 1) 外部清掉的 done 条目跟着摘（发布成功重置、放弃草稿）；在途与失败条目 fileID 为空，不参与，绝不打断上传；
 * 2) 云端已有图用 addExisting() 直接落 done 条目 —— 它不走 pick()，不会重传，也不会弹选图。
 */
function syncFromModel(incomingValue: string[]): void {
  const incoming = incomingValue.filter(Boolean)
  for (const entry of files.value.slice()) {
    if (entry.status === 'done' && entry.fileID && !incoming.includes(entry.fileID))
      dropItem(entry.id)
  }
  for (const id of incoming) {
    if (!hasFileID(id)) addExisting(id)
  }
}

const fileIDKey = computed<string>(() => fileIDs.value.join(','))
const changePayload = computed<UploaderChange>(() => ({
  fileIDs: fileIDs.value.slice(),
  uploading: uploading.value,
  done: done.value,
  count: files.value.length,
  failed: failedIds.value.length,
  max: props.max
}))
const changeKey = computed<string>(() => {
  const payload = changePayload.value
  return `${payload.uploading ? 1 : 0}|${payload.done ? 1 : 0}|${payload.count}|${payload.failed}`
})

/** 外部不管是换数组引用还是原地改，都跟着同步（syncFromModel 幂等，多跑一次没有副作用） */
watch(
  () => props.modelValue,
  (next) => syncFromModel(next ?? []),
  { immediate: true, deep: true }
)

watch(fileIDKey, () => {
  const next = fileIDs.value
  if (next.join(',') === (props.modelValue ?? []).filter(Boolean).join(',')) return
  emit('update:modelValue', next.slice())
})

/** immediate：挂载即报一次，页面不用给 uploading 兜初值 */
watch(changeKey, () => emit('change', changePayload.value), { immediate: true })
</script>

<template>
  <view class="image-uploader">
    <view class="image-uploader__head">
      <text class="image-uploader__title">{{ label }}</text>
      <text class="image-uploader__count">{{ countText }}</text>
    </view>

    <view class="image-uploader__grid">
      <view
        v-for="(entry, index) in files"
        :key="entry.id"
        class="image-uploader__cell"
        :style="cellStyle(index)"
      >
        <view class="image-uploader__frame">
          <BaseImage :src="srcOf(entry)" mode="aspectFill" :ratio="1" :lazy="false" radius="md" />

          <view v-if="isRunning(entry)" class="image-uploader__mask">
            <text class="image-uploader__mask-text">{{ progressOf(entry) }}%</text>
            <view class="image-uploader__track">
              <view class="image-uploader__fill" :style="fillStyle(entry)" />
            </view>
          </view>

          <view
            v-else-if="entry.status === 'error'"
            class="image-uploader__mask"
            @tap="onRetry(entry.id)"
          >
            <text class="image-uploader__mask-title">上传失败</text>
            <text class="image-uploader__mask-text">点击重试</text>
          </view>

          <view class="image-uploader__close" @tap.stop="onRemove(entry.id)">
            <text class="image-uploader__close-text">×</text>
          </view>
        </view>
      </view>

      <!-- 满员即隐藏加号格（用户裁定 #54）：已达上限不再留「添加」入口，免得点了才弹「最多 N 张」 -->
      <view v-if="!isFull" class="image-uploader__cell" :style="cellStyle(files.length)">
        <view class="image-uploader__add" hover-class="image-uploader__add--hover" @tap="onAdd">
          <view class="image-uploader__plus">
            <view class="image-uploader__plus-h" />
            <view class="image-uploader__plus-v" />
          </view>
          <text class="image-uploader__add-text">添加</text>
        </view>
      </view>
    </view>

    <text class="image-uploader__hint">{{ hintText }}</text>
  </view>
</template>

<style lang="scss" scoped>
.image-uploader {
  @include flex-column;
  width: 100%;
}

.image-uploader__head {
  @include section-head;
}

.image-uploader__title {
  @include section-title;
}

.image-uploader__count {
  font-size: $font-sm;
  color: $color-text-3;
}

// 九宫格容器：flex wrap（grid-view 在 Skyline 下 0×0，见兼容清单 §2.3）
.image-uploader__grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  width: 100%;
}

.image-uploader__cell {
  margin-bottom: $space-2;
}

.image-uploader__frame {
  position: relative;
  width: 100%;
  border-radius: $radius-md;
}

.image-uploader__mask {
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

.image-uploader__mask-title {
  font-size: $font-xs;
  color: $color-text-inverse;
}

.image-uploader__mask-text {
  font-size: $font-xs;
  color: $color-text-inverse;
}

.image-uploader__track {
  width: 70%;
  height: $ratio-bar-sm;
  margin-top: $space-1;
  overflow: hidden;
  background-color: $color-fill-deep;
  border-radius: $radius-round;
}

.image-uploader__fill {
  height: 100%;
  background-color: $color-primary;
  border-radius: $radius-round;
  transition: width $duration-base ease-out;
}

// 删除钮压在图上右上角（用户裁定 #54）：top/right 同取 $space-1 让上右边距一致，48rpx 半透明深底白叉
// 在任意配图上都可读；属「图上覆盖图标按钮」，是 §9.1-8 最小可点尺寸的例外（同 OptionEditorCard 删除角标）
.image-uploader__close {
  @include flex-center;
  position: absolute;
  top: $space-1;
  right: $space-1;
  width: $space-5;
  height: $space-5;
  background-color: $color-mask;
  border-radius: $radius-round;
}

.image-uploader__close-text {
  font-size: $font-md;
  line-height: $line-tight;
  color: $color-text-inverse;
}

.image-uploader__add {
  @include flex-column;
  align-items: center;
  justify-content: center;
  width: 100%;
  // 与 32% 格宽等高（正方形占位）：aspect-ratio 由 BaseImage 用过的同一份语义，这里 1/1
  aspect-ratio: 1;
  background-color: $color-fill;
  border-radius: $radius-md;
}

.image-uploader__add--hover {
  background-color: $color-fill-deep;
}

.image-uploader__plus {
  position: relative;
  width: $space-4;
  height: $space-4;
}

// 「+」= 32rpx 盒 + 4rpx 粗的横竖条；居中等价于 (32 - 4) / 2 = 14rpx，用 token 相减写（$space-2 - $border-width-thin）
.image-uploader__plus-h {
  position: absolute;
  top: $space-2 - $border-width-thin;
  left: 0;
  width: $space-4;
  height: $border-width-thick;
  background-color: $color-text-3;
  border-radius: $radius-round;
}

.image-uploader__plus-v {
  position: absolute;
  top: 0;
  left: $space-2 - $border-width-thin;
  width: $border-width-thick;
  height: $space-4;
  background-color: $color-text-3;
  border-radius: $radius-round;
}

.image-uploader__add-text {
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-text-3;
}

.image-uploader__hint {
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-text-3;
}
</style>
