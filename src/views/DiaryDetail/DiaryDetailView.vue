<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppActionSheet from '@/components/common/AppActionSheet.vue'
import AppHeader from '@/components/common/AppHeader.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import DiaryBlocks from '@/components/diary/DiaryBlocks.vue'
import { MOOD_OPTIONS, getMoodLabel } from '@/models/Mood.js'
import { services } from '@/services/container.js'
import { formatTime, formatTodayHeading } from '@/utils/date.js'

const route = useRoute()
const router = useRouter()
const diary = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const menuOpen = ref(false)
const confirmOpen = ref(false)
const moodOpen = ref(false)
const attachmentUrls = ref({})
const tags = ref([])

const moodItems = MOOD_OPTIONS.map((mood) => ({
  id: mood.id,
  label: `${mood.symbol} ${mood.label}`,
  icon: 'mood',
}))

const menuItems = computed(() => [
  { id: 'edit', label: '编辑', icon: 'edit' },
  { id: 'favorite', label: diary.value?.favorite ? '取消收藏' : '收藏', icon: 'star' },
  { id: 'mood', label: diary.value?.mood ? `心情：${getMoodLabel(diary.value.mood)}` : '设置心情', icon: 'mood' },
  { id: 'delete', label: '移到最近删除', icon: 'trash' },
])

const tagNames = computed(() => {
  const tagMap = new Map(tags.value.map((tag) => [tag.id, tag.name]))
  return (diary.value?.tagIds ?? []).map((id) => tagMap.get(id)).filter(Boolean)
})

const metadata = computed(() => {
  if (!diary.value) return []
  return [
    formatTime(diary.value.createdAt),
    diary.value.location?.name,
    diary.value.weather?.summary,
    getMoodLabel(diary.value.mood),
  ].filter(Boolean)
})

onMounted(async () => {
  try {
    diary.value = await services.diaryService.getById(String(route.params.id))
    tags.value = await services.tagService.list()
    const attachments = await services.attachmentService.listImages(diary.value.id)
    attachmentUrls.value = Object.fromEntries(
      attachments.map((attachment) => [attachment.id, attachment.url]),
    )
  } catch (error) {
    errorMessage.value = error?.message ?? '无法读取这篇日记'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  Object.keys(attachmentUrls.value).forEach((attachmentId) => {
    services.attachmentService.release(attachmentId)
  })
})

function goBack() {
  if (window.history.length > 1) router.back()
  else void router.push({ name: 'diaries' })
}

function handleMenuSelect(id) {
  menuOpen.value = false
  if (id === 'edit') void router.push({ name: 'diary-edit', params: { id: diary.value.id } })
  if (id === 'favorite') void toggleFavorite()
  if (id === 'mood') moodOpen.value = true
  if (id === 'delete') confirmOpen.value = true
}

async function toggleFavorite() {
  if (!diary.value) return
  diary.value = await services.diaryService.toggleFavorite(diary.value.id)
}

async function chooseMood(moodId) {
  if (!diary.value) return
  diary.value = await services.diaryService.setMood(diary.value.id, moodId)
  moodOpen.value = false
}

async function deleteDiary() {
  if (!diary.value) return
  await services.diaryService.softDelete(diary.value.id)
  confirmOpen.value = false
  await router.replace({ name: 'diaries' })
}
</script>

<template>
  <div class="screen">
    <AppHeader :title="diary ? formatTodayHeading(diary.diaryDate) : '日记'" show-back @back="goBack">
      <template #actions>
        <button
          v-if="diary"
          class="icon-button"
          type="button"
          aria-label="日记操作"
          @click="menuOpen = true"
        >
          <AppIcon name="more" :size="22" />
        </button>
      </template>
    </AppHeader>

    <main class="page-content detail-content">
      <p v-if="loading" class="quiet-message" role="status">正在打开……</p>
      <p v-else-if="errorMessage" class="quiet-message quiet-message--error" role="alert">{{ errorMessage }}</p>

      <template v-else-if="diary">
        <header v-if="metadata.length || diary.mood || tagNames.length" class="detail-context">
          <p v-if="metadata.length" class="detail-meta">{{ metadata.join(' · ') }}</p>
          <div v-if="diary.mood || tagNames.length" class="detail-badges">
            <span v-if="diary.mood" class="detail-badge detail-badge--mood">{{ getMoodLabel(diary.mood) }}</span>
            <span v-for="tagName in tagNames" :key="tagName" class="detail-badge">{{ tagName }}</span>
          </div>
        </header>
        <DiaryBlocks
          v-if="diary.blocks.length"
          :blocks="diary.blocks"
          :attachment-urls="attachmentUrls"
        />
        <p v-else class="quiet-message">这一页还没有留下文字。</p>
      </template>
    </main>

    <AppActionSheet
      :open="menuOpen"
      title="日记操作"
      :items="menuItems"
      @close="menuOpen = false"
      @select="handleMenuSelect"
    />

    <AppActionSheet
      :open="moodOpen"
      title="选择心情"
      :items="moodItems"
      @close="moodOpen = false"
      @select="chooseMood"
    />

    <ConfirmDialog
      :open="confirmOpen"
      title="移到最近删除？"
      message="日记会保留在最近删除中，之后仍可恢复。"
      confirm-label="移到最近删除"
      danger
      @cancel="confirmOpen = false"
      @confirm="deleteDiary"
    />
  </div>
</template>

<style scoped>
.detail-context {
  display: grid;
  gap: var(--space-md);
  margin-bottom: 2rem;
  padding-bottom: var(--space-xl);
  border-bottom: 1px solid var(--color-border);
}

.detail-meta {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.8;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
}

.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.detail-badge {
  max-width: 100%;
  padding: 0.25rem var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  line-height: 1.8;
  overflow-wrap: anywhere;
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
}

.detail-badge--mood {
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
}

.detail-content :deep(.block-heading) {
  font-family: var(--font-reading);
  font-size: 1.5rem;
  font-weight: 500;
}

.detail-content :deep(.block-paragraph) {
  overflow-wrap: anywhere;
}

.quiet-message {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  line-height: 1.7;
}

.quiet-message--error {
  color: var(--color-danger);
}

</style>


