import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORE_NAMES } from '@/database/schemas/schema.js'
import { createEmptyDiary } from '@/models/Diary.js'
import { IndexedDbStorageProvider } from '@/providers/storage/IndexedDbStorageProvider.js'
import { IndexedDbBackupRepository } from '@/repositories/local/IndexedDbBackupRepository.js'
import { IndexedDbDiaryRepository } from '@/repositories/local/IndexedDbDiaryRepository.js'
import { IndexedDbSettingsRepository } from '@/repositories/local/IndexedDbSettingsRepository.js'
import { BackupService } from '@/services/backup/BackupService.js'
import { TagService } from '@/services/tag/TagService.js'

const openStorages = []

afterEach(async () => {
  for (const storage of openStorages.splice(0)) {
    await storage.close()
    indexedDB.deleteDatabase(storage.databaseName)
  }
})

function createContext() {
  const storage = new IndexedDbStorageProvider(`tag-test-${crypto.randomUUID()}`)
  openStorages.push(storage)
  const settingsRepository = new IndexedDbSettingsRepository(storage)
  const diaryRepository = new IndexedDbDiaryRepository(storage)
  return {
    storage,
    settingsRepository,
    diaryRepository,
    service: new TagService(settingsRepository),
    backupService: new BackupService({
      backupRepository: new IndexedDbBackupRepository(storage),
    }),
  }
}

async function saveDiary(repository, id, tagIds, options = {}) {
  const diary = createEmptyDiary('2026-09-19', {
    now: new Date('2026-09-19T05:00:00.000Z'),
  })
  diary.id = id
  diary.title = id
  diary.tagIds = tagIds
  diary.draft = options.draft ?? false
  diary.deletedAt = options.deletedAt ?? null
  diary.sync.revision = 7
  await repository.save(diary)
}

class MemorySettingsRepository {
  constructor() {
    this.values = new Map()
  }

  async get(key) {
    return this.values.get(key) ?? null
  }

  async set(key, value) {
    this.values.set(key, structuredClone(value))
    return value
  }
}

describe('TagService', () => {
  it('creates unique tags', async () => {
    const service = new TagService(new MemorySettingsRepository())
    const first = await service.create('旅行')
    const duplicate = await service.create('  旅行  ')
    await service.create('生活')

    expect(duplicate.id).toBe(first.id)
    expect(await service.list()).toHaveLength(2)
  })

  it('removes a tag from every diary and draft while keeping a full backup exportable', async () => {
    const context = createContext()
    const removed = await context.service.create('旅行')
    const kept = await context.service.create('生活')

    await saveDiary(context.diaryRepository, 'entry', [removed.id, kept.id, removed.id])
    await saveDiary(context.diaryRepository, 'draft', [removed.id], { draft: true })
    await saveDiary(context.diaryRepository, 'trash', [removed.id, kept.id], {
      deletedAt: '2026-09-20T05:00:00.000Z',
    })
    await saveDiary(context.diaryRepository, 'untouched', [kept.id])
    await context.settingsRepository.set('theme.settings', { mode: 'fixed' })

    const beforeDiaries = await context.storage.getAll(STORE_NAMES.DIARIES)
    const beforeTags = await context.storage.get(STORE_NAMES.SETTINGS, 'diary.tags')
    await context.storage.put(STORE_NAMES.SETTINGS, { ...beforeTags, note: 'preserve' })

    await context.service.remove(removed.id)

    const expectedDiaries = beforeDiaries.map((diary) => ({
      ...diary,
      tagIds: diary.tagIds.filter((id) => id !== removed.id),
    }))
    expect(await context.storage.getAll(STORE_NAMES.DIARIES)).toEqual(expectedDiaries)
    expect(await context.storage.get(STORE_NAMES.SETTINGS, 'diary.tags')).toEqual({
      ...beforeTags,
      note: 'preserve',
      value: [kept],
    })
    expect(await context.settingsRepository.get('theme.settings')).toEqual({ mode: 'fixed' })

    const backup = await context.backupService.createBackup()
    expect(backup.data.diaries).toHaveLength(4)
    expect(backup.data.diaries.map((diary) => diary.tagIds)).toEqual(
      expectedDiaries.map((diary) => diary.tagIds),
    )
    expect(backup.data.settings.find((setting) => setting.key === 'diary.tags').value).toEqual([
      kept,
    ])
  })

  it('rolls back the tag and earlier diary edits if a diary update fails', async () => {
    const context = createContext()
    const removed = await context.service.create('旅行')
    await saveDiary(context.diaryRepository, 'a-entry', [removed.id])
    await saveDiary(context.diaryRepository, 'b-draft', [removed.id], { draft: true })

    const beforeDiaries = await context.storage.getAll(STORE_NAMES.DIARIES)
    const beforeTags = await context.storage.get(STORE_NAMES.SETTINGS, 'diary.tags')
    const originalUpdate = IDBCursorWithValue.prototype.update
    let updates = 0
    const updateSpy = vi.spyOn(IDBCursorWithValue.prototype, 'update').mockImplementation(function (value) {
      if (++updates === 2) throw new Error('simulated diary write failure')
      return originalUpdate.call(this, value)
    })

    try {
      await expect(context.service.remove(removed.id)).rejects.toThrow(
        'simulated diary write failure',
      )
    } finally {
      updateSpy.mockRestore()
    }

    expect(updates).toBe(2)
    expect(await context.storage.getAll(STORE_NAMES.DIARIES)).toEqual(beforeDiaries)
    expect(await context.storage.get(STORE_NAMES.SETTINGS, 'diary.tags')).toEqual(beforeTags)
  })
})
