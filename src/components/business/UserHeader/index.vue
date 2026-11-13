<script setup lang="ts">
/**
 * UserHeader（T5.2）——「我的页」头部：未登录态 / 已登录态 / 编辑资料弹层三态。
 *
 * 三个组件里**只有这一个允许碰 store**（§9.1-4：business 组件可用 composable/store；
 * §11 例外②点名 UserHeader 可以调 `useUserStore().updateProfile()`）。提交只有 updateProfile 这一条路。
 *
 * ── 缺口收口状态（上报后由主 agent 落地的共享层改动）────────────────────────
 * 1. `BaseButton` 没有 `open-type` 透传 → 裁决**不修**：`@chooseavatar` 必须直接挂在 `<button>` 节点上，
 *    套一层组件把它隔远一个节点，透传的是属性而不是事件绑定，风险大于收益。头像按钮保持原生写法。
 * 2. `chooseAvatar` 回填的是**本地临时路径**（wxfile://…），而 `user.updateProfile` 只收 `cloud://`
 *    fileID 或 `https://` 外链（cloudfunctions/user/src/handlers/updateProfile.ts:29 的 isImageFileID）
 *    → 必须先传云存储。现已由 `useUpload.uploadLocal(path)` 提供公开入口（原先手搓 UploadItem +
 *    `files.value = [item]` + `retry()` 的写法绕过了 validate/remaining，已删除）。
 * 3. 昵称上限已进 `Limit.NICKNAME_MAX`（= 云端 `ServerLimit.NICKNAME_MAX` 30），本组件默认取它，
 *    页面不必再注入；prop 保留，用于特殊场景覆盖。
 * 4. `open-type="chooseAvatar"` 与 `input type="nickname"` 在 Skyline 下**没有实测条目**（兼容清单 §2 全表无）
 *    → 待真机复核；兜底逻辑已写全：不选头像也能只改昵称提交。
 */
import { computed, ref } from 'vue'
import BaseAvatar from '@/components/base/BaseAvatar/index.vue'
import BaseButton from '@/components/base/BaseButton/index.vue'
import BasePopup from '@/components/base/BasePopup/index.vue'
import { showToastMsg, useUpload, type UploadItem } from '@/composables'
import { Limit } from '@/constants/plan'
import { useUserStore } from '@/stores/user'
import { truncate } from '@/utils/format'
import type { ChooseAvatarEvent, Emits, NicknameInputEvent, Props } from './types'

/** 昵称单行显示预算（中文字宽）：Skyline 无 line-clamp，按 utils/format 的 textWidth 口径 JS 截字（§11.1） */
const NAME_MAX_WIDTH = 12
/** 昵称为空时的显示，与云端 mapper 的建档兜底串保持同一口径（cloudfunctions/common/src/mapper.ts:28） */
const EMPTY_NAME = '点子商量局用户'

const props = withDefaults(defineProps<Props>(), {
  loginDesc: '登录后即可发起计划、参与表决',
  nickNameMaxlength: Limit.NICKNAME_MAX,
})
const emit = defineEmits<Emits>()

const userStore = useUserStore()
const info = computed(() => userStore.userInfo)
const loggedIn = computed(() => userStore.isLoggedIn)

const editing = ref(false)
const saving = ref(false)
const draftName = ref('')

/** 头像上传：全工程唯一出口 useUpload（组件内不出现第二个 wx.cloud / chooseImage） */
const uploader = useUpload({ max: 1, dir: 'avatars' })
const avatarItem = computed<UploadItem | null>(() => uploader.files.value[0] ?? null)
/** 选完立刻可见的本地临时路径 —— 上传没回来之前也用它预览，不闪成空头像 */
const avatarPicked = computed(() => avatarItem.value?.localPath ?? '')
/** 已落到云存储的 fileID；只有它才有资格进 updateProfile */
const avatarFileID = computed(() => avatarItem.value?.fileID ?? '')
const avatarBusy = computed(() => !!avatarItem.value && avatarItem.value.status !== 'done')
const avatarFailed = computed(() => avatarItem.value?.status === 'error')
const avatarHint = computed(() => {
  if (avatarBusy.value) return '头像上传中…'
  if (avatarFailed.value) return '头像上传失败，本次只会保存昵称'
  return '点击从微信选择头像'
})

const nameText = computed(() => {
  const nick = (info.value?.nickName ?? '').trim()
  return nick ? truncate(nick, NAME_MAX_WIDTH) : EMPTY_NAME
})

/**
 * 原生事件载荷读取。形参收 `unknown` 是工具链的原因：uni-app-types 的 vue 插件在本地加载失败
 * （见 scripts/check-templates.mjs 头注释），`<input>` 于是按 DOM 的 InputHTMLAttributes 校验，
 * `@blur` 期望 FocusEvent，直接标注小程序载荷会类型冲突。真正的字段形状由 types.ts 的
 * `ChooseAvatarEvent` / `NicknameInputEvent` 描述，这里做一次收窄。
 */
function avatarPathOf(event: unknown): string {
  const detail = (event as ChooseAvatarEvent | null)?.detail
  const value = detail?.avatarUrl
  return typeof value === 'string' ? value : ''
}

/** null = 这次事件根本没带值（部分机型 blur 的 detail 里没有 value），调用方据此**不改动**草稿 */
function nickValueOf(event: unknown): string | null {
  const detail = (event as NicknameInputEvent | null)?.detail
  const value = detail?.value
  return typeof value === 'string' ? value : null
}

/**
 * 昵称收口。默认 `nickNameMaxlength = Limit.NICKNAME_MAX`（与云端 `ServerLimit.NICKNAME_MAX` 同值），
 * 超长的部分在这里截掉而不是交给云端回 1001：用户已经点完保存才被告知「太长了」是最差的一版。
 * 必须在 JS 里截而只靠 `maxlength` 不够 —— 微信昵称面板的回填会绕过 input 自己的 maxlength。
 */
function clampNick(value: string): string {
  const max = props.nickNameMaxlength
  return max > 0 && value.length > max ? value.slice(0, max) : value
}

function onLoginTap(): void {
  // 登录链路在页面/App.vue（静默登录 + login(profile)），这里只报意图，绝不自建第二条
  emit('login')
}

function openEditor(): void {
  const current = info.value
  if (!current) return
  draftName.value = current.nickName ?? ''
  // 上次的上传条目（含失败态）不清掉就会串进这次的提交，max:1 所以直接整组重置
  uploader.clear()
  editing.value = true
}

/** chooseAvatar 回填：路径为空（取消 / 未返回）就保持原头像，只改昵称这条路照样能提交 */
function onChooseAvatar(event: unknown): void {
  const path = avatarPathOf(event)
  if (!path) {
    uploader.clear()
    return
  }
  // 重选 = 换掉上一张：max:1 时 uploadLocal 会按「最多 1 张」拒掉，所以先清再传。
  // 在途那条一起清掉是对的 —— patch() 找不到 id 就 no-op，不会写回一个已废弃的条目。
  uploader.clear()
  uploader.uploadLocal(path)
}

/** @input / @change / @blur 三个都接：微信昵称面板回填往往只走 change/blur */
function onNicknameInput(event: unknown): void {
  const value = nickValueOf(event)
  // 载荷没带值就不动草稿（用户真的清空输入框时 @input 会给空串，那条照常落到 draft）
  if (value !== null) draftName.value = value
}

async function save(): Promise<void> {
  const current = info.value
  if (!current || saving.value) return

  const nickName = clampNick(draftName.value.trim())
  if (!nickName) {
    showToastMsg('请先填写昵称')
    return
  }
  if (avatarBusy.value) {
    showToastMsg('头像上传中，稍等一下')
    return
  }

  // 契约里两个字段都必填，云端空串直接 1001，所以「只改昵称」必须把当前 avatarUrl 原值带上，
  // 绝不提交空串去覆盖云端（文件头缺口 2：新选的头像要先换成 fileID 才敢提交）。
  const avatarUrl = avatarFileID.value || current.avatarUrl
  if (!avatarUrl) {
    showToastMsg('请先选择头像')
    return
  }
  // 没改动就不发请求：updateProfile 无条件写 updatedAt，空提交会让「资料更新过」这件事失去意义
  if (nickName === current.nickName && avatarUrl === current.avatarUrl) {
    editing.value = false
    return
  }
  // 头像传失败时退回原 avatarUrl：昵称这条改动不该被一次上传失败连带拖死
  if (avatarFailed.value) showToastMsg('头像上传失败，本次只保存昵称')

  saving.value = true
  try {
    const updated = await userStore.updateProfile({ nickName, avatarUrl })
    showToastMsg('资料已更新')
    editing.value = false
    emit('updated', updated)
  } catch {
    // 失败文案已由 api/request.ts 统一 toast（§7.1），这里不弹第二条，弹层保持打开让用户改
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="user-header">
    <!-- ① 未登录：整行可点，点了只 emit('login') -->
    <view
      v-if="!loggedIn"
      class="user-header__row"
      hover-class="user-header__row--hover"
      @tap="onLoginTap"
    >
      <BaseAvatar class="user-header__avatar" size="lg" />
      <view class="user-header__main">
        <text class="user-header__login">点击登录</text>
        <text class="user-header__desc">{{ loginDesc }}</text>
      </view>
    </view>

    <!-- ② 已登录 -->
    <view v-else class="user-header__row">
      <BaseAvatar class="user-header__avatar" :src="info?.avatarUrl" size="lg" />
      <view class="user-header__main">
        <text class="user-header__name">{{ nameText }}</text>
        <text class="user-header__desc">头像与昵称来自微信资料</text>
      </view>
      <!-- ③ 编辑弹层的入口；BaseButton 够用（这里不需要 open-type） -->
      <BaseButton class="user-header__edit" type="secondary" size="sm" @click="openEditor">
        <text class="user-header__edit-text">编辑资料</text>
      </BaseButton>
    </view>

    <!--
      编辑弹层：BasePopup（#78 起为 fixed 遮罩+面板，弃 page-container，兼容清单 §2.3.2）。
      本页是 Skyline，无文档级滚动穿透问题；弹层内原生资料填写能力仍待真机复核（见 README）。
    -->
    <BasePopup v-model:visible="editing" position="bottom" closable>
      <view class="user-header__form">
        <text class="user-header__form-title">编辑资料</text>

        <view class="user-header__field">
          <text class="user-header__label">头像</text>
          <!--
            原生 button + open-type="chooseAvatar"：BaseButton 没有 open-type 透传（缺口 1），
            所以这里不套 BaseButton，按钮外观自己按 tokens 复刻。Skyline 下无实测条目 → 待真机复核。
          -->
          <button
            class="user-header__avatar-button"
            hover-class="user-header__avatar-button--hover"
            open-type="chooseAvatar"
            @chooseavatar="onChooseAvatar"
          >
            <BaseAvatar :src="avatarPicked || info?.avatarUrl" size="lg" />
          </button>
          <text class="user-header__hint">{{ avatarHint }}</text>
        </view>

        <view class="user-header__field">
          <text class="user-header__label">昵称</text>
          <!-- 微信昵称填写能力：type="nickname"，用户可直接选用微信昵称；Skyline 下无实测条目 → 待真机复核 -->
          <input
            class="user-header__input"
            type="nickname"
            :value="draftName"
            :maxlength="nickNameMaxlength"
            placeholder="点击填写昵称"
            @input="onNicknameInput"
            @change="onNicknameInput"
            @blur="onNicknameInput"
          />
        </view>

        <BaseButton type="primary" block :loading="saving" @click="save">
          <text class="user-header__submit-text">保存</text>
        </BaseButton>
      </view>
    </BasePopup>
  </view>
</template>

<style lang="scss" scoped>
.user-header {
  @include flex-column;
  padding: $space-3;
  background-color: $color-bg-card;
}

.user-header__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  min-height: $tap-min-height;
}

.user-header__row--hover {
  opacity: 0.85;
}

.user-header__avatar {
  flex-shrink: 0;
}

.user-header__main {
  @include flex-column;
  flex: 1;
  min-width: 0;
  margin-left: $space-2;
}

.user-header__name {
  @include ellipsis-1;
  font-size: $font-lg;
  font-weight: $font-weight-medium;
  color: $color-text-1;
}

.user-header__login {
  font-size: $font-lg;
  font-weight: $font-weight-medium;
  color: $color-primary;
}

.user-header__desc {
  @include ellipsis-1;
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-text-3;
}

.user-header__edit {
  flex-shrink: 0;
  margin-left: $space-2;
}

.user-header__edit-text {
  font-size: $font-sm;
  color: $color-primary;
}

.user-header__form {
  @include flex-column;
  padding: $space-4;
}

.user-header__form-title {
  margin-bottom: $space-3;
  font-size: $font-lg;
  font-weight: $font-weight-medium;
  color: $color-text-1;
}

.user-header__field {
  @include flex-column;
  align-items: flex-start;
  margin-bottom: $space-3;
}

.user-header__label {
  margin-bottom: $space-1;
  font-size: $font-sm;
  color: $color-text-2;
}

// 微信 button 自带壳（内边距/底色/after 边框），这里按「透明无壳容器」复位一遍；
// 伪元素在本工程按不可用处理（兼容清单 §1.5），所以真机上若仍有默认描边，改法应该是给 BaseButton 加
// open-type 透传（缺口 1 上报项），而不是在本文件里写 ::after。
.user-header__avatar-button {
  @include flex-center;
  min-width: $avatar-lg;
  min-height: $avatar-lg;
  padding: 0;
  margin: 0;
  background-color: transparent;
  border: none;
  border-radius: $radius-round;
}

.user-header__avatar-button--hover {
  opacity: 0.8;
}

.user-header__hint {
  margin-top: $space-1;
  font-size: $font-xs;
  color: $color-text-3;
}

.user-header__input {
  @include tappable;
  width: 100%;
  padding: 0 $space-2;
  font-size: $font-md;
  color: $color-text-1;
  background-color: $color-fill;
  border-radius: $radius-md;
}

.user-header__submit-text {
  font-size: $font-md;
  color: $color-text-inverse;
}
</style>
