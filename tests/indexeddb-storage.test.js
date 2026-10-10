import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORE_NAMES } from '@/database/schemas/schema.js'
import { createAttachment } from '@/models/Attachment.js'
import { IndexedDbAttachmentRepository } from '@/repositories/local/IndexedDbAttachmentRepository.js'
import { IndexedDbDiaryRepository } from '@/repositories/local/IndexedDbDiaryRepository.js'
import { IndexedDbSettingsRepository } from '@/repositories/local/IndexedDbSettingsRepository.js'
import { IndexedDbStorageProvider } from '@/providers/storage/IndexedDbStorageProvider.js'
import { createEmptyDiary } from '@/models/Diary.js'

const openStorages = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const storage of openStorages.splice(0)) {
    await storage.close()
    indexedDB.deleteDatabase(storage.databaseName)
  }
})

function createStorage(databaseName = `snapshot-test-${crypto.randomUUID()}`) {
  const storage = new IndexedDbStorageProvider(databaseName)
  openStorages.push(storage)
  return storage
}

function snapshotEntries(generation) {
  return [
    { storeName: STORE_NAMES.DIARIES, value: { id: 'entry', generation } },
    { storeName: STORE_NAMES.ATTACHMENTS, value: { id: 'photo', diaryId: 'entry', generation } },
    {
      storeName: STORE_NAMES.ATTACHMENT_BLOBS,
      value: { attachmentId: 'photo', blob: new Blob([`original-${generation}`]) },
    },
    {
      storeName: STORE_NAMES.THUMBNAIL_BLOBS,
      value: { attachmentId: 'photo', blob: new Blob([`thumbnail-${generation}`]) },
    },
    { storeName: STORE_NAMES.SETTINGS, value: { key: 'generation', value: generation } },
  ]
}

describe('IndexedDB storage', () => {
  it('runs schema migration and persists diary/settings records', async () => {
    const databaseName = `diary-test-${crypto.randomUUID()}`
    const storage = new IndexedDbStorageProvider(databaseName)
    const diaryRepository = new IndexedDbDiaryRepository(storage)
    const settingsRepository = new IndexedDbSettingsRepository(storage)
    const attachmentRepository = new IndexedDbAttachmentRepository(storage)
    const diary = new Proxy(createEmptyDiary('2026-09-10'), {})

    await diaryRepository.save(diary)
    const found = await diaryRepository.findActiveByDate('2026-09-10')
    expect(found?.id).toBe(diary.id)

    const latestDraft = await diaryRepository.findLatestDraft()
    expect(latestDraft?.id).toBe(diary.id)

    await settingsRepository.set('theme.settings', { mode: 'fixed' })
    expect(await settingsRepository.get('theme.settings')).toEqual({ mode: 'fixed' })

    const blob = new Blob(['diary-image'], { type: 'image/png' })
    const attachment = createAttachment({
      diaryId: diary.id,
      type: 'image',
      localUri: 'indexeddb://attachment/test',
      mimeType: 'image/png',
      fileName: 'test.png',
      size: blob.size,
    })
    await attachmentRepository.save(attachment, blob)
    expect((await attachmentRepository.listByDiaryId(diary.id))[0]?.id).toBe(attachment.id)
    expect(await (await attachmentRepository.getBlob(attachment.id)).text()).toBe('diary-image')

    await attachmentRepository.delete(attachment.id)
    expect(await attachmentRepository.findById(attachment.id)).toBeNull()

    const schema = await storage.get('meta', 'schemaVersion')
    expect(schema?.value).toBe(3)

    await storage.close()
    indexedDB.deleteDatabase(databaseName)
  })
})

describe('IndexedDB backup snapshots', () => {
  it('reads all five stores in one readonly transaction and resolves only after completion', async () => {
    const storage = createStorage()
    await storage.putMany(snapshotEntries('before'))
    const database = await storage.open()
    const originalTransaction = database.transaction
    let completed = false
    const transactionSpy = vi.spyOn(database, 'transaction').mockImplementation(function (...args) {
      const transaction = originalTransaction.apply(this, args)
      transaction.addEventListener('complete', () => { completed = true })
      return transaction
    })

    const snapshot = await storage.readBackupSnapshot()

    expect(completed).toBe(true)
    expect(transactionSpy).toHaveBeenCalledExactlyOnceWith([
      STORE_NAMES.DIARIES,
      STORE_NAMES.ATTACHMENTS,
      STORE_NAMES.ATTACHMENT_BLOBS,
      STORE_NAMES.THUMBNAIL_BLOBS,
      STORE_NAMES.SETTINGS,
    ], 'readonly')
    expect(snapshot.diaries).toEqual([{ id: 'entry', generation: 'before' }])
    expect(snapshot.attachments).toEqual([{ id: 'photo', diaryId: 'entry', generation: 'before' }])
    expect(snapshot.settings).toEqual([{ key: 'generation', value: 'before' }])
    expect(snapshot.attachmentBlobs[0].attachmentId).toBe('photo')
    expect(await snapshot.attachmentBlobs[0].blob.text()).toBe('original-before')
    expect(snapshot.thumbnailBlobs[0].attachmentId).toBe('photo')
    expect(await snapshot.thumbnailBlobs[0].blob.text()).toBe('thumbnail-before')

    snapshot.diaries[0].generation = 'changed outside IndexedDB'
    snapshot.settings[0].value = 'changed outside IndexedDB'
    expect((await storage.get(STORE_NAMES.DIARIES, 'entry')).generation).toBe('before')
    expect((await storage.get(STORE_NAMES.SETTINGS, 'generation')).value).toBe('before')
  })

  it('returns every empty store without writing or initializing user data', async () => {
    const storage = createStorage()
    expect(await storage.readBackupSnapshot()).toEqual({
      diaries: [], attachments: [], attachmentBlobs: [], thumbnailBlobs: [], settings: [],
    })
  })

  it('includes an overlapping write queued before the snapshot on another connection', async () => {
    const storage = createStorage()
    const writer = createStorage(storage.databaseName)
    await storage.putMany(snapshotEntries('before'))
    await writer.open()

    const writing = writer.putMany(snapshotEntries('after'))
    const snapshot = await storage.readBackupSnapshot()
    await writing

    expect(snapshot.diaries[0].generation).toBe('after')
    expect(snapshot.attachments[0].generation).toBe('after')
    expect(snapshot.settings[0].value).toBe('after')
    expect(await snapshot.attachmentBlobs[0].blob.text()).toBe('original-after')
    expect(await snapshot.thumbnailBlobs[0].blob.text()).toBe('thumbnail-after')
  })

  it('keeps every store at the same generation when another connection writes during reads', async () => {
    const storage = createStorage()
    const writer = createStorage(storage.databaseName)
    await storage.putMany(snapshotEntries('before'))
    await writer.open()
    const originalGetAll = IDBObjectStore.prototype.getAll
    let writing
    let completed = false
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (...args) {
      const request = originalGetAll.apply(this, args)
      if (this.name === STORE_NAMES.DIARIES && !writing) {
        this.transaction.addEventListener('complete', () => { completed = true })
        request.addEventListener('success', () => {
          expect(completed).toBe(false)
          writing = writer.putMany(snapshotEntries('after'))
        })
      }
      return request
    })

    const snapshot = await storage.readBackupSnapshot()
    expect(writing).toBeInstanceOf(Promise)
    await writing

    expect(snapshot.diaries[0].generation).toBe('before')
    expect(snapshot.attachments[0].generation).toBe('before')
    expect(snapshot.settings[0].value).toBe('before')
    expect(await snapshot.attachmentBlobs[0].blob.text()).toBe('original-before')
    expect(await snapshot.thumbnailBlobs[0].blob.text()).toBe('thumbnail-before')
    const current = await storage.readBackupSnapshot()
    expect(current.diaries[0].generation).toBe('after')
    expect(current.attachments[0].generation).toBe('after')
    expect(current.settings[0].value).toBe('after')
    expect(await current.attachmentBlobs[0].blob.text()).toBe('original-after')
    expect(await current.thumbnailBlobs[0].blob.text()).toBe('thumbnail-after')
  })

  it.each([STORE_NAMES.DIARIES, STORE_NAMES.SETTINGS])(
    'rejects an abort after reading %s instead of returning a partial snapshot',
    async (abortAfterStore) => {
      const storage = createStorage()
      await storage.putMany(snapshotEntries('before'))
      const originalGetAll = IDBObjectStore.prototype.getAll
      vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (...args) {
        const request = originalGetAll.apply(this, args)
        if (this.name === abortAfterStore) {
          request.addEventListener('success', () => this.transaction.abort())
        }
        return request
      })

      await expect(storage.readBackupSnapshot()).rejects.toBeInstanceOf(Error)
      expect((await storage.get(STORE_NAMES.DIARIES, 'entry')).generation).toBe('before')
    },
  )

  it('aborts and preserves the original error if queueing a read fails', async () => {
    const storage = createStorage()
    await storage.putMany(snapshotEntries('before'))
    const originalGetAll = IDBObjectStore.prototype.getAll
    const failure = new Error('simulated snapshot read failure')
    const readSpy = vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (...args) {
      if (this.name === STORE_NAMES.THUMBNAIL_BLOBS) throw failure
      return originalGetAll.apply(this, args)
    })

    await expect(storage.readBackupSnapshot()).rejects.toBe(failure)
    readSpy.mockRestore()
    expect((await storage.readBackupSnapshot()).diaries[0].generation).toBe('before')
  })

  it('rejects an asynchronous read error with its original cause instead of returning earlier results', async () => {
    const storage = createStorage()
    await storage.putMany(snapshotEntries('before'))
    const failure = new DOMException('simulated binary read failure', 'DataCloneError')
    const originalClone = globalThis.structuredClone
    // fake-indexeddb clones records when its queued read executes, after getAll() returns.
    const cloneSpy = vi.spyOn(globalThis, 'structuredClone').mockImplementation((value, ...args) => {
      if (value?.attachmentId === 'photo' && value.blob instanceof Blob) throw failure
      return originalClone(value, ...args)
    })

    await expect(storage.readBackupSnapshot()).rejects.toBe(failure)
    cloneSpy.mockRestore()
    expect(await (await storage.readBackupSnapshot()).attachmentBlobs[0].blob.text())
      .toBe('original-before')
  })
})




