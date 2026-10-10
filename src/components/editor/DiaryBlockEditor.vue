<script setup>
import { computed, nextTick, ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'
import EditableParagraph from './EditableParagraph.vue'
import { createImageBlock, createParagraphBlock, getImageAspectRatioCss, getImageWidthRatio } from '@/models/Block.js'

const props = defineProps({
  blocks: { type: Array, default: () => [] },
  attachmentUrls: { type: Object, default: () => ({}) },
  placeholder: { type: String, default: '此刻，想写点什么……' },
  ariaLabel: { type: String, default: '日记正文' },
})

const emit = defineEmits(['update:blocks', 'active-block', 'delete-image'])

const editorRoot = ref(null)
const activeBlockId = ref('')
const selectedImageBlockId = ref('')
const draggingBlockId = ref('')
const customSizeOpen = ref(false)
const ratioOpen = ref(false)
// 空段落首次输入后沿用同一 Block ID，避免 Vue 替换正在输入的 DOM 节点。
const virtualParagraph = ref(createParagraphBlock())

const sizeOptions = [
  { id: 'small', label: '小' },
  { id: 'medium', label: '中' },
  { id: 'large', label: '大' },
  { id: 'full', label: '满宽' },
]

const layoutOptions = [
  { id: 'float-left', label: '左浮' },
  { id: 'center', label: '居中' },
  { id: 'float-right', label: '右浮' },
  { id: 'full', label: '通栏' },
]

const ratioOptions = [
  { id: 'original', label: '原始' },
  { id: '1:1', label: '1:1' },
  { id: '4:3', label: '4:3' },
  { id: '3:4', label: '3:4' },
  { id: '16:9', label: '16:9' },
  { id: 'custom', label: '自由' },
]

const displayBlocks = computed(() => {
  const hasParagraph = props.blocks.some((block) => block.type === 'paragraph')
  if (hasParagraph) return props.blocks
  return [...props.blocks, virtualParagraph.value]
})

const selectedBlock = computed(() =>
  props.blocks.find((block) => block.id === selectedImageBlockId.value) ?? null,
)

const customWidthPercent = computed(() => {
  if (!selectedBlock.value) return 52
  return Math.round(getImageWidthRatio(selectedBlock.value) * 100)
})

function commit(nextBlocks) {
  emit('update:blocks', nextBlocks)
}

function setActiveBlock(blockId) {
  activeBlockId.value = blockId === virtualParagraph.value.id ? '' : blockId
  selectedImageBlockId.value = ''
  emit('active-block', activeBlockId.value)
}

function updateParagraph({ blockId, text }) {
  if (blockId === virtualParagraph.value.id) {
    const next = props.blocks.map((block) => ({ ...block }))
    const lastIndex = next.length - 1
    if (lastIndex >= 0 && next[lastIndex].type === 'paragraph') {
      next[lastIndex] = { ...next[lastIndex], text }
    } else {
      next.push({ ...virtualParagraph.value, text })
    }
    commit(next)
    nextTick(() => { virtualParagraph.value = createParagraphBlock() })
    return
  }

  commit(
    props.blocks.map((block) =>
      block.id === blockId && block.type === 'paragraph' ? { ...block, text } : block,
    ),
  )
}

function handleEnter({ blockId, before, after }) {
  if (blockId === virtualParagraph.value.id) {
    const next = props.blocks.map((block) => ({ ...block }))
    const lastIndex = next.length - 1
    if (lastIndex >= 0 && next[lastIndex].type === 'paragraph') {
      next[lastIndex] = { ...next[lastIndex], text: before }
    } else {
      next.push({ ...virtualParagraph.value, text: before })
    }
    const paragraph = createParagraphBlock(after)
    next.push(paragraph)
    commit(next)
    nextTick(() => { virtualParagraph.value = createParagraphBlock() })
    nextTick(() => focusBlock(paragraph.id))
    return
  }

  const index = props.blocks.findIndex((block) => block.id === blockId)
  if (index < 0) return
  const next = props.blocks.map((block, itemIndex) =>
    itemIndex === index && block.type === 'paragraph' ? { ...block, text: before } : block,
  )
  const paragraph = createParagraphBlock(after)
  next.splice(index + 1, 0, paragraph)
  commit(next)
  nextTick(() => focusBlock(paragraph.id))
}

function handleBackspaceAtStart({ blockId }) {
  const index = props.blocks.findIndex((block) => block.id === blockId)
  if (index <= 0) return
  const current = props.blocks[index]
  if (current.type !== 'paragraph' || current.text) return

  const previous = props.blocks[index - 1]
  const next = props.blocks.filter((block) => block.id !== blockId)
  commit(next)
  if (previous?.type === 'paragraph') nextTick(() => focusBlock(previous.id, true))
}

function focusBlock(blockId, atEnd = false) {
  const node = editorRoot.value?.querySelector(`[data-editor-block-id="${blockId}"]`)
  if (!node) return
  node.focus()
  if (!atEnd) return
  const range = document.createRange()
  range.selectNodeContents(node)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function insertImage(attachmentId) {
  const imageBlock = createImageBlock(attachmentId, { layout: 'center', size: 'medium' })
  const next = props.blocks.map((block) => ({ ...block }))
  const activeIndex = next.findIndex((block) => block.id === activeBlockId.value)
  const insertionIndex = activeIndex >= 0 ? activeIndex + 1 : next.length
  next.splice(insertionIndex, 0, imageBlock)
  commit(next)
  selectedImageBlockId.value = imageBlock.id
  nextTick(() => {
    editorRoot.value
      ?.querySelector(`[data-editor-block-id="${imageBlock.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
  return imageBlock
}

function selectImage(blockId) {
  selectedImageBlockId.value = blockId
  activeBlockId.value = blockId
  emit('active-block', blockId)
}

function applySizePreset(size) {
  if (!selectedBlock.value) return
  const patch = { size, widthRatio: null }
  if (selectedBlock.value.layout === 'full') patch.layout = 'center'
  updateImageBlock(selectedBlock.value.id, patch)
  customSizeOpen.value = false
}

function toggleCustomSize() {
  if (!selectedBlock.value) return
  if (!customSizeOpen.value && selectedBlock.value.layout === 'full') {
    updateImageBlock(selectedBlock.value.id, { layout: 'center' })
  }
  customSizeOpen.value = !customSizeOpen.value
  ratioOpen.value = false
}

function toggleAspectRatio() {
  if (!selectedBlock.value) return
  ratioOpen.value = !ratioOpen.value
  customSizeOpen.value = false
}

function applyAspectRatio(aspectRatio) {
  if (!selectedBlock.value) return
  const patch = { aspectRatio, customAspectRatio: null }

  if (aspectRatio === 'custom') {
    const node = editorRoot.value?.querySelector(
      `[data-editor-block-id="${selectedBlock.value.id}"]`,
    )
    const rect = node?.getBoundingClientRect()
    patch.customAspectRatio = rect ? rect.width / rect.height : 1
  }

  updateImageBlock(selectedBlock.value.id, patch)
  ratioOpen.value = false
}

function updateCustomWidth(event) {
  if (!selectedBlock.value) return
  const patch = { widthRatio: Number(event.target.value) / 100 }
  if (selectedBlock.value.layout === 'full') patch.layout = 'center'
  updateImageBlock(selectedBlock.value.id, patch)
}

function updateCaption(event) {
  if (!selectedBlock.value) return
  updateImageBlock(selectedBlock.value.id, { caption: event.target.value })
}

function updateImageBlock(blockId, patch) {
  commit(
    props.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
  )
}

function moveImage(blockId, direction) {
  const index = props.blocks.findIndex((block) => block.id === blockId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= props.blocks.length) return
  const next = [...props.blocks]
  const [block] = next.splice(index, 1)
  next.splice(target, 0, block)
  commit(next)
}

function removeImage(blockId) {
  const block = props.blocks.find((item) => item.id === blockId)
  if (!block || block.type !== 'image') return
  commit(props.blocks.filter((item) => item.id !== blockId))
  selectedImageBlockId.value = ''
  emit('delete-image', { blockId, attachmentId: block.attachmentId })
}

function imageStyle(block) {
  const ratio = getImageWidthRatio(block)
  const style = { width: `${Math.round(ratio * 100)}%` }
  const aspectRatio = getImageAspectRatioCss(block)
  if (aspectRatio) style.aspectRatio = aspectRatio
  return style
}

function imageBlockClass(block) {
  return [
    `layout-${block.layout}`,
    `size-${block.size}`,
    block.aspectRatio !== 'original' ? 'is-cropped' : '',
    block.aspectRatio === 'custom' ? 'is-free-stretch' : '',
  ]
}

function startDrag(event, blockId) {
  draggingBlockId.value = blockId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', blockId)
}

function dropOn(blockId) {
  const sourceId = draggingBlockId.value
  if (!sourceId || sourceId === blockId) return
  const sourceIndex = props.blocks.findIndex((block) => block.id === sourceId)
  const targetIndex = props.blocks.findIndex((block) => block.id === blockId)
  if (sourceIndex < 0 || targetIndex < 0) return

  const next = [...props.blocks]
  const [moved] = next.splice(sourceIndex, 1)
  const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  next.splice(adjustedTarget, 0, moved)
  commit(next)
  draggingBlockId.value = ''
}

defineExpose({ insertImage, focusBlock })
function startResize(event, block) {
  if (!editorRoot.value) return
  event.preventDefault()
  const figure = event.currentTarget?.closest('.image-block')
  if (!figure) return
  const editorWidth = editorRoot.value.getBoundingClientRect().width
  const startRect = figure.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const onPointerMove = (moveEvent) => {
    const width = clamp(startRect.width + moveEvent.clientX - startX, editorWidth * 0.25, editorWidth)
    const height = clamp(startRect.height + moveEvent.clientY - startY, 90, 1200)
    updateImageBlock(block.id, { widthRatio: width / editorWidth, aspectRatio: 'custom', customAspectRatio: width / height })
  }
  const stopResize = () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stopResize)
    window.removeEventListener('pointercancel', stopResize)
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

</script>

<template>
  <div ref="editorRoot" class="diary-block-editor" :aria-label="ariaLabel">
    <template v-for="block in displayBlocks" :key="block.id">
      <EditableParagraph
        v-if="block.type === 'paragraph'"
        :block-id="block.id"
        :text="block.text"
        :placeholder="block.id === displayBlocks[0].id ? placeholder : ''"
        :autofocus="block.id === virtualParagraph.id"
        @update="updateParagraph"
        @enter="handleEnter"
        @focus="setActiveBlock"
        @backspace-start="handleBackspaceAtStart"
      />

      <figure
        v-else-if="block.type === 'image'"
        class="image-block"
        :class="[imageBlockClass(block), { selected: selectedImageBlockId === block.id }]"
        :style="imageStyle(block)"
        :data-editor-block-id="block.id"
        tabindex="0"
        role="button"
        :aria-label="'日记图片，点击调整布局'"
        @click.stop="selectImage(block.id)"
        @keydown.enter.prevent="selectImage(block.id)"
        @dragover.prevent
        @drop.prevent="dropOn(block.id)"
      >
        <button
          class="drag-handle"
          type="button"
          draggable="true"
          aria-label="拖动图片排序"
          @dragstart="startDrag($event, block.id)"
          @dragend="draggingBlockId = ''"
          @click.stop
        >
          ⠿
        </button>

        <button
          v-if="selectedImageBlockId === block.id"
          class="resize-handle"
          type="button"
          aria-label="自由拉伸图片"
          @pointerdown="startResize($event, block)"
          @click.stop
        >
          ↘
        </button>

        <img
          v-if="attachmentUrls[block.attachmentId]"
          :src="attachmentUrls[block.attachmentId]"
          alt=""
          draggable="false"
        />
        <div v-else class="missing-image">图片暂不可用</div>
        <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
      </figure>
    </template>

    <div v-if="selectedBlock?.type === 'image'" class="image-toolbar" role="toolbar" aria-label="图片布局工具">
      <div class="toolbar-group">
        <span class="toolbar-label">大小</span>
        <button
          v-for="option in sizeOptions"
          :key="option.id"
          class="toolbar-button"
          :class="{ active: selectedBlock.size === option.id && !Number.isFinite(selectedBlock.widthRatio) }"
          type="button"
          @click="applySizePreset(option.id)"
        >
          {{ option.label }}
        </button>
        <button
          class="toolbar-button"
          :class="{ active: customSizeOpen || Number.isFinite(selectedBlock.widthRatio) }"
          type="button"
          @click="toggleCustomSize"
        >
          自定义
        </button>
        <button
          class="toolbar-button"
          :class="{ active: ratioOpen || selectedBlock.aspectRatio !== 'original' }"
          type="button"
          @click="toggleAspectRatio"
        >
          比例
        </button>
      </div>

      <div class="toolbar-group">
        <span class="toolbar-label">位置</span>
        <button
          v-for="option in layoutOptions"
          :key="option.id"
          class="toolbar-button"
          :class="{ active: selectedBlock.layout === option.id }"
          type="button"
          @click="updateImageBlock(selectedBlock.id, { layout: option.id })"
        >
          {{ option.label }}
        </button>
      </div>

      <div v-if="customSizeOpen" class="custom-size-row">
        <span class="toolbar-label">宽度</span>
        <input
          class="custom-size-range"
          type="range"
          min="25"
          max="100"
          step="1"
          :value="customWidthPercent"
          aria-label="自定义图片宽度"
          @input="updateCustomWidth"
        />
        <span class="custom-size-value">{{ customWidthPercent }}%</span>
      </div>

      <div v-if="ratioOpen" class="ratio-row">
        <span class="toolbar-label">比例</span>
        <button
          v-for="option in ratioOptions"
          :key="option.id"
          class="toolbar-button"
          :class="{ active: selectedBlock.aspectRatio === option.id }"
          type="button"
          @click="applyAspectRatio(option.id)"
        >
          {{ option.label }}
        </button>
      </div>

      <label class="caption-row">
        <span class="toolbar-label">说明</span>
        <input
          class="caption-input"
          type="text"
          maxlength="160"
          :value="selectedBlock.caption"
          placeholder="为图片写一句说明（可选）"
          @input="updateCaption"
        />
      </label>

      <div class="toolbar-group toolbar-group--actions">
        <button
          class="toolbar-button"
          type="button"
          aria-label="图片上移"
          @click="moveImage(selectedBlock.id, -1)"
        >
          ↑
        </button>
        <button
          class="toolbar-button"
          type="button"
          aria-label="图片下移"
          @click="moveImage(selectedBlock.id, 1)"
        >
          ↓
        </button>
        <button
          class="toolbar-button toolbar-button--danger"
          type="button"
          aria-label="删除图片"
          @click="removeImage(selectedBlock.id)"
        >
          <AppIcon name="trash" :size="18" />
        </button>
        <button class="toolbar-button" type="button" aria-label="完成图片调整" @click="selectedImageBlockId = ''">
          <AppIcon name="check" :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diary-block-editor {
  position: relative;
  min-height: 20rem;
  color: var(--color-text-primary);
}

.image-block {
  position: relative;
  display: block;
  max-width: 100%;
  margin: 0 0 1.35rem;
  background: var(--color-surface-muted);
  border-radius: var(--radius-md);
  outline: 1px solid transparent;
  outline-offset: 3px;
  transition: outline-color var(--duration-fast) ease;
}

.image-block.layout-float-left {
  float: left;
  clear: left;
  margin-right: 1.25rem;
}

.image-block.layout-float-right {
  float: right;
  clear: right;
  margin-left: 1.25rem;
}

.image-block.layout-center,
.image-block.layout-full {
  float: none;
  clear: both;
  margin-right: auto;
  margin-left: auto;
}

.image-block.layout-center {
  margin-top: 0.7rem;
  margin-bottom: 1.6rem;
}

.image-block.layout-full {
  margin-top: 1rem;
  margin-bottom: 1.75rem;
}

.image-block.selected {
  outline-color: var(--color-accent);
}

.image-block.is-cropped {
  overflow: hidden;
}

.image-block.is-free-stretch img {
  object-fit: fill;
}

.image-block.is-cropped img {
  height: 100%;
  object-fit: cover;
}

.image-block img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-md);
}

.missing-image {
  display: grid;
  min-height: 8rem;
  place-items: center;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

.image-block figcaption {
  margin-top: var(--space-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  line-height: 1.6;
  text-align: center;
}

.drag-handle {
  position: absolute;
  top: 0.45rem;
  left: 0.45rem;
  z-index: 2;
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  border-radius: var(--radius-full);
  place-items: center;
  cursor: grab;
  opacity: 0;
  backdrop-filter: blur(8px);
}

.image-block:hover .drag-handle,
.image-block.selected .drag-handle {
  opacity: 1;
}

.resize-handle {
  position: absolute;
  right: 0.4rem;
  bottom: 0.4rem;
  z-index: 3;
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--color-accent-strong);
  background: color-mix(in srgb, var(--color-surface) 90%, transparent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  place-items: center;
  cursor: nwse-resize;
  touch-action: none;
}

.image-toolbar {
  position: fixed;
  bottom: calc(var(--safe-bottom) + 5.25rem);
  left: 50%;
  z-index: 8;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  width: min(calc(100% - 2rem), 34rem);
  padding: var(--space-sm);
  background: color-mix(in srgb, var(--color-surface) 95%, transparent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
  transform: translateX(-50%);
  backdrop-filter: blur(14px);
}

.toolbar-group {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 0.25rem;
}

.custom-size-row,
.ratio-row,
.caption-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-xs) var(--space-sm) 0;
}

.caption-input {
  flex: 1;
  min-width: 0;
  height: 2.75rem;
  padding: 0 var(--space-md);
  color: var(--color-text-primary);
  font: inherit;
  font-size: var(--text-sm);
  background: var(--color-surface-muted);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
}

.caption-input:focus {
  border-color: var(--color-accent);
  outline: none;
}

.custom-size-range {
  flex: 1;
  min-width: 7rem;
  accent-color: var(--color-accent-strong);
}

.custom-size-value {
  min-width: 2.4rem;
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.toolbar-group--actions {
  margin-left: auto;
}

.toolbar-label {
  margin: 0 0.2rem;
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
}

.toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  height: 2.75rem;
  padding: 0 var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
}

.toolbar-button.active {
  color: var(--color-accent-strong);
  background: var(--color-accent-soft);
}

.toolbar-button--danger {
  color: var(--color-danger);
}

.toolbar-button:active {
  background: var(--color-surface-muted);
}

@media (max-width: 430px) {
  .image-toolbar {
    left: var(--space-lg);
    right: var(--space-lg);
    width: auto;
    transform: none;
  }

  .toolbar-group--actions {
    width: 100%;
    justify-content: flex-end;
  }

  .ratio-row {
    flex-wrap: wrap;
  }
}
</style>






























