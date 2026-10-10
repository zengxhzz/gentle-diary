import { createSSRApp, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ editor: null }))
vi.mock('@/composables/useDiaryEditor.js', () => ({ useDiaryEditor: () => mocks.editor }))
vi.mock('@/services/container.js', () => ({ services: {} }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }), useRouter: () => ({}) }))

import TodayView from '@/views/Today/TodayView.vue'

beforeEach(() => {
  vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 })
  mocks.editor = {
    diary: ref({ diaryDate: '2026-10-10', tagIds: [], sync: { revision: 1 } }),
    blocks: ref([{ id: 'qa-paragraph', type: 'paragraph', text: '安静地写下一点日常。' }]),
    loading: ref(false), loadError: ref(''), saveState: ref('idle'), saveStatusText: ref(''),
  }
})
afterEach(() => vi.unstubAllGlobals())

describe('quiet Today writing presentation', () => {
  it.each([
    ['idle', ''], ['saving', '正在保存草稿'], ['saved', '草稿已保存'],
    ['entry-saved', '已保存到日记'],
  ])('does not render routine persistence text or its spacer for %s', async (state, label) => {
    mocks.editor.saveState.value = state
    mocks.editor.saveStatusText.value = label
    const html = await renderToString(createSSRApp(TodayView))
    expect(html).not.toMatch(/草稿已保存|正在保存草稿|本机草稿 · 自动保存|已保存到日记/)
    expect(html).not.toContain('class="save-status"')
    expect(html).not.toContain('status-dot')
    expect(html).toContain('class="writing-body"')
    expect(html).toContain('data-editor-block-id="qa-paragraph"')
    expect(mocks.editor.blocks.value[0].text).toBe('安静地写下一点日常。')
  })

  it('retains visible, accessible persistence failure feedback', async () => {
    mocks.editor.saveState.value = 'error'
    mocks.editor.loadError.value = '存储空间不足'
    const html = await renderToString(createSSRApp(TodayView))
    expect(html).toContain('内容暂未保存，请稍后再试。')
    expect(html).toMatch(/class="error-line"[^>]*role="status"/)
    expect(html).toContain('data-editor-block-id="qa-paragraph"')
    expect(mocks.editor.blocks.value[0].text).toBe('安静地写下一点日常。')
  })

  it('retains load errors instead of silently showing an empty editor', async () => {
    mocks.editor.loadError.value = '无法读取日记'
    const html = await renderToString(createSSRApp(TodayView))
    expect(html).toContain('无法读取日记')
  })

  it('preserves mood metadata and existing writing controls', async () => {
    mocks.editor.diary.value.mood = 'calm'
    const html = await renderToString(createSSRApp(TodayView))
    expect(html).toContain('平静')
    expect(html).toContain('aria-label="添加内容"')
    expect(html).toContain('aria-label="打开更多入口"')
    expect(html).toContain('日记正文段落')
  })
})
