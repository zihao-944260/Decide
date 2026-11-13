/**
 * 计划写入载荷的服务端权威校验（技术方案 §11.3）。
 *
 * 为什么单独成模块：`plan.create` 与 `plan.update` 必须用**完全相同**的一套上限判定，
 * 否则可以从 update 绕过 create 的限制（图片数量、选项数、deadline 跨度）。
 * 前端 editorStore 也校验一遍，但那只是体验，绕不过这里。
 */
import { Limit, PlanStatus, ServerLimit } from './constants'
import { BizError, ErrorCode } from './errors'
import { asArray, asBoolean, asFileIDList, asNumber, asRecord, asString, inEnum } from './validate'
import type { Block, PlanOption, PlanWritePayload } from './types'

const TEXT_ALIGN = ['left', 'center'] as const
const HEADING_LEVEL = [1, 2, 3] as const

function validateBlock(raw: unknown, index: number): Block {
  const field = `第 ${index + 1} 个内容块`
  const rec = asRecord(raw, field)
  const type = asString(rec.type, `${field}类型`, 16)
  switch (type) {
    case 'text':
      return {
        id: asString(rec.id, `${field} id`, 64),
        type: 'text',
        text: asString(rec.text, `${field}正文`, Limit.BLOCK_TEXT_MAX),
        level: inEnum(rec.level, `${field}层级`, HEADING_LEVEL),
        align: inEnum(rec.align, `${field}对齐`, TEXT_ALIGN),
        bold: rec.bold === undefined ? undefined : asBoolean(rec.bold, `${field}加粗`),
        color: rec.color === undefined ? undefined : asString(rec.color, `${field}颜色`, 16),
      }
    case 'quote':
      return {
        id: asString(rec.id, `${field} id`, 64),
        type: 'quote',
        text: asString(rec.text, `${field}正文`, Limit.BLOCK_TEXT_MAX),
      }
    case 'image': {
      const fileID = asString(rec.fileID, `${field}图片`, 512)
      if (!/^(cloud:\/\/|https:\/\/)/.test(fileID)) {
        throw new BizError(ErrorCode.INVALID_PARAM, `${field}只能使用上传过的图片`)
      }
      return {
        id: asString(rec.id, `${field} id`, 64),
        type: 'image',
        fileID,
        w: asNumber(rec.w, `${field}宽度`),
        h: asNumber(rec.h, `${field}高度`),
        caption: rec.caption === undefined ? undefined : asString(rec.caption, `${field}图注`, 60),
      }
    }
    case 'divider':
      return { id: asString(rec.id, `${field} id`, 64), type: 'divider' }
    default:
      throw new BizError(ErrorCode.INVALID_PARAM, `不支持的${field}类型：${type}`)
  }
}

function validateOptions(raw: unknown, enabled: boolean): PlanOption[] {
  if (!enabled) return []
  const list = asArray(raw === undefined ? [] : raw, '选项', Limit.OPTION_MAX)
  const out: PlanOption[] = []
  const seen = new Set<string>()
  for (let i = 0; i < list.length; i += 1) {
    const rec = asRecord(list[i], `第 ${i + 1} 个选项`)
    const id = asString(rec.id, `第 ${i + 1} 个选项 id`, 64)
    // 选项 id 前端用 nanoid 生成，重复说明是构造请求或客户端状态错乱
    if (seen.has(id)) throw new BizError(ErrorCode.DUPLICATED, '选项标识重复')
    seen.add(id)
    const image = asStringAllowEmptyOptionImage(rec.image)
    if (image !== '' && !/^cloud:\/\//.test(image)) {
      throw new BizError(ErrorCode.INVALID_PARAM, '选项图片只能使用上传过的图片')
    }
    out.push({
      id,
      name: asString(rec.name, `第 ${i + 1} 个选项名称`, Limit.OPTION_NAME_MAX),
      image,
      order: rec.order === undefined ? i : asNumber(rec.order, `第 ${i + 1} 个选项顺序`),
      // count 是出参字段，权威计数存在 plan.optionVotes（vote.submit 原子自增）。
      // 写入载荷里前端传来的 count 一律忽略，落库恒 0 占位，避免客户端伪造票数。
      count: 0,
    })
  }
  return out
}

/** 选项图允许空串（可以不配图），故不复用 asString */
function asStringAllowEmptyOptionImage(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new BizError(ErrorCode.INVALID_PARAM, '选项图片格式不正确')
  return value.trim()
}

/**
 * deadline 规则：
 * - 0 = 不限截止（§5.2「0/缺失表示不限制」），此时 status 恒为进行中；
 * - 新建必须落在 (now, now+365d]；
 * - 编辑允许**保持原值不变**（哪怕它已经过期），因为改文案不该把过期计划复活，
 *   也允许改成未来的新时间；只允许「未过期 → 未来」或「已过期 → 未来」的顺延。
 */
export function resolveDeadline(value: unknown, field: string, now: number, keepValue?: number): number {
  const deadline = asNumber(value, field)
  if (deadline === 0) return 0
  if (keepValue !== undefined && deadline === keepValue) return deadline
  if (deadline <= now) throw new BizError(ErrorCode.INVALID_PARAM, '截止时间必须晚于当前时间')
  const max = now + ServerLimit.DEADLINE_MAX_DAYS * 24 * 60 * 60 * 1000
  if (deadline > max) throw new BizError(ErrorCode.INVALID_PARAM, '截止时间最多设置到一年后')
  return deadline
}

export interface NormalizedPlanWrite {
  readonly payload: PlanWritePayload
  /** 校验通过的 optionCount，直接落库供列表投影使用 */
  readonly optionCount: number
}

export function normalizePlanWrite(raw: unknown, now: number, keepDeadline?: number): NormalizedPlanWrite {
  const body = asRecord(raw, '计划内容')
  const title = asString(body.title, '标题', Limit.TITLE_MAX)
  if (!title) throw new BizError(ErrorCode.INVALID_PARAM, '标题不能为空')

  const blocksIn = asArray(body.blocks, '正文内容', ServerLimit.BLOCK_MAX)
  if (blocksIn.length === 0) throw new BizError(ErrorCode.INVALID_PARAM, '正文内容不能为空')
  const blocks: Block[] = blocksIn.map(validateBlock)

  // 配图可选（契约 §5.2 / §8.6）：asArray 的 required() 默认拒空数组，空列表直接放行
  const imagesIn = body.images === undefined ? [] : body.images
  const images = Array.isArray(imagesIn) && imagesIn.length === 0 ? [] : asFileIDList(imagesIn, '计划配图', Limit.IMAGE_MAX, false)
  const optionsEnabled = asBoolean(body.optionsEnabled, '选项开关')
  const options = validateOptions(body.options, optionsEnabled)
  const deadline = resolveDeadline(body.deadline, '截止时间', now, keepDeadline)

  return {
    payload: { title, blocks, images, deadline, optionsEnabled, options },
    optionCount: options.length,
  }
}

/** 计划是否可以被编辑：软删不可复活，已截止只读（§6.1） */
export function assertPlanEditable(status: number): void {
  if (status === PlanStatus.Removed) throw new BizError(ErrorCode.NOT_FOUND, '该计划不存在或已被删除')
  if (status === PlanStatus.Ended) throw new BizError(ErrorCode.PLAN_CLOSED, '计划已截止，不能再编辑')
  if (status === PlanStatus.Draft) return
  if (status !== PlanStatus.Ongoing) throw new BizError(ErrorCode.INVALID_PARAM, '计划状态异常，无法编辑')
}

/** 计划是否可以被投票 / 评论（§8.3 第 1 步） */
export function assertPlanActionable(status: number, deadline: number, now: number): void {
  if (status === PlanStatus.Removed) throw new BizError(ErrorCode.NOT_FOUND, '该计划不存在或已被删除')
  if (status === PlanStatus.Draft) throw new BizError(ErrorCode.PLAN_CLOSED, '计划尚未发布')
  if (status === PlanStatus.Ended || (deadline > 0 && deadline <= now)) {
    throw new BizError(ErrorCode.PLAN_CLOSED, '该计划已截止')
  }
}
