import { createComment, fetchComments, removeComment } from '@/api/comment'
import { ApiError } from '@/api/request'
import { CommentStatus, Limit, MY_FILTERS } from '@/constants/plan'
import { showToastMsg } from '@/composables/useToast'
import { usePagingList, type PagingList } from '@/composables/usePagingList'
import { usePlanStore } from '@/stores/plan'
import { useUserStore } from '@/stores/user'
import { countChars } from '@/utils/format'
import type { CommentItem, PlanSummary } from '@/types/models'
import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'

/**
 * 评论：分页复用 usePagingList（游标 = seq，服务端升序返回，即 §8.4 的「顺序展示」），
 * 外加发表与删除。删除走乐观移除 + 失败回滚（把条目塞回原下标，不然列表会跳位）。
 */

export interface UseCommentsOptions {
  pageSize?: number
  onPosted?: (comment: CommentItem) => void
  onRemoved?: (commentId: string) => void
}

export interface CommentsController extends PagingList<CommentItem> {
  posting: Ref<boolean>
  post: (content: string) => Promise<boolean>
  remove: (commentId: string) => Promise<boolean>
  canRemove: (comment: CommentItem) => boolean
  isEmpty: ComputedRef<boolean>
}

function findCachedSummary(planId: string): PlanSummary | undefined {
  const store = usePlanStore()
  const buckets = [store.home.list, ...MY_FILTERS.map((filter) => store.myLists[filter].list)]
  for (const bucket of buckets) {
    const hit = bucket.find((item) => item.planId === planId)
    if (hit) return hit
  }
  return undefined
}

export function useComments(
  planId: MaybeRefOrGetter<string>,
  options: UseCommentsOptions = {}
): CommentsController {
  const id = () => toValue(planId)
  const userStore = useUserStore()
  const planStore = usePlanStore()

  const paging = usePagingList<CommentItem>(
    async (cursor, pageSize) => {
      const page = await fetchComments(id(), { cursor, pageSize })
      // 已删除评论不再召回（用户裁定）：云端仍返回占位以保游标连续，入库前滤掉；
      // nextCursor/hasMore 沿用服务端按完整行算出的值，分页不因滤行而断
      return { ...page, list: page.list.filter((item) => item.status === CommentStatus.Normal) }
    },
    {
      pageSize: options.pageSize ?? Limit.COMMENT_PAGE_SIZE,
      getId: (item) => item.commentId
    }
  )

  const posting = ref(false)
  /** 单条删除的在途锁，实例级：模块级会跨页面串味 */
  const removing = new Set<string>()

  function bumpCount(delta: number): void {
    const current = findCachedSummary(id())
    if (!current) return
    planStore.patchPlan(current.planId, { commentCount: Math.max(0, current.commentCount + delta) })
  }

  async function post(content: string): Promise<boolean> {
    const text = content.trim()
    if (!text) {
      showToastMsg('说点什么吧')
      return false
    }
    if (countChars(text) > Limit.COMMENT_MAX) {
      showToastMsg(`评论最多 ${Limit.COMMENT_MAX} 字`)
      return false
    }
    if (posting.value) return false

    posting.value = true
    try {
      // 不传 silent：内容安全命中（敏感词）等文案由 request 统一 toast，避免两处各写一套提示
      const res = await createComment(id(), text)
      paging.appendItem(res.comment, 'tail')
      bumpCount(1)
      options.onPosted?.(res.comment)
      return true
    } catch (err) {
      if (!(err instanceof ApiError)) showToastMsg('发送失败，请重试')
      return false
    } finally {
      posting.value = false
    }
  }

  async function remove(commentId: string): Promise<boolean> {
    if (removing.has(commentId)) return false
    const index = paging.list.value.findIndex((item) => item.commentId === commentId)
    if (index < 0) return false
    const backup = paging.list.value[index]
    removing.add(commentId)
    paging.removeItem(commentId)

    try {
      // silent：乐观删除失败是本地态要回滚的场景，提示文案自己决定
      await removeComment(commentId, { silent: true })
      bumpCount(-1)
      options.onRemoved?.(commentId)
      return true
    } catch (err) {
      // 回滚到原位置，用户不会看到评论「先没了又插到末尾」
      paging.list.value.splice(index, 0, backup)
      showToastMsg(err instanceof ApiError ? err.message : '删除失败，请重试')
      return false
    } finally {
      removing.delete(commentId)
    }
  }

  function canRemove(comment: CommentItem): boolean {
    const me = userStore.userInfo
    return !!me && comment.author.openId === me.openId
  }

  return {
    ...paging,
    posting,
    post,
    remove,
    canRemove,
    isEmpty: computed(() => paging.list.value.length === 0)
  }
}
