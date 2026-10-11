<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import { services } from '@/services/container.js'
import { formatTime, formatTodayHeading } from '@/utils/date.js'
import { getDiarySummary, getDiaryTitle } from '@/utils/text.js'

const router = useRouter()
const drafts = ref([])
const loading = ref(true)
const deleting = ref(null)

onMounted(loadDrafts)

async function loadDrafts() {
  loading.value = true
  try {
    drafts.value = await services.diaryService.listDrafts()
  } finally {
    loading.value = false
  }
}

function openDraft(id) {
  void router.push({ name: 'today', query: { draft: id } })
}

async function deleteDraft() {
  if (!deleting.value) return
  await services.diaryService.deleteDraft(deleting.value.id)
  deleting.value = null
  await loadDrafts()
}

function goBack() {
  void router.push({ name: 'today' })
}
</script>

<template>
  <div class="screen">
    <AppHeader title="草稿" show-back @back="goBack" />

    <main class="page-content drafts-content">
      <header class="page-intro">
        <p v-if="!loading && drafts.length" class="page-eyebrow">{{ drafts.length }} 份草稿</p>
        <h2 class="page-title">还未写完的页</h2>
        <p class="page-description">点开草稿，接着写。</p>
      </header>

      <div v-if="loading" class="quiet-message" role="status">正在打开草稿……</div>

      <section v-else-if="drafts.length" class="draft-list">
        <article v-for="draft in drafts" :key="draft.id" class="draft-entry">
          <button class="draft-main" type="button" @click="openDraft(draft.id)">
            <span class="draft-date">{{ formatTodayHeading(draft.diaryDate) }}</span>
            <strong>{{ getDiaryTitle(draft) || '未命名草稿' }}</strong>
            <span class="draft-summary">{{ getDiarySummary(draft) || (getDiaryTitle(draft) ? '' : '还没有正文') }}</span>
            <span class="draft-time">{{ formatTime(draft.updatedAt) }} 更新</span>
          </button>
          <button
            class="icon-button delete-button"
            type="button"
            :aria-label="`删除草稿：${getDiaryTitle(draft) || '未命名草稿'}`"
            @click="deleting = draft"
          >
            <AppIcon name="trash" :size="18" />
          </button>
        </article>
      </section>

      <section v-else class="empty-state">
        <h3 class="empty-title">没有未完成的草稿</h3>
        <p class="empty-description">新的心事，从今天开始写。</p>
        <RouterLink class="subtle-link" :to="{ name: 'today' }">回到今天</RouterLink>
      </section>
    </main>

    <ConfirmDialog
      :open="Boolean(deleting)"
      title="删除这份草稿？"
      message="草稿删除后无法恢复。"
      confirm-label="删除草稿"
      danger
      @cancel="deleting = null"
      @confirm="deleteDraft"
    />
  </div>
</template>

<style scoped>
.quiet-message {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  line-height: 1.8;
}

.draft-list {
  display: grid;
}

.draft-entry {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.draft-entry:last-child {
  border-bottom: 1px solid var(--color-border);
}

.draft-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  flex: 1;
  gap: var(--space-sm);
  min-width: 0;
  min-height: 2.75rem;
  padding: 1.5rem 0;
  text-align: left;
}

.draft-date,
.draft-time {
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  line-height: 1.8;
}

.draft-date {
  color: var(--color-text-secondary);
  font-family: var(--font-reading);
  font-size: var(--text-sm);
}

.draft-main strong {
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

.draft-summary {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-family: var(--font-diary);
  font-size: var(--text-diary);
  line-height: 1.8;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.delete-button {
  margin-top: 1.25rem;
  color: var(--color-danger);
}
</style>
