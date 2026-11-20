import { Limit } from '@/constants/plan'
import { showToastMsg } from '@/composables/useToast'
import { useUserStore } from '@/stores/user'
import { createBlockId } from '@/utils/blocks'
import { logger } from '@/utils/logger'
import { computed, ref } from 'vue'
/**
 * 图片选择 + 云存储上传（技术方案 §8.2）。
 * 这是全工程唯一允许直接碰 wx.cloud 的地方 —— 它调的是存储 SDK（uploadFile），
 * 不是云函数出口；api/request.ts 只负责 callFunction，包一层反而把云存储语义塞进错的地方。
 * 页面/组件一律通过本 composable 上传，不许自行调 wx.cloud。
 *
 * 占位顺序：chooseMedia 的本地临时路径先渲染（T0.7 实测小程序端 downloadFile 只有
 * tempFilePath、没有云函数侧的 fileContent，所以「本地路径 → fileID」是唯一不闪的路线），
 * 上传完成后只替换 fileID，条目 id 不变 → 列表不重建、不跳动。
 */

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  localPath: string
  fileID: string
  size: number
  width: number
  height: number
  ext: string
  status: UploadStatus
  /** 0~100 */
  progress: number
  message: string
}

export interface UseUploadOptions {
  /** 最多几张：计划配图 Limit.IMAGE_MAX(3)，选项图 Limit.OPTION_IMAGE_MAX(1) */
  max?: number
  /** 单张字节上限，默认 5MB */
  maxSize?: number
  accept?: readonly string[]
  /** 云存储目录前缀，实际路径是 dir/openId/ts_rand.ext */
  dir?: string
  sourceType?: Array<'album' | 'camera'>
  onError?: (message: string) => void
}

/**
 * 单张字节上限（默认 5MB）。导出是为了让展示层（ImageUploader 的提示文案、EditorImageBlock 的空卡说明）
 * 引用同一个数，而不是各自再抄一遍「≤5MB」—— 改上限时只改这里。
 */
export const MAX_SIZE = 5 * 1024 * 1024
/** 允许的扩展名白名单，同上：提示文案由这两个常量拼出来 */
export const DEFAULT_ACCEPT: readonly string[] = ['jpg', 'jpeg', 'png', 'webp']

/**
 * 「支持什么格式、最大多大」这句提示的**唯一**拼法。
 * 展示层（ImageUploader 的 hint、EditorImageBlock 的空卡说明、UserHeader 的头像提示）此前各抄一份
 * 「jpg / png / webp，单张 ≤5MB」，一共三处 —— 上限一改就变成三条互相矛盾的文案。
 */
export const UPLOAD_HINT = `支持 ${DEFAULT_ACCEPT.join(' / ')}，单张不超过 ${Math.floor(MAX_SIZE / 1024 / 1024)}MB`

/**
 * 云存储只读出口：cloud:// fileID 批量换临时 https 链。
 * 原生 <editor>（Quill/webview）不认 cloud:// 协议（只有 <image>/mp-html 特判它），
 * 编辑面显示已有插图必须先换临时链。与 uploadFile 同属存储 SDK，故收在本模块，页面不直连 wx.cloud。
 */
export async function resolveTempUrls(fileIDs: readonly string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const list = fileIDs.filter((id) => id.startsWith('cloud://'))
  if (!list.length) return map
  try {
    const res = await wx.cloud.getTempFileURL({ fileList: list })
    for (const item of res.fileList) {
      if (item.fileID && item.tempFileURL) map.set(item.fileID, item.tempFileURL)
    }
  } catch (err) {
    logger.warn('useUpload', 'getTempFileURL fail', err)
  }
  return map
}

/**
 * 一次性上传一张正文插图并回临时链：选图面板已把本地路径交给页面，这里只做「上传→拿 fileID→换临时链」。
 * 不进 files 队列（正文图不是配图网格的一员），失败抛给调用方弹一条提示。
 */
export async function uploadInlineImage(
  localPath: string
): Promise<{ fileID: string; tempURL: string }> {
  const cloudPath = `plans/inline/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
  const up = await wx.cloud.uploadFile({ cloudPath, filePath: localPath })
  const temp = await resolveTempUrls([up.fileID])
  return { fileID: up.fileID, tempURL: temp.get(up.fileID) ?? '' }
}

function extOf(path: string): string {
  const clean = path.split('?')[0] ?? ''
  const dot = clean.lastIndexOf('.')
  return dot < 0 ? '' : clean.slice(dot + 1).toLowerCase()
}

export function useUpload(options: UseUploadOptions = {}) {
  const max = options.max ?? Limit.IMAGE_MAX
  const maxSize = options.maxSize ?? MAX_SIZE
  const accept = options.accept ?? DEFAULT_ACCEPT
  const dir = options.dir ?? 'plans'

  const files = ref<UploadItem[]>([])
  const userStore = useUserStore()

  /** 上传失败的条目 id，页面用来标红 + 出「重试」按钮 */
  const failedIds = computed(() =>
    files.value.filter((item) => item.status === 'error').map((item) => item.id)
  )

  function fail(message: string): void {
    logger.warn('useUpload', message)
    if (options.onError) options.onError(message)
    else showToastMsg(message)
  }

  function patch(id: string, next: Partial<UploadItem>): void {
    // 必须通过 files.value 取到响应式代理再改，直接改闭包里的原始对象不会触发更新
    const target = files.value.find((item) => item.id === id)
    if (target) Object.assign(target, next)
  }

  function remaining(): number {
    return Math.max(0, max - files.value.length)
  }

  function validate(picked: { path: string; size: number }, ext = extOf(picked.path)): string {
    // ext 为空串时**放行**：`open-type="chooseAvatar"` 给的是 `wxfile://tmp_xxx` 这种无扩展名临时路径，
    // 它一定是图片，按白名单拒就等于「头像永远传不上去」。真正会走到这里的路径只有 uploadLocal()。
    if (ext && !accept.includes(ext)) return `仅支持 ${accept.join('/')} 格式`
    if (picked.size > maxSize) return `单张不能超过 ${Math.floor(maxSize / 1024 / 1024)}MB`
    return ''
  }

  function upload(item: UploadItem): void {
    patch(item.id, { status: 'uploading', progress: 0, message: '' })
    const openId = userStore.userInfo?.openId || 'anonymous'
    const cloudPath = `${dir}/${openId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${item.ext}`

    const task = wx.cloud.uploadFile({
      cloudPath,
      filePath: item.localPath,
      success: (res) =>
        patch(item.id, { fileID: res.fileID, status: 'done', progress: 100, message: '' }),
      fail: (err) => {
        logger.warn('useUpload', `upload ${cloudPath} fail`, err)
        // errMsg 进 message：页面/组件要分清「网络断了」和「存储权限没开」，只有「上传失败」四个字就只能重吹一次
        patch(item.id, {
          status: 'error',
          progress: 0,
          message: err.errMsg ? `上传失败：${err.errMsg}` : '上传失败'
        })
      }
    })

    if (task && typeof task.onProgressUpdate === 'function') {
      task.onProgressUpdate((res) => patch(item.id, { progress: res.progress }))
    }
  }

  function pick(): Promise<UploadItem[]> {
    return new Promise((resolve) => {
      const rest = remaining()
      if (rest <= 0) {
        fail(`最多 ${max} 张`)
        resolve([])
        return
      }
      uni.chooseMedia({
        count: rest,
        mediaType: ['image'],
        sourceType: options.sourceType ?? ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const added: UploadItem[] = []
          for (const file of res.tempFiles) {
            if (added.length >= rest) break
            const picked = { path: file.tempFilePath, size: file.size ?? 0 }
            const message = validate(picked)
            if (message) {
              fail(message)
              continue
            }
            const item: UploadItem = {
              id: createBlockId('f'),
              localPath: picked.path,
              fileID: '',
              size: picked.size,
              width: file.width ?? 0,
              height: file.height ?? 0,
              ext: extOf(picked.path) || 'jpg',
              status: 'pending',
              progress: 0,
              message: ''
            }
            added.push(item)
            files.value = [...files.value, item]
          }
          // 不 await：上传进度要立刻可见，选图结果先返回给页面渲染占位
          added.forEach(upload)
          resolve(added)
        },
        fail: (err) => {
          // 用户主动取消会走 fail(cancel)，不该弹错误提示
          logger.debug('useUpload', 'chooseMedia cancel', err)
          resolve([])
        }
      })
    })
  }

  /** 编辑态回填云端已有图片：没有本地路径，直接是 done 态 */
  function addExisting(fileID: string, width = 0, height = 0): UploadItem {
    const item: UploadItem = {
      id: createBlockId('f'),
      localPath: fileID,
      fileID,
      size: 0,
      width,
      height,
      ext: extOf(fileID) || 'png',
      status: 'done',
      progress: 100,
      message: ''
    }
    files.value = [...files.value, item]
    return item
  }

  /**
   * 上传一个**调用方已经拿到手**的本地临时路径，语义与 pick() 完全一致（校验 → 占位条目 → 立即开传 → 返回条目）。
   *
   * 为什么需要它：微信的头像填写能力（`<button open-type="chooseAvatar">`）是通过原生事件把
   * `avatarUrl`（一个 `wxfile://` 临时路径）交给页面的，根本不经过选图面板，pick() 在这里无路可走。
   * 在此之前的写法是组件自己手搓 `UploadItem` 塞进 `files.value` 再 `retry()` —— 那条路绕过了
   * `validate()` 与 `remaining()`（体积/格式/张数三个上限全部形同虚设），而且是整盘覆盖 `files.value`，
   * 一个实例里已有条目会被直接吃掉。路径由外部决定这件事是合理需求，绕过校验不是。
   *
   * 返回 undefined = 没进队列（路径为空 / 校验不过 / 已满），失败原因照旧由 fail() 弹一条，调用方不补第二条。
   */
  function uploadLocal(
    localPath: string,
    meta: { size?: number; width?: number; height?: number } = {}
  ): UploadItem | undefined {
    if (!localPath) return undefined
    if (remaining() <= 0) {
      fail(`最多 ${max} 张`)
      return undefined
    }
    const picked = { path: localPath, size: meta.size ?? 0 }
    const message = validate(picked)
    if (message) {
      fail(message)
      return undefined
    }
    const item: UploadItem = {
      id: createBlockId('f'),
      localPath: picked.path,
      fileID: '',
      size: picked.size,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      ext: extOf(picked.path) || 'png',
      status: 'pending',
      progress: 0,
      message: ''
    }
    files.value = [...files.value, item]
    upload(item)
    return item
  }

  function retry(id: string): void {
    const item = files.value.find((file) => file.id === id)
    if (item && item.status !== 'done') upload(item)
  }

  function remove(id: string): void {
    // 云端不做删除（v2 由 scheduler 清孤儿文件），这里只摘掉本地条目，§8.2 第 4 条
    files.value = files.value.filter((item) => item.id !== id)
  }

  function clear(): void {
    files.value = []
  }

  return {
    files,
    pick,
    retry,
    remove,
    clear,
    addExisting,
    uploadLocal,
    failedIds,
    /** 全部上传完成且至少一张时才可提交 */
    done: computed(
      () => files.value.length > 0 && files.value.every((item) => item.status === 'done')
    ),
    uploading: computed(() => files.value.some((item) => item.status !== 'done')),
    isFull: computed(() => files.value.length >= max),
    fileIDs: computed(() => files.value.filter((item) => item.fileID).map((item) => item.fileID)),
    max
  }
}
