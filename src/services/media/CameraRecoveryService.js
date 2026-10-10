import { createImageBlock } from '@/models/Block.js'

/**
 * 将 appRestoredResult 转为完整的“附件 + image Block”恢复操作。
 * 普通异常会删除本次新建附件；成功前保留可重放的 URI 上下文。
 */
export class CameraRecoveryService {
  constructor({ mediaProvider, attachmentService, diaryService, diaryRepository }) {
    this.mediaProvider = mediaProvider
    this.attachmentService = attachmentService
    this.diaryService = diaryService
    this.diaryRepository = diaryRepository
    this.listeners = new Set()
    this.queue = []
    this.inFlight = new Set()
    this.initialized = false
    this.unsubscribeProvider = null
  }

  async initialize() {
    if (this.initialized) return
    this.initialized = true
    try {
      await this.cleanupRecoveredOrphans()
      await this.mediaProvider.cleanupAbandonedCameraFiles?.()
    } finally {
      this.unsubscribeProvider = this.mediaProvider.onRestoredImage((result) => {
        void this.process(result)
      })
    }
  }

  /** @param {(result: object) => void} listener */
  subscribe(listener) {
    this.listeners.add(listener)
    const queued = this.queue.splice(0)
    queued.forEach((result) => listener(result))
    return () => this.listeners.delete(listener)
  }

  async process(result) {
    if (!result?.captureId || this.inFlight.has(result.captureId)) return null
    this.inFlight.add(result.captureId)

    try {
      const diary = await this.diaryRepository.findById(result.diaryId)
      if (!diary || diary.deletedAt) {
        await this.mediaProvider.completeCapture?.(result.captureId)
        const outcome = {
          status: 'error',
          captureId: result.captureId,
          diaryId: result.diaryId,
          message: '拍照结果对应的日记已不存在，未保存照片。',
        }
        this.emit(outcome)
        return outcome
      }

      let attachment = await this.attachmentService.findByCaptureId(
        result.diaryId,
        result.captureId,
      )
      if (!attachment && (result.error || !result.picked)) {
        const outcome = {
          status: 'error',
          captureId: result.captureId,
          diaryId: result.diaryId,
          message: result.error ?? '无法恢复拍照结果。',
        }
        this.emit(outcome)
        return outcome
      }
      let created = false

      if (!attachment) {
        attachment = await this.attachmentService.savePickedImage(
          result.diaryId,
          result.picked,
          { captureId: result.captureId },
        )
        created = true
      }

      const alreadyInserted = diary.blocks.some(
        (block) => block.type === 'image' && block.attachmentId === attachment.id,
      )
      if (alreadyInserted) {
        const runtimeAttachment = attachment.url
          ? attachment
          : await this.attachmentService.getRuntimeAttachment(attachment.id)
        if (!runtimeAttachment?.url) throw new Error('已保存照片暂时无法读取，恢复上下文已保留。')
        const outcome = {
          status: 'duplicate',
          captureId: result.captureId,
          diaryId: diary.id,
          diary,
          attachment: runtimeAttachment,
        }
        await this.mediaProvider.completeCapture?.(result.captureId)
        this.emit(outcome)
        return outcome
      }

      let diaryCommitted = false
      try {
        const savedDiary = await this.diaryService.save({
          ...diary,
          blocks: [...diary.blocks, createImageBlock(attachment.id)],
        })
        diaryCommitted = true
        const runtimeAttachment = attachment.url
          ? attachment
          : await this.attachmentService.getRuntimeAttachment(attachment.id)
        if (!runtimeAttachment?.url) throw new Error('已保存照片暂时无法读取，恢复上下文已保留。')
        const outcome = {
          status: 'restored',
          captureId: result.captureId,
          diaryId: savedDiary.id,
          diary: savedDiary,
          attachment: runtimeAttachment,
        }
        await this.mediaProvider.completeCapture?.(result.captureId)
        this.emit(outcome)
        return outcome
      } catch (error) {
        // 一旦 Diary Block 已提交，绝不能因为后续读取或通知失败删除其附件。
        if (created && !diaryCommitted) await this.attachmentService.remove(attachment.id)
        throw error
      }
    } catch (error) {
      const outcome = {
        status: 'error',
        captureId: result.captureId,
        diaryId: result.diaryId,
        message: error?.message ?? '拍照结果恢复失败。',
      }
      this.emit(outcome)
      return outcome
    } finally {
      this.inFlight.delete(result.captureId)
    }
  }

  async cleanupRecoveredOrphans() {
    const diaries = await this.diaryRepository.listAll()
    await this.attachmentService.cleanupOrphans(diaries, {
      protectedCaptureIds: this.mediaProvider.getPendingCaptureIds?.() ?? [],
    })
  }

  emit(result) {
    if (!this.listeners.size) {
      this.queue.push(result)
      return
    }
    this.listeners.forEach((listener) => {
      try {
        listener(result)
      } catch {
        // 视图通知失败不能回滚已提交的日记和图片。
      }
    })
  }
}
