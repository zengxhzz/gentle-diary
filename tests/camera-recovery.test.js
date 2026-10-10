import { describe, expect, it, vi } from 'vitest'
import { CameraRestoreCoordinator } from '@/providers/media/CameraRestoreCoordinator.js'
import { CameraRecoveryService } from '@/services/media/CameraRecoveryService.js'

class MemoryKeyValueStorage {
  constructor() {
    this.values = new Map()
  }

  getItem(key) {
    return this.values.get(key) ?? null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }

  removeItem(key) {
    this.values.delete(key)
  }
}

describe('CameraRestoreCoordinator', () => {
  it('keeps a restored Camera result replayable until the diary and attachment are committed', () => {
    const storage = new MemoryKeyValueStorage()
    const coordinator = new CameraRestoreCoordinator(storage, () => 1000)
    const captureId = coordinator.begin({ diaryId: 'diary-1', source: 'camera' })
    const event = {
      pluginId: 'Camera',
      methodName: 'getPhoto',
      success: true,
      data: { webPath: 'capacitor://photo' },
    }

    expect(coordinator.consume(event)).toMatchObject({
      status: 'success',
      captureId,
      diaryId: 'diary-1',
      source: 'camera',
    })
    expect(coordinator.readStaged()).toMatchObject({ captureId, photo: event.data })
    expect(coordinator.consume(event)).toMatchObject({ captureId, status: 'success' })
    coordinator.acknowledge(captureId)
    expect(coordinator.readStaged()).toBeNull()
    expect(coordinator.consume(event)).toBeNull()
    expect(coordinator.wasProcessed(captureId)).toBe(true)
  })

  it('clears failed or cancelled restored calls without producing image data', () => {
    const coordinator = new CameraRestoreCoordinator(new MemoryKeyValueStorage(), () => 1000)
    coordinator.begin({ diaryId: 'diary-2', source: 'camera' })

    const failed = coordinator.consume({
      pluginId: 'Camera',
      methodName: 'getPhoto',
      success: false,
      error: { message: 'User cancelled photos app' },
    })

    expect(failed).toMatchObject({ status: 'failed', diaryId: 'diary-2' })
    expect(coordinator.readPending()).toBeNull()
  })

  it('refuses a new camera request while an earlier photo is still pending recovery', () => {
    const coordinator = new CameraRestoreCoordinator(new MemoryKeyValueStorage(), () => 1000)
    const captureId = coordinator.begin({ diaryId: 'diary-1', source: 'gallery' })
    coordinator.stage(captureId, { webPath: 'capacitor://photo' })

    expect(() => coordinator.begin({ diaryId: 'diary-1', source: 'camera' }))
      .toThrow('上一张图片仍在恢复')
    coordinator.acknowledge(captureId)
    expect(coordinator.begin({ diaryId: 'diary-1', source: 'camera' })).toBeTruthy()
  })
})

function createRecoveryContext({
  failDiarySave = false,
  initialAttachments = [],
  pendingCaptureIds = [],
  runtimeUnavailable = false,
} = {}) {
  const diaries = new Map([
    [
      'diary-1',
      {
        id: 'diary-1',
        blocks: [],
        attachmentIds: [],
        draft: true,
        deletedAt: null,
      },
    ],
  ])
  const attachments = new Map(initialAttachments.map((attachment) => [attachment.id, attachment]))
  let providerListener = null

  const mediaProvider = {
    onRestoredImage: vi.fn((listener) => {
      providerListener = listener
      return () => {
        providerListener = null
      }
    }),
    getPendingCaptureIds: vi.fn(() => pendingCaptureIds),
    completeCapture: vi.fn(),
  }
  const attachmentService = {
    listMetadata: vi.fn(async () => [...attachments.values()]),
    cleanupOrphans: vi.fn(async (diaryRecords, options = {}) => {
      const referenced = new Set(
        diaryRecords.flatMap((diary) =>
          diary.blocks.filter((block) => block.type === 'image').map((block) => block.attachmentId),
        ),
      )
      for (const attachment of [...attachments.values()]) {
        if (options.protectedCaptureIds?.includes(attachment.captureId)) continue
        if (!referenced.has(attachment.id)) attachments.delete(attachment.id)
      }
    }),
    findByCaptureId: vi.fn(async (diaryId, captureId) =>
      [...attachments.values()].find(
        (attachment) => attachment.diaryId === diaryId && attachment.captureId === captureId,
      ) ?? null),
    savePickedImage: vi.fn(async (diaryId, _picked, options) => {
      const attachment = {
        id: `attachment-${options.captureId}`,
        diaryId,
        captureId: options.captureId,
        ...(runtimeUnavailable ? {} : { url: `blob:${options.captureId}` }),
      }
      attachments.set(attachment.id, attachment)
      return attachment
    }),
    getRuntimeAttachment: vi.fn(async (id) => runtimeUnavailable
      ? null : { ...attachments.get(id), url: `blob:${id}` }),
    remove: vi.fn(async (id) => attachments.delete(id)),
  }
  const diaryRepository = {
    listAll: vi.fn(async () => [...diaries.values()]),
    findById: vi.fn(async (id) => diaries.get(id) ?? null),
  }
  const diaryService = {
    save: vi.fn(async (diary) => {
      if (failDiarySave) throw new Error('diary write failed')
      const attachmentIds = diary.blocks
        .filter((block) => block.type === 'image')
        .map((block) => block.attachmentId)
      const saved = { ...diary, attachmentIds }
      diaries.set(saved.id, saved)
      return saved
    }),
  }
  const service = new CameraRecoveryService({
    mediaProvider,
    attachmentService,
    diaryService,
    diaryRepository,
  })

  return {
    service,
    diaries,
    attachments,
    attachmentService,
    diaryService,
    emit: (result) => providerListener?.(result),
  }
}

const restoredResult = {
  captureId: 'capture-1',
  diaryId: 'diary-1',
  source: 'camera',
  picked: {
    blob: new Blob(['photo'], { type: 'image/jpeg' }),
    fileName: 'photo.jpeg',
    mimeType: 'image/jpeg',
    size: 5,
    width: 100,
    height: 80,
  },
}

describe('CameraRecoveryService', () => {
  it('restores one attachment and image Block, then ignores duplicate insertion', async () => {
    const context = createRecoveryContext()
    await context.service.initialize()

    const first = await context.service.process(restoredResult)
    const duplicate = await context.service.process(restoredResult)

    expect(first.status).toBe('restored')
    expect(duplicate.status).toBe('duplicate')
    expect(context.attachmentService.savePickedImage).toHaveBeenCalledTimes(1)
    expect(context.diaryService.save).toHaveBeenCalledTimes(1)
    expect(context.diaries.get('diary-1').blocks).toHaveLength(1)
    expect(context.diaries.get('diary-1').blocks[0]).toMatchObject({
      type: 'image',
      attachmentId: 'attachment-capture-1',
    })
    expect(context.service.mediaProvider.completeCapture).toHaveBeenCalledWith('capture-1')
  })

  it('removes a newly created attachment when saving the diary fails', async () => {
    const context = createRecoveryContext({ failDiarySave: true })
    await context.service.initialize()

    const outcome = await context.service.process(restoredResult)

    expect(outcome.status).toBe('error')
    expect(context.attachmentService.remove).toHaveBeenCalledWith('attachment-capture-1')
    expect(context.attachments.size).toBe(0)
    expect(context.diaries.get('diary-1').blocks).toHaveLength(0)
    expect(context.service.mediaProvider.completeCapture).not.toHaveBeenCalled()
  })

  it('does not delete an attachment after the diary committed even if runtime image loading fails', async () => {
    const context = createRecoveryContext({ runtimeUnavailable: true })
    await context.service.initialize()

    const outcome = await context.service.process(restoredResult)

    expect(outcome.status).toBe('error')
    expect(context.diaries.get('diary-1').blocks).toHaveLength(1)
    expect(context.attachments.size).toBe(1)
    expect(context.attachmentService.remove).not.toHaveBeenCalled()
    expect(context.service.mediaProvider.completeCapture).not.toHaveBeenCalled()
  })

  it('finishes a process-interrupted recovery from a protected attachment even when the photo URI expired', async () => {
    const context = createRecoveryContext({
      pendingCaptureIds: ['capture-1'],
      initialAttachments: [{
        id: 'attachment-capture-1', diaryId: 'diary-1', captureId: 'capture-1',
      }],
    })
    await context.service.initialize()

    const outcome = await context.service.process({
      captureId: 'capture-1', diaryId: 'diary-1', error: '临时照片地址已失效',
    })

    expect(outcome.status).toBe('restored')
    expect(context.attachmentService.savePickedImage).not.toHaveBeenCalled()
    expect(context.diaries.get('diary-1').blocks).toHaveLength(1)
    expect(context.service.mediaProvider.completeCapture).toHaveBeenCalledWith('capture-1')
  })

  it('cleans recovered orphan attachments before subscribing to new results', async () => {
    const orphan = {
      id: 'attachment-orphan',
      diaryId: 'diary-1',
      captureId: 'old-capture',
    }
    const context = createRecoveryContext({ initialAttachments: [orphan] })

    await context.service.initialize()

    expect(context.attachmentService.cleanupOrphans).toHaveBeenCalled()
    expect(context.attachments.size).toBe(0)
  })
})
