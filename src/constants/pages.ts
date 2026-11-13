/**
 * 跨页失效用的页面标识 —— **唯一字面量来源**。
 * 之前这三个串散在四个页面里（详情页 `const PAGE_KEY`、我的页 `types.ts` 导出的两个、
 * 首页与编辑页的字面量），后果是实打实的：详情页投完票只 `invalidatePage('home')`，
 * 因为它的表里没有 `'mine'` 这一项，从详情页回到「我的」票数最多滞后 60s。
 * 改某个页面的 key 只改这里一行，`usePageRefresh` 的 `key` 与 `invalidatePage` 的参数都是 `PageKey`，
 * 拼错与漏项在编译期就暴露。
 *
 * 只收**已注册过** `usePageRefresh({ key })` 的三个页面；编辑页只失效、不注册，所以这里没有它。
 */
export const PAGE_KEYS = {
  home: 'home',
  mine: 'mine',
  planDetail: 'plan-detail',
} as const

export type PageKeyValue = (typeof PAGE_KEYS)[keyof typeof PAGE_KEYS]
