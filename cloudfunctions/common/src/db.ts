/**
 * 数据库单例 + SDK 边界收窄。
 *
 * wx-server-sdk 4.0.2 的三处类型缺陷全部在这里一次性处理（docs §3.1 实测）：
 * 1. `cloud.DYNAMIC_CURRENT_ENV` 是 symbol，而 `init({ env })` 形参只收 string；
 * 2. `startTransaction()` 返回 `Promise<any>`；
 * 3. `add/get/count/remove/update` 把回调式与 Promise 式重载混写成
 *    `string | void | IXxxResult` 联合，await 后无法收窄，而 IXxxResult 没被 export。
 * 因此下面这组 `xxxOf` 取值函数是**全项目唯一的断言点**，业务层只见收窄后的类型。
 */
import * as cloud from 'wx-server-sdk'
import type {
  AddResult,
  CountResult,
  Db,
  DbCommand,
  GetResult,
  RemoveResult,
  Transaction,
  UpdateResult,
} from './types'

/** 环境按调用方动态解析：写死 envId 会让多个环境的函数互相打脏数据 */
export function initCloud(): void {
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV as unknown as string })
}

let dbInstance: Db | null = null

export function getDb(): Db {
  if (!dbInstance) {
    // throwOnNotFound=false 是运行期支持的选项，但 4.0.2 的 IDatabaseConfig 只声明了 env，
    // 所以在这里断言一次。关掉它之后 doc.get() 读不到记录时返回 data:null 而不是抛错，
    // dao 层就不必用 try/catch 做常规的存在性判断（尤其是事务里的 counters/votes 首次写入）。
    const options = { throwOnNotFound: false } as unknown as Parameters<typeof cloud.database>[0]
    dbInstance = cloud.database(options)
  }
  return dbInstance
}

/** `_.inc / _.in / _.or …` 的统一入口，避免每个 dao 各自取 command */
export function getCommand(): DbCommand {
  return getDb().command
}

/**
 * 取集合引用。
 * 刻意不从 common/index 导出：它是全项目唯一的 `db.collection()` 出口，
 * 只允许 dao/*.ts 直接 import '../db'，业务层拿不到它就写不出绕过投影的查询。
 */
export function collection(name: string): ReturnType<Db['collection']> {
  return getDb().collection(name)
}

export async function startTransaction(): Promise<Transaction> {
  const tx: unknown = await getDb().startTransaction()
  return tx as Transaction
}

// === 返回形状收窄（只在 dao 内调用） ===

/** 查询列表：普通 get 的 data 是数组；事务内 doc.get 的 data 是对象，这里统一成数组 */
export function rowsOf<T>(raw: unknown): T[] {
  const box = raw as GetResult<T> | { data: T | null } | null | undefined
  const data: unknown = box?.data
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') return [data as T]
  return []
}

export function rowOf<T>(raw: unknown): T | null {
  const list = rowsOf<T>(raw)
  return list.length > 0 ? list[0] : null
}

export function totalOf(raw: unknown): number {
  const res = raw as CountResult | null | undefined
  return typeof res?.total === 'number' ? res.total : 0
}

/** add 的返回在普通路径是 `_id`、事务路径是 `id`，两种都认 */
export function idOf(raw: unknown): string {
  const res = raw as (AddResult & { id?: string }) | null | undefined
  if (typeof res?._id === 'string') return res._id
  if (typeof res?.id === 'string') return res.id
  return ''
}

export function updatedOf(raw: unknown): number {
  const res = raw as UpdateResult | null | undefined
  return res?.stats?.updated ?? res?.updated ?? 0
}

export function removedOf(raw: unknown): number {
  const res = raw as RemoveResult | null | undefined
  return res?.stats?.removed ?? res?.removed ?? 0
}

// === 错误识别 ===

export function errorCodeOf(err: unknown): string | number | undefined {
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>
    const code = rec.errCode ?? rec.code
    if (typeof code === 'string' || typeof code === 'number') return code
  }
  return undefined
}

export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>
    const msg = rec.errMsg ?? rec.message ?? rec.errmsg
    if (typeof msg === 'string') return msg
  }
  return String(err)
}

/** 集合不存在（T2.1 尚未在控制台建表时会是这个错，日志要能一眼看出来） */
export function isCollectionMissing(err: unknown): boolean {
  if (errorCodeOf(err) === -501001) return true
  return /collection.*not exist|不存在/i.test(messageOf(err))
}

/**
 * 唯一索引冲突。控制台补建 `planId+openId` 唯一索引后，并发重复投票会从这里兜住；
 * 索引尚未建立（当前状态）时靠「确定性 _id + 事务前查重」防重，两条路径都要认。
 */
export function isDuplicateKeyError(err: unknown): boolean {
  const msg = messageOf(err).toLowerCase()
  return msg.includes('duplicate') || msg.includes('unique index') || errorCodeOf(err) === -502401
}

/** 事务内读到的文档可能因为冲突回滚，错误文案随版本变化，统一在此判定 */
export function isTransactionConflict(err: unknown): boolean {
  const msg = messageOf(err).toLowerCase()
  return msg.includes('transaction') || msg.includes('conflict') || msg.includes('文档版本冲突')
}
