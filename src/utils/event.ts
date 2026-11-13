/**
 * 原生表单事件（input / textarea）的取值口径。
 *
 * 只认 `event.detail.value`，**不读任何 selection / cursor 字段**：
 * Skyline 下 textarea 拿不到选区（技术方案 §2.4），读回来是 -1，
 * 拿它做「按光标位置切字符串」会静默切错 —— 所以段落级样式是 v1 的唯一形态，
 * 这里也就只暴露「整段的值」这一个动作。
 *
 * 这一句此前在三个编辑器块组件与本页面里逐字重复过四份；收成一处，
 * 免得哪天事件载荷形状变了要改四个地方、漏掉的那个静默返回空串。
 *
 * 两处**看着像**但刻意没并进来，因为契约不同：
 * `CommentInput` 的 `readDetail` 还要读 `keyboardheightchange` 的 height/duration（要整个 detail，不只 value）；
 * `UserHeader` 的 `nickValueOf` 返回 `string | null`，null 表示「这次事件根本没带值」，
 * 调用方据此不改动草稿 —— 用本函数替它会变成「没带值就当清空」。
 */
export function readInputValue(event: unknown): string {
  const detail = (event as { detail?: { value?: unknown } } | null)?.detail
  return typeof detail?.value === 'string' ? detail.value : ''
}
