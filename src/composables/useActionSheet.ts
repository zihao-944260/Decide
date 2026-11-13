import { useFeedbackStore, type SheetRequest } from '@/stores/feedback'
import { logger } from '@/utils/logger'
import { computed } from 'vue'

/**
 * 操作菜单。编辑器里长按块（上移/下移/删除/复制/设为标题）与详情页更多操作都要它。
 * 同样两套：openNative 走 uni.showActionSheet（4 项以内、无自定义样式需求的场合最省），
 * open 走 feedback store + 页面里的 BaseActionSheet（需要 danger 配色/超过 6 项时用）。
 * index = -1 表示取消。
 */

function nativeSheet(itemList: string[], alertText?: string): Promise<number> {
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList,
      alertText,
      success: (res) => resolve(res.tapIndex),
      fail: (err) => {
        logger.debug('useActionSheet', 'dismissed', err)
        resolve(-1)
      },
    })
  })
}

export function useActionSheet() {
  const feedback = useFeedbackStore()
  return {
    /** store 里的受控状态，页面直接绑给 BaseActionSheet（computed 保证 store 换对象后仍指向最新） */
    state: computed(() => feedback.sheet),
    /**
     * 受控菜单。`actions` 用的就是 `BaseActionSheet` 的 `ActionSheetItem`（text/desc/disabled/danger/key），
     * 所以页面可以把手上的数组同时喂给 `open()` 和 `<BaseActionSheet :actions>`，中间不需要 map 一层。
     */
    open: (request: SheetRequest): Promise<number> => feedback.openSheet(request),
    close: () => feedback.pickSheet(-1),
    /** BaseActionSheet 的 select/cancel 事件回调 */
    resolve: (index: number) => feedback.pickSheet(index),
    openNative: (itemList: string[], alertText?: string) => nativeSheet(itemList, alertText),
  }
}
