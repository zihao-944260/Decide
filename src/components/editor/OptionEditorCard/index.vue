<script setup lang="ts">
/**
 * OptionEditorCard：一条选项的编辑卡（技术方案 §8.6 编辑态）。视觉与已验收的展示态
 * `business/OptionCard` 对齐（同一套徽标 + 16:9 配图 + 卡片描边），但**不复用它**：
 * 展示态卡片没有输入、没有删除、没有排序，硬要塞进事件反而会把两边都拧弯。
 *
 * 受控边界（agent-prompts §11）：真相只有页面的 `PlanOption` 一份。组件内这台
 * `useUpload({ max: Limit.OPTION_IMAGE_MAX })` 是 §11 点名的唯一例外（上传状态机长在组件里），
 * 除此之外不 import useForm / useEditor / store / api。
 * 「更多」菜单用 `useActionSheet()` —— 它是全局 feedback store 的薄壳，不产生第二份状态，
 * 渲染节点仍由页面里的 `<BaseActionSheet>` 出（接线见 OptionsSection/README.md）。
 *
 * 动作入口只有一条：长按卡片 或 点右侧「⋯」→ ActionSheet（上移/下移/删除）。
 * §8.6 原文就是这么定的，所以卡片里不再另摆一排「上移/下移/删除」按钮做第二套入口。
 */
import BaseImage from '@/components/base/BaseImage/index.vue'
import type { ActionSheetItem } from '@/components/base/BaseActionSheet/types'
import { useActionSheet, useUpload } from '@/composables'
import { Limit, TextInput } from '@/constants/plan'
import { readInputValue } from '@/utils/event'
import { countChars, pad2 } from '@/utils/format'
import { computed, ref, watch } from 'vue'
import type { Emits, Props } from './types'

/** 与展示态 OptionCard 同一个比例（ratio 语义 = 宽/高，见 utils/blocks.ts） */
const IMAGE_RATIO = 16 / 9
const NAME_MAX = Limit.OPTION_NAME_MAX

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
const emit = defineEmits<Emits>()

const { files, pick, retry, remove: dropFile, addExisting } = useUpload({ max: Limit.OPTION_IMAGE_MAX })
const sheet = useActionSheet()

/** 一卡一图，所以第 0 项就是本卡的全部上传状态 */
const item = computed(() => files.value[0])
const isBusy = computed(() => files.value.some((entry) => entry.status !== 'done'))
const isError = computed(() => item.value?.status === 'error')
/** done 才认 fileID：watch 到值变化就一定代表「云端可读」，http://usr 临时路径不会外泄 */
const doneFileID = computed<string>(() => (item.value && item.value.status === 'done' ? item.value.fileID : ''))
/** 在途/失败显本地临时路径（T0.7：小程序端只有 tempFilePath、没有 fileContent），完成后显 fileID */
const previewSrc = computed<string>(() => {
  const entry = item.value
  if (!entry) return ''
  return entry.status === 'done' ? entry.fileID || entry.localPath : entry.localPath
})
const hasImage = computed(() => previewSrc.value !== '')
const progress = computed(() => {
  const value = item.value?.progress ?? 0
  if (!Number.isFinite(value) || value <= 0) return 0
  return value > 100 ? 100 : Math.round(value)
})
const fillStyle = computed(() => `width: ${progress.value}%;`)

// 回填态：编辑态/草稿恢复带来的 fileID 直接落成 done 条目，不重新走选图
if (props.option.image) addExisting(props.option.image)
/** 已经回抛过的值，避免宿主重渲染时重复 emit('image') */
let emittedImage = props.option.image

const name = ref(props.option.name)
watch(
  () => props.option.name,
  (value) => {
    if (value !== name.value) name.value = value
  },
)
/** 码点计数走 utils/format.countChars（与云函数 maxLen 的 Array.from 同口径）；maxlength 已把输入硬闸在 20，这里是给用户的读数 */
const nameLength = computed(() => countChars(name.value))

const badge = computed(() => pad2(props.index + 1))

watch(isBusy, (value) => {
  emit('uploading', value)
})

watch(doneFileID, (value) => {
  if (!value || value === emittedImage) return
  emittedImage = value
  emit('image', value)
})

/**
 * 首末位的上移/下移是「置灰不可点」而不是隐藏（隐藏会让菜单项少一格、位置跳动，
 * 也让用户以为功能缺失）。BaseActionSheet 认 disabled 字段。
 */
const actions = computed<ActionSheetItem[]>(() => [
  { key: 'up', text: '上移', disabled: props.index <= 0 },
  { key: 'down', text: '下移', disabled: props.index >= props.total - 1 },
  { key: 'remove', text: '删除该选项', danger: true },
])

function onInput(event: unknown): void {
  name.value = readInputValue(event)
  emit('rename', name.value)
}

/**
 * 选图 / 换一张。max=1 时 useUpload 会直接拦掉第二次 pick（内部已 toast「最多 1 张」），
 * 所以「换」= 先摘掉本卡条目、再选；选失败（用户取消也算）就把原 fileID 塞回去。
 * 全程不 emit('image')：用户取消时，页面里的值一个字符都没变过。
 */
async function onPick(): Promise<void> {
  if (props.disabled) return
  const entry = item.value
  const keep = entry && entry.status === 'done' ? entry.fileID : ''
  if (entry) dropFile(entry.id)
  const added = await pick()
  if (added.length === 0 && keep) addExisting(keep)
}

function onDeleteImage(): void {
  if (props.disabled) return
  const entry = item.value
  if (entry) dropFile(entry.id)
  emittedImage = ''
  emit('image', '')
}

function onRetry(): void {
  const entry = item.value
  if (entry) retry(entry.id)
}

/** 长按卡片或点「⋯」都走同一入口；菜单状态在 feedback store（组件不持有副本，故不会有两份状态） */
async function openMore(): Promise<void> {
  if (props.disabled) return
  const list = actions.value
  const index = await sheet.open({ title: `选项 ${badge.value}`, actions: list })
  if (index < 0) return
  const picked = list[index]
  if (!picked || picked.disabled) return
  if (picked.key === 'up') emit('move', -1)
  else if (picked.key === 'down') emit('move', 1)
  else emit('remove')
}
</script>

<template>
  <view class="option-editor-card" @longpress="openMore">
    <view class="option-editor-card__head">
      <view class="option-editor-card__badge">
        <text class="option-editor-card__badge-text">{{ badge }}</text>
      </view>
      <textarea
        class="option-editor-card__name"
        :class="{ 'option-editor-card__name--off': disabled }"
        :value="name"
        :placeholder="`选项 ${badge} 的名称`"
        :disabled="disabled"
        :maxlength="NAME_MAX"
        :auto-height="true"
        :adjust-position="true"
        :cursor-spacing="TextInput.CURSOR_SPACING"
        :disable-default-padding="true"
        @input="onInput"
      />
      <view class="option-editor-card__counter">
        <text
          class="option-editor-card__counter-text"
          :class="{ 'option-editor-card__counter-text--full': nameLength >= NAME_MAX }"
        >{{ nameLength }}/{{ NAME_MAX }}</text>
      </view>
      <view class="option-editor-card__more" hover-class="option-editor-card__more--hover" @tap="openMore">
        <text class="option-editor-card__more-icon">⋯</text>
      </view>
    </view>

    <view class="option-editor-card__media" :class="{ 'option-editor-card__media--tight': !hasImage }">
      <view v-if="hasImage" class="option-editor-card__thumb">
        <BaseImage :src="previewSrc" mode="aspectFill" :ratio="IMAGE_RATIO" radius="sm" :preview="false" />
        <view v-if="isBusy" class="option-editor-card__mask">
          <text class="option-editor-card__mask-text">上传中 {{ progress }}%</text>
          <view class="option-editor-card__track">
            <view class="option-editor-card__fill" :style="fillStyle" />
          </view>
        </view>
        <view
          v-else-if="isError"
          class="option-editor-card__mask"
          hover-class="option-editor-card__mask--hover"
          @tap.stop="onRetry"
        >
          <text class="option-editor-card__mask-text option-editor-card__mask-text--error">上传失败</text>
          <text class="option-editor-card__mask-action">点击重试</text>
        </view>
        <view
          v-else
          class="option-editor-card__close"
          hover-class="option-editor-card__close--hover"
          @tap.stop="onDeleteImage"
        >
          <text class="option-editor-card__close-icon">✕</text>
        </view>
      </view>
      <view
        v-else
        class="option-editor-card__pick"
        :class="{ 'option-editor-card__pick--off': disabled }"
        hover-class="option-editor-card__pick--hover"
        @tap="onPick"
      >
        <text class="option-editor-card__pick-text">选择配图</text>
        <text class="option-editor-card__pick-note">最多 1 张 · 换图先删后选</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.option-editor-card {
  @include flex-column;
  padding: $space-3;
  background-color: $color-bg-card;
  border-radius: $radius-lg;
  border: $border-width-thin solid $color-border;
}

// 顶对齐：textarea 文字本就顶对齐，序号/计数/更多都按「首行行高」居中才能与标题首行齐平
.option-editor-card__head {
  @include flex-center;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: $tap-min-height;
}

.option-editor-card__badge {
  @include flex-center;
  flex-shrink: 0;
  min-width: $space-5;
  height: $font-md * $line-normal;
  margin-right: $space-2;
  padding: 0 $space-1;
  background-color: $color-fill;
  border-radius: $radius-sm;
}

.option-editor-card__badge-text {
  font-size: $font-xs;
  color: $color-text-3;
}

.option-editor-card__name {
  flex: 1;
  min-height: $tap-min-height;
  font-size: $font-md;
  line-height: $line-normal;
  color: $color-text-1;
}

.option-editor-card__name--off {
  color: $color-text-3;
}

.option-editor-card__counter {
  @include flex-center;
  flex-shrink: 0;
  min-width: $space-5;
  height: $font-md * $line-normal;
}

.option-editor-card__counter-text {
  font-size: $font-xs;
  color: $color-text-3;
}

// 满字提示不用后代选择器（规范按「Skyline 不支持」执行，兼容清单 §1.5），子节点自己挂修饰类
.option-editor-card__counter-text--full {
  color: $color-danger;
}

.option-editor-card__more {
  @include flex-center;
  align-items: flex-start;
  flex-shrink: 0;
  width: $tap-min-height;
  height: $tap-min-height;
  transition: opacity $duration-fast;
}

.option-editor-card__more--hover {
  opacity: 0.6;
}

.option-editor-card__more-icon {
  font-size: $font-lg;
  line-height: $font-md * $line-normal;
  color: $color-text-3;
}

.option-editor-card__media {
  @include flex-column;
  margin-top: $space-2;
}

.option-editor-card__media--tight {
  margin-top: $space-1;
}

// 缩略图给确定宽度（6 × $space-5 = 288rpx）+ 16:9 的 aspect-ratio 占位：
// 加载前后不顶动列表（§11.1），也不用百分比宽度（清单无条目）
.option-editor-card__thumb {
  position: relative;
  width: $space-5 * 6;
}

.option-editor-card__mask {
  @include flex-column;
  align-items: flex-start;
  justify-content: center;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 $space-1;
  background-color: $color-mask;
  border-radius: $radius-sm;
}

.option-editor-card__mask--hover {
  opacity: 0.85;
}

.option-editor-card__mask-text {
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-inverse;
}

.option-editor-card__mask-text--error {
  color: $color-danger-light;
}

.option-editor-card__mask-action {
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-inverse;
}

.option-editor-card__track {
  width: 100%;
  height: $space-1;
  margin-top: $space-1;
  overflow: hidden;
  background-color: $color-fill-deep;
  border-radius: $radius-round;
}

.option-editor-card__fill {
  height: 100%;
  background-color: $color-primary;
  border-radius: $radius-round;
}

// 删除角标只有 48rpx，比 §9.1-8 的 88rpx 小 —— 与展示态同用的 BaseImage 遮罩同级，
// 属「图上覆盖的图标按钮」例外；卡片本身仍可长按出菜单做同一件事，不是唯一入口。
.option-editor-card__close {
  @include flex-center;
  position: absolute;
  top: 0;
  right: 0;
  width: $space-5;
  height: $space-5;
  background-color: $color-mask;
  border-radius: $radius-sm;
  transition: opacity $duration-fast;
}

.option-editor-card__close--hover {
  opacity: 0.7;
}

.option-editor-card__close-icon {
  font-size: $font-sm;
  color: $color-text-inverse;
}

.option-editor-card__pick {
  @include flex-column;
  align-items: flex-start;
  justify-content: center;
  width: $space-5 * 6;
  min-height: $tap-min-height;
  padding: $space-2;
  background-color: $color-fill;
  border-radius: $radius-md;
  transition: opacity $duration-fast;
}

.option-editor-card__pick--hover {
  opacity: 0.7;
}

.option-editor-card__pick--off {
  opacity: 0.5;
}

.option-editor-card__pick-text {
  font-size: $font-sm;
  line-height: $line-tight;
  color: $color-text-2;
}

.option-editor-card__pick-note {
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}
</style>
