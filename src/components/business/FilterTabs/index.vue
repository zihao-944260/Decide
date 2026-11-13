<script setup lang="ts">
/**
 * FilterTabs（T5.4）——「我的页」四条筛选标签。
 *
 * 裁决（本轮，覆盖 §8.7 原文的「横向滚动筛选卡片」）：**四项短标签用 view + flex 等分一行放下，不做横向滚动**。
 * 理由写在这里，README 里也有：
 * 1. 内容算得过：最长标签「我发起的」4 个中文字 × $font-sm(26rpx) ≈ 104rpx，而 750rpx 下每项 ≥ 150rpx，
 *    「放不下」这个问题在 v1 的数据形状下不存在；
 * 2. Skyline 的 `scroll-view` 必须显式声明 `type`，而 `grid-view` 实测渲染 0×0（兼容清单 §2.3）——
 *    为一个不存在的问题引入一个未验证的风险，收益为零；
 * 3. 横滚还会带来「右侧还有第四项」的视觉暗示缺失，四项一行本身就不需要滚动条。
 *
 * 组件**纯受控**：选中态由页面喂（props.active）、只 emit 一个 filter 值，
 * 不 import store、不发请求、不缓存 tab 状态。缓存语义在 `planStore.myLists[filter]` 与页面（§8.7）。
 */
import { computed } from 'vue'
import { MY_FILTER_LABELS, MY_FILTERS, type MyFilter } from '@/constants/plan'
import { type Emits, type Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  filters: () => MY_FILTERS,
  disabled: false,
})
const emit = defineEmits<Emits>()

const tabs = computed(() =>
  props.filters.map((filter) => ({ filter, label: MY_FILTER_LABELS[filter] })),
)

/**
 * 一个节点一个类名 + 平铺 class（不用后代/子代/伪元素选择器，兼容清单 §1.5 的编码红线）。
 * 选中态改 background-color、禁用态改 opacity，两个修饰类落在不同属性上，
 * 所以「既选中又禁用」时不存在层叠先后之争，两条同时生效。
 */
function itemClass(filter: MyFilter): string[] {
  const names = ['filter-tabs__item']
  if (filter === props.active) names.push('filter-tabs__item--active')
  if (props.disabled) names.push('filter-tabs__item--disabled')
  return names
}

/**
 * 文字的高亮色必须挂在文字**自己**的类名上：Skyline 只认 class/ID/标签选择器，
 * 「父节点 --active → 子节点文字变色」这种后代写法按不支持处理（兼容清单 §1.5）。
 */
function labelClass(filter: MyFilter): string[] {
  const names = ['filter-tabs__label']
  if (filter === props.active) names.push('filter-tabs__label--active')
  return names
}

function onSelect(filter: MyFilter): void {
  if (props.disabled) return
  // 点已选中的项不发事件：切回同一 filter 没有任何语义，页面也不该因此重发请求
  if (filter === props.active) return
  emit('change', filter)
}
</script>

<template>
  <view class="filter-tabs">
    <view class="filter-tabs__row">
      <view
        v-for="tab in tabs"
        :key="tab.filter"
        :class="itemClass(tab.filter)"
        :hover-class="disabled ? 'none' : 'filter-tabs__item--hover'"
        @tap="onSelect(tab.filter)"
      >
        <text :class="labelClass(tab.filter)">{{ tab.label }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
// 组件自己带左右 $space-3 内衬（与 CommentList 同口径），页面不要再包一层横向 padding。
.filter-tabs {
  @include flex-column;
  padding: 0 $space-3;
}

.filter-tabs__row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
}

// 等分：flex: 1 + min-width: 0，四项永远占满一行（Skyline flex:1 实测可用，兼容清单 §2.2）。
// 左右各 $space-1 外边距而不是「项间 gap」：Skyline 只支持 class/ID/标签选择器，
// :last-child 这类结构伪类按不支持处理，用对称边距就不需要判「是不是最后一个」。
.filter-tabs__item {
  @include flex-center;
  flex: 1;
  min-width: 0;
  min-height: $tap-min-height;
  margin: 0 $space-1;
  background-color: $color-fill;
  border-radius: $radius-md;
  transition: background-color $duration-fast;
}

.filter-tabs__item--active {
  background-color: $color-primary-light;
}

.filter-tabs__item--hover {
  opacity: 0.85;
}

.filter-tabs__item--disabled {
  opacity: 0.5;
}

.filter-tabs__label {
  @include ellipsis-1;
  max-width: 100%;
  font-size: $font-sm;
  color: $color-text-2;
}

.filter-tabs__label--active {
  color: $color-primary;
  font-weight: $font-weight-medium;
}
</style>
