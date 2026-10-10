import { cameraTempFileName } from './CameraTempFileProvider.js'

const PENDING_KEY = 'gentle-diary.camera.pending'
const STAGED_KEY = 'gentle-diary.camera.staged'
const PROCESSED_KEY = 'gentle-diary.camera.processed'
const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1000
const MAX_PROCESSED_IDS = 24

/**
 * 保存外部 Camera Activity 的最小上下文与临时照片 URI。
 * 仅在附件和日记引用都持久化后确认完成；不在 localStorage 保存照片内容。
 */
export class CameraRestoreCoordinator {
  constructor(storage = getDefaultStorage(), now = () => Date.now()) {
    this.storage = storage
    this.now = now
  }

  /** @param {{ diaryId: string, source: 'camera' | 'gallery' }} context */
  begin(context) {
    if (this.readStaged()) {
      throw new Error('上一张图片仍在恢复，请重新打开日记后再试。')
    }
    const captureId = createCaptureId()
    this.storage.setItem(
      PENDING_KEY,
      JSON.stringify({
        captureId,
        diaryId: context.diaryId,
        source: context.source,
        startedAt: this.now(),
      }),
    )
    return captureId
  }

  /** @param {string} captureId */
  complete(captureId) {
    const pending = this.readPending()
    if (pending?.captureId === captureId) this.storage.removeItem(PENDING_KEY)
    const staged = this.readStaged()
    if (staged?.captureId === captureId) this.storage.removeItem(STAGED_KEY)
  }

  /** @param {string} captureId @param {{ webPath?: string, format?: string }} photo */
  stage(captureId, photo) {
    const pending = this.readPending()
    if (pending?.captureId !== captureId || !validPhoto(photo)) return null
    const staged = {
      ...pending,
      photo: {
        webPath: photo.webPath,
        format: photo.format ?? null,
        tempFileName: pending.source === 'camera' ? cameraTempFileName(photo) : null,
      },
    }
    this.storage.setItem(STAGED_KEY, JSON.stringify(staged))
    return staged
  }

  readStaged() {
    let staged
    try {
      staged = JSON.parse(this.storage.getItem(STAGED_KEY) ?? 'null')
    } catch {
      this.storage.removeItem(STAGED_KEY)
      return null
    }
    const pending = this.readPending()
    if (!staged || !pending || staged.captureId !== pending.captureId ||
        staged.diaryId !== pending.diaryId || !validPhoto(staged.photo)) {
      this.storage.removeItem(STAGED_KEY)
      return null
    }
    return staged
  }

  acknowledge(captureId) {
    this.complete(captureId)
    this.markProcessed(captureId)
  }

  /**
   * @param {{ pluginId?: string, methodName?: string, success?: boolean, data?: unknown, error?: { message?: string } }} event
   */
  consume(event) {
    if (event?.pluginId !== 'Camera' || event?.methodName !== 'getPhoto') return null
    const pending = this.readPending()
    if (!pending) return null

    if (this.wasProcessed(pending.captureId)) return null

    if (!event.success) {
      this.acknowledge(pending.captureId)
      return {
        status: 'failed',
        ...pending,
        error: event.error?.message ?? '拍照已取消或未能恢复。',
      }
    }

    const staged = this.stage(pending.captureId, event.data)
    if (!staged) return {
      status: 'failed',
      ...pending,
      error: '相机没有返回可读取的图片。',
    }
    return { status: 'success', ...staged }
  }

  readPending() {
    let pending
    try {
      pending = JSON.parse(this.storage.getItem(PENDING_KEY) ?? 'null')
    } catch {
      this.storage.removeItem(PENDING_KEY)
      return null
    }

    if (
      !pending ||
      typeof pending.captureId !== 'string' ||
      typeof pending.diaryId !== 'string' ||
      !['camera', 'gallery'].includes(pending.source) ||
      !Number.isFinite(pending.startedAt) ||
      this.now() - pending.startedAt > MAX_PENDING_AGE_MS
    ) {
      this.storage.removeItem(PENDING_KEY)
      return null
    }
    return pending
  }

  wasProcessed(captureId) {
    return this.readProcessed().includes(captureId)
  }

  markProcessed(captureId) {
    const processed = this.readProcessed().filter((id) => id !== captureId)
    processed.push(captureId)
    this.storage.setItem(PROCESSED_KEY, JSON.stringify(processed.slice(-MAX_PROCESSED_IDS)))
  }

  readProcessed() {
    try {
      const parsed = JSON.parse(this.storage.getItem(PROCESSED_KEY) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
    } catch {
      return []
    }
  }
}

function validPhoto(photo) {
  return photo && typeof photo === 'object' &&
    typeof photo.webPath === 'string' && photo.webPath.length > 0 &&
    photo.webPath.length <= 8192 && !photo.webPath.startsWith('data:') &&
    (photo.format == null ||
      (typeof photo.format === 'string' && photo.format.length <= 32))
}

function getDefaultStorage() {
  if (typeof localStorage !== 'undefined') return localStorage
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

function createCaptureId() {
  if (globalThis.crypto?.randomUUID) return `camera-${globalThis.crypto.randomUUID()}`
  return `camera-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
