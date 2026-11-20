<script setup lang="ts">
/**
 * DeadlinePicker：截止时间的「快捷三项 + 自定义弹层」（技术方案 §8.1 页面结构、§12 T4.9）。
 *
 * 为什么不用原生 `<picker>` / `<picker-view>`：《docs/Skyline兼容清单》§2.3 把 Skyline 专属组件
 * 逐个实测列了可用/不可用，但**对 picker / picker-view 没有任何条目** —— 既没说可用也没说不可用，
 * 等于未验证。本轮的纪律是「兼容清单没写的平台行为不能当成已确认的事实写进代码」（agent-prompts §11），
 * 所以自定义档走已实测可用的组合：BasePopup（fixed 遮罩+面板，#78 弃用 page-container）+
 * 两列显式定高 scroll-view（WebView 下不带 type="list"，#37）。真机复核项见 README。
 *
 * 受控组件：只读 props.deadline、只 emit('change')。校验规则归页面（T4.11 的 useForm）。
 */
import BaseCell from '@/components/base/BaseCell/index.vue'
import BasePopup from '@/components/base/BasePopup/index.vue'
import { peekNow, showToastMsg } from '@/composables'
import { DeadlinePreset } from '@/constants/plan'
import { formatDate, formatDateTime, pad2 } from '@/utils/format'
import { computed, getCurrentInstance, ref } from 'vue'
import { deadlineText, type DeadlineDay, type DeadlineSlot, type Emits, type Props } from './types'

/** 日期列跨度：从今天起 14 天（产品口径，改这里就改了整个弹层的可选范围） */
const DATE_SPAN = 14
/** 时间列步长（分钟）：00:00 ~ 23:30 共 48 档 */
const SLOT_STEP = 30
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS
/**
 * 最小未来余量：档位过滤与确认校验共用同一个阈值。
 * 两个数分开写就会出现「格子里能选、点确定被弹回」的诡异体验，所以刻意合一。
 */
const MIN_FUTURE_MS = 60_000
const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const props = withDefaults(defineProps<Props>(), {
  label: '截止时间'
})
const emit = defineEmits<Emits>()

/**
 * 弹层内两列的 `scroll-into-view` 目标 id 前缀，**每个实例必须不同**：同页挂两个 picker 时
 * 前缀相同会让 A 的滚动跳到 B 的格子上。
 * 注意不能用「文件里 let 一个自增数」：`<script setup>` 的函数体是**每次实例化都跑一遍**的，
 * 那样的计数器永远等于 1。`getCurrentInstance().uid` 才是渲染器分配的全局递增实例号。
 */
const uid = `dp${getCurrentInstance()?.uid ?? 0}`

const presets = DeadlinePreset
const sheetVisible = ref(false)
/**
 * 当前选中的快捷项（days），null = 没选快捷（自定义 / 未设置）。
 * 为什么不从 props.deadline 反推：快捷值是「点击那一刻的 now + N 天」，now 一直在走，
 * 事后拿 deadline 去比 now+N天 永远差一截、匹配不上 —— 所以点击时记一笔，自定义确认时清掉（用户裁定 #55）。
 */
const activePreset = ref<number | null>(null)
/**
 * 打开弹层时冻结的 now。整列档位由它派生：
 * 每分钟重算会让已渲染的格子整体上移一格、用户正在点的那一格换日期，且 setData 白烧；
 * 「档位过期」的风险交给确认时的二次校验兜（见 confirm）。
 */
const pinnedNow = ref(peekNow())
const dateIndex = ref(0)
const timeIndex = ref(0)
/** 只在打开时给一次，避免点击时列被程序化滚动 */
const jumpDateId = ref('')
const jumpTimeId = ref('')

const days = computed<DeadlineDay[]>(() => buildDays(pinnedNow.value))
const slots = computed<DeadlineSlot[]>(() => days.value[dateIndex.value]?.slots ?? [])
const valueText = computed(() => deadlineText(props.deadline))
/** 弹层顶部的「将设为」预览：年月日时分一律走 utils/format.ts，不在模板里拼 */
const previewText = computed(() => {
  const slot = slots.value[timeIndex.value]
  return slot ? `将设为 ${formatDateTime(slot.ts)}` : '请选择时间'
})
const ladderHint = `自定义可选 ${DATE_SPAN} 天内 · 每 ${SLOT_STEP} 分钟一档`

function cellId(kind: string, index: number): string {
  return `${uid}-${kind}${index}`
}

function weekLabel(offset: number, day: Date): string {
  if (offset === 0) return '今天'
  if (offset === 1) return '明天'
  return WEEK_NAMES[day.getDay()] ?? ''
}

/** 本地 00:00 起算，跨月靠 Date 构造器自己进位（中国无夏令时，不做 DST 分支） */
function dayStartAt(base: Date, offset: number): number {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset).getTime()
}

/** 一天里的 30 分钟档位，只保留严格晚于 floor 的 —— 过去的档位根本不出现（第一层拦截） */
function buildSlots(dayStart: number, floor: number): DeadlineSlot[] {
  const out: DeadlineSlot[] = []
  for (let minute = 0; minute < 1440; minute += SLOT_STEP) {
    const ts = dayStart + minute * MINUTE_MS
    if (ts <= floor) continue
    out.push({ ts, label: `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}` })
  }
  return out
}

function buildDays(now: number): DeadlineDay[] {
  const base = new Date(now)
  const floor = now + MIN_FUTURE_MS
  const out: DeadlineDay[] = []
  for (let offset = 0; offset < DATE_SPAN; offset += 1) {
    const dayStart = dayStartAt(base, offset)
    const daySlots = buildSlots(dayStart, floor)
    // 今天全部档位都已过期 → 这一行不出现（14 天窗口不会因此缩到 13 天以下，明天起永远满档）
    if (daySlots.length === 0) continue
    const day = new Date(dayStart)
    out.push({
      dayStart,
      date: formatDate(dayStart),
      week: weekLabel(offset, day),
      slots: daySlots
    })
  }
  return out
}

/** 已选时刻落在哪一天：用「当天 00:00 ≤ ts < 次日 00:00」判，不用本地时区字符串比 */
function indexOfTs(list: DeadlineDay[], ts: number): number {
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]
    if (!item) continue
    if (ts >= item.dayStart && ts < item.dayStart + DAY_MS) return i
  }
  return -1
}

/** 快捷项算出的时刻不在 30 分钟格网上，重开弹层时吸附到最近的档位（差值相同取更早一档） */
function nearestSlotIndex(list: DeadlineSlot[], ts: number): number {
  if (list.length === 0) return 0
  let best = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]
    if (!item) continue
    const diff = Math.abs(item.ts - ts)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

/** 打开时把 index 对齐到已有值；没有值就落在第一个可选项上。全程不测高、不用 scroll-top（实测不生效） */
function syncSelection(deadline: number, now: number): void {
  const list = buildDays(now)
  const di = deadline > 0 ? indexOfTs(list, deadline) : -1
  dateIndex.value = di > 0 ? di : 0
  const day = list[dateIndex.value]
  const slotList = day ? day.slots : []
  timeIndex.value = deadline > 0 ? nearestSlotIndex(slotList, deadline) : 0
  jumpDateId.value = slotList.length > 0 ? cellId('d', dateIndex.value) : ''
  jumpTimeId.value = slotList.length > 0 ? cellId('t', timeIndex.value) : ''
}

function openSheet(): void {
  const now = peekNow()
  pinnedNow.value = now
  syncSelection(props.deadline, now)
  sheetVisible.value = true
  emit('sheet', true)
}

function closeSheet(): void {
  sheetVisible.value = false
  emit('sheet', false)
}

/** BasePopup 的 update:visible（点遮罩关闭走这里；取消/确定按钮走 closeSheet） */
function onVisibleChange(value: boolean): void {
  if (value) {
    openSheet()
    return
  }
  closeSheet()
}

function pickDate(index: number): void {
  dateIndex.value = index
  const list = slots.value
  if (timeIndex.value >= list.length) timeIndex.value = Math.max(0, list.length - 1)
}

function pickTime(index: number): void {
  timeIndex.value = index
}

/**
 * iOS 时钟式滚动震动（#74）：scroll 事件高频触发，按 ~100ms 节流成一次轻触，
 * 模拟时钟拨盘每过一档的 tick。用 wx.vibrateShort type=light —— uni 的旧 VibrateShortOptions
 * 类型不含 type，而本工程是 mp-weixin、wx 全局已有类型（request.ts/useUpload 同款）。
 * 模拟器或不支持的机型走 fail 静默，绝不打断滚动。
 */
const TICK_MS = 100
let lastTickAt = 0
function onColScroll(): void {
  const now = Date.now()
  if (now - lastTickAt < TICK_MS) return
  lastTickAt = now
  wx.vibrateShort({ type: 'light', fail: () => {} })
}

/** §8.1 的快捷项：deadline = 校准 now + days * 86400_000 */
function applyPreset(span: number): void {
  activePreset.value = span
  emit('change', peekNow() + span * DAY_MS)
}

function confirm(): void {
  const slot = slots.value[timeIndex.value]
  if (!slot) {
    showToastMsg('请选择时间')
    return
  }
  const now = peekNow()
  // 第二层拦截：弹层是冻结档位开的，用户停留期间可能已经把这一档跨过去了
  if (slot.ts <= now + MIN_FUTURE_MS) {
    showToastMsg('该时间已过，请重新选择')
    // 重建档位并把选择落回第一个仍然合法的格子；留在弹层，不 emit、不关闭
    pinnedNow.value = now
    syncSelection(0, now)
    return
  }
  emit('change', slot.ts)
  // 自定义时刻不属于任何快捷项，清掉高亮（用户裁定 #55）
  activePreset.value = null
  closeSheet()
}
</script>

<template>
  <view class="deadline-picker">
    <BaseCell section :title="label" :value="valueText" arrow @click="openSheet" />

    <view class="deadline-picker__quick">
      <view
        v-for="(preset, pi) in presets"
        :key="preset.days"
        class="deadline-picker__chip"
        :class="{
          'deadline-picker__chip--last': pi === presets.length - 1,
          'deadline-picker__chip--active': activePreset === preset.days
        }"
        hover-class="deadline-picker__chip--hover"
        @tap="applyPreset(preset.days)"
      >
        <text
          class="deadline-picker__chip-text"
          :class="{ 'deadline-picker__chip-text--active': activePreset === preset.days }"
          >{{ preset.label }}</text
        >
      </view>
    </view>
    <view class="deadline-picker__hint">
      <text class="deadline-picker__hint-text">{{ ladderHint }}</text>
    </view>

    <BasePopup :visible="sheetVisible" position="bottom" @update:visible="onVisibleChange">
      <view class="deadline-picker__sheet">
        <view class="deadline-picker__bar">
          <view
            class="deadline-picker__bar-btn"
            hover-class="deadline-picker__bar-btn--hover"
            @tap="closeSheet"
          >
            <text class="deadline-picker__bar-btn-text">取消</text>
          </view>
          <view class="deadline-picker__bar-title">
            <text class="deadline-picker__bar-title-text">选择截止时间</text>
          </view>
          <view
            class="deadline-picker__bar-btn"
            hover-class="deadline-picker__bar-btn--hover"
            @tap="confirm"
          >
            <text class="deadline-picker__bar-btn-text deadline-picker__bar-btn-text--confirm"
              >确定</text
            >
          </view>
        </view>

        <view class="deadline-picker__preview">
          <text class="deadline-picker__preview-text">{{ previewText }}</text>
        </view>

        <view class="deadline-picker__columns">
          <scroll-view
            class="deadline-picker__col"
            :scroll-y="true"
            :scroll-into-view="jumpDateId"
            @scroll="onColScroll"
          >
            <view
              v-for="(day, index) in days"
              :id="cellId('d', index)"
              :key="day.dayStart"
              class="deadline-picker__cell"
              :class="{ 'deadline-picker__cell--active': index === dateIndex }"
              hover-class="deadline-picker__cell--hover"
              @tap="pickDate(index)"
            >
              <text
                class="deadline-picker__cell-main"
                :class="{ 'deadline-picker__cell-main--active': index === dateIndex }"
                >{{ day.date }}</text
              >
              <text
                class="deadline-picker__cell-sub"
                :class="{ 'deadline-picker__cell-sub--active': index === dateIndex }"
                >{{ day.week }}</text
              >
            </view>
          </scroll-view>

          <scroll-view
            class="deadline-picker__col"
            :scroll-y="true"
            :scroll-into-view="jumpTimeId"
            @scroll="onColScroll"
          >
            <view
              v-for="(slot, index) in slots"
              :id="cellId('t', index)"
              :key="slot.ts"
              class="deadline-picker__cell"
              :class="{ 'deadline-picker__cell--active': index === timeIndex }"
              hover-class="deadline-picker__cell--hover"
              @tap="pickTime(index)"
            >
              <text
                class="deadline-picker__cell-main"
                :class="{ 'deadline-picker__cell-main--active': index === timeIndex }"
                >{{ slot.label }}</text
              >
            </view>
          </scroll-view>
        </view>
      </view>
    </BasePopup>
  </view>
</template>

<style lang="scss" scoped>
.deadline-picker {
  @include flex-column;
}

// 快捷三项等分一行：flex:1 实测可用（兼容清单 §2.2），刻意不用 flex-wrap（清单无条目）
.deadline-picker__quick {
  display: flex;
  flex-direction: row;
  padding: 0;
}

.deadline-picker__chip {
  @include flex-center;
  flex: 1;
  height: $tap-min-height;
  margin-right: $space-2;
  background-color: $color-fill;
  border-radius: $radius-round;
  transition: opacity $duration-fast;
}

// 末位去间距用真实修饰类，不用 :last-child —— 兼容清单 §1.4：Skyline 只认 class / ID / 标签选择器
.deadline-picker__chip--last {
  margin-right: 0;
}

.deadline-picker__chip--hover {
  opacity: 0.7;
}

// 选中快捷项高亮（用户裁定 #55）：与弹层内 --cell--active 同口径（浅蓝底 + 主题蓝字）；
// 颜色不加 transition —— 兼容清单只实测过 transform/width 过渡
.deadline-picker__chip--active {
  background-color: $color-primary-light;
}

.deadline-picker__chip-text {
  font-size: $font-sm;
  color: $color-text-2;
}

.deadline-picker__chip-text--active {
  color: $color-primary;
  font-weight: $font-weight-medium;
}

.deadline-picker__hint {
  padding-top: $space-1;
}

.deadline-picker__hint-text {
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}

.deadline-picker__sheet {
  @include flex-column;
  @include safe-area-bottom($space-3);
}

.deadline-picker__bar {
  @include flex-between;
  min-height: $tap-min-height;
  padding: 0 $space-3;
  @include hairline-bottom;
}

.deadline-picker__bar-btn {
  @include flex-center;
  min-width: $tap-min-height;
  height: $tap-min-height;
}

.deadline-picker__bar-btn--hover {
  opacity: 0.6;
}

.deadline-picker__bar-btn-text {
  font-size: $font-md;
  color: $color-text-3;
}

.deadline-picker__bar-btn-text--confirm {
  color: $color-primary;
  font-weight: $font-weight-medium;
}

.deadline-picker__bar-title {
  @include flex-center;
  flex: 1;
}

.deadline-picker__bar-title-text {
  font-size: $font-md;
  color: $color-text-1;
}

.deadline-picker__preview {
  @include flex-center;
  padding: $space-2 0;
}

.deadline-picker__preview-text {
  font-size: $font-sm;
  color: $color-text-2;
}

// 两列定高：scroll-view 要有确定高度才能滚；5 格 = 5 × 最小可点高度
.deadline-picker__columns {
  display: flex;
  flex-direction: row;
  height: $tap-min-height * 5;
}

.deadline-picker__col {
  flex: 1;
  // 显式定高而非 height:100%：真机 WebView 的百分比高度链不可靠（#78），
  // scroll-view 拿到确定高度才有内部滚动，否则触摸会落到外层页面（穿透）
  height: $tap-min-height * 5;
  padding: 0 $space-2;
}

.deadline-picker__cell {
  @include flex-column;
  align-items: center;
  justify-content: center;
  min-height: $tap-min-height;
  margin-bottom: $space-1;
  border-radius: $radius-md;
}

.deadline-picker__cell--active {
  background-color: $color-primary-light;
}

.deadline-picker__cell--hover {
  opacity: 0.7;
}

.deadline-picker__cell-main {
  font-size: $font-md;
  line-height: $line-tight;
  color: $color-text-1;
}

// 选中色不用后代选择器（规范按「Skyline 不支持」执行，兼容清单 §1.5），改成子节点自己挂修饰类
.deadline-picker__cell-main--active {
  color: $color-primary;
  font-weight: $font-weight-semibold;
}

.deadline-picker__cell-sub {
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-3;
}

.deadline-picker__cell-sub--active {
  color: $color-primary;
}
</style>
