import { normalizeBlocks } from '@/models/Block.js'
import { createEmptyDiary, normalizeDiary } from '@/models/Diary.js'
import { toDateKey } from '@/utils/date.js'
import { getDiaryText, getDiaryTitle } from '@/utils/text.js'

export class DiaryNotFoundError extends Error {
  constructor(id) {
    super(`Diary not found: ${id}`)
    this.name = 'DiaryNotFoundError'
    this.code = 'DIARY_NOT_FOUND'
  }
}

export class DiaryService {
  /**
   * @param {import('../../repositories/interfaces/DiaryRepository.js').DiaryRepository} repository
   * @param {import('../device/DeviceIdentityService.js').DeviceIdentityService} deviceIdentityService
   */
  constructor(repository, deviceIdentityService, attachmentService = null) {
    this.repository = repository
    this.deviceIdentityService = deviceIdentityService
    this.attachmentService = attachmentService
  }

  /**
   * 获取最近的工作草稿；没有草稿时创建仅存在于内存中的新日记。
   * @returns {Promise<import('../../models/Diary.js').Diary>}
   */
  async getOrCreateWorkingDraft() {
    const draft = await this.repository.findLatestDraft()
    if (draft) return normalizeDiary(draft)
    return this.createNewDraft()
  }

  /** @param {string} [diaryDate] */
  createNewDraft(diaryDate = toDateKey()) {
    return createEmptyDiary(diaryDate, {
      deviceId: this.deviceIdentityService.getDeviceId(),
    })
  }

  /** @param {string} id */
  async getById(id) {
    const diary = await this.repository.findById(id)
    if (!diary || diary.deletedAt) throw new DiaryNotFoundError(id)
    return diary
  }

  /** @param {string} id */
  async getDeletedById(id) {
    const diary = await this.repository.findById(id)
    if (!diary || !diary.deletedAt) throw new DiaryNotFoundError(id)
    return diary
  }

  async listTimeline() {
    const diaries = await this.repository.listAll()
    return diaries
      .filter((diary) => !diary.deletedAt && !diary.draft)
      .sort(compareDiaryDescending)
  }

  /**
   * @param {{ query?: string, favoriteOnly?: boolean, mood?: string | null }} [filters]
   */
  async search(filters = {}) {
    const query = filters.query?.trim().toLocaleLowerCase() ?? ''
    const diaries = await this.repository.listAll()

    return diaries
      .filter((diary) => !diary.deletedAt && !diary.draft)
      .filter((diary) => !filters.favoriteOnly || diary.favorite)
      .filter((diary) => !filters.mood || diary.mood === filters.mood)
      .filter((diary) => !filters.tagId || diary.tagIds.includes(filters.tagId))
      .filter((diary) => {
        if (!query) return true
        const searchable = [getDiaryTitle(diary), getDiaryText(diary), diary.mood]
          .filter(Boolean)
          .join('\n')
          .toLocaleLowerCase()
        return searchable.includes(query)
      })
      .sort(compareDiaryDescending)
  }

  /** @param {string} fromDate @param {string} toDate */
  async listByDateRange(fromDate, toDate) {
    const diaries = await this.repository.listAll()
    return diaries
      .filter(
        (diary) =>
          !diary.deletedAt &&
          !diary.draft &&
          diary.diaryDate >= fromDate &&
          diary.diaryDate <= toDate,
      )
      .sort(compareDiaryDescending)
  }

  /** @param {string} id */
  async toggleFavorite(id) {
    const diary = await this.getById(id)
    return this.persist({ ...diary, favorite: !diary.favorite }, { draft: diary.draft })
  }

  /** @param {string} id @param {string | null} mood */
  async setMood(id, mood) {
    const diary = await this.getById(id)
    return this.persist({ ...diary, mood }, { draft: diary.draft })
  }

  async listDrafts() {
    const diaries = await this.repository.listAll()
    return diaries
      .filter((diary) => diary.draft && !diary.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  /** @param {string} id */
  async getDraftById(id) {
    const diary = await this.repository.findById(id)
    if (!diary || diary.deletedAt || !diary.draft) throw new DiaryNotFoundError(id)
    return diary
  }

  /** @param {string} id */
  async deleteDraft(id) {
    const diary = await this.getDraftById(id)
    await this.repository.deletePermanently(id)
    if (this.attachmentService) await this.attachmentService.removeByDiaryId(diary.id)
  }

  async listTrash() {
    const diaries = await this.repository.listAll()
    return diaries
      .filter((diary) => Boolean(diary.deletedAt))
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  }

  /**
   * 历史编辑使用。保留当前 draft 状态，只更新内容。
   * @param {import('../../models/Diary.js').Diary} diary
   */
  async save(diary) {
    return this.persist(diary, { draft: Boolean(diary.draft) })
  }

  /** @param {import('../../models/Diary.js').Diary} diary */
  async saveDraft(diary) {
    return this.persist(diary, { draft: true })
  }

  /** @param {import('../../models/Diary.js').Diary} diary */
  async saveAsEntry(diary) {
    return this.persist(diary, { draft: false })
  }

  /**
   * @param {import('../../models/Diary.js').Diary} diary
   * @param {{ draft: boolean }} state
   */
  async persist(diary, state) {
    const current = await this.repository.findById(diary.id)
    const timestamp = new Date().toISOString()
    const normalizedBlocks = normalizeBlocks(diary.blocks)
    const attachmentIds = [
      ...new Set(
        normalizedBlocks
          .filter((block) => block.type === 'image')
          .map((block) => block.attachmentId),
      ),
    ]
    const normalized = normalizeDiary({
      ...diary,
      blocks: normalizedBlocks,
      attachmentIds,
      createdAt: current?.createdAt ?? diary.createdAt,
      updatedAt: timestamp,
      draft: state.draft,
      deletedAt: null,
      sync: {
        ...diary.sync,
        revision: (current?.sync?.revision ?? diary.sync?.revision ?? 0) + 1,
        deviceId: this.deviceIdentityService.getDeviceId(),
        status: 'local-only',
      },
    })

    return this.repository.save(normalized)
  }

  /** @param {string} id */
  async softDelete(id) {
    const diary = await this.getById(id)
    const timestamp = new Date().toISOString()

    return this.repository.save(
      normalizeDiary({
        ...diary,
        deletedAt: timestamp,
        updatedAt: timestamp,
        sync: {
          ...diary.sync,
          revision: diary.sync.revision + 1,
          deviceId: this.deviceIdentityService.getDeviceId(),
          status: 'local-only',
        },
      }),
    )
  }

  /** @param {string} id */
  async restore(id) {
    const diary = await this.getDeletedById(id)
    const timestamp = new Date().toISOString()
    return this.repository.save(
      normalizeDiary({
        ...diary,
        deletedAt: null,
        updatedAt: timestamp,
        sync: {
          ...diary.sync,
          revision: diary.sync.revision + 1,
          deviceId: this.deviceIdentityService.getDeviceId(),
          status: 'local-only',
        },
      }),
    )
  }

  /** @param {string} id */
  async deletePermanently(id) {
    const diary = await this.repository.findById(id)
    await this.repository.deletePermanently(id)
    if (diary && this.attachmentService) {
      await this.attachmentService.removeByDiaryId(diary.id)
    }
  }
}

function compareDiaryDescending(a, b) {
  const dateComparison = b.diaryDate.localeCompare(a.diaryDate)
  if (dateComparison !== 0) return dateComparison
  return b.updatedAt.localeCompare(a.updatedAt)
}



