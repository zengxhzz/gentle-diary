import { describe, expect, it } from 'vitest'
import {
  blocksToPlainText,
  createImageBlock,
  getImageAspectRatioCss,
  getImageWidthRatio,
  normalizeBlock,
  plainTextToBlocks,
} from '@/models/Block.js'
import { createEmptyDiary, normalizeDiary } from '@/models/Diary.js'

describe('Diary model', () => {
  it('creates a complete local-first diary model', () => {
    const diary = createEmptyDiary('2026-09-10', { deviceId: 'device-test' })

    expect(diary.diaryDate).toBe('2026-09-10')
    expect(diary.blocks).toEqual([])
    expect(diary.encryption.encrypted).toBe(false)
    expect(diary.sync.deviceId).toBe('device-test')
    expect(diary.deletedAt).toBeNull()
  })

  it('normalizes legacy records without losing content', () => {
    const diary = normalizeDiary({
      id: 'diary-1',
      diaryDate: '2026-09-09',
      blocks: [{ id: 'block-1', type: 'paragraph', text: '旧数据' }],
    })

    expect(diary.id).toBe('diary-1')
    expect(diary.blocks[0].text).toBe('旧数据')
    expect(diary.tagIds).toEqual([])
    expect(diary.sync.revision).toBe(0)
  })
})

describe('Block model', () => {
  it('maps plain text to paragraphs and back', () => {
    const blocks = plainTextToBlocks('第一段\n第一段第二行\n\n第二段')
    expect(blocks).toHaveLength(2)
    expect(blocksToPlainText(blocks)).toBe('第一段\n第一段第二行\n\n第二段')
  })

  it('reuses paragraph ids during autosave conversion', () => {
    const first = plainTextToBlocks('第一段\n\n第二段')
    const second = plainTextToBlocks('第一段修改\n\n第二段', first)

    expect(second.map((block) => block.id)).toEqual(first.map((block) => block.id))
  })

  it('changes image width when size changes unless a custom ratio exists', () => {
    expect(getImageWidthRatio(createImageBlock('attachment-1', { size: 'small' }))).toBe(0.32)
    expect(getImageWidthRatio(createImageBlock('attachment-1', { size: 'medium' }))).toBe(0.52)
    expect(getImageWidthRatio(createImageBlock('attachment-1', { size: 'large' }))).toBe(0.72)
    expect(
      getImageWidthRatio(createImageBlock('attachment-1', { size: 'small', widthRatio: 0.4 })),
    ).toBe(0.4)
  })

  it('supports preset and free image aspect ratios', () => {
    expect(getImageAspectRatioCss(createImageBlock('attachment-1', { aspectRatio: '4:3' }))).toBe('4 / 3')
    expect(
      getImageAspectRatioCss(
        createImageBlock('attachment-1', { aspectRatio: 'custom', customAspectRatio: 1.37 }),
      ),
    ).toBe('1.37')
    expect(getImageAspectRatioCss(createImageBlock('attachment-1'))).toBeNull()
  })

  it('normalizes the controlled image layout model', () => {
    const block = normalizeBlock({
      id: 'image-block',
      type: 'image',
      attachmentId: 'attachment-1',
      layout: 'float-right',
      size: 'small',
    })

    expect(block).toMatchObject({
      id: 'image-block',
      type: 'image',
      attachmentId: 'attachment-1',
      layout: 'float-right',
      size: 'small',
      caption: '',
    })
  })

  it('preserves image captions for autosave and detail rendering', () => {
    const block = normalizeBlock({
      id: 'image-caption',
      type: 'image',
      attachmentId: 'attachment-1',
      caption: '雨后的街道',
    })

    expect(block.caption).toBe('雨后的街道')
  })
})



