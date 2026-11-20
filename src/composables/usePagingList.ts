import { logger } from '@/utils/logger'
import type { PageResult } from '@/types/api'
import { ref, type Ref } from 'vue'

/**
 * 通用分页（技术方案 §10）：首页列表 / 我的列表 / 评论列表三处共用。
 * 只做「取下一页 + 状态机 + 并发锁 + 失败不留脏数据」，缓存与业务 patch 通过
 * seed/onPage 钩子交回调用方接到 planStore，composable 不认识 store。
 */

export type PageFetcher<T> = (cursor: string, pageSize: number) => Promise<PageResult<T>>

export interface UsePagingOptions<T extends object> {
  pageSize?: number
  /** patchItem / removeItem / 追加去重需要的主键 */
  getId?: (item: T) => string
  /** 命中本地/ store 缓存时首屏直接回填，不发请求（我的页切 filter 用，§8.7） */
  seed?: () => PageResult<T> | null
  /** 每次成功取到的原始分页数据回吐给调用方写缓存 */
  onPage?: (page: PageResult<T>, append: boolean) => void
  onError?: (error: unknown) => void
}

export interface PagingList<T extends object> {
  list: Ref<T[]>
  /** 首屏或加载更多进行中（列表底部 BaseLoadMore 用） */
  loading: Ref<boolean>
  /** 下拉刷新进行中（绑 scroll-view 的 refresher-triggered） */
  refreshing: Ref<boolean>
  hasMore: Ref<boolean>
  /** 首次成功加载完成：区分「骨架屏」与「真空列表」两态 */
  loaded: Ref<boolean>
  error: Ref<string>
  loadMore: () => Promise<void>
  reload: (options?: { force?: boolean }) => Promise<void>
  refresh: () => Promise<void>
  appendItem: (item: T, position?: 'head' | 'tail') => void
  patchItem: (id: string, patch: Partial<T>) => void
  removeItem: (id: string) => void
  setList: (items: T[]) => void
  reset: () => void
}

const DEFAULT_PAGE_SIZE = 10

export function usePagingList<T extends object>(
  fetcher: PageFetcher<T>,
  options: UsePagingOptions<T> = {}
): PagingList<T> {
  const list = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const refreshing = ref(false)
  const hasMore = ref(true)
  const loaded = ref(false)
  const error = ref('')

  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  let cursor = ''
  let busy = false
  /**
   * 请求代次：reload/切换 filter 会让在途的旧请求作废。
   * 不做这层，「切 filter 后旧页面的数据晚到」会把新列表覆盖成上一个 filter 的内容 ——
   * 游标分页最经典的竞态，靠锁是挡不住的（锁只挡并发，不挡乱序返回）。
   */
  let seq = 0

  function indexOfId(id: string): number {
    const getId = options.getId
    if (!getId) return -1
    return list.value.findIndex((item) => getId(item) === id)
  }

  function dedupeAppended(incoming: T[]): T[] {
    const getId = options.getId
    if (!getId) return incoming
    // 追加去重：乐观插入的条目（刚发的评论、置顶的卡片）可能同时出现在服务端下一页里
    const seen = new Set(list.value.map((item) => getId(item)))
    return incoming.filter((item) => !seen.has(getId(item)))
  }

  function applyPage(page: PageResult<T>, append: boolean): void {
    const incoming = append ? dedupeAppended(page.list) : page.list
    list.value = append ? [...list.value, ...incoming] : [...incoming]
    cursor = page.nextCursor
    hasMore.value = page.hasMore
    loaded.value = true
    error.value = ''
  }

  async function run(mode: 'init' | 'more'): Promise<void> {
    if (busy) return
    if (mode === 'more' && (!hasMore.value || !loaded.value)) return

    busy = true
    loading.value = true
    const mySeq = seq

    try {
      const page = await fetcher(mode === 'more' ? cursor : '', pageSize)
      if (mySeq !== seq) return
      applyPage(page, mode === 'more')
      options.onPage?.(page, mode === 'more')
    } catch (err) {
      // 失败回滚 = 「什么都不改」：list/cursor/hasMore 全部保持原样，
      // 只在首屏失败时把 error 露出来给重试态；加载更多失败用户可以再滚一次
      if (mySeq === seq) {
        error.value = mode === 'init' ? messageOf(err) : error.value || messageOf(err)
        logger.warn('usePagingList', `${mode} failed`, err)
        options.onError?.(err)
      }
    } finally {
      if (mySeq === seq) {
        busy = false
        loading.value = false
        refreshing.value = false
      }
    }
  }

  async function reload({ force = false }: { force?: boolean } = {}): Promise<void> {
    seq += 1
    // 让在途请求的收尾不再改状态，本次调用接管
    busy = false
    loading.value = false
    const pulling = refreshing.value
    refreshing.value = false

    if (!force && options.seed) {
      const cached = options.seed()
      if (cached && cached.list.length > 0) {
        applyPage(cached, false)
        return
      }
    }
    hasMore.value = true
    loaded.value = false
    cursor = ''
    // 重取清空旧数据：骨架屏独占整屏，不允许「骨架 + 真数据」同屏（用户裁定）
    list.value = []
    error.value = ''
    // 下拉刷新必须让 refresher-triggered 在整个请求期间保持 true，
    // finally 里的 true→false 才是原生 spinner 的收回信号；提前复位会永久卡在刷新态
    refreshing.value = pulling
    await run('init')
  }

  async function refresh(): Promise<void> {
    if (refreshing.value) return
    // 不查 busy/loading：reload 会接管状态机（seq 作废在途请求）。
    // 若在这里忽略下拉手势，原生 spinner 拿不到收回信号，同样卡死
    refreshing.value = true
    await reload({ force: true })
  }

  async function loadMore(): Promise<void> {
    await run('more')
  }

  function appendItem(item: T, position: 'head' | 'tail' = 'tail'): void {
    if (options.getId) {
      const id = options.getId(item)
      const existing = indexOfId(id)
      if (existing >= 0) list.value.splice(existing, 1, item)
      else list.value = position === 'head' ? [item, ...list.value] : [...list.value, item]
      return
    }
    list.value = position === 'head' ? [item, ...list.value] : [...list.value, item]
  }

  function patchItem(id: string, patch: Partial<T>): void {
    const index = indexOfId(id)
    if (index < 0) return
    list.value.splice(index, 1, Object.assign({}, list.value[index], patch))
  }

  function removeItem(id: string): void {
    const index = indexOfId(id)
    if (index >= 0) list.value.splice(index, 1)
  }

  function setList(items: T[]): void {
    list.value = [...items]
    loaded.value = true
  }

  function reset(): void {
    seq += 1
    busy = false
    list.value = []
    cursor = ''
    hasMore.value = true
    loaded.value = false
    error.value = ''
    loading.value = false
    refreshing.value = false
  }

  return {
    list,
    loading,
    refreshing,
    hasMore,
    loaded,
    error,
    loadMore,
    reload,
    refresh,
    appendItem,
    patchItem,
    removeItem,
    setList,
    reset
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : '加载失败'
}
