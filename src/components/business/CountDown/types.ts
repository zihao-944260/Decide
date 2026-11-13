/**
 * CountDown —— useCountdown 的展示壳（技术方案 §8.5 / WBS T3.1）。
 * 组件不认识业务语义：任何「有截止时间」的地方都能用，只要喂一个校准后的毫秒时间戳。
 */
export type CountDownTone = 'text' | 'chip'
export type CountDownSize = 'sm' | 'md' | 'lg'

export interface Props {
  /**
   * 截止时间（毫秒时间戳）。
   * 调用方给的是服务端校准后的值（appStore.serverNow() 同源）；组件内不纠偏、不二次换算，
   * 时间源唯一性由 utils/ticker + useServerNow 保证（§8.5 时间校准）。
   */
  deadline: number
  /** 起点（一般是计划 createdAt）：传了 percent 才是真实剩余占比，否则按 total / 7 天窗口估 */
  startAt?: number
  /** 无 startAt 时的总时长（毫秒）。注意：只在创建时读一次，改 props.total 不会重算 */
  total?: number
  /** text=纯文字（跟随档位变色）；chip=带底色胶囊（卡片右上角那种） */
  tone?: CountDownTone
  /** 字号档位：sm=$font-xs / md=$font-sm / lg=$font-md */
  size?: CountDownSize
  /** 是否显示档位指示点（真实节点，Skyline 无伪元素） */
  showDot?: boolean
  /** 归零文案覆盖（详情页可传「投票已结束」）；留空用 utils/format 的「已截止」 */
  endedText?: string
}

export type Emits = {
  /**
   * 归零沿：从「还有时间」翻到 0 时触发一次，携带当时的 deadline 便于调用方比对是哪条数据。
   * 挂载时就已截止不触发（否则一屏过期卡片会把页面打成 N 次 reload）。
   * 语义只是「前端视觉上归零」，真实状态仍由云函数裁决（§8.5）。
   */
  (e: 'expire', deadline: number): void
}
