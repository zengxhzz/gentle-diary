<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppActionSheet from '@/components/common/AppActionSheet.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import DiaryBlockEditor from '@/components/editor/DiaryBlockEditor.vue'
import TagPickerSheet from '@/components/diary/TagPickerSheet.vue'
import DecorationScene from '@/components/themes/DecorationScene.vue'
import { useDiaryEditor } from '@/composables/useDiaryEditor.js'
import { MOOD_OPTIONS, getMoodLabel } from '@/models/Mood.js'
import { services } from '@/services/container.js'
import { formatDayNumber, formatMonthHeading, formatTodayHeading, formatWeekday, toDateKey } from '@/utils/date.js'
import { isWritingViewportCompressed, resolveStableViewport, shouldRevealFocusedEditor } from '@/utils/stableViewport.js'
import { revealEditorCaret } from '@/utils/editorCaret.js'

const route = useRoute()
const router = useRouter()
const dateKey = toDateKey()
const theme = ref(null)
const menuOpen = ref(false)
const toolsOpen = ref(false)
const moodOpen = ref(false)
const tagOpen = ref(false)
const tags = ref([])
const tagSelection = ref([])
const tagSaving = ref(false)
const saveOpen = ref(false)
const savingEntry = ref(false)
const addingImage = ref(false)
const attachmentError = ref('')
const attachmentUrls = ref({})
const blockEditorRef = ref(null)
const notice = ref('')
const stableViewportHeight = ref(window.innerHeight)
const visibleViewportHeight = ref(window.innerHeight)
const writingViewportCompressed = computed(() =>
  isWritingViewportCompressed(stableViewportHeight.value, visibleViewportHeight.value),
)
let stableViewportWidth = window.innerWidth
let viewportRevealFrame = null
let viewportOrientationTimer = null
let viewportOrientationSettling = false
let noticeTimer = null
let unsubscribeCameraRecovery = null

const editor = useDiaryEditor({
  loadDiary: () =>
    route.query.draft
      ? services.diaryService.getDraftById(String(route.query.draft))
      : services.diaryService.getOrCreateWorkingDraft(),
  autoSaveMode: 'draft',
})

const displayDateKey = computed(() => editor.diary.value?.diaryDate ?? dateKey)
const todayScreenStyle = computed(() => ({
  '--stable-viewport-height': `${stableViewportHeight.value}px`,
}))
const canPersistDraft = computed(
  () => editor.blocks.value.length > 0 || (editor.diary.value?.sync?.revision ?? 0) > 0,
)
const canPublish = computed(() => editor.blocks.value.length > 0 && !savingEntry.value)

const currentMoodLabel = computed(() => getMoodLabel(editor.diary.value?.mood))
const selectedTagNames = computed(() => {
  const tagMap = new Map(tags.value.map((tag) => [tag.id, tag.name]))
  return (editor.diary.value?.tagIds ?? []).map((id) => tagMap.get(id)).filter(Boolean)
})

const contextLine = computed(() => {
  const diary = editor.diary.value
  if (!diary) return ''
  return [diary.location?.name, diary.weather?.summary].filter(Boolean).join(' · ')
})

const menuItems = [
  { id: 'history', label: '历史日记', description: '翻阅已经收好的日子', icon: 'paragraph' },
  { id: 'drafts', label: '草稿', description: '继续那些还没写完的片刻', icon: 'edit' },
  { id: 'search', label: '搜索', description: '用文字、心情或标签找回一篇', icon: 'search' },
  { id: 'calendar', label: '日历', description: '按日期回到某一天', icon: 'calendar' },
  { id: 'trash', label: '最近删除', icon: 'restore' },
  { id: 'settings', label: '设置', icon: 'settings' },
]

const saveItems = computed(() => [
  {
    id: 'draft',
    label: '存为草稿',
    description: '保留在当前编辑页，退出应用后仍可继续',
    icon: 'paragraph',
    disabled: !canPersistDraft.value,
    status: canPersistDraft.value ? '' : '先写一点',
  },
  {
    id: 'entry',
    label: '保存到日记',
    description: '收好这一篇，并开始新的一篇',
    icon: 'check',
    disabled: !canPublish.value,
    status: canPublish.value ? '' : '先写一点',
  },
])

const moodItems = computed(() =>
  MOOD_OPTIONS.map((mood) => ({
    id: mood.id,
    label: `${mood.symbol} ${mood.label}`,
    icon: 'mood',
    status: editor.diary.value?.mood === mood.id ? '当前' : '',
  })),
)

const toolItems = [
  { id: 'image', label: '图片', icon: 'image' },
  { id: 'camera', label: '拍照', icon: 'camera' },
  { id: 'mood', label: '心情', icon: 'mood' },
  { id: 'tag', label: '标签', icon: 'tag' },
]

onMounted(async () => {
  window.addEventListener('resize', updateStableViewportHeight)
  window.addEventListener('orientationchange', updateStableViewportHeight)
  await editor.initialize()
  await loadAttachments()
  tags.value = await services.tagService.list()
  unsubscribeCameraRecovery = services.cameraRecoveryService.subscribe(handleCameraRecovery)

  try {
    theme.value = await services.themeService.getActiveTheme({ dateKey })
  } catch {
    theme.value = null
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateStableViewportHeight)
  window.removeEventListener('orientationchange', updateStableViewportHeight)
  if (viewportRevealFrame !== null) window.cancelAnimationFrame(viewportRevealFrame)
  if (viewportOrientationTimer !== null) window.clearTimeout(viewportOrientationTimer)
  if (noticeTimer) clearTimeout(noticeTimer)
  unsubscribeCameraRecovery?.()
  releaseAttachmentUrls()
})

async function loadAttachments() {
  const diaryId = editor.diary.value?.id
  if (!diaryId) return
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
  if (!editor.diary.value) return

  addingImage.value = true
  attachmentError.value = ''
  try {
    // 相册选择器同样可能让 Android 回收 WebView；空白草稿也要先持久化。
    await editor.prepareForExternalActivity()
    const attachment = await services.attachmentService.addImage(editor.diary.value.id, {
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
  if (result.diaryId && result.diaryId !== editor.diary.value?.id) return
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
  showNotice(result.status === 'duplicate' ? '拍照图片已恢复' : '已恢复刚才拍摄的图片')
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

function updateStableViewportHeight(event) {
  visibleViewportHeight.value = window.innerHeight
  const previous = { width: stableViewportWidth, height: stableViewportHeight.value }
  const focusedEditor = document.activeElement
  const editableFocused = focusedEditor?.isContentEditable === true
  if (event?.type === 'orientationchange' || window.innerWidth !== previous.width) {
    viewportOrientationSettling = true
  }
  if (viewportOrientationSettling) {
    if (viewportOrientationTimer !== null) window.clearTimeout(viewportOrientationTimer)
    // Android rotates the window and resizes the IME in separate events.
    viewportOrientationTimer = window.setTimeout(() => {
      viewportOrientationSettling = false
      viewportOrientationTimer = null
    }, 300)
  }
  const next = resolveStableViewport(
    previous,
    { width: window.innerWidth, height: window.innerHeight },
    editableFocused,
    viewportOrientationSettling,
  )
  stableViewportWidth = next.width
  stableViewportHeight.value = next.height
  if (shouldRevealFocusedEditor(previous, next, editableFocused, viewportOrientationSettling)) {
    if (viewportRevealFrame !== null) window.cancelAnimationFrame(viewportRevealFrame)
    // Wait for Vue's size update before positioning the caret in the resized scroll layer.
    viewportRevealFrame = window.requestAnimationFrame(() => {
      viewportRevealFrame = null
      if (focusedEditor.isConnected && document.activeElement === focusedEditor) {
        revealEditorCaret(
          focusedEditor, window.getSelection(), focusedEditor.closest('.today-scroll-layer'),
          visibleViewportHeight.value,
        )
      }
    })
  }
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

function handleMenuSelect(id) {
  menuOpen.value = false
  const routeName = { history: 'diaries', drafts: 'drafts', search: 'search', calendar: 'calendar', trash: 'trash', settings: 'settings' }[id]
  if (routeName) void router.push({ name: routeName })
}

async function handleSaveSelect(id) {
  saveOpen.value = false

  if (id === 'draft') {
    try { await editor.saveAsDraft() } catch { /* 编辑器显示错误。 */ }
    return
  }

  if (id !== 'entry' || savingEntry.value || addingImage.value) return
  savingEntry.value = true

  try {
    // Commit the interaction lock before snapshotting, including any IME blur.
    await nextTick()
    const saved = await editor.saveAsEntry()
    if (!saved) return

    const nextDraft = services.diaryService.createNewDraft(toDateKey())
    releaseAttachmentUrls()
    await router.replace({ name: 'today' })
    await editor.replaceDiary(nextDraft)
    showNotice('已保存到日记')
  } catch {
    // useDiaryEditor 已保存错误状态。
  } finally {
    savingEntry.value = false
  }
}

function showNotice(message) {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 2400)
}
</script>

<template>
  <div class="screen today-screen" :style="todayScreenStyle">
    <DecorationScene v-show="!writingViewportCompressed" :theme="theme" />

    <div class="today-scroll-layer" :inert="savingEntry" :aria-busy="savingEntry">
    <header class="today-header">
      <div class="journal-brand">
        <span class="brand-name">日记</span>
        <span class="brand-note">留一点时间给自己</span>
      </div>

      <div class="header-actions">
        <button
          class="save-trigger"
          type="button"
          :disabled="!canPersistDraft"
          @click="saveOpen = true"
        >
          <AppIcon name="check" :size="16" />
          保存
        </button>

        <button
          class="header-action"
          type="button"
          aria-label="打开更多入口"
          @click="menuOpen = true"
        >
          <AppIcon name="more" :size="23" />
        </button>
      </div>
    </header>

    <main class="today-content">
      <section class="date-heading" aria-label="写作日期">
        <h1 class="date-block" :aria-label="formatTodayHeading(displayDateKey)">
          <span class="today-day" aria-hidden="true">{{ formatDayNumber(displayDateKey).padStart(2, '0') }}</span>
          <span class="date-copy" aria-hidden="true">
            <span class="today-month">{{ formatMonthHeading(displayDateKey) }}</span>
            <span class="today-weekday">{{ formatWeekday(displayDateKey) }}</span>
          </span>
        </h1>
        <span class="writing-label">写给自己</span>
      </section>

      <p
        class="save-status"
        :data-state="editor.saveState.value"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="status-dot" aria-hidden="true"></span>
        {{ notice || editor.saveStatusText.value || '本机草稿 · 自动保存' }}
      </p>

      <div v-if="contextLine || currentMoodLabel || selectedTagNames.length" class="today-meta">
        <p v-if="contextLine" class="context-line">{{ contextLine }}</p>
        <button
          v-if="currentMoodLabel"
          class="mood-chip"
          type="button"
          @click="moodOpen = true"
        >
          {{ currentMoodLabel }}
        </button>
        <span v-for="tagName in selectedTagNames" :key="tagName" class="foreground-tag">{{ tagName }}</span>
      </div>

      <div v-if="editor.loading.value" class="loading-line">正在打开今天……</div>
      <DiaryBlockEditor
        v-else
        ref="blockEditorRef"
        v-model:blocks="editor.blocks.value"
        :attachment-urls="attachmentUrls"
        placeholder="此刻，想写点什么……"
        @delete-image="handleDeleteImage"
      />

      <p v-if="addingImage" class="loading-line" role="status">正在添加图片……</p>
      <p v-if="attachmentError" class="error-line" role="status">{{ attachmentError }}</p>
      <p v-if="editor.loadError.value" class="error-line" role="status">
        {{ editor.saveState.value === 'error' ? '内容暂未保存，请稍后再试。' : editor.loadError.value }}
      </p>
    </main>
    </div>

    <button
      class="compose-button"
      type="button"
      aria-label="添加内容"
      :aria-expanded="toolsOpen"
      :disabled="savingEntry || addingImage"
      @click="toolsOpen = true"
    >
      <AppIcon name="plus" :size="24" />
    </button>

    <AppActionSheet
      :open="menuOpen"
      title="我的日记"
      :items="menuItems"
      @close="menuOpen = false"
      @select="handleMenuSelect"
    />

    <AppActionSheet
      :open="saveOpen"
      title="保存"
      :items="saveItems"
      @close="saveOpen = false"
      @select="handleSaveSelect"
    />

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
      title="此刻的心情"
      :items="moodItems"
      @close="moodOpen = false"
      @select="chooseMood"
    />

    <AppActionSheet
      :open="toolsOpen"
      title="添加到今天"
      layout="grid"
      :items="toolItems"
      @close="toolsOpen = false"
      @select="handleToolSelect"
    />
  </div>
</template>

<style scoped>
.today-screen {
  --today-accent: var(--decoration-accent, var(--color-accent));
  height: var(--stable-viewport-height, 100lvh);
  min-height: var(--stable-viewport-height, 100lvh);
  overflow: hidden;
}

.today-scroll-layer {
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.today-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  width: min(100%, var(--page-width));
  margin: 0 auto;
  padding: calc(var(--safe-top) + 1.25rem) var(--page-gutter) 1.25rem;
}

.journal-brand {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.brand-name {
  font-family: var(--font-reading);
  font-size: 1.375rem;
  letter-spacing: 0.16em;
}

.brand-note {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
}

.date-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0 1.75rem;
  border-bottom: 1px solid var(--color-border-strong);
}

.date-block {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-width: 0;
  margin: 0;
  font-weight: 400;
}

.today-day {
  font-family: var(--font-reading);
  font-size: clamp(3.75rem, 10vw, 5rem);
  line-height: 1;
  letter-spacing: -0.055em;
  font-variant-numeric: lining-nums tabular-nums;
}

.date-copy {
  display: grid;
  gap: 0.55rem;
}

.today-month {
  font-size: var(--text-sm);
  letter-spacing: 0.07em;
}

.today-weekday {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
}

.writing-label {
  color: var(--color-text-secondary);
  font-family: var(--font-reading);
  font-size: var(--text-sm);
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.save-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.5rem;
  margin: 0;
  padding: 1rem 0 2.75rem;
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
}

.status-dot {
  width: 0.3rem;
  height: 0.3rem;
  flex-shrink: 0;
  background: var(--color-accent);
  border-radius: 50%;
}

.save-status[data-state='error'] {
  color: var(--color-danger);
}

.save-status[data-state='error'] .status-dot {
  background: var(--color-danger);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.save-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-width: 4.75rem;
  min-height: 2.75rem;
  padding: 0 var(--space-sm);
  color: var(--color-accent-strong);
  font-size: var(--text-sm);
  background: var(--color-accent-soft);
  border-radius: var(--radius-full);
}

.save-trigger:disabled {
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
  cursor: default;
  opacity: 0.65;
}

.header-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
}

.header-action:active,
.save-trigger:not(:disabled):active {
  background: var(--color-surface-muted);
}

.header-action:focus-visible,
.save-trigger:focus-visible,
.compose-button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

.today-content {
  position: relative;
  z-index: 1;
  width: min(100%, var(--page-width));
  margin: 0 auto;
  padding: 1.5rem var(--page-gutter) calc(var(--safe-bottom) + 8rem);
}

.today-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.context-line {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  letter-spacing: 0.03em;
}

.foreground-tag {
  flex: 0 0 auto;
  padding: 0.3rem var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
}

.mood-chip {
  flex: 0 0 auto;
  min-height: 2.75rem;
  padding: 0 var(--space-md);
  color: var(--color-accent-strong);
  font-size: var(--text-xs);
  background: var(--color-accent-soft);
  border-radius: var(--radius-full);
}

.loading-line {
  color: var(--color-text-tertiary);
  font-family: var(--font-reading);
  font-size: var(--text-md);
}

.error-line {
  margin: var(--space-lg) 0 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
  line-height: 1.6;
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
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  box-shadow: 0 8px 24px rgba(52, 69, 63, 0.16);
}

.compose-button:active {
  transform: scale(0.96);
}

@media (max-width: 520px) {
  .brand-note {
    display: none;
  }

  .today-header {
    padding-top: calc(var(--safe-top) + 1rem);
    padding-bottom: 1rem;
  }

  .today-content {
    padding-top: 1.25rem;
  }

  .date-block {
    gap: 1rem;
  }

  .date-heading {
    padding-bottom: 1.5rem;
  }

  .save-status {
    padding-bottom: 2.25rem;
  }
}
</style>















