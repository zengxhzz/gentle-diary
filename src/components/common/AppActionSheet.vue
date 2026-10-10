<script setup>
import { onBeforeUnmount, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  layout: { type: String, default: 'list' },
})

const emit = defineEmits(['close', 'select'])

function selectItem(item) {
  if (item.disabled) return
  emit('select', item.id)
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="sheet-layer" role="presentation" @click.self="emit('close')">
        <section class="sheet-panel" role="dialog" aria-modal="true" :aria-label="title">
          <div class="sheet-handle" aria-hidden="true"></div>
          <div class="sheet-heading">
            <h2 v-if="title" class="sheet-title">{{ title }}</h2>
            <button class="icon-button" type="button" aria-label="关闭面板" @click="emit('close')">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <div class="sheet-items" :class="{ 'sheet-items--grid': layout === 'grid' }">
            <button
              v-for="item in items"
              :key="item.id"
              class="sheet-item"
              type="button"
              :disabled="item.disabled"
              @click="selectItem(item)"
            >
              <span class="item-icon">
                <AppIcon :name="item.icon" :size="20" />
              </span>
              <span class="item-copy">
                <span class="item-label">{{ item.label }}</span>
                <span v-if="item.description" class="item-description">{{ item.description }}</span>
              </span>
              <span v-if="item.status || item.disabled" class="item-status">{{ item.status || '' }}</span>
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-sm);
  background: var(--color-overlay);
}

.sheet-panel {
  width: min(100%, 28rem);
  max-height: calc(100dvh - var(--safe-top) - 1rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-md) var(--space-md)
    calc(var(--space-lg) + var(--safe-bottom));
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.sheet-handle {
  width: 2rem;
  height: 0.2rem;
  margin: 0 auto var(--space-sm);
  background: var(--color-border-strong);
  border-radius: var(--radius-full);
}

.sheet-title {
  margin: 0;
  padding: var(--space-sm) var(--space-sm) var(--space-md);
  color: var(--color-text-primary);
  font-family: var(--font-reading);
  font-size: 1.125rem;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.sheet-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

.sheet-items {
  display: grid;
  gap: 4px;
}

.sheet-items--grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  padding: 0 var(--space-xs);
}

.sheet-items--grid .sheet-item {
  flex-direction: column;
  justify-content: center;
  gap: 0.65rem;
  min-height: 6.5rem;
  padding: 1rem;
  text-align: center;
  background: color-mix(in srgb, var(--color-accent-soft) 42%, var(--color-surface));
}

.sheet-items--grid .item-icon {
  background: transparent;
}

.sheet-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  min-height: 3.75rem;
  padding: 0.65rem var(--space-md);
  text-align: left;
  border-radius: var(--radius-md);
}

.sheet-item:not(:disabled):active {
  background: var(--color-surface-muted);
}

.sheet-item:disabled {
  cursor: default;
  opacity: 0.48;
}

.sheet-item:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
  border-radius: 12px;
}

.item-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.item-label {
  font-size: var(--text-md);
}

.item-description {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.item-status {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
}

@media (hover: hover) {
  .sheet-item:not(:disabled):hover {
    background: var(--color-surface-muted);
  }
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity var(--duration-normal) ease;
}

.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform var(--duration-normal) ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(1rem);
}
</style>

