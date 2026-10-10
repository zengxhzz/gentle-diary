<script setup>
import { computed } from 'vue'
import { formatDayNumber, formatMonthHeading, formatTime, formatWeekday } from '@/utils/date.js'
import { getMoodLabel } from '@/models/Mood.js'
import { getDiarySummary, getDiaryTitle } from '@/utils/text.js'

const props = defineProps({
  diaries: { type: Array, default: () => [] },
  thumbnailUrls: { type: Object, default: () => ({}) },
})

const groups = computed(() => {
  const result = []

  for (const diary of props.diaries) {
    const key = diary.diaryDate.slice(0, 7)
    let group = result.find((item) => item.key === key)
    if (!group) {
      group = { key, heading: formatMonthHeading(diary.diaryDate), diaries: [] }
      result.push(group)
    }
    group.diaries.push(diary)
  }

  return result
})

function entryTitle(diary) {
  return getDiaryTitle(diary)
}

function entrySummary(diary) {
  return getDiarySummary(diary)
}

function metaParts(diary) {
  return [
    formatTime(diary.createdAt),
    diary.location?.name,
    diary.weather?.summary,
    getMoodLabel(diary.mood),
  ].filter(Boolean)
}
</script>

<template>
  <div class="timeline">
    <section v-for="group in groups" :key="group.key" class="timeline-group">
      <h2 class="month-heading">{{ group.heading }}</h2>

      <div class="timeline-list">
        <RouterLink
          v-for="diary in group.diaries"
          :key="diary.id"
          class="timeline-entry"
          :to="{ name: 'diary-detail', params: { id: diary.id } }"
        >
          <time class="entry-date" :datetime="diary.diaryDate">
            <span class="day-number">{{ formatDayNumber(diary.diaryDate) }}</span>
            <span class="weekday">{{ formatWeekday(diary.diaryDate) }}</span>
          </time>

          <div class="entry-content">
            <h3 v-if="entryTitle(diary)" class="entry-title">{{ entryTitle(diary) }}</h3>
            <p
              v-if="entrySummary(diary)"
              class="entry-summary"
              :class="{ 'entry-summary--lead': !entryTitle(diary) }"
            >
              {{ entrySummary(diary) }}
            </p>
            <p v-else-if="!entryTitle(diary) && !diary.attachmentIds?.length" class="entry-summary">这一页没有留下文字。</p>
            <p v-if="metaParts(diary).length" class="entry-meta">
              {{ metaParts(diary).join(' · ') }}
            </p>
          </div>

          <img
            v-if="thumbnailUrls[diary.id] && diary.attachmentIds?.length"
            class="entry-thumbnail"
            :src="thumbnailUrls[diary.id]"
            alt=""
            loading="lazy"
          />
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.timeline {
  display: grid;
  gap: 2.75rem;
}

.timeline-group {
  display: grid;
  gap: var(--space-md);
}

.month-heading {
  margin: 0;
  color: var(--color-text-secondary);
  font-family: var(--font-reading);
  font-size: 1.125rem;
  font-weight: 400;
  line-height: 1.6;
  letter-spacing: 0.04em;
}

.timeline-list {
  display: grid;
}

.timeline-entry {
  display: grid;
  grid-template-columns: 3.25rem minmax(0, 1fr) auto;
  gap: clamp(0.625rem, 2.5vw, 1.25rem);
  align-items: start;
  min-height: 2.75rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--color-border);
}

.timeline-entry:last-child {
  border-bottom: 1px solid var(--color-border);
}

.timeline-entry:active {
  opacity: 0.72;
}

.entry-date {
  display: grid;
  gap: 0.05rem;
  padding-top: 0.05rem;
  color: var(--color-text-secondary);
}

.day-number {
  color: var(--color-text-primary);
  font-family: var(--font-reading);
  font-size: 1.875rem;
  font-weight: 400;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.weekday {
  font-size: var(--text-xs);
  line-height: 1.8;
}

.entry-content {
  display: grid;
  gap: var(--space-sm);
  min-width: 0;
}

.entry-title {
  margin: 0;
  font-family: var(--font-reading);
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.entry-summary {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-family: var(--font-reading);
  font-size: 1rem;
  line-height: 1.8;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.entry-summary--lead {
  color: var(--color-text-primary);
}

.entry-meta {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  line-height: 1.8;
  letter-spacing: 0.015em;
  overflow-wrap: anywhere;
}

.entry-thumbnail {
  display: block;
  width: 5rem;
  height: 5rem;
  object-fit: cover;
  border-radius: 6px;
}

@media (max-width: 360px) {
  .timeline-entry {
    grid-template-columns: 2.75rem minmax(0, 1fr) auto;
    gap: 0.625rem;
  }
}
</style>


