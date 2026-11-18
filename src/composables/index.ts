/**
 * 逻辑复用层统一出口（技术方案 §10）。
 * 页面/业务组件从这里 import，不 deep-import 单个文件；base 组件按规范不许碰这一层。
 */
export { peekNow, useServerNow } from '@/composables/useServerNow'
export { useCountdown, type Countdown, type UseCountdownOptions } from '@/composables/useCountdown'
export {
  usePagingList,
  type PageFetcher,
  type PagingList,
  type UsePagingOptions,
} from '@/composables/usePagingList'
export { NO_VOTE, toStoreVote, useVote, type MyVote, type UseVoteOptions, type VoteController } from '@/composables/useVote'
export {
  useComments,
  type CommentsController,
  type UseCommentsOptions,
} from '@/composables/useComments'
export {
  useUpload,
  resolveTempUrls,
  uploadInlineImage,
  type UploadItem,
  type UploadStatus,
  type UseUploadOptions,
} from '@/composables/useUpload'
export {
  useEditor,
  DRAFT_DEBOUNCE_MS,
  type EditorController,
  type EditorExtra,
  type PlanDraft,
  type UseEditorOptions,
} from '@/composables/useEditor'
export {
  useForm,
  type FieldRule,
  type FormController,
  type FormErrors,
  type FormRules,
  type UseFormOptions,
} from '@/composables/useForm'
export {
  invalidatePage,
  usePageRefresh,
  type PageRefreshContext,
  type PageRefreshController,
  type UsePageRefreshOptions,
} from '@/composables/usePageRefresh'
export { useTabScrollReset } from '@/composables/useTabScrollReset'
export { buildShareMessage, useShare, type AppShareMessage, type ShareConfig } from '@/composables/useShare'
export { showToastMsg, useToast, type ToastIcon, type ToastOptions } from '@/composables/useToast'
export { useModal, type ConfirmOptions } from '@/composables/useModal'
export { useActionSheet } from '@/composables/useActionSheet'
