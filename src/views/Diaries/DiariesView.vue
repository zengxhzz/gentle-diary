<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
import DiaryTimeline from '@/components/diary/DiaryTimeline.vue'
import { services } from '@/services/container.js'

const router = useRouter()
const diaries = ref([])
const thumbnailUrls = ref({})
const loading = ref(true)
const errorMessage = ref('')

async function loadDiaries() {
  loading.value = true
  errorMessage.value = ''
  try {
    diaries.value = await services.diaryService.listTimeline()
    thumbnailUrls.value = await services.attachmentService.getThumbnailUrlMap(diaries.value)
  } catch (error) {
    errorMessage.value = error?.message ?? '无法读取日记'
  } finally {
    loading.value = false
  }
}

function goBack() {
  void router.push({ name: 'today' })
}

onMounted(loadDiaries)

onBeforeUnmount(() => {
  services.attachmentService.releaseAll()
})
</script>

<template>
  <div class="screen">
    <AppHeader title="日记" show-back @back="goBack">
      <template #actions>
        <RouterLink class="text-button" :to="{ name: 'trash' }">最近删除</RouterLink>
      </template>
    </AppHeader>

    <main class="page-content history-content">
      <header class="page-intro">
        <p v-if="!loading && !errorMessage && diaries.length" class="page-eyebrow">共 {{ diaries.length }} 篇日记</p>
        <h2 class="page-title">写过的日子</h2>
      </header>

      <div v-if="loading" class="quiet-state" role="status">正在整理日记……</div>
      <p v-else-if="errorMessage" class="quiet-state quiet-state--error" role="alert">{{ errorMessage }}</p>

      <DiaryTimeline
        v-else-if="diaries.length"
        :diaries="diaries"
        :thumbnail-urls="thumbnailUrls"
      />

      <section v-else class="empty-state">
        <h3 class="empty-title">还没有日记</h3>
        <p class="empty-description">写下今天，留给以后的自己。</p>
        <RouterLink class="subtle-link" :to="{ name: 'today' }">回到今天</RouterLink>
      </section>
    </main>
  </div>
</template>

<style scoped>
.quiet-state {
  margin: 0;
  padding: var(--space-lg) 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  line-height: 1.7;
}

.quiet-state--error {
  color: var(--color-danger);
}

</style>



