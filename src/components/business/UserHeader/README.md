# UserHeader（T5.2）

「我的页」头部，三态：**未登录** / **已登录** / **编辑资料弹层**。
三个组件里**唯一允许碰 store 的**（§9.1-4 + §11 例外②）：读 `useUserStore().userInfo / isLoggedIn`，
提交只走 `useUserStore().updateProfile()`。**不 import api**，登录动作也不在这里做（见 emits）。

## Props（逐字抄自 `types.ts`）

```ts
export interface Props {
  /** 未登录态的说明文案（登录动作本身归页面/App.vue 的静默登录链路，这里只出文案与入口） */
  loginDesc?: string
  /** 昵称输入框的 maxlength。默认 -1 = 前端不限长 */
  nickNameMaxlength?: number
}
```

| prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `loginDesc` | `string` | `'登录后即可发起计划、参与表决'` | 未登录态副文案 |
| `nickNameMaxlength` | `number` | `-1` | **`-1` = 前端不限长**（微信 input 的 -1 语义）。为什么要留这个口子见「缺口 3」 |

## Emits（逐字抄自 `types.ts`）

```ts
export type Emits = {
  (e: 'login'): void
  (e: 'updated', info: UserInfo): void
}
```

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `login` | 无 | 未登录态点了整行。组件**不自己登录** —— 静默登录链路在 `App.vue`/页面（`userStore.login(profile, { silent: true })`），这里只报意图，避免出现第二条登录入口 |
| `updated` | `UserInfo`（云端回吐的最新值，store 已同步并落盘） | 保存成功。**失败不会走到这里**，失败文案已由 `api/request.ts` 统一 toast（§7.1），组件不再弹第二条 |

没有 props 承载列表/筛选，没有 slot，没有 `defineExpose`。

## 页面接线示例（T5.5 可逐字抄；这一段同时说明 StatCards / FilterTabs 的关系）

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import FilterTabs from '@/components/business/FilterTabs/index.vue'
import PlanList from '@/components/business/PlanList/index.vue'
import StatCards from '@/components/business/StatCards/index.vue'
import UserHeader from '@/components/business/UserHeader/index.vue'
import { fetchMyPlans } from '@/api/plan'
import { invalidatePage, usePageRefresh, type PageFetcher } from '@/composables'
import type { MyFilter } from '@/constants/plan'
import { usePlanStore } from '@/stores/plan'
import { useUserStore } from '@/stores/user'
import type { PageResult } from '@/types/api'
import type { PlanSummary, UserInfo } from '@/types/models'

const userStore = useUserStore()
const planStore = usePlanStore()

/**
 * 我的页唯一的 filter 真相。StatCards 的 :active 与 FilterTabs 的 :active 读同一个 ref，
 * 两个组件都不持有选中态 —— 分成两份就会「卡片高亮 A、列表是 B」。
 */
const activeFilter = ref<MyFilter>('created')
const planListRef = ref<InstanceType<typeof PlanList> | null>(null)

/** 数字来自 users 文档的冗余字段，进页面拉一次 userInfo 就够了，别发 user.stats（stores/user.ts 已注释） */
const stats = computed(() => userStore.stats)

/** fetcher 读 ref，filter 换了就换引用；组件不认识 api */
const fetcher: PageFetcher<PlanSummary> = (cursor, pageSize) =>
  fetchMyPlans({ cursor, pageSize, filter: activeFilter.value })

function onStatSelect(filter: MyFilter): void {
  activeFilter.value = filter // 卡片只把 filter 交回页面，剩下由下面的 watch 统一处理
}

function onFilterChange(filter: MyFilter): void {
  activeFilter.value = filter
}

function onPage(page: PageResult<PlanSummary>, append: boolean): void {
  planStore.setMyPage(activeFilter.value, page, append)
}

/** 切 filter：seed 命中该桶就不发请求（§8.7「切回不重新请求」），下拉刷新与 invalidate 走 force */
watch(activeFilter, async () => {
  await nextTick()
  void planListRef.value?.reload()
})

/** 保存资料成功：stats 已在 store 里跟着 userInfo 同步过，页面只需要知道「资料变过」 */
function onProfileUpdated(_info: UserInfo): void {
  invalidatePage('mine')
}

/** refreshing 传给 StatCards 的 loading：进页面重拉期间画占位条，不显示 0 */
const { refreshing } = usePageRefresh({
  key: 'mine',
  onRefresh: async ({ first }) => {
    await nextTick()
    if (userStore.isLoggedIn) await userStore.refresh()
    const list = planListRef.value
    if (!list) throw new Error('planList instance not mounted')
    await list.reload({ force: !first })
  },
})
</script>

<template>
  <view class="mine">
    <scroll-view type="list" class="mine__scroll">
      <!-- 未登录时组件自己出「点击登录」，页面只需接 login -->
      <UserHeader @login="onLogin" @updated="onProfileUpdated" />

      <!-- 未登录建议整块不渲染：stats 全 0 会被读成「你一条都没发起过」。口径见下面一节 -->
      <StatCards
        v-if="userStore.isLoggedIn"
        :stats="stats"
        :active="activeFilter"
        :loading="refreshing"
        @select="onStatSelect"
      />

      <FilterTabs :active="activeFilter" @change="onFilterChange" />

      <PlanList
        ref="planListRef"
        :fetcher="fetcher"
        :seed="() => planStore.myPage(activeFilter)"
        :on-page="onPage"
        :auto-load="false"
        @click="onCardClick"
        @long-press="onLongPress"
      />
    </scroll-view>
  </view>
</template>
```

（`onLogin` / `onCardClick` / `onLongPress` 是页面自己的活；长按管理归 T5.6。
这段示例只证明三个组件的契约能对接上，不构成 T5.5 的最终形状。）

## 为什么 StatCards 与 FilterTabs 是纯受控（本轮裁决，页面别绕过）

两个组件都不 import store、不发请求、不持有状态，数字与选中态一律由页面喂：

- **状态只有一个来源**。`planStore.myLists[filter]` 才是缓存的主人，`activeFilter` 才是选中态的主人。
  组件内部各自 `ref(active)` 的话，就会出现「卡片显示 A、tab 高亮 B、列表数据是 C」三份真相；
  §4.11 已经因为「一个列表实例服务四个 filter 桶，`loaded` 分不清桶」裁决过一次同类问题。
- **下一轮页面要接 `planStore`**，组件里藏状态就等于给页面埋一个必须知道的私有约定。
- 联动因此**必须在页面完成**：`StatCards` 的 `@select` 和 `FilterTabs` 的 `@change` 都写同一个
  `activeFilter`，两者从它读回来渲染高亮。组件之间零依赖（StatCards 只从 FilterTabs 的 `types.ts`
  取文案常量，不 import 组件）。

## 未登录时三张卡显示什么（口径）

`stats` 在未登录时是 `{ created: 0, joined: 0, ongoing: 0 }`（`stores/user.ts` 的 `EMPTY_STATS`，`logout()` 也会重置回它）。
**0 在这里是假话** —— 它陈述的是「你一条都没发起过」，而实际情况是「还没登录，没有你的数据」。

- 推荐：`v-if="userStore.isLoggedIn"` 整块不渲染（示例里那样）。
- 想保留版式高度不跳：传 `:loading="true"`，组件画占位条而不显示 0；`disabled` 可同时给上防点击。
- 不要做的：直接传 `stats` 让它显示 `0 0 0`，也不要 `v-show` 隐藏后仍让它可点（点了会把 filter 切到一个必然空列表上）。

## 编辑资料弹层：原生资料填写能力与兜底

弹层是 `BasePopup`（#78 起为 fixed 遮罩+面板，弃 page-container，兼容清单 §2.3.2）+ 两个微信原生能力：

1. `<button open-type="chooseAvatar" @chooseavatar="…">` 取头像；
2. `<input type="nickname" @input/@change/@blur="…">` 取昵称（微信昵称面板回填常常只触发 change/blur，所以三个都接）。

兜底逻辑（都已实现，不是 TODO）：

- **用户没选头像**（取消 / 低版本不回填 → `detail.avatarUrl` 为空）：清掉上一次的上传条目，
  保持原头像，**只改昵称照样能提交**。
- **`avatarUrl` 绝不提交空串**：契约里 `updateProfile` 两个字段都必填，云端空串直接 1001；
  所以「只改昵称」这条路径带上当前 `userInfo.avatarUrl` 原值。
  仅当原值本身为空（建档就没头像）才拦下并提示「请先选择头像」。
- **头像上传中**点保存：提示稍等，不拿旧 fileID 覆盖、也不把临时路径撞给云端。
- **头像上传失败**：退回原 `avatarUrl`，只保存昵称，并提示一次。
- 昵称与头像都没变化：直接收弹层，不发请求（`updateProfile` 无条件写 `updatedAt`，空提交会让「资料更新过」失去意义）。

## 已知缺口（上报主 agent，本目录一条都没动手改）

1. **`BaseButton` 没有 `open-type` 透传** → 头像按钮只能用原生 `<button>`，外观在本组件按 tokens 复刻了一份
   （`user-header__avatar-button`），微信默认按钮壳（内边距/底色/after 描边）只能靠 CSS 复位。
   建议：给 `BaseButton` 加可选 `openType?: string`（以及 `appParameter/sessionFrom` 之类按需要），
   透传到根 `<button>`；改完这个组件就能删掉自绘样式。**不许为这个在组件里写 `::after`**（兼容清单 §1.5 的编码红线）。
2. **`chooseAvatar` 回填的是本地临时路径，而云端只收 `cloud://` fileID 或 `https://`**
   （`cloudfunctions/user/src/handlers/updateProfile.ts:29` 的 `isImageFileID` 校验）。
   所以头像必须先传上云存储，出口只能是 `useUpload`（§11），但 `useUpload` 公开的取数入口只有
   `pick()`（内部 `uni.chooseMedia`），**没有「拿一个外部临时路径直接上传」的方法**。
   本组件用它的公开成员组合出这条路径：`files.value = [item]` + `retry(item.id)`（retry 对非 done 项就是上传）。
   建议：`useUpload` 增 `uploadLocal(filePath: string): UploadItem`（或 `addLocal()` + 自动上传），
   把这个「用公开成员凑出来的私有约定」收掉 —— 否则编辑器线的 `ImageUploader` 将来接微信素材选择时会照抄这套 hack。
   另注：走这条路**绕过了 `useUpload.pick()` 里的格式/体积校验**（`chooseAvatar` 的 detail 没有 size/宽高可校验），
   体积上限只有云存储自己兜。
3. **前端 `constants/plan.ts` 的 `Limit` 没有昵称长度上限**。唯一权威值在服务端：
   `cloudfunctions/common/src/constants.ts:59` 的 `ServerLimit.NICKNAME_MAX = 30`，超限 `user.updateProfile` 报 1001。
   组件没发明这个数字：默认 `nickNameMaxlength = -1`（不限长），超限吃一次云端往返 + `request.ts` 的统一 toast。
   建议：加 `Limit.NICKNAME_MAX = 30`（与云端同源，改一处要改两处），页面接
   `:nick-name-maxlength="Limit.NICKNAME_MAX"`，同时组件的 `clampNick()` 会自动生效
   （微信昵称面板能回填比 input maxlength 更长的串，本地截断必须在提交前做一次）。
4. **`MY_FILTER_LABELS`（筛选文案表）落在 `FilterTabs/types.ts` 而不是 `constants/plan.ts`**。
   因为 `StatCards` 的卡片标签必须与 tab 标签逐字一致，只能有一个人写。
   建议：上收到 `src/constants/plan.ts`（与 `MY_FILTERS` 同域），届时通知我改两处 import。

## 待真机复核（模拟器通过 ≠ 真机通过，M0）

| 项 | 状态 | 兜底 |
| --- | --- | --- |
| `button open-type="chooseAvatar"` 在 Skyline 下的表现 | **兼容清单里没有条目**（§2 全表未测）。按钮能否正常拉起微信头像面板、`chooseavatar` 事件名在 glass-easel 下是否原名透传，都未验证 | 事件没触发 = 不选头像，「只改昵称」路径可提交；上传没回来 = 保存时退回原 avatarUrl |
| 原生 `<button>` 里嵌自定义组件（`BaseAvatar`） | 未验证：小程序 button 的内容区历史上对子节点有额外限制 | 真机若空白/不渲染，改法是把预览图放 button **外面**，button 退化成「更换头像」文字按钮（结构已按这个改法预留：`avatarPicked` 独立 computed） |
| `input type="nickname"` 在 Skyline 下 | 兼容清单里没有条目；`type="nickname"` 的微信昵称面板是否弹出未验证 | 退化成普通文本输入（`type="nickname"` 只是附加能力，不弹面板也能打字提交）；blur 载荷无 `value` 时**不覆盖草稿**（`nickValueOf` 返回 null 的分支） |
| `BasePopup` 弹层作为 `scroll-view type="list"` 的后代节点 | **组合已消解（#78，2026-11-13）**：BasePopup 改 fixed 遮罩+面板（兼容清单 §2.3.2），不再含 page-container；fixed 全屏覆盖与列表嵌套无关 | 无需兜底；弹层内触摸行为仍随 #78 真机复验 |
| 头像上传（`useUpload` → `wx.cloud.uploadFile`）用 chooseAvatar 的临时路径 | T0.7 只实测过 `chooseMedia` 的临时路径 | 失败即回退原头像（见上面的兜底） |

## Skyline 约束落地

无 `inline-block`、无 `-webkit-line-clamp`（昵称按 `utils/format` 的 `truncate` + `textWidth` 口径截 12 个中文字宽，
CSS 单行 ellipsis 只做第二保险）、无后代/子代/伪元素选择器、无 `list-view`/`grid-view`/`sticky-*`、
无 `boundingClientRect`/`SelectorQuery`（视口外节点取矩形会永久挂起，兼容清单 §2.3）、
所有文字包 `<text>`、可点区域 `min-height: $tap-min-height`、样式 `scoped` + BEM + 全 token。
