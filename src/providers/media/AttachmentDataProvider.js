/**
 * 附件二进制 Provider 契约。页面不得直接调用。
 * @interface
 */
export class AttachmentDataProvider {
  getStorageUris(_attachmentId) { return { localUri: '', thumbnailUri: '' } }
  async save(_attachment, _blob, _thumbnailBlob = null) { throw new Error('Not implemented') }
  async read(_attachment, _variant = 'original') { throw new Error('Not implemented') }
  async saveThumbnail(_attachment, _blob) { throw new Error('Not implemented') }
  async delete(_attachment) { throw new Error('Not implemented') }
  async cleanup(_validAttachmentIds) {}
}
