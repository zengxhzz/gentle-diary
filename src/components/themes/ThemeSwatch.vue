<script setup>
import { computed } from 'vue'

const props = defineProps({
  theme: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  checked: { type: Boolean, default: false },
  checkMode: { type: Boolean, default: false },
})

const style = computed(() => ({
  '--theme-accent': props.theme.palette?.accent ?? 'var(--color-accent)',
  '--theme-soft': props.theme.palette?.soft ?? 'var(--color-accent-soft)',
  '--theme-warm': props.theme.palette?.warm ?? 'var(--color-warm)',
}))
</script>

<template>
  <div class="theme-swatch" :class="{ selected, checked }" :style="style">
    <div class="swatch-art" aria-hidden="true">
      <img
        v-for="decoration in theme.decorations"
        :key="decoration.id"
        class="swatch-decoration"
        :src="decoration.image"
        alt=""
        width="64"
        height="64"
        decoding="async"
        draggable="false"
      />
    </div>
    <div class="swatch-footer">
      <span class="swatch-name">{{ theme.name }}</span>
      <span v-if="checkMode || selected" class="swatch-selection" aria-hidden="true">
        <span v-if="selected || checked" class="swatch-state">已选</span>
        <span class="swatch-check" :class="{ 'swatch-check--active': selected || checked }">
          {{ selected || checked ? '✓' : '' }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.theme-swatch {
  position: relative;
  display: grid;
  grid-template-rows: minmax(5.6rem, 1fr) auto;
  min-width: 0;
  min-height: 8.75rem;
  height: 100%;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition:
    border-color var(--duration-fast) ease,
    box-shadow var(--duration-fast) ease;
}

.theme-swatch.selected,
.theme-swatch.checked {
  border-color: var(--color-accent-strong);
  box-shadow: inset 0 0 0 1px var(--color-accent-strong);
}

.swatch-art {
  position: relative;
  min-height: 5.6rem;
  margin: 3px 3px 0;
  color: var(--theme-accent);
  background: var(--color-surface);
  border-radius: calc(var(--radius-sm) - 4px);
}

.swatch-decoration {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  width: min(64px, 60%);
  height: 64px;
  object-fit: contain;
  transform: translate(-50%, -50%);
}

.swatch-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
  min-width: 0;
  min-height: 3rem;
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.swatch-name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.selected .swatch-name,
.checked .swatch-name {
  color: var(--color-text-primary);
  font-weight: 500;
}

.swatch-selection {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-accent-strong);
}

.swatch-state {
  font-size: var(--text-xs);
}

.swatch-check {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  color: var(--color-surface);
  font-size: var(--text-xs);
  line-height: 1;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
}

.swatch-check--active {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}
</style>
