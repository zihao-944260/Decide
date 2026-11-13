import type { UserInfo } from '@/types/models'

export interface Props {
  /** 未登录态的说明文案（登录动作本身归页面/App.vue 的静默登录链路，这里只出文案与入口） */
  loginDesc?: string
  /**
   * 昵称输入框的 `maxlength`，**默认 `Limit.NICKNAME_MAX`（30）**，与云端
   * `ServerLimit.NICKNAME_MAX`（cloudfunctions/common/src/constants.ts:59）同值 ——
   * `user.updateProfile` 超限直接 1001，所以前端必须自己限。
   * 保留成 prop 只为了「页面想更严」的场景；传 -1 = 前端不限长，不建议。
   */
  nickNameMaxlength?: number
}

export type Emits = {
  /**
   * 未登录态点了整行。**组件不自己登录**：静默登录链路在 App.vue / 页面（`userStore.login(..., { silent: true })`），
   * 这里只负责把「用户想登录」这件事报出去，避免出现第二条登录入口。
   */
  (e: 'login'): void
  /**
   * 资料保存成功，载荷是云端回吐的**最新** `UserInfo`（store 已同步并落盘）。
   * 页面用它做后续：`invalidatePage('mine')` / 重拉列表等。失败不会走到这里 ——
   * 失败提示已由 `api/request.ts` 统一 toast（§7.1），组件不再弹第二条。
   */
  (e: 'updated', info: UserInfo): void
}

/**
 * `button open-type="chooseAvatar"` 的原生载荷。
 * 字段全部按可选处理：用户在微信头像面板里取消、或低版本基础库不回填，都会走到 undefined 分支，
 * 那时**只改昵称也必须能提交**（README 的兜底项）。
 */
export interface ChooseAvatarEvent {
  detail?: {
    avatarUrl?: string
  }
}

/** `input type="nickname"` 的原生载荷（@input / @change / @blur 三个事件形状一致） */
export interface NicknameInputEvent {
  detail?: {
    value?: string
  }
}
