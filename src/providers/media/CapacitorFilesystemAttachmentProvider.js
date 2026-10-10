import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { AttachmentDataProvider } from './AttachmentDataProvider.js'

const ATTACHMENT_DIRECTORY = 'gentle-diary/attachments'

/**
 * Android/iOS 使用应用私有 Directory.Data 保存附件文件。
 * IndexedDB Provider 保留为兼容副本，使旧附件和导入备份无需破坏性迁移。
 */
export class CapacitorFilesystemAttachmentProvider extends AttachmentDataProvider {
  constructor(fallbackProvider) {
    super()
    this.fallbackProvider = fallbackProvider
  }

  getStorageUris(attachmentId) {
    if (!Capacitor.isNativePlatform()) return this.fallbackProvider.getStorageUris(attachmentId)
    return {
      localUri: `filesystem://DATA/${originalPath(attachmentId)}`,
      thumbnailUri: `filesystem://DATA/${thumbnailPath(attachmentId)}`,
    }
  }

  async save(attachment, blob, thumbnailBlob = null) {
    const saved = await this.fallbackProvider.save(attachment, blob, thumbnailBlob)
    if (!Capacitor.isNativePlatform()) return saved

    try {
      await ensureDirectory()
      await writeBlob(originalPath(saved.id), blob)
      if (thumbnailBlob) await writeBlob(thumbnailPath(saved.id), thumbnailBlob)
    } catch {
      // IndexedDB 中的原始数据已经原子保存，Filesystem 失败时继续使用回退副本。
    }
    return saved
  }

  async read(attachment, variant = 'original') {
    const uri = variant === 'thumbnail' ? attachment.thumbnailUri : attachment.localUri
    if (Capacitor.isNativePlatform() && uri?.startsWith('filesystem://')) {
      try {
        const result = await Filesystem.readFile({
          path: variant === 'thumbnail' ? thumbnailPath(attachment.id) : originalPath(attachment.id),
          directory: Directory.Data,
        })
        const blob = filesystemDataToBlob(
          result.data,
          variant === 'thumbnail' ? attachment.thumbnailMimeType : attachment.mimeType,
        )
        const expectedSize = variant === 'thumbnail' ? attachment.thumbnailSize : attachment.size
        // A mirror write may have been interrupted by process death or disk failure.
        // Never prefer an empty/truncated mirror over the canonical IndexedDB copy.
        if (!blob.size || (expectedSize != null && blob.size !== expectedSize)) {
          throw new Error('Attachment mirror size mismatch')
        }
        return blob
      } catch {
        // 旧数据、导入数据或文件丢失时读取 IndexedDB 兼容副本。
      }
    }
    return this.fallbackProvider.read(attachment, variant)
  }

  async saveThumbnail(attachment, blob) {
    const saved = await this.fallbackProvider.saveThumbnail(attachment, blob)
    if (!Capacitor.isNativePlatform()) return saved
    try {
      await ensureDirectory()
      await writeBlob(thumbnailPath(attachment.id), blob)
    } catch {
      // 缩略图仍在 IndexedDB，可继续安全显示。
    }
    return saved
  }

  async delete(attachment) {
    // IndexedDB is the canonical copy. A mirror deletion failure must not leave
    // stale metadata that makes later full backups fail; startup cleanup retries it.
    await this.fallbackProvider.delete(attachment)
    if (Capacitor.isNativePlatform()) {
      for (const path of [originalPath(attachment.id), thumbnailPath(attachment.id)]) {
        try {
          await Filesystem.deleteFile({ path, directory: Directory.Data })
        } catch {
          // An unreferenced private mirror is cleaned on the next reconcileStorage().
        }
      }
    }
  }

  async cleanup(validAttachmentIds) {
    await this.fallbackProvider.cleanup?.(validAttachmentIds)
    if (!Capacitor.isNativePlatform()) return

    let files
    try {
      const result = await Filesystem.readdir({
        path: ATTACHMENT_DIRECTORY,
        directory: Directory.Data,
      })
      files = result.files ?? []
    } catch (error) {
      if (isMissingFileError(error)) return
      throw error
    }

    const validFileNames = new Set()
    for (const attachmentId of validAttachmentIds) {
      const encodedId = encodeURIComponent(attachmentId)
      validFileNames.add(`${encodedId}.bin`)
      validFileNames.add(`${encodedId}.thumb`)
    }

    for (const file of files) {
      const name = typeof file === 'string' ? file : file.name
      if (!name || validFileNames.has(name)) continue
      try {
        await Filesystem.deleteFile({
          path: `${ATTACHMENT_DIRECTORY}/${name}`,
          directory: Directory.Data,
        })
      } catch (error) {
        if (!isMissingFileError(error)) throw error
      }
    }
  }
}

async function ensureDirectory() {
  try {
    await Filesystem.mkdir({
      path: ATTACHMENT_DIRECTORY,
      directory: Directory.Data,
      recursive: true,
    })
  } catch (error) {
    if (error?.code !== 'OS-PLUG-FILE-0010' && !String(error?.message ?? '').includes('exist')) {
      throw error
    }
  }
}

async function writeBlob(path, blob) {
  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data: await blobToBase64(blob),
    recursive: true,
  })
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function filesystemDataToBlob(data, mimeType) {
  if (data instanceof Blob) return data
  const binary = atob(String(data))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' })
}

function originalPath(attachmentId) {
  return `${ATTACHMENT_DIRECTORY}/${encodeURIComponent(attachmentId)}.bin`
}

function thumbnailPath(attachmentId) {
  return `${ATTACHMENT_DIRECTORY}/${encodeURIComponent(attachmentId)}.thumb`
}

function isMissingFileError(error) {
  return (
    error?.code === 'OS-PLUG-FILE-0008' ||
    /not found|does not exist/i.test(String(error?.message ?? ''))
  )
}
