<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import DiaryTimeline from '@/components/diary/DiaryTimeline.vue'
import { MOOD_OPTIONS } from '@/models/Mood.js'
import { services } from '@/services/container.js'

const router = useRouter()
const query = ref('')
const favoriteOnly = ref(false)
const selectedMood = ref(null)
const selectedTagId = ref(null)
const tags = ref([])
const results = ref([])
const thumbnailUrls = ref({})
const loading = ref(false)
let searchTimer = null

onMounted(async () => {
  tags.value = await services.tagService.list()
  await runSearch()
})
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  services.attachmentService.releaseAll()
})

watch([query, favoriteOnly, selectedMood, selectedTagId], () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(runSearch, 180)
})

async function runSearch() {
  loading.value = true
  try {
    results.value = await services.diaryService.search({
      query: query.value,
      favoriteOnly: favoriteOnly.value,
      mood: selectedMood.value,
      tagId: selectedTagId.value,
    })
    thumbnailUrls.value = await services.attachmentService.getThumbnailUrlMap(results.value)
  } finally {
    loading.value = false
  }
}

function clearSearch() {
  query.value = ''
  favoriteOnly.value = false
  selectedMood.value = null
  selectedTagId.value = null
}

function goBack() {
  void router.push({ name: 'today' })
}
</script>

<template>
  <div class="screen">
    <AppHeader title="搜索" show-back @back="goBack" />

    <main class="page-content search-content">
      <header class="page-intro">
        <h2 class="page-title">找回一段记忆</h2>
      </header>

      <label class="search-field">
        <AppIcon name="search" :size="19" />
        <input
          v-model="query"
          type="search"
          aria-label="搜索日记标题或正文"
          placeholder="搜索标题或正文"
          autocomplete="off"
        />
        <button v-if="query" class="icon-button" type="button" aria-label="清空搜索" @click="query = ''">
          <AppIcon name="close" :size="17" />
        </button>
      </label>

      <div class="filter-row" role="group" aria-label="筛选日记">
        <button
          class="filter-chip"
          :class="{ active: favoriteOnly }"
          type="button"
          :aria-pressed="favoriteOnly"
          @click="favoriteOnly = !favoriteOnly"
        >
          <AppIcon name="star" :size="16" />
          收藏
        </button>
        <button
          v-for="tag in tags"
          :key="tag.id"
          class="filter-chip"
          :class="{ active: selectedTagId === tag.id }"
          type="button"
          :aria-pressed="selectedTagId === tag.id"
          @click="selectedTagId = selectedTagId === tag.id ? null : tag.id"
        >
          # {{ tag.name }}
        </button>
        <button
          v-for="mood in MOOD_OPTIONS"
          :key="mood.id"
          class="filter-chip"
          :class="{ active: selectedMood === mood.id }"
          type="button"
          :aria-pressed="selectedMood === mood.id"
          @click="selectedMood = selectedMood === mood.id ? null : mood.id"
        >
          {{ mood.symbol }} {{ mood.label }}
        </button>
      </div>

      <p v-if="!loading && results.length" class="result-count" role="status">{{ results.length }} 篇日记</p>
      <div v-if="loading" class="quiet-message" role="status">正在寻找……</div>
      <DiaryTimeline
        v-else-if="results.length"
        :diaries="results"
        :thumbnail-urls="thumbnailUrls"
      />
      <section v-else class="empty-state">
        <h3 class="empty-title">{{ query || favoriteOnly || selectedMood || selectedTagId ? '没有找到匹配的日记' : '还没有可以查找的日记' }}</h3>
        <p class="empty-description">{{ query || favoriteOnly || selectedMood || selectedTagId ? '换个关键词，或放宽筛选条件。' : '写下第一篇日记，再来这里回看。' }}</p>
        <button
          v-if="query || favoriteOnly || selectedMood || selectedTagId"
          class="subtle-link"
          type="button"
          @click="clearSearch"
        >
          清除筛选
        </button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.search-field {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-height: 3.5rem;
  padding: 0 var(--space-md);
  color: var(--color-text-tertiary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.search-field:focus-within {
  border-color: var(--color-accent-strong);
  box-shadow: 0 0 0 2px var(--color-accent-soft);
}

.search-field > :deep(svg) {
  flex-shrink: 0;
}

.search-field input {
  flex: 1;
  min-width: 0;
  min-height: 3.375rem;
  padding: 0;
  color: var(--color-text-primary);
  font-size: 1rem;
  background: transparent;
  border: 0;
}

.search-field input::placeholder {
  color: var(--color-text-tertiary);
}

.search-field input:focus-visible {
  outline: none;
}

.search-field input::-webkit-search-cancel-button,
.search-field input::-webkit-search-decoration {
  -webkit-appearance: none;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin: var(--space-lg) 0 var(--space-xl);
}

.filter-chip {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  min-height: 2.75rem;
  max-width: 100%;
  padding: 0 var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.6;
  overflow-wrap: anywhere;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.filter-chip.active {
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}

.quiet-message {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  line-height: 1.8;
}

.result-count {
  margin: 0 0 var(--space-xl);
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  line-height: 1.8;
}
</style>
