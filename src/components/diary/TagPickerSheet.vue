<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  tags: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'update:modelValue', 'create', 'remove', 'save'])
const newTagName = ref('')

const selectedIds = computed(() => new Set(props.modelValue))

watch(
  () => props.open,
  (open) => {
    newTagName.value = ''
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

function toggleTag(tagId) {
  const next = new Set(props.modelValue)
  if (next.has(tagId)) next.delete(tagId)
  else next.add(tagId)
  emit('update:modelValue', [...next])
}

function createTag() {
  const name = newTagName.value.trim()
  if (!name) return
  emit('create', name)
  newTagName.value = ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="tag-layer" @click.self="emit('close')">
        <section class="tag-panel" role="dialog" aria-modal="true" aria-label="选择标签">
          <div class="tag-handle" aria-hidden="true"></div>
          <div class="tag-heading">
            <h2>选择标签</h2>
            <button class="icon-button" type="button" aria-label="关闭标签面板" @click="emit('close')">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <div v-if="tags.length" class="tag-list">
            <div v-for="tag in tags" :key="tag.id" class="tag-chip-wrap">
              <button
                class="tag-chip"
                :class="{ active: selectedIds.has(tag.id) }"
                type="button"
                :aria-pressed="selectedIds.has(tag.id)"
                @click="toggleTag(tag.id)"
              >
                {{ tag.name }}
              </button>
              <button
                class="tag-remove"
                type="button"
                :aria-label="`删除标签 ${tag.name}`"
                @click="emit('remove', tag.id)"
              >
                ×
              </button>
            </div>
          </div>
          <p v-else class="empty-copy">还没有标签，可以在下面创建一个。</p>

          <form class="new-tag-row" @submit.prevent="createTag">
            <input v-model="newTagName" aria-label="新标签名称" placeholder="新标签" maxlength="24" />
            <button type="submit" aria-label="创建标签" :disabled="!newTagName.trim()">
              <AppIcon name="plus" :size="18" />
            </button>
          </form>

          <div class="tag-actions">
            <button class="text-button" type="button" @click="emit('close')">取消</button>
            <button class="primary-button" type="button" :disabled="saving" @click="emit('save')">
              完成
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tag-layer {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-sm);
  background: var(--color-overlay);
}

.tag-panel {
  width: min(100%, 28rem);
  max-height: calc(100dvh - var(--safe-top) - 1rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-sm) var(--space-lg) calc(var(--space-lg) + var(--safe-bottom));
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}

.tag-handle {
  width: 2rem;
  height: 0.2rem;
  margin: 0 auto var(--space-md);
  background: var(--color-border-strong);
  border-radius: var(--radius-full);
}

.tag-panel h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-family: var(--font-reading);
  font-size: 1.125rem;
  font-weight: 500;
}

.tag-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.tag-chip-wrap {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.tag-chip-wrap .tag-chip {
  border: 0;
  border-radius: 0;
}

.tag-remove {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--color-text-tertiary);
  place-items: center;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.tag-chip {
  min-height: 2.75rem;
  padding: 0 var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.tag-chip.active {
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
  border-color: transparent;
}

.empty-copy {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

.new-tag-row {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.new-tag-row input {
  flex: 1;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0 var(--space-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.new-tag-row button {
  display: grid;
  width: 2.75rem;
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
  border-radius: var(--radius-md);
  place-items: center;
}

.tag-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.primary-button {
  min-height: 2.75rem;
  padding: 0 var(--space-lg);
  color: var(--color-surface);
  background: var(--color-accent-strong);
  border-radius: var(--radius-full);
}

.primary-button:disabled,
.new-tag-row button:disabled {
  opacity: 0.55;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity var(--duration-normal) ease;
}

.sheet-enter-active .tag-panel,
.sheet-leave-active .tag-panel {
  transition: transform var(--duration-normal) ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .tag-panel,
.sheet-leave-to .tag-panel {
  transform: translateY(1rem);
}
</style>
