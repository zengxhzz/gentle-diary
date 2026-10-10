<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { services } from '@/services/container.js'
import { formatDeletedTime, formatTodayHeading } from '@/utils/date.js'
import { getDiarySummary, getDiaryTitle } from '@/utils/text.js'

const router = useRouter()
const diaries = ref([])
const loading = ref(true)
const errorMessage = ref('')
const pendingDiary = ref(null)
const pendingAction = ref('')

async function loadTrash() {
  loading.value = true
  errorMessage.value = ''
  try {
    diaries.value = await services.diaryService.listTrash()
  } catch (error) {
    errorMessage.value = error?.message ?? '无法读取最近删除'
  } finally {
    loading.value = false
  }
}

function goBack() {
  void router.push({ name: 'diaries' })
}

function requestAction(type, diary) {
  pendingAction.value = type
  pendingDiary.value = diary
}

async function confirmAction() {
  if (!pendingDiary.value) return

  try {
    if (pendingAction.value === 'restore') {
      await services.diaryService.restore(pendingDiary.value.id)
      await loadTrash()
    } else if (pendingAction.value === 'delete') {
      await services.diaryService.deletePermanently(pendingDiary.value.id)
      await loadTrash()
    }
  } catch (error) {
    errorMessage.value = error?.message ?? '操作失败'
  } finally {
    pendingAction.value = ''
    pendingDiary.value = null
  }
}

function itemTitle(diary) {
  return getDiaryTitle(diary) || getDiarySummary(diary) || '空白日记'
}

onMounted(loadTrash)
</script>

<template>
  <div class="screen">
    <AppHeader title="最近删除" show-back @back="goBack" />

    <main class="page-content trash-content">
      <header class="page-intro">
        <h2 class="page-title">暂时收起的页</h2>
        <p class="page-description">日记可以恢复，永久删除后无法找回。</p>
      </header>

      <div v-if="loading" class="quiet-message" role="status">正在查看……</div>
      <p v-else-if="errorMessage" class="quiet-message quiet-message--error" role="alert">{{ errorMessage }}</p>

      <section v-else-if="diaries.length" class="trash-list">
        <article v-for="diary in diaries" :key="diary.id" class="trash-entry">
          <div class="entry-copy">
            <p class="entry-date">{{ formatTodayHeading(diary.diaryDate) }}</p>
            <h2 class="entry-title">{{ itemTitle(diary) }}</h2>
            <p class="entry-meta">{{ formatDeletedTime(diary.deletedAt) }}</p>
          </div>

          <div class="entry-actions">
            <button
              class="icon-button entry-action"
              type="button"
              :aria-label="`恢复日记：${itemTitle(diary)}`"
              @click="requestAction('restore', diary)"
            >
              <AppIcon name="restore" :size="20" />
            </button>
            <button
              class="icon-button entry-action entry-action--danger"
              type="button"
              :aria-label="`永久删除日记：${itemTitle(diary)}`"
              @click="requestAction('delete', diary)"
            >
              <AppIcon name="trash" :size="20" />
            </button>
          </div>
        </article>
      </section>

      <section v-else class="empty-state">
        <h3 class="empty-title">最近没有删除的日记</h3>
        <p class="empty-description">写过的日子，都还在。</p>
        <RouterLink class="subtle-link" :to="{ name: 'diaries' }">回看日记</RouterLink>
      </section>
    </main>

    <ConfirmDialog
      :open="Boolean(pendingAction)"
      :title="pendingAction === 'delete' ? '永久删除这篇日记？' : '恢复这篇日记？'"
      :message="
        pendingAction === 'delete'
          ? '永久删除后无法再恢复。'
          : '恢复后会重新出现在历史日记中。'
      "
      :confirm-label="pendingAction === 'delete' ? '永久删除' : '恢复'"
      :danger="pendingAction === 'delete'"
      @cancel="pendingAction = ''"
      @confirm="confirmAction"
    />
  </div>
</template>

<style scoped>
.quiet-message {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  line-height: 1.7;
}

.quiet-message--error {
  color: var(--color-danger);
}

.trash-list {
  display: grid;
}

.trash-entry {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: 1.5rem 0;
  border-top: 1px solid var(--color-border);
}

.trash-entry:last-child {
  border-bottom: 1px solid var(--color-border);
}

.entry-copy {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
  min-width: 0;
}

.entry-date,
.entry-title,
.entry-meta {
  margin: 0;
}

.entry-date {
  color: var(--color-text-secondary);
  font-family: var(--font-reading);
  font-size: var(--text-sm);
  line-height: 1.8;
}

.entry-title {
  display: -webkit-box;
  overflow: hidden;
  font-family: var(--font-reading);
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.6;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.entry-meta {
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  line-height: 1.8;
}

.entry-actions {
  display: flex;
  flex-shrink: 0;
  gap: var(--space-xs);
  margin-left: auto;
}

.entry-action {
  color: var(--color-accent-strong);
}

.entry-action--danger {
  color: var(--color-danger);
}

</style>

