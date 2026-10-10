import { App } from '@capacitor/app'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'
import { BrowserMediaProvider, readImageDimensions } from './BrowserMediaProvider.js'
import { CameraRestoreCoordinator } from './CameraRestoreCoordinator.js'
import { CameraTempFileProvider } from './CameraTempFileProvider.js'
import { MediaProvider } from './MediaProvider.js'

/**
 * 原生端使用 Capacitor Camera，Web 端自动回退到浏览器文件选择。
 * Android 进程被回收时，恢复结果会排队交给上层恢复 Service。
 */
export class CapacitorMediaProvider extends MediaProvider {
  constructor(
    fallbackProvider = new BrowserMediaProvider(),
    restoreCoordinator = new CameraRestoreCoordinator(),
    cameraTempFileProvider = new CameraTempFileProvider(),
  ) {
    super()
    this.fallbackProvider = fallbackProvider
    this.restoreCoordinator = restoreCoordinator
    this.cameraTempFileProvider = cameraTempFileProvider
    this.restoredListeners = new Set()
    this.restoredQueue = []
    this.deliveryInFlight = new Set()
    this.deliveredCaptureIds = new Set()
    this.appListenerPromise = null
    this.initializeRestoreListener()
  }

  /** @param {{ source?: 'gallery' | 'camera', diaryId?: string }} [options] */
  async pickImage(options = {}) {
    if (!Capacitor.isNativePlatform()) {
      return this.fallbackProvider.pickImage(options)
    }

    const sourceName = options.source === 'camera' ? 'camera' : 'gallery'
    const source = sourceName === 'camera' ? CameraSource.Camera : CameraSource.Photos
    const captureId = options.diaryId
      ? this.restoreCoordinator.begin({ diaryId: options.diaryId, source: sourceName })
      : null

    let photo
    try {
      photo = await Camera.getPhoto({
        source,
        resultType: CameraResultType.Uri,
        quality: 90,
        width: 2400,
        height: 2400,
        correctOrientation: true,
        saveToGallery: false,
      })
    } catch (error) {
      if (captureId) this.restoreCoordinator.complete(captureId)
      if (isCancellationError(error)) return null
      throw error
    }

    if (captureId && !this.restoreCoordinator.stage(captureId, photo)) {
      throw new Error('相机没有返回可恢复的图片地址。')
    }
    const picked = await this.photoToPickedImage(photo)
    return captureId ? { ...picked, captureId } : picked
  }

  initializeRestoreListener() {
    if (!Capacitor.isNativePlatform() || this.appListenerPromise) return
    this.appListenerPromise = App.addListener('appRestoredResult', (event) => {
      void this.handleRestoredResult(event)
    }).catch(() => null)
  }

  /** @param {(result: object) => void} listener */
  onRestoredImage(listener) {
    this.restoredListeners.add(listener)
    const queued = this.restoredQueue.splice(0)
    queued.forEach((result) => listener(result))
    void this.replayStagedResult()
    return () => this.restoredListeners.delete(listener)
  }

  getPendingCaptureIds() {
    const staged = this.restoreCoordinator.readStaged()
    return staged ? [staged.captureId] : []
  }

  async completeCapture(captureId) {
    if (!captureId) return
    const staged = this.restoreCoordinator.readStaged()
    try {
      this.restoreCoordinator.acknowledge(captureId)
    } catch {
      // 日记和附件已保存；确认记录失败只会使下次启动走去重恢复。
    }
    if (staged?.captureId === captureId && staged.source === 'camera') {
      await this.cameraTempFileProvider.delete(staged.photo.tempFileName)
    }
  }

  async handleRestoredResult(event) {
    const pending = this.restoreCoordinator.readPending()
    let effectiveEvent = event
    if (event?.pluginId === 'Camera' && event?.methodName === 'getPhoto' &&
        !event.success && pending?.source === 'camera') {
      const recoveredPhoto = await this.cameraTempFileProvider.recoverPhoto(pending.startedAt)
      if (recoveredPhoto) {
        effectiveEvent = { ...event, success: true, data: recoveredPhoto }
      }
    }
    const restored = this.restoreCoordinator.consume(effectiveEvent)
    if (!restored) return
    if (restored.status === 'failed') {
      // 这是进程重建后的结果；即使插件称为“取消”，也不能静默丢掉照片。
      this.emitRestored({ ...restored, error: '拍照未保存：可能已取消拍摄，或系统回收后相机未写入照片。请重新拍摄。' })
      await this.cleanupAbandonedCameraFiles()
      return
    }

    await this.deliverStagedResult(restored)
  }

  async replayStagedResult() {
    const staged = this.restoreCoordinator.readStaged()
    if (staged) await this.deliverStagedResult(staged)
  }

  async cleanupAbandonedCameraFiles() {
    const staged = this.restoreCoordinator.readStaged()
    await this.cameraTempFileProvider.cleanupAbandoned(staged?.photo?.tempFileName ?? null)
  }

  async deliverStagedResult(staged) {
    if (this.deliveryInFlight.has(staged.captureId) ||
        this.deliveredCaptureIds.has(staged.captureId)) return
    this.deliveryInFlight.add(staged.captureId)
    try {
      const picked = await this.photoToPickedImage(staged.photo)
      this.deliveredCaptureIds.add(staged.captureId)
      this.emitRestored({
        captureId: staged.captureId,
        diaryId: staged.diaryId,
        source: staged.source,
        picked,
      })
    } catch (error) {
      this.deliveredCaptureIds.add(staged.captureId)
      this.emitRestored({
        captureId: staged.captureId,
        diaryId: staged.diaryId,
        source: staged.source,
        error: error?.message ?? '无法读取恢复的照片。',
      })
    } finally {
      this.deliveryInFlight.delete(staged.captureId)
    }
  }

  emitRestored(result) {
    if (!this.restoredListeners.size) {
      this.restoredQueue.push(result)
      return
    }
    this.restoredListeners.forEach((listener) => listener(result))
  }

  async photoToPickedImage(photo) {
    if (!photo || typeof photo !== 'object' || !photo.webPath) {
      throw new Error('相机没有返回可读取的图片')
    }

    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    const dimensions = await readImageDimensions(blob)
    const format = photo.format || blob.type.split('/')[1] || 'jpeg'
    const mimeType = blob.type || `image/${format}`

    return {
      blob,
      fileName: `photo-${Date.now()}.${format}`,
      mimeType,
      size: blob.size,
      width: dimensions.width,
      height: dimensions.height,
    }
  }
}

function isCancellationError(error) {
  const message = String(error?.message ?? error ?? '').toLocaleLowerCase()
  return message.includes('cancel') || message.includes('取消')
}
