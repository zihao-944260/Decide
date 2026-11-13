/**
 * common 公共层唯一出口（技术方案 §6.3）。
 * 业务云函数只 `import ... from 'common'`，不深入子路径 —— common 内部拆文件不影响函数侧。
 */
export * from './constants'
export * from './errors'
export * from './types'
export {
  initCloud,
  getDb,
  getCommand,
  startTransaction,
  rowsOf,
  rowOf,
  totalOf,
  idOf,
  updatedOf,
  removedOf,
  errorCodeOf,
  messageOf,
  isCollectionMissing,
  isDuplicateKeyError,
  isTransactionConflict,
} from './db'
export { getOpenId, requireOpenId, assertAuthor, assertCommentDeleter, assertWritable } from './auth'
export { log, shortOpenId } from './logger'
export * from './validate'
export { encodeCursor, decodeCursor } from './cursor'
export type { Cursor } from './cursor'
export { readPageArgs, buildPage } from './paging'
export type { PageArgs, CursorOf } from './paging'
export { assertWriteQuota } from './ratelimit'
export { checkText, submitImagesForReview } from './security'
export type { SecSceneValue } from './security'
export * from './mapper'
export * from './planPayload'
export * from './dao'
export { createRouter } from './router'
export type { ActionContext, ActionMap, ActionRun, ActionSpec } from './router'
