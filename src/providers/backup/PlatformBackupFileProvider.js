import { Capacitor, registerPlugin } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const BACKUP_DIRECTORY = 'gentle-diary/backups'
const SHARE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const OPERATION_ID_PATTERN = new RegExp(`^${UUID_PATTERN}$`, 'i')
const EXPORT_SOURCE_PATTERN = new RegExp(`^[a-z0-9._-]+-${UUID_PATTERN}\\.json$`, 'i')
const BackupDocument = registerPlugin('BackupDocument')

/**
 * Web 使用标准下载；Android 默认使用系统“创建文档”保存，iOS 使用系统分享。
 * 原生分享仍可显式选择，用于传输到用户信任的其他应用。
 */
export class PlatformBackupFileProvider {
  constructor({
    isNativePlatform = () => Capacitor.isNativePlatform(),
    getPlatform = () => Capacitor.getPlatform(),
    filesystem = Filesystem,
    share = Share,
    backupDocument = BackupDocument,
    browserDownload = downloadBlob,
    operationId = () => crypto.randomUUID(),
    clock = () => Date.now(),
  } = {}) {
    this.isNativePlatform = isNativePlatform
    this.getPlatform = getPlatform
    this.filesystem = filesystem
    this.share = share
    this.backupDocument = backupDocument
    this.browserDownload = browserDownload
    this.operationId = operationId
    this.clock = clock
    this.busy = false
  }

  supportsShareDelivery() {
    return this.isNativePlatform()
  }

  async getRecoveryStatus() {
    if (!this.isNativePlatform() || this.getPlatform() !== 'android') return { state: 'idle' }
    return this.backupDocument.getRecoveryStatus()
  }

  async exportFile(blob, fileName, { method = 'save' } = {}) {
    if (this.busy) {
      throw Object.assign(new Error('已有备份操作正在进行，请稍后再试。'), { code: 'BACKUP_BUSY' })
    }
    this.busy = true
    try {
      if (!(blob instanceof Blob) || typeof fileName !== 'string' || !fileName) {
        throw new TypeError('备份文件无效。')
      }

      if (!['save', 'share'].includes(method)) throw new TypeError('不支持的备份交付方式。')

      if (!this.isNativePlatform()) {
        if (method === 'share') throw new Error('网页环境不支持原生分享。')
        this.browserDownload(blob, fileName)
        return { method: 'download', fileName }
      }

      // BackupDocument is implemented only on Android. On iOS the share sheet
      // offers “Save to Files”; returning from it is not proof of durable delivery.
      if (method === 'save' && this.getPlatform() !== 'android') method = 'share'

      if (method === 'share') {
        const canShare = await this.share.canShare()
        if (!canShare?.value) throw new Error('当前设备无法打开系统分享面板。')
      }

      const safeFileName = sanitizeFileName(fileName)
      const sourceFileName = createSourceFileName(safeFileName, this.operationId())
      const path = `${BACKUP_DIRECTORY}/${sourceFileName}`
      const directory = method === 'save' ? Directory.Data : Directory.Cache
      if (method === 'share') await cleanupExportCache(this.filesystem, this.clock())
      const data = await blob.text()
      let result
      try {
        result = await this.filesystem.writeFile({
          path,
          directory,
          data,
          encoding: Encoding.UTF8,
          recursive: true,
        })
      } catch (error) {
        await deleteTemporaryExport(this.filesystem, path, directory)
        throw error
      }

      if (method === 'save') {
        let saved
        try {
          saved = await this.backupDocument.save({ fileName: safeFileName, sourceFileName })
        } catch (error) {
          // Only BACKUP_BUSY guarantees that native has not taken ownership.
          // All other save outcomes leave cleanup and recovery to the plugin.
          if (error?.code === 'BACKUP_BUSY') {
            await deleteTemporaryExport(this.filesystem, path, directory)
          }
          throw error
        }
        if (saved?.canceled === true) {
          return { method: 'document', fileName: safeFileName, canceled: true }
        }
        if (saved?.canceled !== false) {
          throw new Error('系统未确认备份写入，请核对目标文件。')
        }
        return {
          method: 'document',
          fileName: safeFileName,
          canceled: false,
          ...(saved.cleanupWarning ? { cleanupWarning: saved.cleanupWarning } : {}),
        }
      }

      try {
        await this.share.share({
          title: '日记备份',
          text: '完整日记备份（未加密，请保存到可信位置）',
          files: [result.uri],
          dialogTitle: '分享日记备份',
        })
      } catch (error) {
        if (isShareCanceled(error)) {
          return { method: 'share', fileName: safeFileName, canceled: true }
        }
        await deleteTemporaryExport(this.filesystem, path, directory)
        throw error
      }

      // The recipient may still be reading, including after reported cancellation.
      return { method: 'share', fileName: safeFileName }
    } finally {
      this.busy = false
    }
  }
}

async function cleanupExportCache(filesystem, now) {
  if (!Number.isFinite(now)) return
  let files
  try {
    const result = await filesystem.readdir({
      path: BACKUP_DIRECTORY,
      directory: Directory.Cache,
    })
    files = result.files ?? []
  } catch {
    // Cache maintenance must not prevent a new export.
    return
  }

  for (const file of files) {
    const name = file?.name
    const mtime = file?.mtime // FileInfo.mtime and Date.now() are milliseconds since the Unix epoch.
    if (typeof name !== 'string' || !EXPORT_SOURCE_PATTERN.test(name)) continue
    if (file.type && file.type !== 'file') continue
    // Providers may return zero or omit timestamps when metadata is unavailable.
    if (!Number.isFinite(mtime) || mtime <= 0 || now - mtime <= SHARE_CACHE_MAX_AGE_MS) continue
    await deleteTemporaryExport(filesystem, `${BACKUP_DIRECTORY}/${name}`, Directory.Cache)
  }
}

async function deleteTemporaryExport(filesystem, path, directory) {
  try {
    await filesystem.deleteFile({ path, directory })
  } catch {
    // Best-effort cleanup must preserve the delivery outcome or original error.
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function sanitizeFileName(fileName) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  return safe || 'gentle-diary-backup.json'
}

function createSourceFileName(fileName, operationId) {
  if (typeof operationId !== 'string' || !OPERATION_ID_PATTERN.test(operationId)) {
    throw new TypeError('备份操作标识无效。')
  }
  const base = fileName.replace(/\.json$/i, '') || 'gentle-diary-backup'
  return `${base}-${operationId}.json`
}

function isShareCanceled(error) {
  return /cancel(?:ed|led)?/i.test(String(error?.message ?? error ?? ''))
}

