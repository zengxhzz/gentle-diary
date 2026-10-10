import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createParagraphBlock } from '@/models/Block.js'
import { createEmptyDiary } from '@/models/Diary.js'

const mocks = vi.hoisted(() => ({
  leaveHook: null,
  saveDraft: vi.fn(),
  save: vi.fn(),
  saveAsEntry: vi.fn(),
}))

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: (hook) => {
    mocks.leaveHook = hook
  },
}))

vi.mock('@/services/container.js', () => ({
  services: {
    diaryService: {
      saveDraft: mocks.saveDraft,
      save: mocks.save,
      saveAsEntry: mocks.saveAsEntry,
    },
  },
}))

import { useDiaryEditor } from '@/composables/useDiaryEditor.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.leaveHook = null
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  mocks.saveDraft.mockImplementation(async (diary) => ({
    ...diary,
    sync: { ...diary.sync, revision: (diary.sync?.revision ?? 0) + 1 },
  }))
  mocks.save.mockImplementation(mocks.saveDraft.getMockImplementation())
  mocks.saveAsEntry.mockImplementation(async (diary) => ({
    ...diary,
    draft: false,
    sync: { ...diary.sync, revision: (diary.sync?.revision ?? 0) + 1 },
  }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function createDraft() {
  const diary = createEmptyDiary('2026-09-20')
  diary.id = 'draft-autosave'
  diary.blocks = [createParagraphBlock('开始')]
  return diary
}

describe('useDiaryEditor autosave lifecycle', () => {
  it.each(['draft', 'preserve'])('persists metadata on a clean %s editor without text edits', async (autoSaveMode) => {
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode })
    await editor.initialize()
    const save = autoSaveMode === 'draft' ? mocks.saveDraft : mocks.save

    const saved = await editor.updateMetadata({ mood: 'happy' })
    expect(saved.mood).toBe('happy')
    await editor.updateMetadata({ tagIds: ['tag-work', 'tag-family'], favorite: true })

    expect(save).toHaveBeenCalledTimes(2)
    expect(save.mock.calls[1][0]).toMatchObject({
      mood: 'happy', tagIds: ['tag-work', 'tag-family'], favorite: true,
    })
    expect(editor.blocks.value[0].text).toBe('开始')
    expect(editor.saveState.value).toBe('saved')
    await expect(mocks.leaveHook()).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(650)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it.each([{ mood: 'calm' }, { tagIds: ['tag-only'] }, { favorite: true }])(
    'persists meaningful metadata on a blank new draft: %j', async (patch) => {
      const editor = useDiaryEditor({
        loadDiary: async () => createEmptyDiary('2026-09-20'), autoSaveMode: 'draft',
      })
      await editor.initialize()

      const saved = await editor.updateMetadata(patch)

      expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
      expect(saved).toMatchObject({ ...patch, blocks: [], sync: { revision: 1 } })
      expect(editor.saveState.value).toBe('saved')
    },
  )

  it('ignores unknown or invalid metadata and avoids writing unchanged blank defaults', async () => {
    const blankDraft = createEmptyDiary('2026-09-20')
    const editor = useDiaryEditor({ loadDiary: async () => blankDraft, autoSaveMode: 'draft' })
    await editor.initialize()

    await editor.updateMetadata({ mood: null, tagIds: [], favorite: false })
    await editor.updateMetadata({ id: 'other-id', blocks: [], draft: false, sync: { revision: 99 } })
    await editor.updateMetadata({ mood: 3, tagIds: [null], favorite: 'yes' })

    expect(editor.diary.value).toEqual(blankDraft)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(650)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })

  it('persists metadata clears on an existing blank draft', async () => {
    const blankDraft = createEmptyDiary('2026-09-20')
    Object.assign(blankDraft, { mood: 'happy', tagIds: ['tag-old'], favorite: true })
    blankDraft.sync.revision = 4
    const editor = useDiaryEditor({ loadDiary: async () => blankDraft, autoSaveMode: 'draft' })
    await editor.initialize()

    await editor.updateMetadata({ mood: null, tagIds: [], favorite: false })

    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
    expect(editor.diary.value).toMatchObject({
      blocks: [], mood: null, tagIds: [], favorite: false, sync: { revision: 5 },
    })
  })

  it('saves the latest text and cleared metadata after a pending blank-draft metadata save', async () => {
    let finishSnapshot
    mocks.saveDraft.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishSnapshot = () => resolve({ ...diary, sync: { ...diary.sync, revision: 1 } })
    }))
    const editor = useDiaryEditor({
      loadDiary: async () => createEmptyDiary('2026-09-20'), autoSaveMode: 'draft',
    })
    await editor.initialize()

    const pending = editor.updateMetadata({ mood: 'calm', tagIds: ['tag-old'], favorite: true })
    editor.blocks.value = [createParagraphBlock('元数据保存期间新增的正文')]
    const pendingClear = editor.updateMetadata({ mood: null, tagIds: [], favorite: false })
    await nextTick()
    finishSnapshot()
    await Promise.all([pending, pendingClear])

    expect(mocks.saveDraft).toHaveBeenCalledTimes(2)
    expect(mocks.saveDraft.mock.calls[0][0]).toMatchObject({
      blocks: [], mood: 'calm', tagIds: ['tag-old'], favorite: true,
    })
    expect(editor.diary.value).toMatchObject({
      blocks: [{ text: '元数据保存期间新增的正文' }],
      mood: null, tagIds: [], favorite: false, sync: { revision: 2 },
    })
    await expect(mocks.leaveHook()).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(650)
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2)
  })

  it('allows saveAsDraft to persist a loaded blank draft with meaningful metadata', async () => {
    const blankDraft = createEmptyDiary('2026-09-20')
    blankDraft.mood = 'calm'
    const editor = useDiaryEditor({ loadDiary: async () => blankDraft, autoSaveMode: 'draft' })
    await editor.initialize()

    await expect(editor.saveAsDraft()).resolves.toMatchObject({
      blocks: [], mood: 'calm', sync: { revision: 1 },
    })
    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
  })

  it.each(['saveNow', 'prepareForExternalActivity'])(
    'preserves newer metadata and text while %s persists an older snapshot', async (saveMethod) => {
      let finishSnapshot
      let finishLatest
      const heldSave = (diary) => new Promise((resolve) => {
        finishSnapshot = () => resolve({ ...diary, sync: { ...diary.sync, revision: 1 } })
      })
      if (saveMethod === 'saveAsEntry') mocks.saveAsEntry.mockImplementationOnce(heldSave)
      else mocks.saveDraft.mockImplementationOnce(heldSave)
      const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
      await editor.initialize()

      const pendingSnapshot = editor[saveMethod]()
      mocks.saveDraft.mockImplementationOnce((diary) => new Promise((resolve) => {
        finishLatest = () => resolve({ ...diary, sync: { ...diary.sync, revision: 2 } })
      }))
      const pendingMetadata = editor.updateMetadata({ mood: 'calm', tagIds: ['tag-new'], favorite: true })
      // A second metadata edit occurs while both the first snapshot and API call wait.
      const pendingLatest = editor.updateMetadata({ mood: 'happy', tagIds: ['tag-latest'] })
      editor.blocks.value[0].text = '保存期间的新文字'
      await nextTick()
      finishSnapshot()
      await pendingSnapshot

      expect(editor.diary.value).toMatchObject({
        mood: 'happy', tagIds: ['tag-latest'], favorite: true, sync: { revision: 1 },
      })
      expect(mocks.saveDraft.mock.lastCall[0]).toMatchObject({
        mood: 'happy', tagIds: ['tag-latest'], favorite: true,
        blocks: [{ text: '保存期间的新文字' }], sync: { revision: 1 },
      })
      finishLatest()
      await Promise.all([pendingMetadata, pendingLatest])
      expect(editor.diary.value.sync.revision).toBe(2)
      expect(editor.blocks.value[0].text).toBe('保存期间的新文字')
      await expect(mocks.leaveHook()).resolves.toBe(true)
      await vi.advanceTimersByTimeAsync(650)
      expect(mocks.saveDraft).toHaveBeenCalledTimes(saveMethod === 'saveAsEntry' ? 1 : 2)
    },
  )

  it('detaches tag arrays from callers and in-flight persistence snapshots', async () => {
    let finishSnapshot
    mocks.saveDraft.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishSnapshot = () => resolve({ ...diary, sync: { ...diary.sync, revision: 1 } })
    }))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()
    const tagIds = ['tag-original']

    const pending = editor.updateMetadata({ tagIds })
    tagIds.push('caller-mutation')
    editor.diary.value.tagIds.push('newer-editor-tag')
    expect(mocks.saveDraft.mock.calls[0][0].tagIds).toEqual(['tag-original'])
    finishSnapshot()
    await pending
    await vi.advanceTimersByTimeAsync(650)

    expect(editor.diary.value.tagIds).toEqual(['tag-original', 'newer-editor-tag'])
    expect(mocks.saveDraft.mock.calls[1][0].tagIds).toEqual(['tag-original', 'newer-editor-tag'])
  })

  it('waits for newer edits before publication completes and never reverts to draft', async () => {
    let finishPublish
    let finishLatest
    mocks.saveAsEntry.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishPublish = () => resolve({ ...diary, draft: false, sync: { ...diary.sync, revision: 1 } })
    }))
    mocks.save.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishLatest = () => resolve({ ...diary, sync: { ...diary.sync, revision: 2 } })
    }))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()
    let completed = false
    const publishing = editor.saveAsEntry().then((value) => { completed = true; return value })
    editor.blocks.value[0].text = '发布期间的最后一句'
    const metadata = editor.updateMetadata({ mood: 'happy', tagIds: ['tag-latest'] })
    await nextTick()
    finishPublish()
    await vi.advanceTimersByTimeAsync(0)
    expect(completed).toBe(false)
    expect(mocks.save.mock.lastCall[0]).toMatchObject({
      draft: false, mood: 'happy', tagIds: ['tag-latest'], blocks: [{ text: '发布期间的最后一句' }],
    })
    finishLatest()
    const [saved] = await Promise.all([publishing, metadata])
    expect(saved).toMatchObject({ draft: false, sync: { revision: 2 }, mood: 'happy' })
    await vi.advanceTimersByTimeAsync(650)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(editor.saveState.value).toBe('entry-saved')
  })

  it('retains edits and rejects publication if saving its newer edits fails', async () => {
    let finishPublish
    mocks.saveAsEntry.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishPublish = () => resolve({ ...diary, draft: false, sync: { ...diary.sync, revision: 1 } })
    }))
    mocks.save.mockRejectedValueOnce(new Error('最新修改写入失败'))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()
    const publishing = editor.saveAsEntry()
    const rejected = expect(publishing).rejects.toThrow('最新修改写入失败')
    editor.blocks.value[0].text = '失败也不能丢失'
    await nextTick()
    finishPublish()
    await rejected
    expect(editor.blocks.value[0].text).toBe('失败也不能丢失')
    expect(editor.saveState.value).toBe('error')
    await editor.flushSave()
    expect(editor.diary.value.draft).toBe(false)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })

  it('retains failed metadata edits and retries the same patch', async () => {
    mocks.saveDraft.mockRejectedValueOnce(new Error('元数据写入失败'))
    const editor = useDiaryEditor({
      loadDiary: async () => createEmptyDiary('2026-09-20'), autoSaveMode: 'draft',
    })
    await editor.initialize()
    const patch = { mood: 'calm', tagIds: ['tag-retry'], favorite: true }

    await expect(editor.updateMetadata(patch)).rejects.toThrow('元数据写入失败')
    expect(editor.diary.value).toMatchObject(patch)
    expect(editor.saveState.value).toBe('error')
    expect(editor.loadError.value).toBe('元数据写入失败')

    await editor.updateMetadata(patch)
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2)
    expect(editor.diary.value).toMatchObject({ ...patch, sync: { revision: 1 } })
    expect(editor.saveState.value).toBe('saved')
    expect(editor.loadError.value).toBe('')
  })

  it('retains newer metadata and text when an overlapping snapshot fails', async () => {
    let failSnapshot
    mocks.saveDraft.mockImplementationOnce(() => new Promise((resolve, reject) => {
      failSnapshot = () => reject(new Error('旧快照写入失败'))
    }))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()

    const pendingSnapshot = editor.prepareForExternalActivity()
    const pendingMetadata = editor.updateMetadata({ mood: 'happy', tagIds: ['tag-pending'] })
    editor.blocks.value[0].text = '失败后保留的新文字'
    await nextTick()
    const results = Promise.allSettled([pendingSnapshot, pendingMetadata])
    failSnapshot()
    expect((await results).map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(editor.diary.value).toMatchObject({ mood: 'happy', tagIds: ['tag-pending'] })
    expect(editor.blocks.value[0].text).toBe('失败后保留的新文字')
    expect(editor.saveState.value).toBe('error')

    await editor.flushSave()
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2)
    expect(mocks.saveDraft.mock.lastCall[0]).toMatchObject({
      mood: 'happy', tagIds: ['tag-pending'], blocks: [{ text: '失败后保留的新文字' }],
    })
    expect(editor.saveState.value).toBe('saved')
  })

  it('debounces draft persistence for 650ms', async () => {
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()

    editor.blocks.value[0].text = '已修改'
    await nextTick()
    await vi.advanceTimersByTimeAsync(649)
    expect(mocks.saveDraft).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
    expect(mocks.saveDraft.mock.calls[0][0].blocks[0].text).toBe('已修改')
  })

  it('flushes pending edits before route navigation completes', async () => {
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()

    editor.blocks.value[0].text = '离开前保存'
    await nextTick()
    expect(mocks.saveDraft).not.toHaveBeenCalled()

    await expect(mocks.leaveHook()).resolves.toBe(true)
    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
    expect(mocks.saveDraft.mock.calls[0][0].blocks[0].text).toBe('离开前保存')
  })

  it('allows leaving a clean editor without a redundant database write', async () => {
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()

    await expect(mocks.leaveHook()).resolves.toBe(true)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })

  it('waits for typing that arrives during route-leave persistence', async () => {
    let finishSnapshot
    let finishLatest
    mocks.saveDraft.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishSnapshot = () => resolve({ ...diary, sync: { ...diary.sync, revision: 1 } })
    })).mockImplementationOnce((diary) => new Promise((resolve) => {
      finishLatest = () => resolve({ ...diary, sync: { ...diary.sync, revision: 2 } })
    }))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()
    editor.blocks.value[0].text = '准备离开'
    await nextTick()
    let completed = false
    const leaving = mocks.leaveHook().then((value) => { completed = true; return value })
    editor.blocks.value[0].text = '离开保存期间又输入'
    await nextTick()
    finishSnapshot()
    await vi.advanceTimersByTimeAsync(0)
    expect(completed).toBe(false)
    expect(mocks.saveDraft.mock.lastCall[0].blocks[0].text).toBe('离开保存期间又输入')
    finishLatest()
    await expect(leaving).resolves.toBe(true)
    await vi.advanceTimersByTimeAsync(650)
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2)
  })

  it('blocks navigation when persisting newer route-leave typing fails', async () => {
    let finishSnapshot
    mocks.saveDraft.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishSnapshot = () => resolve({ ...diary, sync: { ...diary.sync, revision: 1 } })
    })).mockRejectedValueOnce(new Error('新输入写入失败'))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()
    editor.blocks.value[0].text = '准备离开'
    await nextTick()
    const leaving = mocks.leaveHook()
    editor.blocks.value[0].text = '仍须保护的最后一句'
    await nextTick()
    finishSnapshot()
    await expect(leaving).resolves.toBe(false)
    expect(editor.blocks.value[0].text).toBe('仍须保护的最后一句')
    expect(editor.saveState.value).toBe('error')
    await expect(mocks.leaveHook()).resolves.toBe(true)
  })

  it('keeps the editor open and retains edits when route-leave saving fails', async () => {
    mocks.saveDraft.mockRejectedValueOnce(new Error('存储空间不足'))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()

    editor.blocks.value[0].text = '不能丢失的文字'
    await nextTick()

    await expect(mocks.leaveHook()).resolves.toBe(false)
    expect(editor.blocks.value[0].text).toBe('不能丢失的文字')
    expect(editor.saveState.value).toBe('error')
    expect(editor.loadError.value).toBe('存储空间不足')

    await expect(mocks.leaveHook()).resolves.toBe(true)
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2)
  })

  it('reports a background autosave failure without an unhandled rejection', async () => {
    mocks.saveDraft.mockRejectedValueOnce(new Error('写入失败'))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()

    editor.blocks.value[0].text = '稍后重试'
    await nextTick()
    await vi.advanceTimersByTimeAsync(650)

    expect(editor.saveState.value).toBe('error')
    expect(editor.blocks.value[0].text).toBe('稍后重试')
  })

  it('persists a blank draft before an external photo picker opens', async () => {
    const blankDraft = createEmptyDiary('2026-09-20')
    blankDraft.id = 'draft-before-picker'
    const editor = useDiaryEditor({ loadDiary: async () => blankDraft, autoSaveMode: 'draft' })
    await editor.initialize()

    const saved = await editor.prepareForExternalActivity()

    expect(mocks.saveDraft).toHaveBeenCalledTimes(1)
    expect(mocks.saveDraft.mock.calls[0][0]).toMatchObject({
      id: 'draft-before-picker',
      blocks: [],
    })
    expect(saved.id).toBe('draft-before-picker')
    expect(saved.sync.revision).toBe(1)
  })

  it('does not mark newer typing clean when a slow lifecycle snapshot finishes', async () => {
    let finishSnapshot
    mocks.saveDraft.mockImplementationOnce((diary) => new Promise((resolve) => {
      finishSnapshot = () => resolve({ ...diary, sync: { ...diary.sync, revision: 1 } })
    }))
    const editor = useDiaryEditor({ loadDiary: async () => createDraft(), autoSaveMode: 'draft' })
    await editor.initialize()

    const pending = editor.prepareForExternalActivity()
    editor.blocks.value[0].text = '快照写入时继续输入的文字'
    await nextTick()
    finishSnapshot()
    await pending
    await vi.advanceTimersByTimeAsync(650)

    expect(mocks.saveDraft).toHaveBeenCalledTimes(2)
    expect(mocks.saveDraft.mock.calls[1][0].blocks[0].text).toBe('快照写入时继续输入的文字')
    expect(editor.blocks.value[0].text).toBe('快照写入时继续输入的文字')
  })
})
