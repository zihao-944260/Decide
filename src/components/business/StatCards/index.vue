<script setup lang="ts">
/**
 * StatCards（T5.3）——「我发起的 / 我参与的 / 进行中 / 已截止」四张数据卡。
 *
 * **纯受控**（§11 本轮裁决）：不 import store、不发请求、不持有选中态。
 * 数字全部由 `props.stats` 算出来（每张卡自带 `count`，见 types.ts），
 * 高亮全部来自 `props.active`，点击只 `emit('select', filter)`。
 * 这样下一轮页面接 `planStore` / `userStore` 时不会出现「组件内部还有一份状态」的打架。
 *
 * 这一排卡同时**就是我的页唯一切换器**（用户 2026-11-18 口径：下面那条 FilterTabs chip 是重复入口，删）。
 * 所以它必须四张卡对齐四个 MyFilter 取值，一个不多一个不少 —— 少一张就有一桶数据点不到。
 */
import { computed } from 'vue'
import { compactCount } from '@/utils/format'
import { STAT_CARDS, type Emits, type Props, type StatCard } from './types'

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
})
const emit = defineEmits<Emits>()

interface CardView extends StatCard {
  /** 已缩写好的数字文案（999+/万/亿口径统一走 utils/format 的 compactCount） */
  text: string
}

/**
 * `UserStats` 的值来自云端冗余计数字段，运行时可能是 undefined / NaN（§5.1「允许短暂不一致」）。
 * 这里统一收成非负整数：坏值显示 0 而不是空白，但**加载中不显示 0**（见 loading 分支）。
 */
function readCount(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '0'
  return compactCount(value)
}

const cards = computed<CardView[]>(() =>
  STAT_CARDS.map((card) => ({ ...card, text: readCount(card.count(props.stats)) })),
)

function itemClass(card: CardView): string[] {
  const names = ['stat-cards__item']
  if (card.filter === props.active) names.push('stat-cards__item--active')
  if (props.disabled) names.push('stat-cards__item--disabled')
  return names
}

/** 数字的强调色挂在文字自己的类名上（Skyline 按无后代选择器处理，兼容清单 §1.5） */
function valueClass(card: CardView): string[] {
  const names = ['stat-cards__value']
  if (card.filter === props.active) names.push('stat-cards__value--active')
  return names
}

function onSelect(card: CardView): void {
  if (props.disabled) return
  emit('select', card.filter)
}
</script>

<template>
  <view class="stat-cards">
    <view class="stat-cards__row">
      <view
        v-for="card in cards"
        :key="card.filter"
        :class="itemClass(card)"
        :hover-class="disabled ? 'none' : 'stat-cards__item--hover'"
        @tap="onSelect(card)"
      >
        <!-- 加载中：占位条代替数字，0 留给「真的是 0」 -->
        <view v-if="loading" class="stat-cards__bar" />
        <text v-else :class="valueClass(card)">{{ card.text }}</text>
        <text class="stat-cards__label">{{ card.label }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
// keyframes 放在 scoped 块里（与 BaseSkeleton 同法），不开第二个非 scoped 块，
// 免得往全局样式里漏一个动画名（兼容清单 §1.5：非 scoped 内容会原样输出到全局）。
@keyframes stat-cards-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

// 左右内衬 $space-3 与页面其它块同口径，列宽因此与下面的列表对齐
.stat-cards {
  @include flex-column;
  padding: 0 $space-3;
}

.stat-cards__row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
}

// 四卡等分；对称外边距代替 gap（结构伪类按不支持处理）。
// 按 token 算：390/402pt 屏每列约 83~86px，四字标签（$font-xs）约 47px，放得下且不会留悬空列。
.stat-cards__item {
  @include flex-column;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  min-height: $tap-min-height;
  margin: 0 $space-1;
  padding: $space-2 0;
  background-color: $color-bg-card;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  transition: opacity $duration-fast;
}

.stat-cards__item--active {
  background-color: $color-primary-light;
}

.stat-cards__item--hover {
  opacity: 0.85;
}

.stat-cards__item--disabled {
  opacity: 0.5;
}

.stat-cards__value {
  font-size: $font-xl;
  font-weight: $font-weight-semibold;
  line-height: $line-tight;
  color: $color-text-1;
}

.stat-cards__value--active {
  color: $color-primary;
}

.stat-cards__label {
  @include ellipsis-1;
  max-width: 100%;
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-text-2;
}

.stat-cards__bar {
  width: 50%;
  height: $skeleton-bar-height-lg;
  background-color: $color-fill;
  border-radius: $radius-sm;
  animation: stat-cards-pulse 1200ms ease-in-out infinite alternate;
}
</style>
