import { describe, expect, it, vi } from 'vitest'
import { createParagraphBlock } from '@/models/Block.js'
import { DiaryService } from '@/services/diary/DiaryService.js'

class MemoryDiaryRepository {
  constructor() {
    this.records = new Map()
  }

  async findById(id) {
    return this.records.get(id) ?? null
  }

  async findActiveByDate(diaryDate) {
    return (
      [...this.records.values()]
        .filter((diary) => diary.diaryDate === diaryDate && !diary.deletedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    )
  }

  async findLatestDraft() {
    return (
      [...this.records.values()]
        .filter((diary) => diary.draft && !diary.deletedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    )
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

const deviceIdentityService = {
  getDeviceId: () => 'device-test',
}

function createService() {
  return new DiaryService(new MemoryDiaryRepository(), deviceIdentityService)
}

describe('DiaryService drafts and entries', () => {
  it('keeps an autosaved working draft out of the diary timeline', async () => {
    const service = createService()
    const draft = await service.getOrCreateWorkingDraft()
    draft.diaryDate = '2026-09-10'
    draft.blocks = [createParagraphBlock('还没写完。')]

    const savedDraft = await service.saveDraft(draft)
    expect(savedDraft.draft).toBe(true)
    expect(await service.listTimeline()).toHaveLength(0)

    const reopenedDraft = await service.getOrCreateWorkingDraft()
    expect(reopenedDraft.id).toBe(savedDraft.id)
    expect(reopenedDraft.blocks[0].text).toBe('还没写完。')
  })

  it('creates multiple independent entries on the same day', async () => {
    const service = createService()

    const firstDraft = await service.getOrCreateWorkingDraft()
    firstDraft.diaryDate = '2026-09-10'
    firstDraft.blocks = [createParagraphBlock('第一篇')]
    const first = await service.saveAsEntry(firstDraft)

    const secondDraft = await service.getOrCreateWorkingDraft()
    secondDraft.diaryDate = '2026-09-10'
    secondDraft.blocks = [createParagraphBlock('第二篇')]
    const second = await service.saveAsEntry(secondDraft)

    const timeline = await service.listTimeline()
    expect(timeline).toHaveLength(2)
    expect(timeline.map((diary) => diary.id)).toEqual(
      expect.arrayContaining([first.id, second.id]),
    )
  })

  it('removes attachments when a diary is permanently deleted', async () => {
    const repository = new MemoryDiaryRepository()
    const attachmentService = { removeByDiaryId: vi.fn().mockResolvedValue(undefined) }
    const service = new DiaryService(repository, deviceIdentityService, attachmentService)
    const diary = await service.getOrCreateWorkingDraft()
    diary.blocks = [createParagraphBlock('带图片的日记')]
    const saved = await service.saveAsEntry(diary)

    await service.deletePermanently(saved.id)

    expect(attachmentService.removeByDiaryId).toHaveBeenCalledWith(saved.id)
    expect(await repository.findById(saved.id)).toBeNull()
  })

  it('edits and soft-deletes one entry without affecting another', async () => {
    const service = createService()

    const firstDraft = await service.getOrCreateWorkingDraft()
    firstDraft.diaryDate = '2026-09-10'
    firstDraft.blocks = [createParagraphBlock('第一篇')]
    const first = await service.saveAsEntry(firstDraft)

    const secondDraft = await service.getOrCreateWorkingDraft()
    secondDraft.diaryDate = '2026-09-10'
    secondDraft.blocks = [createParagraphBlock('第二篇')]
    const second = await service.saveAsEntry(secondDraft)

    first.blocks = [createParagraphBlock('第一篇已修改')]
    const edited = await service.save(first)
    expect(edited.id).toBe(first.id)
    expect(edited.draft).toBe(false)
    expect(edited.blocks[0].text).toBe('第一篇已修改')

    await service.softDelete(first.id)
    const remaining = await service.listTimeline()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second.id)

    const restored = await service.restore(first.id)
    expect(restored.deletedAt).toBeNull()
    expect(await service.listTimeline()).toHaveLength(2)
  })
})


