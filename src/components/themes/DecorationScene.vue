<script setup>
import { getDecorationStyle } from './decorationLayout.js'

defineProps({
  theme: { type: Object, default: null },
})
</script>

<template>
  <div v-if="theme" class="decoration-scene" aria-hidden="true">
    <img
      v-for="decoration in theme.decorations"
      :key="decoration.id"
      class="decoration-item"
      :style="getDecorationStyle(decoration)"
      :src="decoration.image"
      alt=""
      width="64"
      height="64"
      decoding="async"
      draggable="false"
    />
  </div>
</template>

<style scoped>
.decoration-scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--stable-viewport-height, 100lvh);
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.decoration-item {
  position: absolute;
  display: block;
  object-fit: contain;
  object-position: left bottom;
  user-select: none;
}

/* A landscape Android IME may leave less than one text block of visible space.
   Prioritize writing; the same selected decoration returns when the IME closes. */
@media (max-height: 240px) {
  .decoration-scene {
    display: none;
  }
}
</style>


