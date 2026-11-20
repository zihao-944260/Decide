/**
 * user.updateProfile —— CloudContract['user.updateProfile']
 * `{ nickName, avatarUrl }` → `{ userInfo }`
 *
 * 契约要求两个字段都必填（前端选了图才能提交），和 login 的「可选补齐」不同，
 * 这里空串就是非法（1001），否则会出现改了头像把昵称清空的情况。
 */
import {
  BizError,
  ErrorCode,
  ServerLimit,
  SecScene,
  assertWritable,
  asString,
  checkText,
  isImageFileID,
  toUserInfo,
  userDao,
  type ActionSpec
} from 'common'

export const updateProfile: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const { openId, startedAt } = ctx
    const nickName = asString(payload.nickName, '昵称', ServerLimit.NICKNAME_MAX)
    const avatarUrl = asString(payload.avatarUrl, '头像', 512)

    if (!isImageFileID(avatarUrl) && !avatarUrl.startsWith('https://')) {
      throw new BizError(ErrorCode.INVALID_PARAM, '头像请使用小程序上传的图片')
    }
    // scene=1（资料）：昵称属于个人资料，风控阈值比评论更宽松但同样要过审
    await checkText(openId, nickName, SecScene.Profile, startedAt)

    const existing = await userDao.getByOpenId(openId)
    if (!existing) throw new BizError(ErrorCode.UNAUTHORIZED, '登录状态已失效，请重新进入小程序')
    // 禁言只封内容产出（计划/评论/投票），改资料不受影响；封禁才是全量拦截
    assertWritable(existing.status, false)

    const now = Date.now()
    await userDao.update(openId, { nickName, avatarUrl, updatedAt: now })
    const userInfo = toUserInfo({ ...existing, nickName, avatarUrl, updatedAt: now })
    return { userInfo }
  }
}
