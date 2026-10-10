import { AttachmentDataProvider } from './AttachmentDataProvider.js'

/** IndexedDB/WebView 兼容实现，也是原生 Filesystem 的可靠回退。 */
export class IndexedDbAttachmentDataProvider extends AttachmentDataProvider {
  constructor(repository) {
    super()
    this.repository = repository
  }

  getStorageUris(attachmentId) {
    return {
      localUri: `indexeddb://attachment/${attachmentId}`,
      thumbnailUri: `indexeddb://thumbnail/${attachmentId}`,
    }
  }

  async save(attachment, blob, thumbnailBlob = null) {
    return this.repository.save(attachment, blob, thumbnailBlob)
  }

  async read(attachment, variant = 'original') {
    return variant === 'thumbnail'
      ? this.repository.getThumbnail(attachment.id)
      : this.repository.getBlob(attachment.id)
  }

  async saveThumbnail(attachment, blob) {
    return this.repository.saveThumbnail(attachment, blob)
  }

  async delete(attachment) {
    return this.repository.delete(attachment.id)
  }

  async cleanup(_validAttachmentIds) {
    // IndexedDB 二进制与 metadata 由 Repository 在同一删除流程中维护，无额外镜像需要清理。
  }
}
