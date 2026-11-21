<script setup lang="ts">
import { showToastMsg } from '@/composables'
import { ErrorCode } from '@/constants/error-code'
import { Limit, TextInput } from '@/constants/plan'
import { clipChars } from '@/utils/format'
import type { CommentInputExpose, KeyboardPayload, PublishResult, Props, Emits } from './types'
import { computed, ref, watch } from 'vue'

/** 输入框可长到几行（rows 修饰类白名单），超出走 textarea 内部滚动 */
const ROWS_MIN = 2
const ROWS_MAX = 6

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  posting: false,
  publish: undefined,
  maxlength: Limit.COMMENT_MAX,
  placeholder: '说点什么…',
  disabled: false,
  visible: true,
  avoidKeyboard: true,
  adjustPosition: true,
  cursorSpacing: TextInput.CURSOR_SPACING,
  bottomOffset: 0,
  maxRows: 2
})
const emit = defineEmits<Emits>()

const draft = ref(props.modelValue)
const submitting = ref(false)
const focused = ref(false)
const blurSignal = ref(false)
const keyboardHeight = ref(0)

// 外层改 modelValue（发表成功后清空、草稿恢复）→ 单向同步进来，组件不持有第二份真相
watch(
  () => props.modelValue,
  (value) => {
    if (value !== draft.value) draft.value = value
  }
)

const busy = computed(() => submitting.value || props.posting)
const canSend = computed(() => !props.disabled && !busy.value && draft.value.trim().length > 0)
/** 组件自己避让时强制关掉原生 adjust-position，否则两次位移会叠加（README 有接线说明） */
const nativeAdjust = computed(() => !props.avoidKeyboard && props.adjustPosition)
const lifted = computed(() => props.avoidKeyboard && keyboardHeight.value > 0)
// 顶起距离 = 键盘高度本身：不留额外空隙，输入条下沿与键盘上沿严丝合缝
const liftOffset = computed(() => props.bottomOffset + (lifted.value ? keyboardHeight.value : 0))
// fixed 吸底 + translateY 抬升（兼容清单 §2.2：fixed 可用、transform 可用；不用 sticky）
const barStyle = computed<Record<string, string>>(() => ({
  transform: `translateY(-${liftOffset.value}px)`
}))
/** 键盘背面白底的高度 = 键盘高度（px）；只露在系统键盘圆角外侧的那圈区域 */
const keyboardBackdropStyle = computed<Record<string, string>>(() => ({
  height: `${keyboardHeight.value}px`
}))
// 行数 → 修饰类，max-height 全部由 token 算出来，避免在 JS 里写死尺寸
const rowsClass = computed(() => {
  const rows = Math.min(ROWS_MAX, Math.max(ROWS_MIN, props.maxRows))
  return `comment-input__field--rows-${rows}`
})

/**
 * 展开入口的判定：内容估算超过封顶行数才出现。
 * Skyline 下 textarea 取不到选区、也没有内容高度可量（兼容清单 §2.4，禁止测量），
 * 所以用字数估算行数：字段宽约 21 个全角字/行，半角按 0.55 个全角宽计。
 */
const CHARS_PER_LINE = 21

function estimateLines(text: string): number {
  if (!text) return 1
  return text.split('\n').reduce((sum, line) => {
    let width = 0
    for (const ch of line) width += ch.charCodeAt(0) < 0x2e80 ? 0.55 : 1
    return sum + Math.max(1, Math.ceil(width / CHARS_PER_LINE))
  }, 0)
}

const rowCap = computed(() => Math.min(ROWS_MAX, Math.max(ROWS_MIN, props.maxRows)))

const showExpand = computed(
  () => !props.disabled && !busy.value && estimateLines(draft.value) > rowCap.value
)

function onExpand(): void {
  if (!showExpand.value) return
  emit('expand')
}

function setValue(value: string): void {
  draft.value = value
  emit('update:modelValue', value)
}

function readDetail(event: unknown): Record<string, unknown> {
  const cast = (event as { detail?: Record<string, unknown> } | null)?.detail
  return cast && typeof cast === 'object' ? cast : {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Skyline 下 textarea 选区不可用（兼容清单 §2.4），这里只取 value，不碰任何 selection API；
 *  maxlength 对粘贴不生效（实测超限），逻辑层按码点再截一次 —— 超限直接截断 */
function onInput(event: unknown): void {
  setValue(clipChars(readString(readDetail(event).value), props.maxlength))
}

function onFocus(): void {
  focused.value = true
}

/** 收起一定复位：键盘事件在部分机型不发 height=0，blur 兜底归零（§11.2 遮挡红线） */
function onBlur(): void {
  focused.value = false
  blurSignal.value = false
  if (keyboardHeight.value !== 0) {
    keyboardHeight.value = 0
    emit('keyboard-height', { height: 0, duration: 0 })
  }
}

function onKeyboardChange(event: unknown): void {
  const detail = readDetail(event)
  const payload: KeyboardPayload = {
    height: Math.max(0, readNumber(detail.height)),
    duration: readNumber(detail.duration)
  }
  keyboardHeight.value = payload.height
  emit('keyboard-height', payload)
}

/** 抛出型失败归一化：code/message 一定补齐，调用方不用再判空 */
type Failure = PublishResult & { code: number; message: string }

function failureOf(err: unknown): Failure {
  const shape = err as { code?: unknown; message?: unknown } | null
  const code = readNumber(shape?.code) || ErrorCode.SERVER_ERROR
  const message = readString(shape?.message)
  return { ok: false, code, message: message || '发送失败，请重试' }
}

/**
 * 发送。两条路径：
 * 1. 传了 publish（推荐，页面里就是 `async (text) => ({ ok: await comments.post(text) })`）：
 *    组件 await 结果，成功自己清空、失败保留原文并 emit('error', {code,message})，提示只走 useToast；
 * 2. 没传 publish：只 emit('submit', content)，是否清空由页面决定（调 expose 的 clear() 或改 modelValue）。
 *    这条路径的防重复点击靠外层的 posting —— useComments.post 在首个 await 前就把它置真，够用。
 */
async function send(): Promise<void> {
  if (busy.value) return
  const content = draft.value.trim()
  if (!content) {
    showToastMsg('说点什么吧')
    return
  }
  if (content.length > props.maxlength) {
    showToastMsg(`评论最多 ${props.maxlength} 字`)
    return
  }
  emit('submit', content)
  if (!props.publish) return

  submitting.value = true
  try {
    const result = await props.publish(content)
    if (result.ok) {
      setValue('')
      return
    }
    // ApiError 文案已由 api/request 统一 toast（§7.1），页面用 toast:false 关掉这里，避免双弹
    if (result.message && result.toast !== false) showToastMsg(result.message)
    emit('error', result)
  } catch (err) {
    const failure = failureOf(err)
    showToastMsg(failure.message)
    emit('error', failure)
  } finally {
    submitting.value = false
  }
}

function focus(): void {
  focused.value = true
}

function blur(): void {
  blurSignal.value = true
}

function clear(): void {
  setValue('')
}

function setText(value: string): void {
  setValue(value)
}

const exposed: CommentInputExpose = { focus, blur, clear, setText }
defineExpose(exposed)
</script>

<template>
  <view
    v-if="visible"
    class="comment-input"
    :class="{ 'comment-input--lifted': lifted }"
    :style="barStyle"
  >
    <!-- 键盘弹起时在键盘区域背面铺白：系统键盘浮在最上层，只在它的圆角外侧露出这层底色，
         把原来露出的页面灰变成白，与输入条整体连成一片 -->
    <view v-if="lifted" class="comment-input__keyboard-backdrop" :style="keyboardBackdropStyle" />
    <view class="comment-input__row">
      <textarea
        class="comment-input__field"
        :class="rowsClass"
        :value="draft"
        :placeholder="placeholder"
        :disabled="disabled || busy"
        :maxlength="maxlength"
        :auto-height="true"
        :show-confirm-bar="false"
        confirm-type="send"
        :adjust-position="nativeAdjust"
        :cursor-spacing="cursorSpacing"
        :focus="focused"
        :blur="blurSignal"
        placeholder-class="comment-input__placeholder"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keyboardheightchange="onKeyboardChange"
        @confirm="send"
      />
      <view
        v-if="showExpand"
        class="comment-input__expand"
        hover-class="comment-input__expand--hover"
        @tap="onExpand"
      >
        <!-- 展开图标：左上/右下两个直角括行成的「全屏」符号（Skyline 无伪元素，用真实节点 + border） -->
        <view class="comment-input__expand-icon">
          <view class="comment-input__expand-corner comment-input__expand-corner--tl" />
          <view class="comment-input__expand-corner comment-input__expand-corner--br" />
        </view>
      </view>
      <view
        class="comment-input__send"
        :class="{ 'comment-input__send--off': !canSend }"
        :hover-class="canSend ? 'comment-input__send--hover' : 'none'"
        @tap="send"
      >
        <view v-if="busy" class="comment-input__spinner" />
        <text
          v-else
          class="comment-input__send-text"
          :class="{ 'comment-input__send-text--off': !canSend }"
          >发送</text
        >
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@keyframes comment-input-spin {
  to {
    transform: rotate(360deg);
  }
}

.comment-input {
  @include flex-column;
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: $z-popup;
  padding: $space-2 $space-3;
  background-color: $color-bg-card;
  // 上浮阴影：吸底条/顶起时与页面内容之间需要一层分离感
  box-shadow: $shadow-popup;
  transition: transform $duration-fast linear;
  @include hairline-top;
  @include safe-area-bottom(0rpx);
}

// 键盘抬起时 Home 指示条被盖住：底部内边距清零，条的下沿直接贴住键盘上沿。
// 键盘圆角外侧露出的那圈由 __keyboard-backdrop 铺白，这里不再给输入条加圆角。
.comment-input--lifted {
  padding-bottom: 0;
}

// 键盘背面白底：绝对定位贴在输入条下沿（输入条 fixed 且带 transform，就是它的包含块），
// 高度 = 键盘高度；系统键盘浮在最上层，圆角外侧露出的就是这层白，不再是页面灰
.comment-input__keyboard-backdrop {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  background-color: $color-bg-card;
}

.comment-input__row {
  display: flex;
  flex-direction: row;
  // stretch 而非 center：真机 textarea 的 auto-height 会按原生行高取整，单行也可能比按钮高几 rpx；
  // 让发送按钮随行的交叉轴撑满 = 始终等于输入框真实高度（#76），多行长高时按钮同步跟高
  align-items: stretch;
}

.comment-input__field {
  // textarea 是原生组件，不覆盖 display（Skyline defaultDisplayBlock 已为 block），
  // 这里只做 flex 子项的伸缩与圆角底色
  flex: 1;
  overflow: hidden;
  // 单行与发送按钮同高（$tap-min-height）：上下 padding 补齐行高差，文字垂直居中；
  // 聚焦不再插入计数行，整条高度恒定（用户裁定 #44）
  min-height: $comment-field-height;
  padding: ($comment-field-height - $font-sm * $line-normal) / 2 $space-2;
  font-size: $font-sm;
  line-height: $line-normal;
  color: $color-text-1;
  background-color: $color-fill;
  border-radius: $radius-md;
}

// 多行上限 = N 行文本 + 单行时的上下 padding（与 min-height 同一笔账）
.comment-input__field--rows-2 {
  max-height: $font-md * $line-normal * 2 + ($comment-field-height - $font-md * $line-normal);
}

.comment-input__field--rows-3 {
  max-height: $font-md * $line-normal * 3 + ($comment-field-height - $font-md * $line-normal);
}

.comment-input__field--rows-4 {
  max-height: $font-md * $line-normal * 4 + ($comment-field-height - $font-md * $line-normal);
}

.comment-input__field--rows-5 {
  max-height: $font-md * $line-normal * 5 + ($comment-field-height - $font-md * $line-normal);
}

.comment-input__field--rows-6 {
  max-height: $font-md * $line-normal * 6 + ($comment-field-height - $font-md * $line-normal);
}

.comment-input__placeholder {
  color: $color-text-3;
}

// 展开按钮：仅在内容超过封顶行数时出现，点开半屏编辑层
.comment-input__expand {
  @include flex-center;
  flex-shrink: 0;
  width: $comment-field-height;
  min-height: $comment-field-height;
  margin-left: $space-2;
  border-radius: $radius-md;
  background-color: $color-fill;
}

.comment-input__expand--hover {
  opacity: 0.7;
}

.comment-input__expand-icon {
  position: relative;
  width: 28rpx;
  height: 28rpx;
}

.comment-input__expand-corner {
  position: absolute;
  width: 12rpx;
  height: 12rpx;
}

.comment-input__expand-corner--tl {
  top: 0;
  left: 0;
  border-top: $border-width-thick solid $color-text-2;
  border-left: $border-width-thick solid $color-text-2;
}

.comment-input__expand-corner--br {
  right: 0;
  bottom: 0;
  border-right: $border-width-thick solid $color-text-2;
  border-bottom: $border-width-thick solid $color-text-2;
}

.comment-input__send {
  @include flex-center;
  flex-shrink: 0;
  min-width: $comment-field-height;
  min-height: $comment-field-height;
  // height:auto + 行 stretch：按钮高度交给输入框真实高度决定，min-height 只兜底最小可点高度（#76）
  height: auto;
  margin-left: $space-2;
  padding: 0 $space-2;
  border-radius: $radius-md;
  background-color: $color-primary;
  transition: opacity $duration-fast;
}

.comment-input__send--hover {
  opacity: 0.7;
}

.comment-input__send--off {
  background-color: $color-fill-deep;
}

.comment-input__send-text {
  font-size: $font-sm;
  color: $color-text-inverse;
}

.comment-input__send-text--off {
  color: $color-text-3;
}

.comment-input__spinner {
  width: $spinner-sm;
  height: $spinner-sm;
  border: $border-width-thick solid $color-text-inverse;
  border-top-color: transparent;
  border-radius: $radius-round;
  animation: comment-input-spin 800ms linear infinite;
}
</style>
