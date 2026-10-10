/**
 * Attachment Repository 契约。
 * metadata 与二进制 Blob 分开存储，但通过同一事务保存。
 * @interface
 */
export class AttachmentRepository {
  async save(_attachment, _blob, _thumbnailBlob = null) { throw new Error('Not implemented') }
  async findById(_id) { throw new Error('Not implemented') }
  async listByDiaryId(_diaryId) { throw new Error('Not implemented') }
  async getBlob(_attachmentId) { throw new Error('Not implemented') }
  async getThumbnail(_attachmentId) { throw new Error('Not implemented') }
  async saveThumbnail(_attachment, _blob) { throw new Error('Not implemented') }
  async listAll() { throw new Error('Not implemented') }
  async delete(_attachmentId) { throw new Error('Not implemented') }
}
