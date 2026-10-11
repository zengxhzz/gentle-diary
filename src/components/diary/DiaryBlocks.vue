<script setup>
import { getImageAspectRatioCss, getImageWidthRatio } from '@/models/Block.js'

defineProps({
  blocks: { type: Array, default: () => [] },
  attachmentUrls: { type: Object, default: () => ({}) },
})

function imageStyle(block) {
  const ratio = getImageWidthRatio(block)
  const style = { width: `${Math.round(ratio * 100)}%` }
  const aspectRatio = getImageAspectRatioCss(block)
  if (aspectRatio) style.aspectRatio = aspectRatio
  return style
}
</script>

<template>
  <article class="diary-blocks">
    <template v-for="block in blocks" :key="block.id">
      <h2 v-if="block.type === 'heading'" class="block-heading">{{ block.text }}</h2>
      <p v-else-if="block.type === 'paragraph'" class="block-paragraph">{{ block.text }}</p>
      <figure
        v-else-if="block.type === 'image' && attachmentUrls[block.attachmentId]"
        class="block-image"
        :class="[
          `layout-${block.layout}`,
          `size-${block.size}`,
          block.aspectRatio !== 'original' ? 'is-cropped' : '',
          block.aspectRatio === 'custom' ? 'is-free-stretch' : '',
        ]"
        :style="imageStyle(block)"
      >
        <img :src="attachmentUrls[block.attachmentId]" alt="" />
        <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
      </figure>
    </template>
  </article>
</template>

<style scoped>
.diary-blocks {
  display: block;
  color: var(--color-text-primary);
  font-family: var(--font-diary);
  font-size: var(--text-diary);
  font-weight: 400;
  line-height: 2.1;
  letter-spacing: 0.025em;
}

.block-paragraph {
  margin: 0 0 1.15em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.block-heading {
  margin: 0.6em 0 0.8em;
  font-family: var(--font-sans);
  font-size: var(--text-lg);
  font-weight: 600;
  line-height: 1.6;
  letter-spacing: 0.02em;
}

.block-image {
  max-width: 100%;
  margin: 0 0 1.35rem;
}

.block-image.layout-float-left {
  float: left;
  clear: left;
  margin-right: 1.25rem;
}

.block-image.layout-float-right {
  float: right;
  clear: right;
  margin-left: 1.25rem;
}

.block-image.layout-center,
.block-image.layout-full {
  float: none;
  clear: both;
  margin-right: auto;
  margin-left: auto;
}

.block-image.layout-center {
  margin-top: 0.7rem;
  margin-bottom: 1.6rem;
}

.block-image.layout-full {
  margin-top: 1rem;
  margin-bottom: 1.75rem;
}

.block-image.is-cropped {
  overflow: hidden;
}

.block-image.is-cropped img {
  height: 100%;
  object-fit: cover;
}

.block-image.is-free-stretch img {
  object-fit: fill;
}

.block-image img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 72vh;
  object-fit: contain;
  border-radius: var(--radius-md);
}

.block-image figcaption {
  margin-top: var(--space-sm);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  line-height: 1.6;
  text-align: center;
}
</style>






