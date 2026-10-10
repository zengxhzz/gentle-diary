import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { normalizeBlocks } from '@/models/Block.js'
import { services } from '@/services/container.js'

const metadataKeys = ['mood', 'tagIds', 'favorite']

function metadataSnapshot(value) {
  return {
    mood: value.mood ?? null,
    tagIds: [...(value.tagIds ?? [])],
    favorite: Boolean(value.favorite),
  }
}

/**
 * 统一管理 Block 编辑器的加载、自动保存与离开前刷新。
 * autoSaveMode='draft' 时输入自动进入工作草稿；'preserve' 用于编辑已保存日记。
 * @param {{
 *   loadDiary: () => Promise<import('@/models/Diary.js').Diary>,
 *   autoSaveMode?: 'draft' | 'preserve'
 * }} options
 */
export function useDiaryEditor({ loadDiary, autoSaveMode = 'preserve' }) {
  const diary = ref(null)
  const blocks = ref([])
  const loading = ref(true)
  const loadError = ref('')
  const saveState = ref('idle')
  const dirty = ref(false)

  let initialized = false
  let saveTimer = null
  let savePromise = null

  const saveStatusText = computed(() => {
    if (saveState.value === 'saving') {
      return autoSaveMode === 'draft' ? '正在保存草稿' : '正在保存'
    }
    if (saveState.value === 'saved') {
      return autoSaveMode === 'draft' ? '草稿已保存' : '已保存'
    }
    if (saveState.value === 'entry-saved') return '已保存到日记'
    if (saveState.value === 'error') return '保存失败'
    return ''
  })

  async function initialize() {
    loading.value = true
    loadError.value = ''
    initialized = false

    try {
      const loaded = await loadDiary()
      diary.value = loaded
      blocks.value = normalizeBlocks(loaded.blocks)
      await nextTick()
      initialized = true
      dirty.value = false
      saveState.value = 'idle'
    } catch (error) {
      loadError.value = error?.message ?? '无法读取日记'
    } finally {
      loading.value = false
    }
  }

  function scheduleSave() {
    if (!initialized) return
    dirty.value = true
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void flushSave()
    }, 650)
  }

  function canPersist(snapshot) {
    const metadata = metadataSnapshot(diary.value)
    return snapshot.length > 0 || (diary.value.sync?.revision ?? 0) > 0 ||
      Boolean(metadata.mood || metadata.tagIds.length || metadata.favorite)
  }

  function acceptSavedSnapshot(saved, candidate) {
    const currentMetadata = metadataSnapshot(diary.value)
    const newerMetadata = {}
    for (const key of metadataKeys) {
      if (JSON.stringify(currentMetadata[key]) !== JSON.stringify(candidate[key])) {
        newerMetadata[key] = currentMetadata[key]
      }
    }
    dirty.value = Object.keys(newerMetadata).length > 0 ||
      JSON.stringify(normalizeBlocks(blocks.value)) !== JSON.stringify(candidate.blocks)
    // Keep service-generated fields (including revision), while preserving edits
    // made after this detached snapshot was submitted.
    diary.value = { ...saved, ...newerMetadata }
    loadError.value = ''
    if (dirty.value) scheduleSave()
  }

  /**
   * Apply and immediately persist mood, tagIds and/or favorite. Unknown keys and
   * invalid values are ignored. A failed save rejects, retaining edits for retry.
   * @param {Partial<Pick<import('@/models/Diary.js').Diary, 'mood' | 'tagIds' | 'favorite'>>} patch
   * @returns {Promise<import('@/models/Diary.js').Diary | null>}
   */
  async function updateMetadata(patch) {
    if (!initialized || !diary.value) return null
    const nextMetadata = metadataSnapshot(diary.value)
    if (patch?.mood === null || typeof patch?.mood === 'string') nextMetadata.mood = patch.mood
    if (Array.isArray(patch?.tagIds) && patch.tagIds.every((id) => typeof id === 'string')) {
      nextMetadata.tagIds = [...patch.tagIds]
    }
    if (typeof patch?.favorite === 'boolean') nextMetadata.favorite = patch.favorite
    if (JSON.stringify(nextMetadata) !== JSON.stringify(metadataSnapshot(diary.value))) {
      diary.value = { ...diary.value, ...nextMetadata }
      scheduleSave()
    }
    if (!dirty.value && !savePromise) return diary.value
    return (await saveNow()) ?? diary.value
  }

  async function saveNow() {
    if (!initialized || !diary.value) return null
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }

    if (savePromise) {
      await savePromise
      if (dirty.value) return saveNow()
      return null
    }

    const snapshot = normalizeBlocks(blocks.value)
    if (!canPersist(snapshot)) {
      dirty.value = false
      return null
    }

    saveState.value = 'saving'
    diary.value = {
      ...diary.value,
      blocks: snapshot,
    }
    const candidate = { ...diary.value, ...metadataSnapshot(diary.value), blocks: snapshot }

    try {
      savePromise =
        autoSaveMode === 'draft' && diary.value.draft !== false
          ? services.diaryService.saveDraft(candidate)
          : services.diaryService.save(candidate)
      const saved = await savePromise
      acceptSavedSnapshot(saved, candidate)
      saveState.value = 'saved'
      return saved
    } catch (error) {
      dirty.value = true
      saveState.value = 'error'
      loadError.value = error?.message ?? '保存失败'
      throw error
    } finally {
      savePromise = null
    }
  }

  async function saveAsDraft() {
    if (!initialized || !diary.value) return null
    if (!canPersist(normalizeBlocks(blocks.value))) return null
    const saved = await saveNow()
    saveState.value = 'saved'
    return saved ?? diary.value
  }

  async function saveAsEntry() {
    if (!initialized || !diary.value || !blocks.value.length) return null
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (savePromise) await savePromise

    const snapshot = normalizeBlocks(blocks.value)
    saveState.value = 'saving'
    const candidate = {
      ...diary.value,
      ...metadataSnapshot(diary.value),
      blocks: snapshot,
      draft: false,
    }

    try {
      savePromise = services.diaryService.saveAsEntry(candidate)
      const saved = await savePromise
      acceptSavedSnapshot(saved, candidate)
      saveState.value = 'entry-saved'
    } catch (error) {
      dirty.value = true
      saveState.value = 'error'
      loadError.value = error?.message ?? '保存失败'
      throw error
    } finally {
      savePromise = null
    }
    // Publishing must not let the caller discard edits made during its write.
    // Subsequent writes preserve the now-published entry instead of reverting it.
    while (dirty.value || savePromise) await saveNow()
    saveState.value = 'entry-saved'
    return diary.value
  }

  /** @param {import('@/models/Diary.js').Diary} nextDiary */
  async function replaceDiary(nextDiary) {
    initialized = false
    diary.value = nextDiary
    blocks.value = normalizeBlocks(nextDiary.blocks)
    await nextTick()
    dirty.value = false
    saveState.value = 'idle'
    initialized = true
  }

  async function flushSave() {
    if (!dirty.value && !savePromise) return
    try {
      await saveNow()
    } catch {
      // 后台保存无法阻止系统切换；错误状态会保留在当前界面供用户重试。
    }
  }

  /**
   * 启动相机或相册等外部 Activity 前强制持久化，即使当前是空白新草稿。
   * Android 回收 WebView 后，恢复结果才能找到稳定的目标日记 ID。
   */
  async function prepareForExternalActivity() {
    if (!initialized || !diary.value) return null
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (savePromise) await savePromise

    const snapshot = normalizeBlocks(blocks.value)
    saveState.value = 'saving'
    const candidate = { ...diary.value, ...metadataSnapshot(diary.value), blocks: snapshot }

    try {
      savePromise =
        autoSaveMode === 'draft' && diary.value.draft !== false
          ? services.diaryService.saveDraft(candidate)
          : services.diaryService.save(candidate)
      const saved = await savePromise
      // Typing can continue while the lifecycle snapshot is being persisted.
      // Never discard its newer dirty state when the older snapshot completes.
      acceptSavedSnapshot(saved, candidate)
      saveState.value = 'saved'
      return saved
    } catch (error) {
      dirty.value = true
      saveState.value = 'error'
      loadError.value = error?.message ?? '保存失败'
      throw error
    } finally {
      savePromise = null
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') void flushSave()
  }

  watch(blocks, () => scheduleSave(), { deep: true })

  onBeforeRouteLeave(async () => {
    if (!dirty.value && !savePromise) return true
    try {
      // A navigation request does not prevent typing while storage is pending.
      // Stay on this route until every newer edit is durable, or a write fails.
      do { await saveNow() } while (dirty.value || savePromise)
      return true
    } catch {
      // 写入失败时留在编辑页，避免把未保存内容当作已安全持久化。
      return false
    }
  })

  document.addEventListener('visibilitychange', handleVisibilityChange)
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    void flushSave()
  })

  return {
    diary,
    blocks,
    loading,
    loadError,
    saveState,
    saveStatusText,
    initialize,
    updateMetadata,
    saveNow,
    saveAsDraft,
    saveAsEntry,
    replaceDiary,
    flushSave,
    prepareForExternalActivity,
  }
}
