import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_SCHEMA_VERSION, STORE_NAMES } from '@/database/schemas/schema.js'
import { createAttachment } from '@/models/Attachment.js'
import { createImageBlock, createParagraphBlock } from '@/models/Block.js'
import { createEmptyDiary } from '@/models/Diary.js'
import { IndexedDbStorageProvider } from '@/providers/storage/IndexedDbStorageProvider.js'
import { IndexedDbAttachmentRepository } from '@/repositories/local/IndexedDbAttachmentRepository.js'
import { IndexedDbBackupRepository } from '@/repositories/local/IndexedDbBackupRepository.js'
import { IndexedDbDiaryRepository } from '@/repositories/local/IndexedDbDiaryRepository.js'
import { IndexedDbSettingsRepository } from '@/repositories/local/IndexedDbSettingsRepository.js'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupService,
  BackupValidationError,
  dataUrlToBlob,
} from '@/services/backup/BackupService.js'

const openStorages = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const storage of openStorages.splice(0)) {
    const databaseName = storage.databaseName
    await storage.close()
    indexedDB.deleteDatabase(databaseName)
  }
})

function createContext(StorageClass = IndexedDbStorageProvider) {
  const storage = new StorageClass(`backup-test-${crypto.randomUUID()}`)
  openStorages.push(storage)
  const diaryRepository = new IndexedDbDiaryRepository(storage)
  const attachmentRepository = new IndexedDbAttachmentRepository(storage)
  const settingsRepository = new IndexedDbSettingsRepository(storage)
  const backupService = new BackupService({
    backupRepository: new IndexedDbBackupRepository(storage),
    appVersion: '9.8.7-test',
    now: () => new Date('2026-09-19T06:00:00.000Z'),
  })
  return { storage, diaryRepository, attachmentRepository, settingsRepository, backupService }
}

async function seedCompleteData(context) {
  const tag = {
    id: 'tag-trip',
    name: '旅行',
    createdAt: '2026-09-18T10:00:00.000Z',
  }
  const diary = createEmptyDiary('2026-09-19', {
    deviceId: 'device-backup',
    now: new Date('2026-09-19T05:00:00.000Z'),
  })
  diary.id = 'diary-entry'
  diary.title = '湖边'
  diary.blocks = [
    createParagraphBlock('今天去了湖边。'),
    createImageBlock('attachment-photo', { caption: '傍晚的湖面' }),
  ]
  diary.blocks[0].id = 'block-paragraph'
  diary.blocks[1].id = 'block-image'
  diary.mood = 'calm'
  diary.favorite = true
  diary.draft = false
  diary.tagIds = [tag.id]
  diary.attachmentIds = ['attachment-photo']
  diary.sync.revision = 4
  await context.diaryRepository.save(diary)

  const draft = createEmptyDiary('2026-09-19', {
    deviceId: 'device-backup',
    now: new Date('2026-09-19T05:30:00.000Z'),
  })
  draft.id = 'diary-draft'
  draft.blocks = [createParagraphBlock('还没写完')]
  draft.blocks[0].id = 'block-draft'
  draft.sync.revision = 1
  await context.diaryRepository.save(draft)

  const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255])
  const blob = new Blob([bytes], { type: 'image/png' })
  const thumbnail = new Blob([new Uint8Array([9, 8, 7, 6])], { type: 'image/jpeg' })
  const attachment = createAttachment({
    id: 'attachment-photo',
    diaryId: diary.id,
    type: 'image',
    localUri: 'indexeddb://attachment/attachment-photo',
    thumbnailUri: 'indexeddb://thumbnail/attachment-photo',
    mimeType: blob.type,
    thumbnailMimeType: thumbnail.type,
    fileName: 'lake.png',
    width: 1600,
    height: 1200,
    size: blob.size,
    createdAt: '2026-09-19T05:10:00.000Z',
  })
  await context.attachmentRepository.save(attachment, blob, thumbnail)

  await context.settingsRepository.set('diary.tags', [tag])
  await context.settingsRepository.set('theme.settings', {
    mode: 'fixed',
    rotation: 'daily',
    fixedThemeId: 'plant',
    enabledThemes: ['cloud', 'plant'],
  })

  return { diary, draft, bytes, thumbnail }
}

describe('BackupService export and restore', () => {
  it('exports complete data with format, versions, settings and attachment bytes', async () => {
    const context = createContext()
    const seeded = await seedCompleteData(context)

    const backup = await context.backupService.createBackup()

    expect(backup).toMatchObject({
      format: BACKUP_FORMAT,
      backupVersion: BACKUP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: '2026-09-19T06:00:00.000Z',
      appVersion: '9.8.7-test',
    })
    expect(backup.data.diaries.map((item) => item.id).sort()).toEqual([
      'diary-draft',
      'diary-entry',
    ])
    expect(backup.data.settings.map((item) => item.key).sort()).toEqual([
      'diary.tags',
      'theme.settings',
    ])
    expect(backup.data.attachments[0]).toMatchObject({
      metadata: {
        id: 'attachment-photo',
        thumbnailSize: 4,
      },
    })
    expect(backup.data.attachments[0].dataUrl).toMatch(/^data:image\/png;base64,/)
    expect(backup.data.attachments[0].thumbnailDataUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(backup.data.attachments[0].sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(backup.data.attachments[0].thumbnailSha256).toMatch(/^[a-f0-9]{64}$/)
    expect([...new Uint8Array(await dataUrlToBlob(backup.data.attachments[0].dataUrl).arrayBuffer())])
      .toEqual([...seeded.bytes])
    expect([...new Uint8Array(await dataUrlToBlob(backup.data.attachments[0].thumbnailDataUrl).arrayBuffer())])
      .toEqual([9, 8, 7, 6])
  })

  it('exports an empty database as a valid JSON file that can be restored', async () => {
    const source = createContext()
    const file = await source.backupService.createBackupFile()

    expect(file.fileName).toBe('gentle-diary-backup-2026-09-19.json')
    expect(file.blob.type).toBe('application/json')
    expect(file.backup.data).toEqual({ diaries: [], settings: [], attachments: [] })
    expect(JSON.parse(await file.blob.text())).toEqual(file.backup)
    const target = createContext()
    await expect(target.backupService.importFromFile(file.blob)).resolves.toMatchObject({
      diaryCount: 0, attachmentCount: 0, settingsCount: 0,
    })
  })

  it('keeps legacy diary normalization when exporting raw snapshot records', async () => {
    const source = createContext()
    await source.storage.put(STORE_NAMES.DIARIES, {
      id: 'legacy-diary',
      diaryDate: '2026-09-19',
      createdAt: '2026-09-19T05:00:00.000Z',
      blocks: [],
    })

    const backup = await source.backupService.createBackup()
    expect(backup.data.diaries[0]).toMatchObject({
      id: 'legacy-diary', title: '', draft: true, tagIds: [], attachmentIds: [],
      encryption: { encrypted: false, version: null },
      sync: { revision: 0, status: 'local-only' },
    })
    const target = createContext()
    await expect(target.backupService.importFromJson(JSON.stringify(backup)))
      .resolves.toMatchObject({ diaryCount: 1 })
  })

  it('exports deleted diaries and multiple attachments including one without a thumbnail', async () => {
    const source = createContext()
    const seeded = await seedCompleteData(source)
    await source.diaryRepository.save({
      ...seeded.diary, deletedAt: '2026-09-19T05:45:00.000Z',
    })
    const block = createImageBlock('attachment-without-thumbnail')
    block.id = 'block-without-thumbnail'
    await source.diaryRepository.save({
      ...seeded.draft,
      blocks: [...seeded.draft.blocks, block],
      attachmentIds: ['attachment-without-thumbnail'],
    })
    const blob = new Blob([new Uint8Array([11, 22, 33])])
    await source.attachmentRepository.save(createAttachment({
      id: 'attachment-without-thumbnail',
      diaryId: seeded.draft.id,
      mimeType: 'image/png',
      fileName: 'draft.png',
      size: blob.size,
    }), blob)

    const backup = await source.backupService.createBackup()
    expect(backup.data.diaries.find((diary) => diary.id === seeded.diary.id).deletedAt)
      .toBe('2026-09-19T05:45:00.000Z')
    expect(backup.data.attachments).toHaveLength(2)
    expect(backup.data.attachments.find((entry) => entry.metadata.id === 'attachment-without-thumbnail'))
      .toMatchObject({
        dataUrl: 'data:image/png;base64,CxYh',
        thumbnailDataUrl: null,
        thumbnailSha256: null,
      })
    const target = createContext()
    await target.backupService.importFromJson(JSON.stringify(backup))
    expect([...new Uint8Array(await (await target.attachmentRepository.getBlob('attachment-without-thumbnail')).arrayBuffer())])
      .toEqual([11, 22, 33])
    expect(await target.attachmentRepository.getThumbnail('attachment-without-thumbnail')).toBeNull()
  })

  it.each(['replace', 'delete'])(
    'exports one complete snapshot while a concurrent connection performs a %s',
    async (operation) => {
      const source = createContext()
      const seeded = await seedCompleteData(source)
      const writer = new IndexedDbStorageProvider(source.storage.databaseName)
      openStorages.push(writer)
      await writer.open()
      const metadata = await source.attachmentRepository.findById('attachment-photo')
      const replacementBlob = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' })
      const replacementThumbnail = new Blob([new Uint8Array([3, 2, 1])], { type: 'image/jpeg' })
      const replacements = [
        { storeName: STORE_NAMES.DIARIES, value: { ...seeded.diary, title: '并发更新', tagIds: [] } },
        {
          storeName: STORE_NAMES.ATTACHMENTS,
          value: { ...metadata, fileName: 'replacement.png', size: replacementBlob.size, thumbnailSize: replacementThumbnail.size },
        },
        { storeName: STORE_NAMES.ATTACHMENT_BLOBS, value: { attachmentId: metadata.id, blob: replacementBlob } },
        { storeName: STORE_NAMES.THUMBNAIL_BLOBS, value: { attachmentId: metadata.id, blob: replacementThumbnail } },
        { storeName: STORE_NAMES.SETTINGS, value: { key: 'diary.tags', value: [] } },
        { storeName: STORE_NAMES.SETTINGS, value: { key: 'theme.settings', value: { fixedThemeId: 'cloud' } } },
      ]
      let writing
      let snapshotCompleted = false
      const originalGetAll = IDBObjectStore.prototype.getAll
      const readSpy = vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (...args) {
        const request = originalGetAll.apply(this, args)
        if (this.name === STORE_NAMES.DIARIES && !writing) {
          this.transaction.addEventListener('complete', () => { snapshotCompleted = true })
          request.addEventListener('success', () => {
            writing = operation === 'replace'
              ? writer.putMany(replacements)
              : writer.deleteMany([
                  { storeName: STORE_NAMES.DIARIES, key: seeded.diary.id },
                  { storeName: STORE_NAMES.ATTACHMENTS, key: metadata.id },
                  { storeName: STORE_NAMES.ATTACHMENT_BLOBS, key: metadata.id },
                  { storeName: STORE_NAMES.THUMBNAIL_BLOBS, key: metadata.id },
                  { storeName: STORE_NAMES.SETTINGS, key: 'diary.tags' },
                  { storeName: STORE_NAMES.SETTINGS, key: 'theme.settings' },
                ])
          })
        }
        return request
      })
      const originalArrayBuffer = Blob.prototype.arrayBuffer
      const encodeSpy = vi.spyOn(Blob.prototype, 'arrayBuffer').mockImplementation(async function () {
        expect(snapshotCompleted).toBe(true)
        expect(writing).toBeInstanceOf(Promise)
        // 保证数据库变化已提交，再读取快照中的 Blob 字节。
        await writing
        return originalArrayBuffer.call(this)
      })
      const digestSpy = vi.spyOn(crypto.subtle, 'digest')
      const diaryReadSpy = vi.spyOn(source.diaryRepository, 'listAll')
      const attachmentReadSpy = vi.spyOn(source.attachmentRepository, 'listAll')
      const blobReadSpy = vi.spyOn(source.attachmentRepository, 'getBlob')
      const thumbnailReadSpy = vi.spyOn(source.attachmentRepository, 'getThumbnail')

      const backup = await source.backupService.createBackup()

      expect(readSpy).toHaveBeenCalledTimes(5)
      expect(encodeSpy).toHaveBeenCalled()
      expect(digestSpy).toHaveBeenCalledTimes(4)
      expect(diaryReadSpy).not.toHaveBeenCalled()
      expect(attachmentReadSpy).not.toHaveBeenCalled()
      expect(blobReadSpy).not.toHaveBeenCalled()
      expect(thumbnailReadSpy).not.toHaveBeenCalled()
      expect(backup.data.diaries.find((diary) => diary.id === seeded.diary.id))
        .toMatchObject({ title: '湖边', tagIds: ['tag-trip'] })
      expect(backup.data.settings.find((setting) => setting.key === 'diary.tags').value[0].id)
        .toBe('tag-trip')
      expect(backup.data.settings.find((setting) => setting.key === 'theme.settings').value.fixedThemeId)
        .toBe('plant')
      expect(backup.data.attachments[0].metadata).toMatchObject({
        fileName: 'lake.png', size: seeded.bytes.length, thumbnailSize: 4,
      })
      vi.restoreAllMocks()

      const currentDiary = await source.diaryRepository.findById(seeded.diary.id)
      if (operation === 'replace') {
        expect(currentDiary).toMatchObject({ title: '并发更新', tagIds: [] })
      } else {
        expect(currentDiary).toBeNull()
      }
      const target = createContext()
      await target.backupService.importFromJson(JSON.stringify(backup))
      expect([...new Uint8Array(await (await target.attachmentRepository.getBlob(metadata.id)).arrayBuffer())])
        .toEqual([...seeded.bytes])
      expect([...new Uint8Array(await (await target.attachmentRepository.getThumbnail(metadata.id)).arrayBuffer())])
        .toEqual([9, 8, 7, 6])
    },
  )

  it('rejects an aborted snapshot before encoding any attachment bytes', async () => {
    const context = createContext()
    await seedCompleteData(context)
    const originalGetAll = IDBObjectStore.prototype.getAll
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (...args) {
      const request = originalGetAll.apply(this, args)
      if (this.name === STORE_NAMES.SETTINGS) {
        request.addEventListener('success', () => this.transaction.abort())
      }
      return request
    })
    const encodeSpy = vi.spyOn(Blob.prototype, 'arrayBuffer')
    const digestSpy = vi.spyOn(crypto.subtle, 'digest')

    await expect(context.backupService.createBackup()).rejects.toBeInstanceOf(Error)
    expect(encodeSpy).not.toHaveBeenCalled()
    expect(digestSpy).not.toHaveBeenCalled()
  })

  it.each([
    [STORE_NAMES.ATTACHMENT_BLOBS, 'missing original'],
    [STORE_NAMES.THUMBNAIL_BLOBS, 'missing required thumbnail'],
  ])('rejects %s with %s instead of silently exporting incomplete data', async (storeName) => {
    const context = createContext()
    await seedCompleteData(context)
    await context.storage.delete(storeName, 'attachment-photo')

    await expect(context.backupService.createBackup()).rejects.toMatchObject({
      code: 'MISSING_ATTACHMENT_DATA',
    })
    expect(await context.diaryRepository.findById('diary-entry')).not.toBeNull()
    expect(await context.attachmentRepository.findById('attachment-photo')).not.toBeNull()
  })

  it('rejects inconsistent diary references from the snapshot using the existing strict validation', async () => {
    const context = createContext()
    const seeded = await seedCompleteData(context)
    await context.storage.put(STORE_NAMES.DIARIES, { ...seeded.diary, attachmentIds: [] })

    await expect(context.backupService.createBackup()).rejects.toMatchObject({
      code: 'INVALID_REFERENCE',
    })
  })

  it('round-trips diaries, drafts, settings, binary Blob and thumbnail content', async () => {
    const source = createContext()
    const seeded = await seedCompleteData(source)
    const backupJson = JSON.stringify(await source.backupService.createBackup())

    const target = createContext()
    const stale = createEmptyDiary('2020-01-01')
    stale.id = 'stale-diary'
    await target.diaryRepository.save(stale)
    await target.settingsRepository.set('stale.setting', true)

    const result = await target.backupService.importFromJson(backupJson, { mode: 'replace' })

    expect(result).toMatchObject({ diaryCount: 2, attachmentCount: 1, settingsCount: 2 })
    expect(await target.diaryRepository.findById('stale-diary')).toBeNull()
    expect((await target.diaryRepository.findById('diary-entry')).blocks[1]).toMatchObject({
      attachmentId: 'attachment-photo',
      caption: '傍晚的湖面',
    })
    expect((await target.diaryRepository.findById('diary-draft')).draft).toBe(true)
    expect(await target.settingsRepository.get('theme.settings')).toMatchObject({
      fixedThemeId: 'plant',
    })
    expect(await target.settingsRepository.get('stale.setting')).toBeNull()

    const restoredBlob = await target.attachmentRepository.getBlob('attachment-photo')
    const restoredThumbnail = await target.attachmentRepository.getThumbnail('attachment-photo')
    expect([...new Uint8Array(await restoredBlob.arrayBuffer())]).toEqual([...seeded.bytes])
    expect([...new Uint8Array(await restoredThumbnail.arrayBuffer())]).toEqual([9, 8, 7, 6])
    expect(restoredBlob.type).toBe('image/png')
    expect(restoredThumbnail.type).toBe('image/jpeg')
    expect(await target.attachmentRepository.findById('attachment-photo')).toMatchObject({
      localUri: 'indexeddb://attachment/attachment-photo',
      thumbnailUri: 'indexeddb://thumbnail/attachment-photo',
    })
  })

  it('normalizes source-device filesystem URIs during a portable restore', async () => {
    const source = createContext()
    await seedCompleteData(source)
    const backup = await source.backupService.createBackup()
    backup.data.attachments[0].metadata.localUri =
      'filesystem://DATA/gentle-diary/attachments/attachment-photo.bin'
    backup.data.attachments[0].metadata.thumbnailUri =
      'filesystem://DATA/gentle-diary/attachments/attachment-photo.thumb'

    const target = createContext()
    await target.backupService.importFromJson(JSON.stringify(backup))

    expect(await target.attachmentRepository.findById('attachment-photo')).toMatchObject({
      localUri: 'indexeddb://attachment/attachment-photo',
      thumbnailUri: 'indexeddb://thumbnail/attachment-photo',
    })
  })

  it('continues to import the original v1 format without SHA-256 fields', async () => {
    const source = createContext()
    await seedCompleteData(source)
    const backup = await source.backupService.createBackup()
    backup.backupVersion = 1
    delete backup.data.attachments[0].sha256
    delete backup.data.attachments[0].thumbnailSha256

    const target = createContext()
    const result = await target.backupService.importFromJson(JSON.stringify(backup))

    expect(result.attachmentCount).toBe(1)
    expect(await target.attachmentRepository.getBlob('attachment-photo')).toBeInstanceOf(Blob)
  })

  it('rejects invalid JSON and unsupported backup versions before writing', async () => {
    const context = createContext()
    await expect(context.backupService.importFromJson('{broken')).rejects.toMatchObject({
      code: 'INVALID_JSON',
    })

    const validSource = createContext()
    await seedCompleteData(validSource)
    const backup = await validSource.backupService.createBackup()
    backup.backupVersion = 999

    await expect(context.backupService.importFromJson(JSON.stringify(backup))).rejects.toMatchObject({
      code: 'UNSUPPORTED_BACKUP_VERSION',
    })
  })

  it('rejects corrupt attachment data, duplicate IDs and missing attachment references', async () => {
    const source = createContext()
    await seedCompleteData(source)
    const backup = await source.backupService.createBackup()

    const corrupt = structuredClone(backup)
    corrupt.data.attachments[0].dataUrl = 'data:image/png;base64,***'
    await expect(source.backupService.importFromJson(JSON.stringify(corrupt))).rejects.toBeInstanceOf(
      BackupValidationError,
    )

    const duplicate = structuredClone(backup)
    duplicate.data.diaries.push(structuredClone(duplicate.data.diaries[0]))
    await expect(source.backupService.importFromJson(JSON.stringify(duplicate))).rejects.toMatchObject({
      code: 'DUPLICATE_ID',
    })

    const missing = structuredClone(backup)
    missing.data.attachments = []
    await expect(source.backupService.importFromJson(JSON.stringify(missing))).rejects.toMatchObject({
      code: 'MISSING_ATTACHMENT',
    })
  })

  it('rejects equal-length byte corruption and missing v2 hashes before replacing data', async () => {
    const source = createContext()
    await seedCompleteData(source)
    const backup = await source.backupService.createBackup()
    const target = createContext()
    const original = createEmptyDiary('2025-01-02')
    original.id = 'original-diary'
    await target.diaryRepository.save(original)

    const corruptOriginal = structuredClone(backup)
    corruptOriginal.data.attachments[0].dataUrl = changeBase64Character(
      corruptOriginal.data.attachments[0].dataUrl,
    )
    await expect(target.backupService.importFromJson(JSON.stringify(corruptOriginal)))
      .rejects.toMatchObject({ code: 'INVALID_ATTACHMENT_DATA' })

    const corruptThumbnail = structuredClone(backup)
    corruptThumbnail.data.attachments[0].thumbnailDataUrl = changeBase64Character(
      corruptThumbnail.data.attachments[0].thumbnailDataUrl,
    )
    await expect(target.backupService.importFromJson(JSON.stringify(corruptThumbnail)))
      .rejects.toMatchObject({ code: 'INVALID_ATTACHMENT_DATA' })

    const missingHash = structuredClone(backup)
    delete missingHash.data.attachments[0].sha256
    await expect(target.backupService.importFromJson(JSON.stringify(missingHash)))
      .rejects.toMatchObject({ code: 'INVALID_ATTACHMENT_DATA' })

    expect((await target.diaryRepository.listAll()).map((diary) => diary.id)).toEqual(['original-diary'])
  })

  it('keeps all original data when a validated import fails inside the write transaction', async () => {
    class FailingImportStorage extends IndexedDbStorageProvider {
      async replaceAll(data) {
        return super.replaceAll({
          ...data,
          diaries: [...data.diaries, { title: 'missing-primary-key' }],
        })
      }
    }

    const source = createContext()
    await seedCompleteData(source)
    const backupJson = JSON.stringify(await source.backupService.createBackup())

    const target = createContext(FailingImportStorage)
    const original = createEmptyDiary('2025-01-02')
    original.id = 'original-diary'
    original.blocks = [createParagraphBlock('不能丢失')]
    original.blocks[0].id = 'original-block'
    await target.diaryRepository.save(original)
    await target.settingsRepository.set('original.setting', { safe: true })

    await expect(target.backupService.importFromJson(backupJson)).rejects.toBeTruthy()

    expect((await target.diaryRepository.listAll()).map((diary) => diary.id)).toEqual([
      'original-diary',
    ])
    expect(await target.settingsRepository.get('original.setting')).toEqual({ safe: true })
    expect(await target.diaryRepository.findById('diary-entry')).toBeNull()
  })
})

function changeBase64Character(dataUrl) {
  const index = dataUrl.indexOf(',') + 1
  return `${dataUrl.slice(0, index)}${dataUrl[index] === 'A' ? 'B' : 'A'}${dataUrl.slice(index + 1)}`
}
