<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '此刻，想写点什么……' },
  ariaLabel: { type: String, default: '今天的日记正文' },
})

const emit = defineEmits(['update:modelValue'])
const textarea = ref(null)

function resize() {
  const element = textarea.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.max(element.scrollHeight, 320)}px`
}

function onInput(event) {
  emit('update:modelValue', event.target.value)
  resize()
}

onMounted(resize)
watch(() => props.modelValue, () => nextTick(resize))
</script>

<template>
  <textarea
    ref="textarea"
    class="diary-text-editor"
    :value="modelValue"
    :placeholder="placeholder"
    :aria-label="ariaLabel"
    autocomplete="off"
    autocapitalize="sentences"
    spellcheck="true"
    @input="onInput"
  ></textarea>
</template>

<style scoped>
.diary-text-editor {
  display: block;
  width: 100%;
  min-height: 20rem;
  padding: 0;
  color: var(--color-text-primary);
  font-family: var(--font-diary);
  font-size: var(--text-diary);
  font-weight: 400;
  line-height: 2;
  letter-spacing: 0.018em;
  background: transparent;
  border: 0;
  border-radius: 0;
  outline: 0;
  resize: none;
  overflow: hidden;
  -webkit-user-select: text;
  user-select: text;
}

.diary-text-editor::placeholder {
  color: color-mix(in srgb, var(--color-text-tertiary) 76%, transparent);
  font-family: var(--font-diary);
  font-size: var(--text-diary);
  letter-spacing: 0.04em;
}

.diary-text-editor:focus-visible {
  outline: 0;
}
</style>
