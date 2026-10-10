<script setup>
import AppIcon from './AppIcon.vue'

defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  backLabel: { type: String, default: '返回' },
})

const emit = defineEmits(['back'])
</script>

<template>
  <header class="app-header">
    <div class="header-leading">
      <button
        v-if="showBack"
        class="icon-button"
        type="button"
        :aria-label="backLabel"
        @click="emit('back')"
      >
        <AppIcon name="arrow-left" :size="21" />
      </button>
    </div>

    <h1 class="header-title">{{ title }}</h1>

    <div class="header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) 5rem;
  align-items: center;
  width: min(100%, var(--page-width));
  min-height: 4.5rem;
  margin: 0 auto;
  padding: calc(var(--safe-top) + 0.75rem) calc(var(--page-gutter) - 0.5rem) 0.75rem;
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
}

.header-leading,
.header-actions {
  display: flex;
  align-items: center;
  min-width: 5rem;
}

.header-actions {
  justify-content: flex-end;
}

.header-title {
  margin: 0;
  overflow: hidden;
  font-family: var(--font-reading);
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--color-text-secondary);
  border-radius: var(--radius-full);
}

.icon-button:active {
  background: var(--color-surface-muted);
}

.icon-button:focus-visible,
.text-button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
</style>
