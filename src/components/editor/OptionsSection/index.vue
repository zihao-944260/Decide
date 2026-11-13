<script setup lang="ts">
/**
 * OptionsSection：「添加选项」开关 + 选项卡片编辑区（技术方案 §8.6 编辑态、§12 T4.10）。
 *
 * 两条硬语义：
 * 1. **开关关闭只折叠、不清空**。折叠用类名 `--off`（display:none），不用 v-show：
 *    它编译成 hidden 属性，在 WebView 页会被类的 display:flex 覆盖而收不起（实测）；
 *    worklet 高度动画已按 T0 结论否决。为什么不用 v-if：卡片里那台
 *    `useUpload` 的本地预览路径只活在组件实例上，v-if 卸载即丢，重新打开会出现
 *    「图还在列表里、缩略图没了」的假象。误触丢数据是验收级 bug。
 * 2. **order 由本组件维护**。任何增删排序改名换图之后，输出的数组一定带连续 0 基 order。
 *    云函数按它排展示顺序（planPayload.ts 缺省也按 `i` 补），详情页 OptionCardList 按云端数组
 *    原样渲染、不本地重排 —— order 写错就是线上顺序错，所以这条 invariant 只允许有一个出口。
 *
 * 提交校验（至少 2 个 / 名称非空）不在这里做，规则归页面；本目录 types.ts 把判据给全了。
 */
import BaseButton from '@/components/base/BaseButton/index.vue'
import OptionEditorCard from '@/components/editor/OptionEditorCard/index.vue'
import { showToastMsg } from '@/composables'
import { Limit } from '@/constants/plan'
import type { PlanOption } from '@/types/models'
import { computed, ref, watch } from 'vue'
import { createEmptyOption, optionCardId, type Emits, type Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
const emit = defineEmits<Emits>()

const MAX = Limit.OPTION_MAX
const isFull = computed(() => props.options.length >= MAX)
const hintText = computed(() => {
  const count = props.options.length
  if (isFull.value) return `已达 ${MAX} 个上限，删掉一个才能继续添加`
  if (count === 0) return '还没有选项，点上方按钮加第一个'
  return `已添加 ${count}/${MAX} 个`
})

/** 在途配图的选项 id。按 id 记而不是按下标 —— 下标会随移动/删除漂移 */
const busyIds = ref<string[]>([])

/** 唯一出口：任何改动都过这里，保证交出去的数组 order 连续 */
function commit(list: PlanOption[]): void {
  emit('change', list.map((option, index) => ({ ...option, order: index })))
}

function onToggle(): void {
  if (props.disabled) return
  emit('toggle', !props.enabled)
}

function onAdd(): void {
  if (props.disabled) return
  // 到上限时按钮已是 disabled（BaseButton 内部不响应点击），这里是防直接调用路径的兜底
  if (isFull.value) {
    showToastMsg(`选项最多 ${MAX} 个`)
    return
  }
  commit([...props.options, createEmptyOption()])
}

function patchAt(index: number, changes: Partial<PlanOption>): void {
  commit(props.options.map((option, i) => (i === index ? { ...option, ...changes } : option)))
}

function onRename(index: number, name: string): void {
  patchAt(index, { name })
}

function onImage(index: number, fileID: string): void {
  patchAt(index, { image: fileID })
}

function onMove(index: number, delta: number): void {
  const to = index + delta
  if (to < 0 || to >= props.options.length) return
  const moved = props.options[index]
  const target = props.options[to]
  if (!moved || !target) return
  const next = props.options.slice()
  next[index] = target
  next[to] = moved
  commit(next)
}

function onRemove(index: number): void {
  commit(props.options.filter((_, i) => i !== index))
}

function onCardUploading(id: string, value: boolean): void {
  const has = busyIds.value.includes(id)
  if (value === has) return
  busyIds.value = value ? [...busyIds.value, id] : busyIds.value.filter((item) => item !== id)
  emit('uploading', busyIds.value.length > 0)
}

/**
 * 卡片被卸载（删除、或整包换掉）时不会补发 uploading=false，
 * 所以在 options 变化后把已不存在的 id 摘掉 —— 否则页面的提交门禁会被一个不存在的卡片永久按住。
 */
watch(
  () => props.options,
  (list) => {
    if (busyIds.value.length === 0) return
    const alive = new Set(list.map((option) => option.id))
    const kept = busyIds.value.filter((id) => alive.has(id))
    if (kept.length === busyIds.value.length) return
    busyIds.value = kept
    emit('uploading', kept.length > 0)
  },
)
</script>

<template>
  <view class="options-section">
    <view class="options-section__row" hover-class="options-section__row--hover" @tap="onToggle">
      <view class="options-section__row-main">
        <text class="options-section__title">添加选项</text>
        <text class="options-section__desc">开关关闭只是收起，已填的选项不会丢</text>
      </view>
      <!-- 自绘开关：兼容清单对原生 <switch> 没有任何 Skyline 实测条目，按「无条目 = 未验证」处理；
           这里只用实测过的 flex / border-radius / transform / transition（§2.2、§2.5） -->
      <view class="options-section__track" :class="{ 'options-section__track--on': enabled }">
        <view class="options-section__knob" :class="{ 'options-section__knob--on': enabled }" />
      </view>
    </view>

    <view :class="enabled ? 'options-section__body' : 'options-section__body options-section__body--off'">
      <view
        v-for="(option, index) in options"
        :id="optionCardId(option.id)"
        :key="option.id"
        class="options-section__item"
      >
        <OptionEditorCard
          :option="option"
          :index="index"
          :total="options.length"
          :disabled="disabled"
          @rename="onRename(index, $event)"
          @image="onImage(index, $event)"
          @uploading="onCardUploading(option.id, $event)"
          @move="onMove(index, $event)"
          @remove="onRemove(index)"
        />
      </view>

      <BaseButton type="secondary" block :disabled="isFull || disabled" @click="onAdd">
        <text class="options-section__add-text" :class="{ 'options-section__add-text--off': isFull || disabled }">
          添加选项
        </text>
      </BaseButton>
      <text class="options-section__hint" :class="{ 'options-section__hint--warn': isFull }">{{ hintText }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.options-section {
  @include flex-column;
}

.options-section__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 0 $space-3;
  transition: opacity $duration-fast;
}

.options-section__row--hover {
  opacity: 0.7;
}

.options-section__row-main {
  @include flex-column;
  flex: 1;
}

.options-section__title {
  @include section-title;
}

.options-section__desc {
  // 标题→副文本间距对齐 BaseCell desc 规格（$space-1），此前 $space-1/2 比其他模块挤一倍
  margin-top: $space-1;
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}

// 64 × 40 的轨道 + 32 的滑块，左右各留 4rpx：位移量 24rpx = 64 − 4 − 32 − 4，全部由 token 算出来。
// 轨道底色不做 transition —— 清单只实测过 transition: transform / width，颜色过渡无条目。
.options-section__track {
  @include flex-center;
  justify-content: flex-start;
  flex-shrink: 0;
  width: $space-5 + $space-2;
  height: $space-4 + $space-1;
  background-color: $color-fill-deep;
  border-radius: $radius-round;
}

.options-section__track--on {
  background-color: $color-primary;
}

.options-section__knob {
  width: $space-4;
  height: $space-4;
  margin-left: $space-1 / 2;
  background-color: $color-bg-card;
  border-radius: $radius-round;
  transition: transform $duration-base;
}

.options-section__knob--on {
  // 实测可用：兼容清单 §2.2 transform / §2.5 CSS transition: transform
  transform: translateX($space-5 / 2);
}

.options-section__body {
  @include flex-column;
  margin-top: 0;
}

// 折叠态：类名优先级压过 flex-column，两种渲染器都收得起（v-show 的 hidden 在 WebView 会失效）
.options-section__body--off {
  display: none;
}

.options-section__item {
  margin-bottom: $space-2;
}

.options-section__add-text {
  font-size: $font-md;
  color: $color-primary;
}

.options-section__add-text--off {
  color: $color-text-3;
}

.options-section__hint {
  margin-top: $space-2;
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}

.options-section__hint--warn {
  color: $color-danger;
}
</style>
