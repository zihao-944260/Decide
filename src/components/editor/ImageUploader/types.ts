export interface UploaderChange {
  /** 已拿到 fileID 的条目（与 v-model 同值，顺序一致） */
  fileIDs: string[]
  /**
   * 有条目不在 done 态（上传中 / 失败 / 刚选完还没传完）。
   * **页面提交门禁用 `!uploading`**：`done` 要求「至少一张且全部完成」，配图可以为空，用 `done` 当门禁会永远发不出去。
   */
  uploading: boolean
  /** 至少一张且全部完成（做「配图已就绪」文案用，别拿它当门禁） */
  done: boolean
  /** 当前格子数（含在途与失败） */
  count: number
  /** 失败条目数，页面可据此显示「有 N 张没传上去」 */
  failed: number
  max: number
}

export interface Props {
  /**
   * v-model：`plans.images`（fileID 数组）。
   * 编辑态把云端已有值传进来，组件挂载时用 `useUpload.addExisting()` 回填成 done 条目（不重新上传）；
   * 外部把它清空，组件跟着摘掉对应格子（在途/失败条目不打断）。
   */
  modelValue?: string[]
  /** 最多几张。默认 Limit.IMAGE_MAX(3)；只在创建 useUpload 实例时读一次，运行中改此值不生效 */
  max?: number
  /** 提交在途等场景整体禁用；组件不弹提示（提示只归 useUpload，避免双弹） */
  disabled?: boolean
  /** 区块标题 */
  label?: string
}

export type Emits = {
  (e: 'update:modelValue', fileIDs: string[]): void
  /** 上传状态每次变化都抛，页面用它做提交门禁与「N 张未传完」提示 */
  (e: 'change', payload: UploaderChange): void
}
