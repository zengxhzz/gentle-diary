<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  blockId: { type: String, required: true },
  text: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  autofocus: { type: Boolean, default: false },
})

const emit = defineEmits(['update', 'enter', 'focus', 'backspace-start'])
const element = ref(null)

function syncFromModel() {
  const node = element.value
  if (!node) return
  if (node.innerText !== props.text) {
    node.textContent = props.text
  }
}

function onInput(event) {
  emit('update', {
    blockId: props.blockId,
    text: event.currentTarget.innerText,
  })
}

function onKeydown(event) {
  if (event.isComposing || event.keyCode === 229) return

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    insertLineBreak()
    return
  }

  if (event.key === 'Backspace' && getCaretOffset(element.value) === 0) {
    emit('backspace-start', { blockId: props.blockId })
  }
}

function insertLineBreak() {
  document.execCommand('insertLineBreak')
  emit('update', { blockId: props.blockId, text: element.value?.innerText ?? '' })
}

function onBeforeInput(event) {
  if (event.isComposing || event.inputType !== 'insertParagraph') return
  event.preventDefault()
  insertLineBreak()
}

function onPaste(event) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  document.execCommand('insertText', false, text)
  emit('update', {
    blockId: props.blockId,
    text: element.value?.innerText ?? '',
  })
}

function getCaretOffset(node) {
  if (!node) return 0
  const selection = window.getSelection()
  if (!selection?.rangeCount) return node.innerText.length
  const range = selection.getRangeAt(0)
  const prefix = range.cloneRange()
  prefix.selectNodeContents(node)
  prefix.setEnd(range.endContainer, range.endOffset)
  return prefix.toString().length
}

onMounted(async () => {
  syncFromModel()
  await nextTick()
  if (props.autofocus) element.value?.focus()
})

watch(() => props.text, syncFromModel)
</script>

<template>
  <div
    ref="element"
    class="editable-paragraph"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    aria-label="日记正文段落"
    :data-editor-block-id="blockId"
    :data-placeholder="placeholder"
    @beforeinput="onBeforeInput"
    @input="onInput"
    @keydown="onKeydown"
    @paste="onPaste"
    @focus="emit('focus', blockId)"
  ></div>
</template>

<style scoped>
.editable-paragraph {
  min-height: 1.8em;
  margin: 0 0 1.15em;
  color: var(--color-text-primary);
  font-family: var(--font-diary);
  font-size: var(--text-diary);
  font-weight: 400;
  line-height: 2.1;
  letter-spacing: 0.025em;
  caret-color: var(--color-accent-strong);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  outline: 0;
}

.editable-paragraph:empty::before {
  color: var(--color-text-secondary);
  font-family: var(--font-diary);
  font-size: var(--text-diary);
  letter-spacing: 0.04em;
  content: attr(data-placeholder);
  pointer-events: none;
}
</style>







