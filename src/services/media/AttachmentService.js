import { createAttachment } from '@/models/Attachment.js'
import { IndexedDbAttachmentDataProvider } from '@/providers/media/IndexedDbAttachmentDataProvider.js'
import { createImageThumbnail } from './createImageThumbnail.js'

export class AttachmentService {
  /**
   * @param {import('../../repositories/interfaces/AttachmentRepository.js').AttachmentRepository} repository
   * @param {import('../../providers/media/MediaProvider.js').MediaProvider} mediaProvider
   * @param {import('../../providers/media/AttachmentDataProvider.js').AttachmentDataProvider} [dataProvider]
   * @param {(blob: Blob) => Promise<Blob | null>} [thumbnailGenerator]
   */
  constructor(
    repository,
    mediaProvider,
    dataProvider = new IndexedDbAttachmentDataProvider(repository),
    thumbnailGenerator = createImageThumbnail,
  ) {
    this.repository = repository
    this.mediaProvider = mediaProvider
    this.dataProvider = dataProvider
    this.thumbnailGenerator = thumbnailGenerator
    this.runtimeUrls = new Map()
  }

  /**
   * @param {string} diaryId
   * @param {{ source?: 'gallery' | 'camera' }} [options]
   */
  async addImage(diaryId, options = {}) {
    const picked = await this.mediaProvider.pickImage({ ...options, diaryId })
    if (!picked) return null
    return this.savePickedImage(diaryId, picked, { captureId: picked.captureId ?? null })
  }

  /**
   * @param {string} diaryId
   * @param {{ blob: Blob, mimeType: string, fileName: string, width: number | null, height: number | null, size: number }} picked
   * @param {{ captureId?: string | null }} [options]
   */
  async savePickedImage(diaryId, picked, options = {}) {
    if (!(picked?.blob instanceof Blob)) throw new Error('图片数据无效')

    let thumbnailBlob = null
    try {
      thumbnailBlob = await this.thumbnailGenerator(picked.blob)
    } catch {
      // 不让缩略图失败阻止原图保存；列表会跳过缺失缩略图并可在后续读取时重试。
    }

    const attachment = createAttachment({
      diaryId,
      type: 'image',
      mimeType: picked.mimeType,
      fileName: picked.fileName,
      width: picked.width,
      height: picked.height,
      size: picked.size,
      thumbnailMimeType: thumbnailBlob?.type || 'image/jpeg',
      thumbnailSize: thumbnailBlob?.size ?? null,
      encrypted: false,
      captureId: options.captureId ?? null,
    })
    const locations = this.dataProvider.getStorageUris(attachment.id)
    attachment.localUri = locations.localUri
    attachment.thumbnailUri = thumbnailBlob ? locations.thumbnailUri : ''

    const saved = await this.dataProvider.save(attachment, picked.blob, thumbnailBlob)
    return this.toRuntimeAttachment(saved, picked.blob, thumbnailBlob)
  }

  /** @param {string} diaryId @param {string} captureId */
  async findByCaptureId(diaryId, captureId) {
    const attachments = await this.repository.listByDiaryId(diaryId)
    return attachments.find((attachment) => attachment.captureId === captureId) ?? null
  }

  /** 确认原图与 Diary Block 都已保存，才消费原生相机恢复上下文。 */
  async completeCapture(captureId) {
    await this.mediaProvider.completeCapture?.(captureId)
  }

  async listMetadata() {
    return this.repository.listAll()
  }

  /** @param {string} diaryId */
  async listImages(diaryId) {
    const attachments = await this.repository.listByDiaryId(diaryId)
    const runtimeAttachments = []

    for (const attachment of attachments) {
      if (attachment.type !== 'image') continue
      const blob = await this.dataProvider.read(attachment, 'original')
      if (!blob) continue
      runtimeAttachments.push(this.toRuntimeAttachment(attachment, blob))
    }

    return runtimeAttachments
  }

  /** @param {string} attachmentId */
  async getRuntimeAttachment(attachmentId) {
    const attachment = await this.repository.findById(attachmentId)
    if (!attachment) return null
    const blob = await this.dataProvider.read(attachment, 'original')
    if (!blob) return null
    return this.toRuntimeAttachment(attachment, blob)
  }

  /** @param {string} attachmentId */
  async getRuntimeThumbnail(attachmentId) {
    let attachment = await this.repository.findById(attachmentId)
    if (!attachment || attachment.type !== 'image') return null

    let thumbnailBlob = await this.dataProvider.read(attachment, 'thumbnail')
    if (!thumbnailBlob) {
      const originalBlob = await this.dataProvider.read(attachment, 'original')
      if (!originalBlob) return null
      try {
        thumbnailBlob = await this.thumbnailGenerator(originalBlob)
      } catch {
        thumbnailBlob = null
      }
      if (!thumbnailBlob) return null

      attachment = createAttachment({
        ...attachment,
        thumbnailUri: this.dataProvider.getStorageUris(attachment.id).thumbnailUri,
        thumbnailMimeType: thumbnailBlob.type || 'image/jpeg',
        thumbnailSize: thumbnailBlob.size,
      })
      try {
        attachment = await this.dataProvider.saveThumbnail(attachment, thumbnailBlob)
      } catch (error) {
        // 图片可能在缩略图生成期间被删除；列表应跳过它，而不是整页加载失败。
        if (!(await this.repository.findById(attachment.id))) return null
        throw error
      }
    }

    return {
      ...attachment,
      thumbnailUrl: this.getRuntimeUrl(attachment.id, 'thumbnail', thumbnailBlob),
    }
  }

  /**
   * @param {Array<{ id: string, attachmentIds?: string[] }>} diaries
   * @returns {Promise<Record<string, string>>}
   */
  async getThumbnailUrlMap(diaries) {
    const result = {}

    for (const diary of diaries) {
      const firstAttachmentId = diary.attachmentIds?.[0]
      if (!firstAttachmentId) continue
      const runtimeThumbnail = await this.getRuntimeThumbnail(firstAttachmentId)
      if (runtimeThumbnail?.thumbnailUrl) result[diary.id] = runtimeThumbnail.thumbnailUrl
    }

    return result
  }

  /** @param {string} diaryId */
  async removeByDiaryId(diaryId) {
    const attachments = await this.repository.listByDiaryId(diaryId)
    for (const attachment of attachments) await this.remove(attachment.id)
  }

  /** @param {string} attachmentId */
  async remove(attachmentId) {
    const attachment = await this.repository.findById(attachmentId)
    if (!attachment) {
      this.release(attachmentId)
      return
    }
    await this.dataProvider.delete(attachment)
    this.release(attachmentId)
  }

  /**
   * 删除一个 image Block 后，仅当已保存日记不再引用该附件时才删除二进制。
   * 历史备份可能有多个 Block 共用一个附件 ID。
   * @param {string} attachmentId
   * @param {{ blocks?: Array<object>, attachmentIds?: string[] } | null} savedDiary
   */
  async removeIfUnreferenced(attachmentId, savedDiary) {
    if (!savedDiary || !Array.isArray(savedDiary.blocks) ||
        !Array.isArray(savedDiary.attachmentIds)) {
      throw new Error('请先保存日记，再清理图片附件。')
    }
    if (savedDiary?.attachmentIds?.includes(attachmentId)) return false
    if (savedDiary?.blocks?.some((block) =>
      block.type === 'image' && block.attachmentId === attachmentId)) return false
    await this.remove(attachmentId)
    return true
  }

  /**
   * App 启动时清理没有任何 Diary Block/attachmentIds 引用的附件。
   * @param {Array<{ blocks?: Array<object>, attachmentIds?: string[] }>} diaries
   * @param {{ protectedCaptureIds?: string[] }} [options]
   */
  async cleanupOrphans(diaries, { protectedCaptureIds = [] } = {}) {
    const referenced = new Set()
    for (const diary of diaries) {
      diary.attachmentIds?.forEach((id) => referenced.add(id))
      diary.blocks
        ?.filter((block) => block.type === 'image')
        .forEach((block) => referenced.add(block.attachmentId))
    }

    const attachments = await this.repository.listAll()
    for (const attachment of attachments) {
      if (attachment.captureId && protectedCaptureIds.includes(attachment.captureId)) continue
      if (!referenced.has(attachment.id)) await this.remove(attachment.id)
    }
    await this.reconcileStorage()
  }

  /** 清理原生 Filesystem 中不再有 metadata 的派生镜像。 */
  async reconcileStorage() {
    const attachments = await this.repository.listAll()
    await this.dataProvider.cleanup?.(attachments.map((attachment) => attachment.id))
  }

  /** @param {string} attachmentId */
  release(attachmentId) {
    for (const variant of ['original', 'thumbnail']) {
      const key = `${attachmentId}:${variant}`
      const url = this.runtimeUrls.get(key)
      if (url) URL.revokeObjectURL(url)
      this.runtimeUrls.delete(key)
    }
  }

  releaseAll() {
    for (const url of this.runtimeUrls.values()) URL.revokeObjectURL(url)
    this.runtimeUrls.clear()
  }

  /**
   * @param {import('../../models/Attachment.js').Attachment} attachment
   * @param {Blob} blob
   * @param {Blob | null} [thumbnailBlob]
   */
  toRuntimeAttachment(attachment, blob, thumbnailBlob = null) {
    return {
      ...attachment,
      url: this.getRuntimeUrl(attachment.id, 'original', blob),
      ...(thumbnailBlob
        ? { thumbnailUrl: this.getRuntimeUrl(attachment.id, 'thumbnail', thumbnailBlob) }
        : {}),
    }
  }

  getRuntimeUrl(attachmentId, variant, blob) {
    const key = `${attachmentId}:${variant}`
    let url = this.runtimeUrls.get(key)
    if (!url) {
      url = URL.createObjectURL(blob)
      this.runtimeUrls.set(key, url)
    }
    return url
  }
}
