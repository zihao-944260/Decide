import type { RequestOptions } from '@/api/request'
import { request } from '@/api/request'
import type { PageQuery, PageResult } from '@/types/api'
import type { CommentItem } from '@/types/models'

/** 评论域接口。评论游标 = seq（不透明 string），升序即「顺序展示」。 */

export function createComment(
  planId: string,
  content: string,
  options?: RequestOptions,
): Promise<{ comment: CommentItem }> {
  return request('comment.create', { planId, content }, options)
}

export function fetchComments(
  planId: string,
  query: PageQuery = {},
  options?: RequestOptions,
): Promise<PageResult<CommentItem>> {
  return request('comment.list', { planId, ...query }, options)
}

export function removeComment(commentId: string, options?: RequestOptions): Promise<{ ok: true }> {
  return request('comment.remove', { commentId }, options)
}
