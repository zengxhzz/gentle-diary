import { INDEX_NAMES, STORE_NAMES } from '@/database/schemas/schema.js'
import { createAttachment } from '@/models/Attachment.js'

/** @implements {import('../interfaces/AttachmentRepository.js').AttachmentRepository} */
export class IndexedDbAttachmentRepository {
  /** @param {import('../../providers/storage/IndexedDbStorageProvider.js').IndexedDbStorageProvider} storage */
  constructor(storage) {
    this.storage = storage
  }

  /**
   * @param {import('../../models/Attachment.js').Attachment} attachment
   * @param {Blob} blob
   * @param {Blob | null} [thumbnailBlob]
   */
  async save(attachment, blob, thumbnailBlob = null) {
    const normalized = createAttachment(attachment)
    if (thumbnailBlob) {
      normalized.thumbnailSize = thumbnailBlob.size
      normalized.thumbnailMimeType = thumbnailBlob.type || normalized.thumbnailMimeType
    }
    await this.storage.putMany([
      { storeName: STORE_NAMES.ATTACHMENTS, value: normalized },
      {
        storeName: STORE_NAMES.ATTACHMENT_BLOBS,
        value: { attachmentId: normalized.id, blob },
      },
      ...(thumbnailBlob
        ? [{
            storeName: STORE_NAMES.THUMBNAIL_BLOBS,
            value: { attachmentId: normalized.id, blob: thumbnailBlob },
          }]
        : []),
    ])
    return normalized
  }

  /** @param {string} id */
  async findById(id) {
    const record = await this.storage.get(STORE_NAMES.ATTACHMENTS, id)
    return record ? createAttachment(record) : null
  }

  /** @param {string} diaryId */
  async listByDiaryId(diaryId) {
    const records = await this.storage.getAllByIndex(
      STORE_NAMES.ATTACHMENTS,
      INDEX_NAMES.ATTACHMENT_DIARY_ID,
      diaryId,
    )
    return records.map(createAttachment)
  }

  /** @param {string} attachmentId */
  async getBlob(attachmentId) {
    const record = await this.storage.get(STORE_NAMES.ATTACHMENT_BLOBS, attachmentId)
    return record?.blob ?? null
  }

  /** @param {string} attachmentId */
  async getThumbnail(attachmentId) {
    const record = await this.storage.get(STORE_NAMES.THUMBNAIL_BLOBS, attachmentId)
    return record?.blob ?? null
  }

  /** @param {import('../../models/Attachment.js').Attachment} attachment @param {Blob} blob */
  async saveThumbnail(attachment, blob) {
    const database = await this.storage.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAMES.ATTACHMENTS, STORE_NAMES.THUMBNAIL_BLOBS],
        'readwrite',
      )
      const attachments = transaction.objectStore(STORE_NAMES.ATTACHMENTS)
      const thumbnails = transaction.objectStore(STORE_NAMES.THUMBNAIL_BLOBS)
      let saved = null

      attachments.get(attachment.id).onsuccess = (event) => {
        const current = event.target.result
        if (!current) {
          // 清理可能由旧版本留下的孤儿 blob，且不写回已删除的 metadata。
          thumbnails.delete(attachment.id)
          return
        }

        saved = createAttachment({
          ...current,
          thumbnailUri: current.thumbnailUri || attachment.thumbnailUri,
          thumbnailSize: blob.size,
          thumbnailMimeType: blob.type || current.thumbnailMimeType,
        })
        attachments.put(saved)
        thumbnails.put({ attachmentId: attachment.id, blob })
      }

      transaction.oncomplete = () => {
        if (saved) resolve(saved)
        else reject(new Error('附件已删除，无法保存缩略图'))
      }
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
  }

  async listAll() {
    const records = await this.storage.getAll(STORE_NAMES.ATTACHMENTS)
    return records.map(createAttachment)
  }

  /** @param {string} attachmentId */
  async delete(attachmentId) {
    await this.storage.deleteMany([
      { storeName: STORE_NAMES.ATTACHMENTS, key: attachmentId },
      { storeName: STORE_NAMES.ATTACHMENT_BLOBS, key: attachmentId },
      { storeName: STORE_NAMES.THUMBNAIL_BLOBS, key: attachmentId },
    ])
  }
}
