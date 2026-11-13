/**
 * 内容安全（技术方案 §11.3，接口结论来自 docs/Skyline兼容清单.md §3.3 实测）。
 *
 * - 文本：`security.msgSecCheck` **v2**，`suggest !== 'pass'` 直接拦截（先审后发）。
 * - 图片：`security.mediaCheckAsync` **v2**，只负责「提交」，结论由微信异步消息推送回来。
 *   回调链路目前控制台未配置，所以图片是 **先发后审**：提交成功即放行，
 *   收到回调后再改 plan/comment 状态（回调函数留待 T4 与控制台配置）。
 *
 * 时间约束：默认超时只有 3s（config.json 的 timeout 经 CLI 部署不生效，需控制台改），
 * 所以文本检测用「分片 + 次数上限 + 时间预算」三重收敛，预算用尽即停止后续检测并记日志。
 */
import * as cloud from 'wx-server-sdk'
import { ServerLimit, SecScene } from './constants'
import { BizError, ErrorCode } from './errors'
import { messageOf } from './db'
import { log } from './logger'

/** openapi 在 4.0.2 里只是 Record<string, any>，这里按官方文档收窄一次（唯一的断言点） */
interface MsgSecCheckParam {
  content: string
  version: 2
  scene: number
  openid: string
}

/** 微信侧字段是 errcode/errmsg，SDK 部分版本归一成 errCode/errMsg，两种都声明 */
interface ApiFlagged {
  errCode?: number
  errMsg?: string
  errcode?: number
  errmsg?: string
}

interface MsgSecCheckResponse extends ApiFlagged {
  result?: { suggest?: string; label?: number }
  traceId?: string
}

interface MediaCheckParam {
  media_url: string
  media_type: 2
  version: 2
  scene: number
  openid: string
  title: string
}

interface MediaCheckResponse extends ApiFlagged {
  traceId?: string
}

interface TempFileItem {
  fileID: string
  tempFileURL: string
  status: number
  errMsg: string
}

interface SecurityApi {
  msgSecCheck(param: MsgSecCheckParam): Promise<MsgSecCheckResponse>
  mediaCheckAsync(param: MediaCheckParam): Promise<MediaCheckResponse>
}

interface StorageApi {
  getTempFileURL(param: { fileList: { fileID: string; maxAge?: number }[] }): Promise<{ fileList: TempFileItem[] }>
}

const openapi = cloud.openapi as unknown as Record<string, unknown>
const security = openapi.security as unknown as SecurityApi
const storage = openapi.storage as unknown as StorageApi

const VIOLATION_MESSAGE = '内容包含违规信息，请修改后再试'

export type SecSceneValue = (typeof SecScene)[keyof typeof SecScene]

/** errCode/errcode 任一存在且非 0 即视为接口调用失败（不等于「命中违规」） */
function callFailed(res: ApiFlagged): boolean {
  const code = res.errCode ?? res.errcode
  return code !== undefined && code !== 0
}

/**
 * 文本检测：超长按片送检，最多 ServerLimit.SEC_CHECK_MAX_CHUNKS 片。
 * 命中违规抛 1001（前端 toast 文案即 message）；接口本身报错不阻断发布 ——
 * 微信侧抖动或配额耗尽时把全站写路径打死代价更大，这里放行并记 warn，
 * 由 scheduler 对账与人工处置兜底。
 */
export async function checkText(
  openId: string,
  content: string,
  scene: SecSceneValue,
  startedAt: number,
): Promise<void> {
  const text = content.trim()
  if (!text) return

  const chunks: string[] = []
  for (let i = 0; i < text.length && chunks.length < ServerLimit.SEC_CHECK_MAX_CHUNKS; i += ServerLimit.SEC_CHECK_CHUNK) {
    chunks.push(text.slice(i, i + ServerLimit.SEC_CHECK_CHUNK))
  }

  for (const chunk of chunks) {
    if (Date.now() - startedAt > ServerLimit.TIME_BUDGET_MS) {
      log.warn('msgSecCheck 超出时间预算，剩余分片未检测', { openId, scene, total: chunks.length })
      return
    }
    let res: MsgSecCheckResponse
    try {
      res = await security.msgSecCheck({ content: chunk, version: 2, scene, openid: openId })
    } catch (err) {
      log.warn('msgSecCheck 调用失败（放行）', { openId, scene, error: messageOf(err) })
      continue
    }
    if (callFailed(res)) {
      log.warn('msgSecCheck 返回错误码（放行）', { openId, scene, errCode: res.errCode ?? res.errcode, errMsg: res.errMsg ?? res.errmsg })
      continue
    }
    const suggest = res.result?.suggest
    if (suggest && suggest !== 'pass') {
      log.warn('msgSecCheck 命中违规', { openId, scene, suggest, traceId: res.traceId })
      throw new BizError(ErrorCode.INVALID_PARAM, VIOLATION_MESSAGE, { traceId: res.traceId ?? '' })
    }
  }
}

/**
 * 图片送审（先发后审）：取临时 URL → mediaCheckAsync 提交。
 * 任何失败只记日志、不抛错：提交失败 ≠ 内容违规，拦截会把功能打死。
 * title 带 `img:{fileID}`，回调链路配好后可直接反查归属文件。
 */
export async function submitImagesForReview(
  openId: string,
  fileIDs: readonly string[],
  startedAt: number,
): Promise<void> {
  const list = fileIDs.filter((id) => id.startsWith('cloud://'))
  if (list.length === 0) return
  if (Date.now() - startedAt > ServerLimit.TIME_BUDGET_MS) {
    log.warn('图片送审跳过（超出时间预算）', { openId, count: list.length })
    return
  }

  let urls: TempFileItem[]
  try {
    const res = await storage.getTempFileURL({
      fileList: list.map((fileID) => ({ fileID, maxAge: 3600 })),
    })
    urls = res.fileList ?? []
  } catch (err) {
    log.warn('getTempFileURL 失败，图片未送审', { openId, error: messageOf(err) })
    return
  }

  for (const item of urls) {
    if (item.status !== 0 || !item.tempFileURL) {
      log.warn('临时 URL 获取失败，图片未送审', { openId, fileID: item.fileID, errMsg: item.errMsg })
      continue
    }
    try {
      const res = await security.mediaCheckAsync({
        media_url: item.tempFileURL,
        media_type: 2,
        version: 2,
        scene: SecScene.Forum,
        openid: openId,
        title: `img:${item.fileID}`,
      })
      if (callFailed(res)) {
        log.warn('mediaCheckAsync 提交失败', { openId, fileID: item.fileID, errCode: res.errCode ?? res.errcode })
      }
    } catch (err) {
      log.warn('mediaCheckAsync 抛错', { openId, fileID: item.fileID, error: messageOf(err) })
    }
  }
}
