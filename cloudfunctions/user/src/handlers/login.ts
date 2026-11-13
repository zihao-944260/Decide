/**
 * user.login —— CloudContract['user.login']
 * `{ nickName?, avatarUrl? }` → `{ userInfo, isNew }`
 *
 * 静默建档：openId 第一次出现就落一条 users 记录，不需要显式注册动作。
 * `users._id` 直接用 openId，所以并发首登会撞唯一主键 —— 那不算失败，
 * 兜回「已存在」再读一次即可（§5.1 的 openId 唯一索引还没在控制台建，先靠 _id 兜）。
 *
 * stats 是异步冗余字段（§5.1「允许短暂不一致」），登录路径**不重算**：
 * 冷启动即登录时三条 count 查询会让首屏多等 100~200ms，而权威统计由 user.stats 负责。
 */
import {
  BizError,
  ErrorCode,
  ServerLimit,
  SecScene,
  UserStatus,
  asStringAllowEmpty,
  checkText,
  isDuplicateKeyError,
  isImageFileID,
  toUserInfo,
  userDao,
  type ActionSpec,
  type UserDoc,
  type UserInfo,
} from 'common'

export const login: ActionSpec = {
  kind: 'write',
  run: async (payload, ctx) => {
    const { openId, startedAt } = ctx
    const now = Date.now()
    const nickName = asStringAllowEmpty(payload.nickName, '昵称', ServerLimit.NICKNAME_MAX)
    const avatarUrl = asStringAllowEmpty(payload.avatarUrl, '头像', 512)

    // 头像只接受云存储 fileID 或微信头像 https 外链；外链图片无法送审，但微信头像本身已过审
    if (avatarUrl && !isImageFileID(avatarUrl) && !avatarUrl.startsWith('https://')) {
      throw new BizError(ErrorCode.INVALID_PARAM, '头像格式不正确')
    }
    if (nickName) await checkText(openId, nickName, SecScene.Profile, startedAt)

    const existing = await userDao.getByOpenId(openId)
    if (existing) {
      // 只在真正变化时写库：每次冷启动都刷 updatedAt 会让「资料是否更新过」失去意义
      const patch: Record<string, string | number> = {}
      if (nickName && nickName !== existing.nickName) patch.nickName = nickName
      if (avatarUrl && avatarUrl !== existing.avatarUrl) patch.avatarUrl = avatarUrl
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now
        await userDao.update(openId, patch)
        Object.assign(existing, patch)
      }
      if (existing.status === UserStatus.Banned) {
        throw new BizError(ErrorCode.FORBIDDEN, '账号已被封禁，无法使用', { userInfo: toUserInfo(existing) })
      }
      return { userInfo: toUserInfo(existing), isNew: false }
    }

    const doc: UserDoc = {
      _id: openId,
      openId,
      nickName,
      avatarUrl,
      status: UserStatus.Normal,
      stats: { created: 0, joined: 0, ongoing: 0 },
      createdAt: now,
      updatedAt: now,
    }
    try {
      await userDao.create(doc)
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err
      const raced = await userDao.getByOpenId(openId)
      if (!raced) throw err
      return { userInfo: toUserInfo(raced), isNew: false }
    }
    const userInfo: UserInfo = toUserInfo(doc)
    return { userInfo, isNew: true }
  },
}
