<script setup>
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: '确认' },
  cancelLabel: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

function onKeydown(event) {
  if (event.key === 'Escape') emit('cancel')
}

watch(
  () => props.open,
  (open) => {
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-layer" role="presentation" @click.self="emit('cancel')">
        <section class="dialog-panel" role="alertdialog" aria-modal="true" :aria-label="title">
          <h2 class="dialog-title">{{ title }}</h2>
          <p v-if="message" class="dialog-message">{{ message }}</p>
          <div class="dialog-actions">
            <button class="dialog-button" type="button" @click="emit('cancel')">
              {{ cancelLabel }}
            </button>
            <button
              class="dialog-button dialog-button--confirm"
              :class="{ danger }"
              type="button"
              @click="emit('confirm')"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-layer {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: grid;
  place-items: center;
  padding: var(--space-xl);
  background: var(--color-overlay);
}

.dialog-panel {
  width: min(100%, 22rem);
  padding: var(--space-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.dialog-title {
  margin: 0;
  font-size: var(--text-lg);
  font-family: var(--font-reading);
  font-weight: 500;
}

.dialog-message {
  margin: var(--space-md) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.7;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-xl);
}

.dialog-button {
  min-width: 4rem;
  min-height: 2.75rem;
  padding: 0 var(--space-lg);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.dialog-button:not(.dialog-button--confirm):active {
  background: var(--color-surface-muted);
}

.dialog-button--confirm {
  color: var(--color-surface);
  background: var(--color-accent-strong);
  border-color: transparent;
}

.dialog-button--confirm:active {
  opacity: 0.85;
}

.dialog-button--confirm.danger {
  background: var(--color-danger);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity var(--duration-normal) ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
