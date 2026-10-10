<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 22 },
})

const icons = {
  more: { paths: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'] },
  plus: { paths: ['M12 5v14', 'M5 12h14'] },
  'arrow-left': { paths: ['M19 12H5', 'm12 19-7-7 7-7'] },
  close: { paths: ['m6 6 12 12', 'M18 6 6 18'] },
  image: {
    paths: [
      'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z',
      'm4 16 4.5-4.5 4 4 2-2L20 18',
      'M15.5 8.5h.01',
    ],
  },
  camera: {
    paths: [
      'M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z',
      'M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    ],
  },
  mic: {
    paths: [
      'M12 14.5a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5.5a3 3 0 0 0 3 3Z',
      'M6.5 11.5a5.5 5.5 0 0 0 11 0',
      'M12 17v3',
      'M9 20h6',
    ],
  },
  mood: {
    paths: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M8.5 10h.01', 'M15.5 10h.01', 'M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2'],
  },
  location: {
    paths: ['M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  },
  weather: {
    paths: ['M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.4 11 3.5 3.5 0 0 0 7 18Z'],
  },
  tag: {
    paths: ['M20 13 13 20 4 11V4h7l9 9Z', 'M8 8h.01'],
  },
  edit: {
    paths: ['M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z', 'm14.5 7.5 3 3'],
  },
  trash: {
    paths: ['M4 7h16', 'M9 7V4h6v3', 'm7 7 1 13h8l1-13', 'M10 11v5', 'M14 11v5'],
  },
  restore: {
    paths: ['M4 4v6h6', 'M5.5 14a7 7 0 1 0 1.6-7.3L4 10'],
  },
  check: {
    paths: ['m5 12 4 4L19 6'],
  },
  paragraph: {
    paths: ['M6 7h12', 'M6 12h12', 'M6 17h8'],
  },
  search: {
    paths: ['M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z', 'm16 16 4.5 4.5'],
  },
  calendar: {
    paths: ['M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z', 'M7.5 3v3M16.5 3v3M3.5 9h17'],
  },
  star: {
    paths: ['M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z'],
  },
  settings: {
    paths: [
      'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
      'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L6 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4.6v-3h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L6 8l2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h3v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.2 8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v3h-.2a1.7 1.7 0 0 0-1 1Z',
    ],
  },
}

const icon = computed(() => icons[props.name] ?? icons.paragraph)
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      v-for="(path, index) in icon.paths"
      :key="index"
      :d="path"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
