import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IndexedDbStorageProvider } from '@/providers/storage/IndexedDbStorageProvider.js'
import { IndexedDbAttachmentRepository } from '@/repositories/local/IndexedDbAttachmentRepository.js'
import { IndexedDbAttachmentDataProvider } from '@/providers/media/IndexedDbAttachmentDataProvider.js'
import { AttachmentService } from '@/services/media/AttachmentService.js'
import { STORE_NAMES } from '@/database/schemas/schema.js'

const storages = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const storage of storages.splice(0)) {
    const databaseName = storage.databaseName
    await storage.close()
    indexedDB.deleteDatabase(databaseName)
  }
})

function createContext(options = {}) {
  const storage = new IndexedDbStorageProvider(`attachment-test-${crypto.randomUUID()}`)
  storages.push(storage)
  const repository = new IndexedDbAttachmentRepository(storage)
  const dataProvider = new IndexedDbAttachmentDataProvider(repository)
  const original = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' })
  const thumbnail = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' })
  const mediaProvider = {
    pickImage: vi.fn(async () => ({
      blob: original,
      fileName: 'photo.png',
      mimeType: original.type,
      size: original.size,
      width: 1200,
      height: 800,
    })),
  }
  const thumbnailGenerator = options.thumbnailGenerator ?? vi.fn(async () => thumbnail)
  const service = new AttachmentService(
    repository,
    mediaProvider,
    options.dataProvider ?? dataProvider,
    thumbnailGenerator,
  )
  return { storage, repository, dataProvider, mediaProvider, service, original, thumbnail }
}

describe('AttachmentService', () => {
  it('saves and reads original image and independent thumbnail blobs', async () => {
    const context = createContext()
    const attachment = await context.service.addImage('diary-1', { source: 'gallery' })

    expect(attachment).toMatchObject({
      diaryId: 'diary-1',
      mimeType: 'image/png',
      thumbnailMimeType: 'image/jpeg',
      thumbnailSize: 3,
    })
    expect(attachment.localUri).toContain('indexeddb://attachment/')
    expect(attachment.thumbnailUri).toContain('indexeddb://thumbnail/')
    expect([...new Uint8Array(await (await context.repository.getBlob(attachment.id)).arrayBuffer())]).toEqual([
      1, 2, 3, 4, 5,
    ])
    expect([
      ...new Uint8Array(await (await context.repository.getThumbnail(attachment.id)).arrayBuffer()),
    ]).toEqual([9, 8, 7])

    const thumbnails = await context.service.getThumbnailUrlMap([
      { id: 'diary-1', attachmentIds: [attachment.id] },
    ])
    expect(thumbnails['diary-1']).toMatch(/^blob:/)
  })

  it('deletes metadata, original and thumbnail together', async () => {
    const context = createContext()
    const attachment = await context.service.addImage('diary-1')

    await context.service.remove(attachment.id)

    expect(await context.repository.findById(attachment.id)).toBeNull()
    expect(await context.repository.getBlob(attachment.id)).toBeNull()
    expect(await context.repository.getThumbnail(attachment.id)).toBeNull()
  })

  it('keeps the original image when thumbnail generation fails', async () => {
    const context = createContext({
      thumbnailGenerator: vi.fn(async () => {
        throw new Error('thumbnail failed')
      }),
    })

    const attachment = await context.service.addImage('diary-1')

    expect(await context.repository.getBlob(attachment.id)).toBeInstanceOf(Blob)
    expect(await context.repository.getThumbnail(attachment.id)).toBeNull()
    expect(await context.service.getRuntimeAttachment(attachment.id)).toMatchObject({
      id: attachment.id,
    })
  })

  it('does not recreate a deleted attachment when thumbnail generation finishes later', async () => {
    const thumbnailGenerator = vi.fn(async () => null)
    const context = createContext({ thumbnailGenerator })
    const attachment = await context.service.addImage('diary-1')

    let generationStarted
    const started = new Promise((resolve) => { generationStarted = resolve })
    let finishGeneration
    const blocked = new Promise((resolve) => { finishGeneration = resolve })
    thumbnailGenerator.mockImplementation(async () => {
      generationStarted()
      await blocked
      return context.thumbnail
    })

    const pendingThumbnail = context.service.getRuntimeThumbnail(attachment.id)
    await started
    await context.service.remove(attachment.id)
    finishGeneration()
    expect(await pendingThumbnail).toBeNull()

    expect(await context.repository.findById(attachment.id)).toBeNull()
    expect(await context.repository.getBlob(attachment.id)).toBeNull()
    expect(await context.repository.getThumbnail(attachment.id)).toBeNull()
  })

  it('removes an existing orphan thumbnail blob when metadata is missing', async () => {
    const context = createContext()
    const attachment = await context.service.addImage('diary-1')
    await context.service.remove(attachment.id)
    await context.storage.put(STORE_NAMES.THUMBNAIL_BLOBS, {
      attachmentId: attachment.id,
      blob: context.thumbnail,
    })

    await expect(context.repository.saveThumbnail(attachment, context.thumbnail)).rejects.toThrow('附件已删除')
    expect(await context.repository.findById(attachment.id)).toBeNull()
    expect(await context.repository.getThumbnail(attachment.id)).toBeNull()
  })

  it('keeps current metadata when a delayed thumbnail finishes', async () => {
    const thumbnailGenerator = vi.fn(async () => null)
    const context = createContext({ thumbnailGenerator })
    const attachment = await context.service.addImage('diary-1')

    let generationStarted
    const started = new Promise((resolve) => { generationStarted = resolve })
    let finishGeneration
    const blocked = new Promise((resolve) => { finishGeneration = resolve })
    thumbnailGenerator.mockImplementation(async () => {
      generationStarted()
      await blocked
      return context.thumbnail
    })

    const pendingThumbnail = context.service.getRuntimeThumbnail(attachment.id)
    await started
    await context.storage.put(STORE_NAMES.ATTACHMENTS, { ...attachment, fileName: 'renamed.png' })
    finishGeneration()
    const runtimeThumbnail = await pendingThumbnail

    expect(runtimeThumbnail).toMatchObject({
      fileName: 'renamed.png',
      thumbnailSize: context.thumbnail.size,
      thumbnailMimeType: context.thumbnail.type,
    })
    expect(await context.repository.findById(attachment.id)).toMatchObject({
      fileName: 'renamed.png',
      thumbnailSize: context.thumbnail.size,
    })
    expect(await context.repository.getThumbnail(attachment.id)).toBeInstanceOf(Blob)
  })

  it('does not release or remove metadata when the binary provider delete fails', async () => {
    const context = createContext()
    const failingProvider = {
      getStorageUris: (id) => context.dataProvider.getStorageUris(id),
      save: (...args) => context.dataProvider.save(...args),
      read: (...args) => context.dataProvider.read(...args),
      saveThumbnail: (...args) => context.dataProvider.saveThumbnail(...args),
      delete: vi.fn(async () => {
        throw new Error('filesystem unavailable')
      }),
    }
    const service = new AttachmentService(
      context.repository,
      context.mediaProvider,
      failingProvider,
      vi.fn(async () => context.thumbnail),
    )
    const attachment = await service.addImage('diary-1')

    await expect(service.remove(attachment.id)).rejects.toThrow('filesystem unavailable')
    expect(await context.repository.findById(attachment.id)).not.toBeNull()
  })

  it('removes unreferenced attachments while preserving active and deleted diary references', async () => {
    const context = createContext()
    const kept = await context.service.addImage('diary-1')
    const orphan = await context.service.addImage('diary-orphan')

    await context.service.cleanupOrphans([
      {
        id: 'diary-1',
        deletedAt: '2026-09-19T00:00:00.000Z',
        blocks: [{ id: 'block-1', type: 'image', attachmentId: kept.id }],
        attachmentIds: [kept.id],
      },
    ])

    expect(await context.repository.findById(kept.id)).not.toBeNull()
    expect(await context.repository.findById(orphan.id)).toBeNull()
  })
})
