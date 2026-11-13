import { logger } from '@/utils/logger'

const PREFIX = 'decide:'

/** storage key 统一前缀（规范约定），避免与三方/uni 内部 key 撞车 */
export function storageKey(name: string): string {
  return `${PREFIX}${name}`
}

/** 读 JSON；解析失败按「没有缓存」处理，绝不让脏数据把页面初始化打断 */
export function readJson<T>(name: string): T | null {
  try {
    const raw: unknown = uni.getStorageSync(storageKey(name))
    if (typeof raw !== 'string' || !raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(name: string, value: unknown): boolean {
  try {
    uni.setStorageSync(storageKey(name), JSON.stringify(value))
    return true
  } catch (err) {
    // 配额写满时草稿保存会失败，页面仍可正常提交，只需知道没存上
    logger.warn('storage', `write ${name} failed`, err)
    return false
  }
}

export function removeStorage(name: string): void {
  try {
    uni.removeStorageSync(storageKey(name))
  } catch {
    /* 删不掉就让它去，下一次读也会因解析失败而丢弃 */
  }
}

export function hasStorage(name: string): boolean {
  try {
    const raw: unknown = uni.getStorageSync(storageKey(name))
    return typeof raw === 'string' && raw.length > 0
  } catch {
    return false
  }
}
