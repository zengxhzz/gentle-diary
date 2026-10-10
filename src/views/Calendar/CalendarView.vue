<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/common/AppHeader.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import DiaryTimeline from '@/components/diary/DiaryTimeline.vue'
import { services } from '@/services/container.js'
import { formatMonthHeading, toDateKey } from '@/utils/date.js'

const router = useRouter()
const todayKey = toDateKey()
const monthCursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const selectedDateKey = ref(todayKey)
const entries = ref([])
const thumbnailUrls = ref({})
const loading = ref(false)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const calendarDays = computed(() => {
  const year = monthCursor.value.getFullYear()
  const month = monthCursor.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const start = new Date(year, month, 1 - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: toDateKey(date) === todayKey,
    }
  })
})

const diaryDates = computed(() => new Set(entries.value.map((diary) => diary.diaryDate)))
const selectedDiaries = computed(() =>
  entries.value.filter((diary) => diary.diaryDate === selectedDateKey.value),
)
const monthLabel = computed(() => formatMonthHeading(toDateKey(monthCursor.value)))

onMounted(loadMonth)
onBeforeUnmount(() => services.attachmentService.releaseAll())

async function loadMonth() {
  loading.value = true
  const first = calendarDays.value[0].key
  const last = calendarDays.value.at(-1).key
  try {
    entries.value = await services.diaryService.listByDateRange(first, last)
    thumbnailUrls.value = await services.attachmentService.getThumbnailUrlMap(selectedDiaries.value)
  } finally {
    loading.value = false
  }
}

function moveMonth(offset) {
  monthCursor.value = new Date(
    monthCursor.value.getFullYear(),
    monthCursor.value.getMonth() + offset,
    1,
  )
  void loadMonth()
}

function selectDate(day) {
  selectedDateKey.value = day.key
  void loadThumbnails()
}

async function loadThumbnails() {
  thumbnailUrls.value = await services.attachmentService.getThumbnailUrlMap(selectedDiaries.value)
}

function goBack() {
  void router.push({ name: 'today' })
}
</script>

<template>
  <div class="screen">
    <AppHeader title="日历" show-back @back="goBack" />

    <main class="page-content calendar-content">
      <header class="page-intro">
        <h2 class="page-title">循着日期回看</h2>
        <p class="page-description">有圆点的日子，留下了日记。</p>
      </header>

      <section class="calendar-panel" aria-labelledby="calendar-month">
        <div class="month-header">
          <button class="icon-button" type="button" aria-label="上个月" @click="moveMonth(-1)">
            <AppIcon name="arrow-left" :size="19" />
          </button>
          <h3 id="calendar-month" aria-live="polite">{{ monthLabel }}</h3>
          <button class="icon-button next-month" type="button" aria-label="下个月" @click="moveMonth(1)">
            <AppIcon name="arrow-left" :size="19" />
          </button>
        </div>

        <div class="weekday-row" aria-hidden="true">
          <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
        </div>

        <div class="day-grid">
          <button
            v-for="day in calendarDays"
            :key="day.key"
            class="day-cell"
            :class="{
              muted: !day.inMonth,
              selected: day.key === selectedDateKey,
              today: day.isToday,
            }"
            type="button"
            :aria-label="day.key"
            :aria-pressed="day.key === selectedDateKey"
            :aria-current="day.isToday ? 'date' : undefined"
            @click="selectDate(day)"
          >
            <span>{{ day.day }}</span>
            <i v-if="diaryDates.has(day.key)" aria-hidden="true"></i>
          </button>
        </div>
      </section>

      <section class="day-results" :aria-label="`${selectedDateKey} 的日记`">
        <p v-if="loading" class="quiet-message" role="status">正在查看……</p>
        <DiaryTimeline
          v-else-if="selectedDiaries.length"
          :diaries="selectedDiaries"
          :thumbnail-urls="thumbnailUrls"
        />
        <div v-else class="empty-state day-empty">
          <h3 class="empty-title">这一天还没有日记</h3>
          <p class="empty-description">选一个有圆点的日期继续回看。</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.calendar-panel {
  padding: var(--space-xl) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.month-header {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
  align-items: center;
  margin-bottom: var(--space-xl);
}

.month-header h3 {
  margin: 0;
  font-family: var(--font-reading);
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.6;
  text-align: center;
}

.month-header .next-month :deep(svg) {
  transform: rotate(180deg);
}

.weekday-row,
.day-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.weekday-row {
  margin-bottom: var(--space-sm);
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  line-height: 1.8;
  text-align: center;
}

.day-cell {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0;
  aspect-ratio: 1;
  color: var(--color-text-secondary);
  font-family: var(--font-reading);
  font-size: 1rem;
  border-radius: 6px;
  place-items: center;
}

.day-cell.muted {
  color: var(--color-text-tertiary);
}

.day-cell.today {
  color: var(--color-accent-strong);
  font-weight: 600;
}

.day-cell.selected {
  color: var(--color-surface);
  background: var(--color-accent-strong);
}

.day-cell i {
  position: absolute;
  bottom: 0.375rem;
  width: 0.25rem;
  height: 0.25rem;
  background: currentColor;
  border-radius: var(--radius-full);
}

.day-results {
  margin-top: 2rem;
}

.day-empty {
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.quiet-message {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  line-height: 1.8;
}
</style>
