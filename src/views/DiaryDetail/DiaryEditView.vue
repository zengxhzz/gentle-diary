<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppActionSheet from '@/components/common/AppActionSheet.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import DiaryBlockEditor from '@/components/editor/DiaryBlockEditor.vue'
import TagPickerSheet from '@/components/diary/TagPickerSheet.vue'
import { useDiaryEditor } from '@/composables/useDiaryEditor.js'
import { MOOD_OPTIONS, getMoodLabel } from '@/models/Mood.js'
import { services } from '@/services/container.js'
import { formatTodayHeading } from '@/utils/date.js'

const route = useRoute()
const router = useRouter()
const diaryId = String(route.params.id)
const attachmentUrls = ref({})
const toolsOpen = ref(false)
const moodOpen = ref(false)
const tagOpen = ref(false)
const tags = ref([])
const tagSelection = ref([])
const tagSaving = ref(false)
const addingImage = ref(false)
const attachmentError = ref('')
const blockEditorRef = ref(null)
let unsubscribeCameraRecovery = null

const editor = useDiaryEditor({
  loadDiary: () => services.diaryService.getById(diaryId),
  autoSaveMode: 'preserve',
})

const moodItems = computed(() =>
  MOOD_OPTIONS.map((mood) => ({
    id: mood.id,
    label: `${mood.symbol} ${mood.label}`,
    icon: 'mood',
    status: editor.diary.value?.mood === mood.id ? '当前' : '',
  })),
)

const currentMoodLabel = computed(() => getMoodLabel(editor.diary.value?.mood))
const selectedTagNames = computed(() => {
  const tagMap = new Map(tags.value.map((tag) => [tag.id, tag.name]))
  return (editor.diary.value?.tagIds ?? []).map((id) => tagMap.get(id)).filter(Boolean)
})

const toolItems = [
  { id: 'image', label: '图片', icon: 'image' },
  { id: 'camera', label: '拍照', icon: 'camera' },
  { id: 'mood', label: '心情', icon: 'mood' },
  { id: 'tag', label: '标签', icon: 'tag' },
]

onMounted(async () => {
  await editor.initialize()
  await loadAttachments()
  tags.value = await services.tagService.list()
  unsubscribeCameraRecovery = services.cameraRecoveryService.subscribe(handleCameraRecovery)
})

onBeforeUnmount(() => {
  unsubscribeCameraRecovery?.()
  releaseAttachmentUrls()
})

function goBack() {
  // 正常从详情进入编辑时直接回退，避免堆叠重复详情页。
  if (window.history.state?.back) {
    router.back()
    return
  }

  void router.replace({ name: 'diary-detail', params: { id: diaryId } })
}

async function loadAttachments() {
  const attachments = await services.attachmentService.listImages(diaryId)
  attachmentUrls.value = Object.fromEntries(
    attachments.map((attachment) => [attachment.id, attachment.url]),
  )
}

function releaseAttachmentUrls() {
  Object.keys(attachmentUrls.value).forEach((attachmentId) => {
    services.attachmentService.release(attachmentId)
  })
  attachmentUrls.value = {}
}

async function handleToolSelect(id) {
  toolsOpen.value = false
  if (id === 'mood') {
    moodOpen.value = true
    return
  }
  if (id === 'tag') {
    tagSelection.value = [...(editor.diary.value?.tagIds ?? [])]
    tagOpen.value = true
    return
  }
  if (id !== 'image' && id !== 'camera') return

  addingImage.value = true
  attachmentError.value = ''
  try {
    // 相册选择器同样会离开 WebView；必须先保存尚在防抖窗口中的修改。
    await editor.prepareForExternalActivity()
    const attachment = await services.attachmentService.addImage(diaryId, {
      source: id === 'camera' ? 'camera' : 'gallery',
    })
    if (!attachment) return
    const insertedBlock = blockEditorRef.value?.insertImage(attachment.id)
    if (!insertedBlock) {
      await services.attachmentService.remove(attachment.id)
      return
    }
    attachmentUrls.value = {
      ...attachmentUrls.value,
      [attachment.id]: attachment.url,
    }
    const saved = await editor.saveNow()
    if (!(saved ?? editor.diary.value)?.attachmentIds?.includes(attachment.id)) {
      throw new Error('图片尚未保存到日记，请稍后重试。')
    }
    await services.attachmentService.completeCapture(attachment.captureId)
  } catch (error) {
    attachmentError.value = error?.message ?? '无法添加图片'
  } finally {
    addingImage.value = false
  }
}

async function handleCameraRecovery(result) {
  if (result.diaryId && result.diaryId !== diaryId) return
  if (result.status === 'error') {
    attachmentError.value = result.message
    return
  }
  if (!result.diary || !result.attachment) return

  if (result.attachment.url) {
    attachmentUrls.value = {
      ...attachmentUrls.value,
      [result.attachment.id]: result.attachment.url,
    }
  }
  await editor.replaceDiary(result.diary)
}

async function createTag(name) {
  const tag = await services.tagService.create(name)
  if (!tag) return
  tags.value = await services.tagService.list()
  if (!tagSelection.value.includes(tag.id)) {
    tagSelection.value = [...tagSelection.value, tag.id]
  }
}

async function removeTag(tagId) {
  await services.tagService.remove(tagId)
  tags.value = await services.tagService.list()
  tagSelection.value = tagSelection.value.filter((id) => id !== tagId)
  if (editor.diary.value) {
    try {
      await editor.updateMetadata({ tagIds: (editor.diary.value.tagIds ?? []).filter((id) => id !== tagId) })
    } catch { /* 编辑器保留失败状态和待重试改动。 */ }
  }
}

async function saveTags() {
  if (!editor.diary.value) return
  tagSaving.value = true
  try {
    await editor.updateMetadata({ tagIds: tagSelection.value })
    tagOpen.value = false
  } catch { /* 失败时保持选择面板，允许重试。 */
  } finally {
    tagSaving.value = false
  }
}

async function chooseMood(moodId) {
  if (!editor.diary.value) return
  moodOpen.value = false
  try {
    await editor.updateMetadata({ mood: moodId })
  } catch { /* 编辑器保留失败状态和待重试改动。 */ }
}

async function handleDeleteImage({ attachmentId }) {
  try {
    const saved = await editor.saveNow()
    const removed = await services.attachmentService.removeIfUnreferenced(
      attachmentId, saved ?? editor.diary.value,
    )
    if (!removed) return
    const nextUrls = { ...attachmentUrls.value }
    delete nextUrls[attachmentId]
    attachmentUrls.value = nextUrls
  } catch (error) {
    attachmentError.value = error?.message ?? '图片删除未完成，原文件仍保留。'
  }
}
</script>

<template>
  <div class="screen edit-screen">
    <AppHeader
      :title="editor.diary.value ? formatTodayHeading(editor.diary.value.diaryDate) : '编辑'"
      show-back
      @back="goBack"
    >
      <template #actions>
        <span v-if="editor.saveStatusText.value" class="save-status" aria-live="polite">
          {{ editor.saveStatusText.value }}
        </span>
      </template>
    </AppHeader>

    <main class="page-content edit-content">
      <p v-if="editor.loading.value" class="quiet-message" role="status">正在打开……</p>
      <template v-else-if="editor.diary.value">
        <div v-if="currentMoodLabel || selectedTagNames.length" class="mood-line">
          <button
            v-if="currentMoodLabel"
            type="button"
            class="mood-chip"
            aria-label="更改心情"
            :aria-expanded="moodOpen"
            aria-haspopup="dialog"
            @click="moodOpen = true"
          >
            {{ currentMoodLabel }}
          </button>
          <span v-for="tagName in selectedTagNames" :key="tagName" class="foreground-tag">{{ tagName }}</span>
        </div>

        <DiaryBlockEditor
          ref="blockEditorRef"
          v-model:blocks="editor.blocks.value"
          :attachment-urls="attachmentUrls"
          placeholder="继续写……"
          aria-label="编辑日记正文"
          @delete-image="handleDeleteImage"
        />
      </template>
      <p v-else class="quiet-message quiet-message--error" role="alert">
        {{ editor.loadError.value || '无法读取这篇日记。' }}
      </p>

      <p v-if="addingImage" class="quiet-message" role="status">正在添加图片……</p>
      <p v-if="attachmentError" class="quiet-message quiet-message--error" role="alert">{{ attachmentError }}</p>
      <p v-if="editor.saveState.value === 'error'" class="quiet-message quiet-message--error" role="alert">
        {{ editor.loadError.value || '内容暂未保存，请稍后再试。' }}
      </p>
    </main>

    <button
      class="compose-button"
      type="button"
      aria-label="添加内容"
      :aria-expanded="toolsOpen"
      aria-haspopup="dialog"
      @click="toolsOpen = true"
    >
      <AppIcon name="plus" :size="24" />
    </button>

    <TagPickerSheet
      :open="tagOpen"
      :tags="tags"
      :model-value="tagSelection"
      :saving="tagSaving"
      @update:model-value="tagSelection = $event"
      @create="createTag"
      @remove="removeTag"
      @save="saveTags"
      @close="tagOpen = false"
    />

    <AppActionSheet
      :open="moodOpen"
      title="选择心情"
      :items="moodItems"
      @close="moodOpen = false"
      @select="chooseMood"
    />

    <AppActionSheet
      :open="toolsOpen"
      title="添加到日记"
      layout="grid"
      :items="toolItems"
      @close="toolsOpen = false"
      @select="handleToolSelect"
    />
  </div>
</template>

<style scoped>
.edit-content {
  padding-bottom: calc(var(--safe-bottom) + 8rem);
}

.mood-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xl);
}

.foreground-tag {
  max-width: 100%;
  padding: 0.3rem var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  line-height: 1.8;
  overflow-wrap: anywhere;
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
}

.mood-chip {
  min-width: 2.75rem;
  min-height: 2.75rem;
  max-width: 100%;
  padding: 0 var(--space-md);
  color: var(--color-accent-strong);
  font-size: var(--text-sm);
  line-height: 1.6;
  overflow-wrap: anywhere;
  background: var(--color-accent-soft);
  border-radius: var(--radius-full);
}

.quiet-message {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  line-height: 1.8;
}

.quiet-message--error {
  color: var(--color-danger);
}

.save-status {
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.compose-button {
  position: fixed;
  right: max(var(--page-gutter), calc((100vw - var(--page-width)) / 2 + var(--page-gutter)));
  bottom: calc(var(--safe-bottom) + var(--space-xl));
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  color: var(--color-surface);
  background: var(--color-accent-strong);
  border: 1px solid var(--color-accent-strong);
  border-radius: var(--radius-full);
  box-shadow: 0 6px 20px rgba(52, 69, 63, 0.12);
}

.compose-button:active {
  transform: scale(0.96);
}
</style>
