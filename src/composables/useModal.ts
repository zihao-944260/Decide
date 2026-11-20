import { useFeedbackStore, type DialogRequest } from '@/stores/feedback'
import { logger } from '@/utils/logger'

/**
 * 二次确认。两种实现刻意分开：
 * - confirm()：原生 showModal，零渲染成本，绝大多数场景用它；
 * - confirmCustom()：翻 feedback store 的可见性，由页面渲染 agent A 的 BaseModal，
 *   只在需要自定义排版（危险操作 + 富内容）时使用。
 */

export interface ConfirmOptions {
  title?: string
  content: string
  confirmText?: string
  cancelText?: string
}

function nativeConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: options.title ?? '提示',
      content: options.content,
      confirmText: options.confirmText ?? '确定',
      cancelText: options.cancelText ?? '取消',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: (err) => {
        logger.warn('useModal', 'showModal fail', err)
        // 弹不出来就当用户取消：确认类操作宁可不执行，不能默认放行
        resolve(false)
      }
    })
  })
}

export function useModal() {
  const feedback = useFeedbackStore()
  return {
    confirm: nativeConfirm,
    alert: (content: string, title = '提示') =>
      nativeConfirm({ title, content, cancelText: '知道了' }),
    confirmCustom: (request: DialogRequest): Promise<boolean> => feedback.openDialog(request),
    closeCustom: () => feedback.closeDialog()
  }
}
