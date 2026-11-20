<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCountdown } from '@/composables'
import type { Props, Emits } from './types'

const props = withDefaults(defineProps<Props>(), {
  tone: 'text',
  size: 'sm',
  showDot: true,
  endedText: ''
})
const emit = defineEmits<Emits>()

/**
 * expire 只转发「挂载之后」发生的归零沿。
 * useCountdown 的首次 sync 在 setup 里同步执行，若不过滤这一刀，一屏 N 个已过期卡片
 * 会在首帧广播 N 次 expire，页面照做就是 N 次 reload —— 列表越滚越忙。
 */
let mounted = false
const countdown = useCountdown(() => props.deadline, {
  startAt: () => props.startAt,
  total: props.total,
  onExpire: () => {
    if (mounted) emit('expire', props.deadline)
  }
})
onMounted(() => {
  mounted = true
})

// 四档文案由 useCountdown / utils/format 决定，组件只负责「按档位换样式」，不自己算时间
const displayText = computed(() => {
  if (countdown.expired.value) return props.endedText || countdown.text.value
  return countdown.text.value
})

const level = computed(() => countdown.level.value)

/** 档位 → 指示点色：秒级告警、终态置灰，其余走次要文字色 */
const dotClass = computed(() => `count-down__dot--${level.value}`)
const textClass = computed(() => `count-down__text--${level.value}`)

/**
 * tone 与档位合成一个单类名：工程约定一个节点一个类名，样式不靠 `.a.b` 叠加来定（兼容清单 §1.5 末尾的澄清）。
 * 胶囊态只有三种底色，其余档位共用 normal，避免为 day/hour/minute 各写一份。
 */
const toneClass = computed(() => {
  if (props.tone !== 'chip') return 'count-down--text'
  if (level.value === 'ended') return 'count-down--chip-ended'
  if (level.value === 'second') return 'count-down--chip-danger'
  return 'count-down--chip-normal'
})

const rootClass = computed(() => ['count-down', `count-down--${props.size}`, toneClass.value])
</script>

<template>
  <view :class="rootClass">
    <view v-if="showDot" class="count-down__dot" :class="dotClass" />
    <text class="count-down__text" :class="textClass">{{ displayText }}</text>
  </view>
</template>

<style lang="scss" scoped>
.count-down {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
}

.count-down--text {
  // 纯文字态无底色，靠档位类决定颜色
  padding: 0;
}

.count-down--chip-normal {
  padding: $space-1 $space-2;
  background-color: $color-primary-light;
  border-radius: $radius-round;
}

.count-down--chip-danger {
  padding: $space-1 $space-2;
  background-color: $color-danger-light;
  border-radius: $radius-round;
}

.count-down--chip-ended {
  padding: $space-1 $space-2;
  background-color: $color-fill;
  border-radius: $radius-round;
}

.count-down--sm {
  font-size: $font-xs;
}

.count-down--md {
  font-size: $font-sm;
}

.count-down--lg {
  font-size: $font-md;
}

.count-down__dot {
  flex-shrink: 0;
  width: $space-1;
  height: $space-1;
  margin-right: $space-1;
  border-radius: $radius-round;
}

.count-down__dot--day,
.count-down__dot--hour,
.count-down__dot--minute {
  background-color: $color-primary;
}

.count-down__dot--second {
  background-color: $color-danger;
}

// 归零置灰（§12 T3.1 验收标准）
.count-down__dot--ended {
  background-color: $color-text-3;
}

.count-down__text {
  font-size: inherit;
  line-height: $line-tight;
  white-space: nowrap;
}

.count-down__text--day,
.count-down__text--hour,
.count-down__text--minute {
  color: $color-text-2;
}

.count-down__text--second {
  color: $color-danger;
  font-weight: $font-weight-medium;
}

.count-down__text--ended {
  color: $color-text-3;
}
</style>
