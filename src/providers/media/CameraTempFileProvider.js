import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

const CAMERA_FILE_PATTERN = /^JPEG_\d{8}_\d{6}_\d+\.jpg$/
const PHOTO_DIRECTORY = 'Pictures'
const RETENTION_MS = 24 * 60 * 60 * 1000

/** 只识别 Capacitor Camera 在当前应用 External/Pictures 下创建的临时照片。 */
export function cameraTempFileName(photo) {
  if (typeof photo?.tempFileName === 'string' &&
      CAMERA_FILE_PATTERN.test(photo.tempFileName)) return photo.tempFileName
  if (typeof photo?.path !== 'string') return null
  const match = /^file:\/\/\/.+\/Android\/data\/[^/]+\/files\/Pictures\/(JPEG_\d{8}_\d{6}_\d+\.jpg)$/.exec(photo.path)
  return match?.[1] ?? null
}

/**
 * Camera 7 的 ACTION_IMAGE_CAPTURE 会在 External/Pictures 留下原始临时文件。
 * 仅操作当前应用的 Directory.External 和严格匹配的插件文件名。
 */
export class CameraTempFileProvider {
  constructor(filesystem = Filesystem, capacitor = Capacitor, now = () => Date.now()) {
    this.filesystem = filesystem
    this.capacitor = capacitor
    this.now = now
  }

  get available() {
    return this.capacitor.isNativePlatform() && this.capacitor.getPlatform() === 'android'
  }

  async list() {
    if (!this.available) return []
    try {
      const result = await this.filesystem.readdir({
        path: PHOTO_DIRECTORY,
        directory: Directory.External,
      })
      return (result.files ?? []).filter(
        (file) => file.type === 'file' && CAMERA_FILE_PATTERN.test(file.name),
      )
    } catch {
      return []
    }
  }

  /** 原插件恢复结果报错时，尝试拾回其已经写完的本次拍照文件。 */
  async recoverPhoto(startedAt) {
    if (!Number.isFinite(startedAt)) return null
    const candidates = (await this.list())
      .filter((file) => file.size > 0 && Number.isFinite(file.mtime) &&
        file.mtime >= startedAt - 5000 && file.mtime <= this.now() + 30000)
      .sort((a, b) => b.mtime - a.mtime)
    const file = candidates[0]
    if (!file) return null
    try {
      const { uri } = await this.filesystem.getUri({
        path: `${PHOTO_DIRECTORY}/${file.name}`,
        directory: Directory.External,
      })
      return {
        path: uri,
        webPath: this.capacitor.convertFileSrc(uri),
        format: 'jpeg',
        tempFileName: file.name,
      }
    } catch {
      return null
    }
  }

  async delete(fileName) {
    if (!this.available || !CAMERA_FILE_PATTERN.test(fileName ?? '')) return
    try {
      await this.filesystem.deleteFile({
        path: `${PHOTO_DIRECTORY}/${fileName}`,
        directory: Directory.External,
      })
    } catch {
      // canonical 附件已在 IndexedDB；临时文件由下次启动清理。
    }
  }

  /** 保留 24 小时内尚可恢复的非空照片；零字节和过期临时文件可安全清理。 */
  async cleanupAbandoned(protectedFileName = null) {
    const files = await this.list()
    for (const file of files) {
      if (file.name === protectedFileName) continue
      if (file.size === 0 ||
          (Number.isFinite(file.mtime) && file.mtime < this.now() - RETENTION_MS)) {
        await this.delete(file.name)
      }
    }
  }
}
