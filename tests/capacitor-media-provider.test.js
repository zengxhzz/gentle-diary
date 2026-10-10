import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  getPhoto: vi.fn(),
  addListener: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
}))
vi.mock('@capacitor/app', () => ({
  App: { addListener: native.addListener },
}))
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: native.getPhoto },
  CameraResultType: { Uri: 'uri' },
  CameraSource: { Camera: 'camera', Photos: 'photos' },
}))
vi.mock('@/providers/media/BrowserMediaProvider.js', () => ({
  BrowserMediaProvider: class {},
  readImageDimensions: vi.fn(async () => ({ width: 160, height: 90 })),
}))

import { CameraRestoreCoordinator } from '@/providers/media/CameraRestoreCoordinator.js'
import { CapacitorMediaProvider } from '@/providers/media/CapacitorMediaProvider.js'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

let originalFetch
let cameraTemps

beforeEach(() => {
  vi.clearAllMocks()
  native.addListener.mockResolvedValue({ remove: vi.fn() })
  native.getPhoto.mockResolvedValue({ webPath: 'capacitor://photo-1', format: 'jpeg' })
  originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn(async () => ({
    blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
  }))
  cameraTemps = {
    recoverPhoto: vi.fn(async () => null),
    delete: vi.fn(async () => {}),
    cleanupAbandoned: vi.fn(async () => {}),
  }
})

afterEach(() => { globalThis.fetch = originalFetch })

describe('CapacitorMediaProvider capture staging', () => {
  it('stages a normal picker result until its image Block is durably saved', async () => {
    const coordinator = new CameraRestoreCoordinator(new MemoryStorage(), () => 1000)
    const provider = new CapacitorMediaProvider({}, coordinator, cameraTemps)

    const picked = await provider.pickImage({ source: 'gallery', diaryId: 'diary-1' })

    expect(picked).toMatchObject({ mimeType: 'image/jpeg', width: 160, height: 90 })
    expect(coordinator.readStaged()).toMatchObject({
      captureId: picked.captureId,
      diaryId: 'diary-1',
      photo: { webPath: 'capacitor://photo-1' },
    })
    await provider.completeCapture(picked.captureId)
    expect(coordinator.readStaged()).toBeNull()
    expect(coordinator.wasProcessed(picked.captureId)).toBe(true)
  })

  it('replays a staged URI after process restart and keeps it pending on read failure', async () => {
    const coordinator = new CameraRestoreCoordinator(new MemoryStorage(), () => 1000)
    const captureId = coordinator.begin({ source: 'camera', diaryId: 'diary-2' })
    coordinator.stage(captureId, { webPath: 'capacitor://photo-2', format: 'jpeg' })
    globalThis.fetch = vi.fn(async () => { throw new Error('cache unavailable') })
    const provider = new CapacitorMediaProvider({}, coordinator, cameraTemps)
    const listener = vi.fn()

    provider.onRestoredImage(listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))

    expect(listener.mock.calls[0][0]).toMatchObject({
      captureId, diaryId: 'diary-2', error: 'cache unavailable',
    })
    expect(coordinator.readStaged()).not.toBeNull()
    expect(provider.getPendingCaptureIds()).toEqual([captureId])
  })

  it('rescues a recent camera output file when the restored Camera callback reports cancellation', async () => {
    const coordinator = new CameraRestoreCoordinator(new MemoryStorage(), () => 1000)
    const captureId = coordinator.begin({ source: 'camera', diaryId: 'diary-3' })
    cameraTemps.recoverPhoto.mockResolvedValue({
      webPath: 'capacitor://recovered', format: 'jpeg',
      tempFileName: 'JPEG_20261003_024124_123.jpg',
    })
    const provider = new CapacitorMediaProvider({}, coordinator, cameraTemps)
    const listener = vi.fn()
    provider.onRestoredImage(listener)

    await provider.handleRestoredResult({
      pluginId: 'Camera', methodName: 'getPhoto', success: false,
      error: { message: 'User cancelled photos app' },
    })

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      captureId, diaryId: 'diary-3', picked: expect.objectContaining({ size: 5 }),
    }))
    expect(coordinator.readStaged()?.photo.tempFileName).toBe('JPEG_20261003_024124_123.jpg')
    await provider.completeCapture(captureId)
    expect(cameraTemps.delete).toHaveBeenCalledWith('JPEG_20261003_024124_123.jpg')
  })

  it('reports an unrecoverable process-death camera result instead of silently treating it as cancellation', async () => {
    const coordinator = new CameraRestoreCoordinator(new MemoryStorage(), () => 1000)
    coordinator.begin({ source: 'camera', diaryId: 'diary-4' })
    const provider = new CapacitorMediaProvider({}, coordinator, cameraTemps)
    const listener = vi.fn()
    provider.onRestoredImage(listener)

    await provider.handleRestoredResult({
      pluginId: 'Camera', methodName: 'getPhoto', success: false,
      error: { message: 'User cancelled photos app' },
    })

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      diaryId: 'diary-4', error: expect.stringContaining('请重新拍摄'),
    }))
    expect(coordinator.readPending()).toBeNull()
    expect(cameraTemps.cleanupAbandoned).toHaveBeenCalled()
  })
})
