<script setup lang="ts">
/**
 * EditorToolbar —— 编辑器底部工具栏（T4.6，技术方案 §8.1「交互与选区」/ §9.2）。
 *
 * 形制对齐用户指定的参考编辑器：两行扁平图标条。
 * 第一行 = 段落级样式（B / 左中对齐 / H1 / H2 / 正文），第二行 = 色板 + 插入 + 删除。
 * 图标全部用「文字字形 + 真实节点拼装」（Skyline 无伪元素、image 不支持 SVG，兼容清单 §1.5）：
 * 对齐图标是三条 CSS 横条，档位是 H1/H2 字形，其余保留中文短标签。
 *
 * 三条形状约束：
 * 1. **纯受控**：点击只 emit，不改数据、不读 store。真相在页面的 `useEditor()` 里，
 *    页面把 `editor.activeStyle` / `editor.stylable` 原样喂进来（README 有逐字接线）。
 * 2. **置灰而不是隐藏**：`stylable === false` 时样式项仍占位，只是不可点。
 *    隐藏会让整排宽度跳一下（验收项）。插入项不受 stylable 影响 —— 它作用于「插入位置」，
 *    与当前块能不能设样式无关；删除项只看 `canRemove`（有无聚焦块）。
 * 3. **自己不 fixed**：吸底由页面完成（把本组件放在页面唯一 scroll-view 的兄弟节点上，
 *    详情页 CommentInput 就是这个接法）。组件只输出 markup。
 *
 * 色板只有 TEXT_COLORS 一个来源（constants/plan），组件内不写第二份色值；
 * 段落级样式没有「选中部分加粗」这条路（兼容清单 §2.4：Skyline 取不到 textarea 选区）。
 */
import { computed } from 'vue'
import { TEXT_COLORS } from '@/constants/plan'
import { ALIGNS, LEVELS } from '@/utils/blocks'
import type { TextBlock } from '@/types/models'
import type { Emits, Props } from './types'

const props = withDefaults(defineProps<Props>(), { disabled: false, canRemove: false })
const emit = defineEmits<Emits>()

/**
 * 档位/对齐的**取值**来自 `utils/blocks` 的 LEVELS / ALIGNS（与 `sanitizeBlocks` 的白名单同源），
 * 这里只挂文案。用 `Record` 而不是自己排一份数组：新增档位时 Record 少一个键就编译不过，
 * 不会出现「工具栏点得出、块里存不下」的错配。1=H1、2=H2、3=正文（§8.1）。
 */
const LEVEL_LABELS: Record<TextBlock['level'], string> = { 1: 'H1', 2: 'H2', 3: '正文' }
const LEVEL_ITEMS = LEVELS.map((level) => ({ level, label: LEVEL_LABELS[level] }))
const ALIGN_ITEMS = ALIGNS.map((align) => ({ align }))

const styleEnabled = computed<boolean>(() => props.stylable && !props.disabled)
const insertEnabled = computed<boolean>(() => !props.disabled)
const removeEnabled = computed<boolean>(() => props.canRemove && !props.disabled)
const active = computed<Props['activeStyle']>(() => props.activeStyle)

const boldOn = computed<boolean>(() => Boolean(active.value?.bold))

/** activeStyle 为 null（无聚焦块 / 聚焦在图片·引用·分割线上）时一律不高亮 */
function levelOn(level: TextBlock['level']): boolean {
  return active.value ? active.value.level === level : false
}
function alignOn(align: TextBlock['align']): boolean {
  return active.value ? active.value.align === align : false
}
function colorOn(value: string): boolean {
  return active.value ? active.value.color === value : false
}

/** 基类 + 至多一个互斥修饰类（--off 优先于 --on：禁用态不可能同时是选中态） */
function itemClass(isOn: boolean, enabled: boolean): string {
  const classes = ['editor-toolbar__item']
  if (!enabled) classes.push('editor-toolbar__item--off')
  else if (isOn) classes.push('editor-toolbar__item--on')
  return classes.join(' ')
}
/** 字形（B / H1 / H2）：B 恒为粗体，选中态染主题色；置灰交给 item 的 opacity */
function glyphClass(isOn: boolean, enabled: boolean, heavy = false): string {
  const classes = ['editor-toolbar__glyph']
  if (heavy) classes.push('editor-toolbar__glyph--heavy')
  if (isOn && enabled) classes.push('editor-toolbar__glyph--on')
  return classes.join(' ')
}
/** 对齐图标容器：三条横条按对齐值摆位 */
function barsClass(align: TextBlock['align']): string {
  return `editor-toolbar__bars editor-toolbar__bars--${align}`
}
function barClass(isOn: boolean, enabled: boolean, short: boolean): string {
  const classes = ['editor-toolbar__bar']
  if (short) classes.push('editor-toolbar__bar--short')
  if (isOn && enabled) classes.push('editor-toolbar__bar--on')
  return classes.join(' ')
}
/** 色板外层是 88rpx 的可点格，色块本身只是里面的圆点 */
function dotClass(value: string): string {
  const classes = ['editor-toolbar__dot']
  if (!styleEnabled.value) classes.push('editor-toolbar__dot--off')
  else if (colorOn(value)) classes.push('editor-toolbar__dot--on')
  return classes.join(' ')
}
function swatchClass(value: string): string {
  const classes = ['editor-toolbar__swatch']
  if (!value) classes.push('editor-toolbar__swatch--reset')
  return classes.join(' ')
}
/** 色值全部来自 TEXT_COLORS（§9.1-5：组件内不出现字面色值）；'' 是复位项，交给 --reset 描边样式 */
function swatchStyle(value: string): string {
  return value ? `background-color: ${value};` : ''
}

function onLevel(level: TextBlock['level']): void {
  if (styleEnabled.value) emit('set-level', level)
}
function onAlign(align: TextBlock['align']): void {
  if (styleEnabled.value) emit('set-align', align)
}
function onBold(): void {
  if (styleEnabled.value) emit('toggle-bold')
}
function onColor(value: string): void {
  if (styleEnabled.value) emit('set-color', value)
}
/** 插入项只吃 disabled，不吃 stylable */
function onInsert(kind: 'quote' | 'divider' | 'image'): void {
  if (!insertEnabled.value) return
  if (kind === 'quote') emit('insert-quote')
  else if (kind === 'divider') emit('insert-divider')
  else emit('insert-image')
}
function onRemove(): void {
  if (removeEnabled.value) emit('remove')
}
</script>

<template>
  <view class="editor-toolbar">
    <!-- 第一行：段落级样式（作用于当前聚焦的 text 块整段）：加粗 / 对齐 / 档位 -->
    <view class="editor-toolbar__row">
      <view :class="itemClass(boldOn, styleEnabled)" @tap="onBold">
        <text :class="glyphClass(boldOn, styleEnabled, true)">B</text>
      </view>
      <view
        v-for="entry in ALIGN_ITEMS"
        :key="`align-${entry.align}`"
        :class="itemClass(alignOn(entry.align), styleEnabled)"
        @tap="onAlign(entry.align)"
      >
        <view :class="barsClass(entry.align)">
          <view :class="barClass(alignOn(entry.align), styleEnabled, false)" />
          <view :class="barClass(alignOn(entry.align), styleEnabled, true)" />
          <view :class="barClass(alignOn(entry.align), styleEnabled, false)" />
        </view>
      </view>
      <view
        v-for="entry in LEVEL_ITEMS"
        :key="`level-${entry.level}`"
        :class="itemClass(levelOn(entry.level), styleEnabled)"
        @tap="onLevel(entry.level)"
      >
        <text :class="glyphClass(levelOn(entry.level), styleEnabled)">{{ entry.label }}</text>
      </view>
    </view>

    <!-- 第二行：色板（TEXT_COLORS 唯一来源）+ 插入三类块 + 删除聚焦块 -->
    <view class="editor-toolbar__row">
      <view class="editor-toolbar__colors">
        <view
          v-for="entry in TEXT_COLORS"
          :key="`color-${entry.value}`"
          :class="dotClass(entry.value)"
          @tap="onColor(entry.value)"
        >
          <view :class="swatchClass(entry.value)" :style="swatchStyle(entry.value)" />
        </view>
      </view>

      <view class="editor-toolbar__split" />

      <view class="editor-toolbar__inserts">
        <view :class="itemClass(false, insertEnabled)" @tap="onInsert('quote')">
          <text class="editor-toolbar__label">引用</text>
        </view>
        <view :class="itemClass(false, insertEnabled)" @tap="onInsert('divider')">
          <text class="editor-toolbar__label">分割线</text>
        </view>
        <view :class="itemClass(false, insertEnabled)" @tap="onInsert('image')">
          <text class="editor-toolbar__label">图片</text>
        </view>
        <view :class="itemClass(false, removeEnabled)" @tap="onRemove">
          <text class="editor-toolbar__label">删除</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.editor-toolbar {
  @include flex-column;
  width: 100%;
  padding: $space-1 $space-2;
  background-color: $color-bg-card;
  @include hairline-top;
  @include safe-area-bottom($space-1);
}

.editor-toolbar__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
}

// 六个样式项等分一行：flex:1 + min-width:0，换机型也不挤、不隐藏
.editor-toolbar__item {
  @include flex-center;
  flex: 1;
  min-width: 0;
  min-height: $tap-min-height;
  margin-right: $space-1;
  border-radius: $radius-md;
}

.editor-toolbar__item--on {
  background-color: $color-primary-light;
}

.editor-toolbar__item--off {
  opacity: 0.35;
}

.editor-toolbar__label {
  font-size: $font-sm;
  color: $color-text-2;
  @include ellipsis-1;
}

.editor-toolbar__label--on {
  color: $color-primary;
  font-weight: $font-weight-semibold;
}

// 字形按钮（B / H1 / H2）：比正文标签大一档，B 恒为粗体
.editor-toolbar__glyph {
  font-size: $font-md;
  font-weight: $font-weight-semibold;
  color: $color-text-2;
}

.editor-toolbar__glyph--heavy {
  font-weight: 700;
}

.editor-toolbar__glyph--on {
  color: $color-primary;
}

// 对齐图标：三条 4rpx 横条（Skyline 无伪元素、无 SVG），中条短一截
.editor-toolbar__bars {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 36rpx;
}

.editor-toolbar__bars--center {
  align-items: center;
}

.editor-toolbar__bar {
  width: 36rpx;
  height: $border-width-thick;
  border-radius: $radius-round;
  background-color: $color-text-2;
}

.editor-toolbar__bar--short {
  width: 22rpx;
}

.editor-toolbar__bar--on {
  background-color: $color-primary;
}

.editor-toolbar__colors {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

.editor-toolbar__dot {
  @include flex-center;
  width: $tap-min-height;
  height: $tap-min-height;
  border-radius: $radius-md;
}

.editor-toolbar__dot--on {
  background-color: $color-primary-light;
}

.editor-toolbar__dot--off {
  opacity: 0.35;
}

.editor-toolbar__swatch {
  width: $space-4;
  height: $space-4;
  border: $border-width-thin solid transparent;
  border-radius: $radius-round;
}

// 「默认」复位项：空心圈，语义是跟随正文色，不是第五种颜色
.editor-toolbar__swatch--reset {
  background-color: transparent;
  border-color: $color-text-3;
}

.editor-toolbar__split {
  width: $border-width-thin;
  height: $space-4;
  margin: 0 $space-1;
  background-color: $color-border;
}

.editor-toolbar__inserts {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  min-width: 0;
}
</style>
