import { describe, expect, it } from 'vitest'
import { createParagraphBlock } from '@/models/Block.js'
import { DiaryService } from '@/services/diary/DiaryService.js'

class MemoryDiaryRepository {
  constructor() {
    this.records = new Map()
  }

  async findById(id) {
    return this.records.get(id) ?? null
  }

  async findLatestDraft() {
    return null
  }

  async listAll() {
    return [...this.records.values()]
  }

  async save(diary) {
    this.records.set(diary.id, structuredClone(diary))
    return structuredClone(diary)
  }

  async deletePermanently(id) {
    this.records.delete(id)
  }
}

const deviceIdentityService = { getDeviceId: () => 'device-test' }

async function createEntry(service, date, text, mood = null) {
  const diary = await service.getOrCreateWorkingDraft()
  diary.diaryDate = date
  diary.blocks = [createParagraphBlock(text)]
  diary.mood = mood
  return service.saveAsEntry(diary)
}

describe('DiaryService Phase 4 retrieval', () => {
  it('searches text and filters by favorite and mood', async () => {
    const service = new DiaryService(new MemoryDiaryRepository(), deviceIdentityService)
    const first = await createEntry(service, '2026-09-10', '湖边散步', 'calm')
    await createEntry(service, '2026-09-11', '工作记录', 'tired')
    await service.toggleFavorite(first.id)

    expect((await service.search({ query: '湖边' })).map((item) => item.id)).toEqual([first.id])
    expect((await service.search({ favoriteOnly: true })).map((item) => item.id)).toEqual([first.id])
    expect((await service.search({ mood: 'tired' })).length).toBe(1)
    expect((await service.search()).length).toBe(2)
  })

  it('stores and clears mood', async () => {
    const service = new DiaryService(new MemoryDiaryRepository(), deviceIdentityService)
    const diary = await createEntry(service, '2026-09-10', '今天很好', 'happy')

    const cleared = await service.setMood(diary.id, null)
    expect(cleared.mood).toBeNull()
  })

  it('lists and deletes drafts', async () => {
    const service = new DiaryService(new MemoryDiaryRepository(), deviceIdentityService)
    const draft = await service.getOrCreateWorkingDraft()
    draft.blocks = [createParagraphBlock('未完成草稿')]
    const savedDraft = await service.saveDraft(draft)

    expect((await service.listDrafts()).map((item) => item.id)).toEqual([savedDraft.id])
    expect((await service.getDraftById(savedDraft.id)).id).toBe(savedDraft.id)

    await service.deleteDraft(savedDraft.id)
    expect(await service.listDrafts()).toHaveLength(0)
  })

  it('lists diaries in a date range', async () => {
    const service = new DiaryService(new MemoryDiaryRepository(), deviceIdentityService)
    await createEntry(service, '2026-09-01', '一号')
    await createEntry(service, '2026-09-10', '十号')
    await createEntry(service, '2026-10-01', '十月一号')

    const result = await service.listByDateRange('2026-09-01', '2026-09-30')
    expect(result.map((diary) => diary.diaryDate)).toEqual(['2026-09-10', '2026-09-01'])
  })
})
