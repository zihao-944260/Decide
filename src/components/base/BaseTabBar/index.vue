<script setup lang="ts">
/**
 * BaseTabBar —— 底部悬浮胶囊导航（形态对齐用户给的参考图：白底胶囊 + 选中项内衬 + 主色文字）。
 *
 * 为什么不直接用原生 tabBar：微信的原生条由客户端在页面之外绘制，`pages.json` 只能改颜色、
 * 文字、图标，改不出「悬浮胶囊」和「选中项内衬」这两种形态，所以这里自绘。
 *
 * 收起原生条走的是 `pages.json → tabBar.custom: true` + `src/custom-tab-bar/` 里的 0×0 空壳组件，
 * 不是 `uni.hideTabBar()`：Skyline 下 hideTabBar 只擦除绘制，不还回那一条预留带（模拟器实测
 * 收起前后 `windowHeight` 都是 762，胶囊底下始终露出 82px 窗口黑底）；改成 custom 后视口回到
 * 整屏 844，且空壳不接管点击、也不会像真正的原生自定义条那样盖住页面内容。
 * `pages.json → tabBar` 段必须保留：它决定这些页面是 tab 页（`switchTab` 的前提），
 * 数据与本组件的 `TABBAR_ITEMS` 一一对应，改一处必须改两处。
 *
 * 定位方式：`position: fixed` 悬浮在列表之上，与首页发布 pill 同款 —— 自己不画底色、也不占普通流，
 * 列表因此铺到视口底、从胶囊四周透出来。代价是滚动到底的让位必须由页面自己在**滚动内容尾部**垫高
 * （PlanList 的 floatClearance），否则末卡会永久藏在胶囊下面。
 * 写在页面根节点的最后一个子节点只是惯例：fixed 之后它在 flex 列里已经不参与布局。
 *
 * ── 高亮内衬是一颗会滑的滑块 ────────────────────────────────────────
 * 内衬不是「每项各自的背景」，而是胶囊里唯一一颗绝对定位节点：槽位宽 = 1/项数，
 * 位置只靠 `translateX(格数 * 100%)` 表达，所以增删导航项不需要改任何样式。
 * 果冻感由两层叠出来，各走一条独立的时间轴：
 * - 外层槽位：`transition` + 轻微过冲 bezier（控制点 >1，滑过头约 5px 再回落）；
 * - 内层本体：`@keyframes` 的 squash-stretch（起步顺行进方向拉长 → 落点拍扁鼓起 → 衰减回弹）。
 * 两层必须分开，是因为 transform 只有一个：位移和形变写在同一个节点上会互相覆盖。
 *
 * 重启 keyframes 靠 `--odd` / `--even` 两个类名轮换（两段内容逐字相同、只是动画名不同）：
 * 小程序没有 DOM，改不动 animation-name 也强制不了重排，换名是让同一段形变再播一次的唯一办法。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { TABBAR_ITEMS, TABBAR_SLOT_WIDTH, type TabBarKey } from '@/constants/tabbar'
import { useTabBarStore } from '@/stores/tabbar'
import type { Props } from './types'

/**
 * 挂载首帧到起跑之间的等待。真下一帧没有可靠的口子（Skyline 不给 JS 侧 rAF），
 * 给 32ms 是让「起点」先被画出去，否则起点和终点写在同一帧里，transition 直接不起作用。
 */
const SLIDE_START_MS = 32

const props = defineProps<Props>()
const tabBar = useTabBarStore()

// setup 期先认领：本页出现即说明它就是当前 tab（冷启动直达非首页时也靠这步把 store 掰回来）。
// 正常切页时点击回调已经先写过一次，这里是空操作。
tabBar.go(props.active)

const activeKey = computed(() => tabBar.active)
const targetIndex = computed(() => tabBar.activeIndex)

/**
 * 滑块真正画在哪一格。初值取 `prev`：首次进入本页时胶囊是刚挂载的，
 * 起点得摆回上一项，再由 onMounted 补跑那一段滑动。
 */
const sliderIndex = ref(tabBar.prevIndex)
const jellySeq = ref(0)

const sliderStyle = computed(() => ({
  width: `${TABBAR_SLOT_WIDTH}%`,
  transform: `translateX(${sliderIndex.value * 100}%)`
}))

/** seq=0 是没动过：不给动画类，避免首帧凭空抖一下 */
const jellyClass = computed(() => {
  if (jellySeq.value === 0) return ['base-tabbar__jelly']
  return [
    'base-tabbar__jelly',
    jellySeq.value % 2 === 1 ? 'base-tabbar__jelly--odd' : 'base-tabbar__jelly--even'
  ]
})

function onSelect(key: TabBarKey, url: string): void {
  // 点当前项不发 switchTab：微信会把它当成一次真实的 tab 跳转，页面随之重建、列表重头加载
  if (key === activeKey.value) return
  tabBar.go(key)
  uni.switchTab({ url })
}

// 已在页面栈里的 tab：store 一变当场就滑（此刻本页还看得见，这一下就是点击反馈）
watch(targetIndex, (to) => {
  jellySeq.value += 1
  sliderIndex.value = to
})

onMounted(() => {
  if (sliderIndex.value === targetIndex.value) return
  jellySeq.value += 1
  setTimeout(() => {
    sliderIndex.value = targetIndex.value
  }, SLIDE_START_MS)
})

/**
 * 一个节点一个类名 + 平铺 class（不用后代/子代/伪元素选择器，兼容清单 §1.5 的编码红线）；
 * 选中态只落文字与图标两处，内衬已经由那颗滑块节点自己表达，不再挂在项目上。
 */
function labelClass(key: TabBarKey): string[] {
  const names = ['base-tabbar__label']
  if (key === activeKey.value) names.push('base-tabbar__label--active')
  return names
}
</script>

<template>
  <view class="base-tabbar">
    <view class="base-tabbar__capsule">
      <!-- 滑块本体排在内容之前：小程序没有 z-index 层级习惯用法，同层文档流里后画的盖前画的 -->
      <view class="base-tabbar__slider" :style="sliderStyle">
        <view :class="jellyClass" />
      </view>

      <view
        v-for="item in TABBAR_ITEMS"
        :key="item.key"
        class="base-tabbar__item"
        hover-class="base-tabbar__item--hover"
        @tap="onSelect(item.key, item.url)"
      >
        <image
          class="base-tabbar__icon"
          :src="item.key === activeKey ? item.activeIcon : item.icon"
          mode="aspectFit"
        />
        <text :class="labelClass(item.key)">{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
// 整条导航是浮在列表之上的悬浮层，与首页发布 pill 同款：**不画底色、不占普通流**，
// 列表一路铺到视口底、从胶囊四周透出来（滚动到底的让位由页面自己在滚动内容尾部垫，见下）。
// 定位框只圈到「胶囊那一圈」：bottom 已经把 $tabbar-bottom-gap + 安全区让出去，盒子高=胶囊高，
// 胶囊底下那条 home indicator 区不再属于导航。左右仍留 $space-4 边距 —— 那两条约 16px 宽的
// 透明带是唯一的代价：小程序没有 pointer-events 可用，盒子铺到哪儿点击就吃到哪儿，
// 所以宁可只多盖两侧边条，也不铺满整屏宽（铺满会把列表下半屏的滚动和点击全吃掉）。
.base-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(#{$tabbar-bottom-gap} + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  padding: 0 $space-4;
}

// position: relative 是给滑块当定位参照的：滑块的 left/top 与百分比宽度都相对胶囊算。
// overflow:hidden 在这里只是**兜底**，不是把滑块关进胶囊的手段 —— 真正保证不冲出导航的是几何：
// $tabbar-pill-inset 留出的内衬比「最大横向形变 + 落点过冲」之和还宽（算账见 tokens 注释），
// 滑块离胶囊沿始终有 5px 左右余量。裁剪只留给以后真把预算调爆的情况，那时它是最后一道视觉底线。
// 裁剪随 border-radius 一起做（兼容清单「border-radius + overflow:hidden 裁剪 ✅」）。
.base-tabbar__capsule {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
  height: $tabbar-height;
  background-color: $color-bg-card;
  border-radius: $radius-round;
  box-shadow: $shadow-tabbar;
}

// 滑块槽位：绝对定位、等分宽、只靠 translateX 位移；padding 让本体在槽内再收一圈，不贴边。
// 一圈用同一个值（$tabbar-pill-inset），横竖拆成两个值的那天就是「首项左边距和上下不一样」的成因。
.base-tabbar__slider {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: row;
  padding: $tabbar-pill-inset;
  transition: transform $duration-tabbar-slide $ease-tabbar-spring;
}

// 本体只负责「长什么样 + 果冻形变」，位移归槽位，两条 transform 不互相覆盖。
// 圆角用 $radius-round（= 高的一半，胶囊形）而不是固定档位：外层胶囊也是这个圆角，
// 而内衬横竖相等 ⇒ 内外两层圆角之差 = 内衬 = 圆心位移 0 ⇒ 两圈弧线严格同心，
// 于是「色块离胶囊沿的距离」在四边和两段端点弧上都等于 $tabbar-pill-inset。
.base-tabbar__jelly {
  flex: 1;
  background-color: $color-fill;
  border-radius: $radius-round;
}

.base-tabbar__jelly--odd {
  animation: base-tabbar-jelly-odd $duration-tabbar-slide linear;
}

.base-tabbar__jelly--even {
  animation: base-tabbar-jelly-even $duration-tabbar-slide linear;
}

// 两段逐字相同，只有名字不同 —— 换名就是重启，见文件头。
//
// 形变按「一次滑动 = 一块果冻被甩出去、撞上终点、回弹、停住」排，不按期拍抖动排：
//   22% 起步加速 → 顺运动方向拉长（这一段速度最高，bezier 前 25% 就跑完七成多路程）
//   52% 收尾减速 → 拉长收回
//   68% 撞上落点 → 沿运动方向压扁、垂直方向鼓起。这个点不是猜的：$ease-tabbar-spring
//       的过冲峰值 1.0204 正好落在时长的 67%（数值解出来的），果冻「拍在墙上」就该在这一刻
//   85% 回弹 → 鼓起收回、反冲拉长
//   100% 停
// 振幅全程 ≤6%，且后一次摆动比前一次小，是衰减振荡而不是等幅抖。
// 之前「太生硬」的根源：26% 一次就拉到 22%/压到 20%，而且放大发生在落点附近 —— 那是撞墙，不是果冻。
@keyframes base-tabbar-jelly-odd {
  0% {
    transform: scale(1, 1);
  }
  22% {
    transform: scale(1.05, 0.952);
  }
  52% {
    transform: scale(0.978, 1.014);
  }
  68% {
    transform: scale(0.94, 1.056);
  }
  85% {
    transform: scale(1.024, 0.98);
  }
  100% {
    transform: scale(1, 1);
  }
}

@keyframes base-tabbar-jelly-even {
  0% {
    transform: scale(1, 1);
  }
  22% {
    transform: scale(1.05, 0.952);
  }
  52% {
    transform: scale(0.978, 1.014);
  }
  68% {
    transform: scale(0.94, 1.056);
  }
  85% {
    transform: scale(1.024, 0.98);
  }
  100% {
    transform: scale(1, 1);
  }
}

// 每一项等分胶囊宽度，图标与文字居中排在滑块之上
.base-tabbar__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.base-tabbar__item--hover {
  opacity: 0.6;
}

.base-tabbar__icon {
  width: $tabbar-icon-size;
  height: $tabbar-icon-size;
}

.base-tabbar__label {
  margin-top: $space-1;
  font-size: $font-xs;
  line-height: $line-tight;
  color: $color-text-2;
}

.base-tabbar__label--active {
  font-weight: $font-weight-semibold;
  color: $color-primary;
}
</style>
