<script setup lang="ts">
/**
 * VoteActions：赞同 / 反对两个按钮 + 在途锁 + 截止置灰 + 主态整块隐藏（§8.3 / T3.10）。
 *
 * 三条硬规则都在这里落稳：
 * 1. 状态只有一个来源 —— useVote 的 myVote/counts/total/voting，组件不缓存、不另算一份票；
 * 2. `voting` 期间只让被点的那颗出 loading，另一颗禁用，连点不会二次提交；
 * 3. 已选项的二次点击由 composable 直接忽略（v1 无取消投票），UI 不额外加逻辑、不弹提示。
 */
import { computed, ref } from 'vue'
import BaseButton from '../../base/BaseButton/index.vue'
import { VoteType, type VoteTypeValue } from '@/constants/plan'
import { NO_VOTE, useVote } from '@/composables/useVote'
import { showToastMsg } from '@/composables/useToast'
import type { Emits, Props } from './types'

const props = withDefaults(defineProps<Props>(), {
  closed: false,
  isAuthor: false,
  showCount: false,
  closedText: '该计划已截止',
  optionsEnabled: false,
  locked: false
})
const emit = defineEmits<Emits>()

const { myVote, counts, total, voting, agree, disagree } = useVote(() => props.planId, {
  onVoted: (type) => emit('voted', type),
  onClosed: () => emit('closed')
})

/** 只用于「哪颗按钮在转」；重复提交的拦截在 useVote 里，这里不兜第二份 */
const pending = ref<VoteTypeValue | null>(null)

const agreeActive = computed(() => myVote.value === VoteType.Agree)
const disagreeActive = computed(() => myVote.value === VoteType.Disagree)
const agreeLoading = computed(() => pending.value === VoteType.Agree)
const disagreeLoading = computed(() => pending.value === VoteType.Disagree)
// 在途时另一颗禁用；点中的那颗只显 loading，避免整排闪一下灰。locked = 已投过，两颗都封死
const agreeDisabled = computed(
  () => props.closed || props.locked || (voting.value && !agreeLoading.value)
)
const disagreeDisabled = computed(
  () => props.closed || props.locked || (voting.value && !disagreeLoading.value)
)
const myVoteText = computed(() => {
  if (myVote.value === NO_VOTE) return ''
  return myVote.value === VoteType.Agree ? '我的选择：赞同' : '我的选择：反对'
})

async function onCast(type: VoteTypeValue): Promise<void> {
  if (props.closed || props.locked || pending.value !== null) return
  pending.value = type
  try {
    if (type === VoteType.Agree) await agree()
    else await disagree()
  } finally {
    pending.value = null
  }
}

/**
 * 禁用态的 BaseButton 不 emit click，截止提示只能挂在行容器上（tap 仍会冒泡到这里）。
 * 未截止时这里必须什么都不做 —— 投票入口只有按钮那一条路。
 */
function onRowTap(): void {
  if (props.closed) showToastMsg(props.closedText)
}
</script>

<template>
  <!-- 发起人主态整块不渲染（§8.3 禁止自投）；选项表决模式同样不渲染 —— 投票入口在 OptionCardList -->
  <view v-if="!isAuthor && !optionsEnabled" class="vote-actions">
    <view class="vote-actions__row" @tap="onRowTap">
      <view class="vote-actions__cell">
        <BaseButton
          type="primary"
          size="lg"
          block
          :loading="agreeLoading"
          :disabled="agreeDisabled"
          @click="onCast(VoteType.Agree)"
        >
          <text class="vote-actions__label">赞同</text>
          <text v-if="agreeActive" class="vote-actions__mark">已选</text>
          <text v-if="showCount" class="vote-actions__count">{{ counts.agree }}</text>
        </BaseButton>
      </view>
      <view class="vote-actions__cell">
        <BaseButton
          type="danger"
          size="lg"
          block
          :loading="disagreeLoading"
          :disabled="disagreeDisabled"
          @click="onCast(VoteType.Disagree)"
        >
          <text class="vote-actions__label">反对</text>
          <text v-if="disagreeActive" class="vote-actions__mark">已选</text>
          <text v-if="showCount" class="vote-actions__count">{{ counts.disagree }}</text>
        </BaseButton>
      </view>
    </view>
    <view v-if="showCount" class="vote-actions__foot">
      <text class="vote-actions__total">共 {{ total }} 人表态</text>
      <text v-if="myVoteText" class="vote-actions__mine">{{ myVoteText }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.vote-actions {
  @include flex-column;
  width: 100%;
}

.vote-actions__row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

// BaseButton 的根节点宽度由 block 撑满，所以外层给它一个可 flex:1 的真实容器
.vote-actions__cell {
  @include flex-column;
  flex: 1;
  min-width: 0;
  margin: 0 $space-1;
}

.vote-actions__label {
  font-size: $font-md;
}

.vote-actions__mark {
  margin-left: $space-1;
  font-size: $font-xs;
}

.vote-actions__count {
  margin-left: $space-1;
  font-size: $font-sm;
}

.vote-actions__foot {
  @include flex-center;
  justify-content: center;
  min-height: $tap-min-height;
  transition: opacity $duration-fast;
}

.vote-actions__total {
  font-size: $font-sm;
  color: $color-text-3;
}

.vote-actions__mine {
  margin-left: $space-2;
  font-size: $font-sm;
  color: $color-primary;
}
</style>
