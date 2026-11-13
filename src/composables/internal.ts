import { getCurrentScope, onScopeDispose } from 'vue'

/**
 * composable 内部的收尾函数绑定。
 * 为什么不直接 onScopeDispose：useCountdown/useUpload 这些也会被组件外的
 * effectScope（甚至单测、云函数预取脚本）调用，无活跃 scope 时 onScopeDispose 会告警；
 * 这里退化成「能绑就绑」，调用方仍可拿返回值手动 dispose。
 */
export function bindDispose(dispose: () => void): () => void {
  if (getCurrentScope()) onScopeDispose(dispose)
  return dispose
}
