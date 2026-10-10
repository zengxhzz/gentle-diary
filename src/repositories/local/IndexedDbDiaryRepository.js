import { INDEX_NAMES, STORE_NAMES } from '@/database/schemas/schema.js'
import { normalizeDiary } from '@/models/Diary.js'

/** @implements {import('../interfaces/DiaryRepository.js').DiaryRepository} */
export class IndexedDbDiaryRepository {
  /** @param {import('../../providers/storage/IndexedDbStorageProvider.js').IndexedDbStorageProvider} storage */
  constructor(storage) {
    this.storage = storage
  }

  /** @param {string} id */
  async findById(id) {
    const result = await this.storage.get(STORE_NAMES.DIARIES, id)
    return result ? normalizeDiary(result) : null
  }

  /** @param {string} diaryDate */
  async findActiveByDate(diaryDate) {
    const records = await this.storage.getAllByIndex(
      STORE_NAMES.DIARIES,
      INDEX_NAMES.DIARY_DATE,
      diaryDate,
    )

    const active = records
      .map(normalizeDiary)
      .filter((diary) => !diary.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

    return active ?? null
  }

  async findLatestDraft() {
    const records = await this.storage.getAll(STORE_NAMES.DIARIES)
    return (
      records
        .map(normalizeDiary)
        .filter((diary) => diary.draft && !diary.deletedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    )
  }

  async listAll() {
    const records = await this.storage.getAll(STORE_NAMES.DIARIES)
    return records.map(normalizeDiary)
  }

  /** @param {import('../../models/Diary.js').Diary} diary */
  async save(diary) {
    const normalized = normalizeDiary(diary)
    await this.storage.put(STORE_NAMES.DIARIES, normalized)
    return normalized
  }

  /** @param {string} id */
  async deletePermanently(id) {
    await this.storage.delete(STORE_NAMES.DIARIES, id)
  }
}

