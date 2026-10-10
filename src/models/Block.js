import { createId } from '@/utils/id.js'

/**
 * @typedef {'paragraph' | 'heading' | 'image'} BlockType
 *
 * @typedef {Object} ParagraphBlock
 * @property {string} id
 * @property {'paragraph'} type
 * @property {string} text
 *
 * @typedef {Object} HeadingBlock
 * @property {string} id
 * @property {'heading'} type
 * @property {string} text
 * @property {1 | 2 | 3} [level]
 *
 * @typedef {Object} ImageBlock
 * @property {string} id
 * @property {'image'} type
 * @property {string} attachmentId
 * @property {'float-left' | 'float-right' | 'center' | 'full'} layout
 * @property {'small' | 'medium' | 'large' | 'full'} size
 * @property {number | null} [widthRatio]
 * @property {'original' | '1:1' | '4:3' | '3:4' | '16:9' | 'custom'} [aspectRatio]
 * @property {number | null} [customAspectRatio]
 * @property {string} [caption]
 *
 * @typedef {ParagraphBlock | HeadingBlock | ImageBlock} DiaryBlock
 */

/**
 * @param {string} [text]
 * @returns {ParagraphBlock}
 */
export function createParagraphBlock(text = '') {
  return { id: createId('block'), type: 'paragraph', text }
}

/**
 * @param {string} [text]
 * @param {1 | 2 | 3} [level]
 * @returns {HeadingBlock}
 */
export function createHeadingBlock(text = '', level = 2) {
  return { id: createId('block'), type: 'heading', text, level }
}

/**
 * @param {string} attachmentId
 * @param {Partial<Omit<ImageBlock, 'id' | 'type' | 'attachmentId'>>} [options]
 * @returns {ImageBlock}
 */
export function createImageBlock(attachmentId, options = {}) {
  return {
    id: createId('block'),
    type: 'image',
    attachmentId,
    layout: options.layout ?? 'center',
    size: options.size ?? 'medium',
    widthRatio: options.widthRatio ?? null,
    aspectRatio: options.aspectRatio ?? 'original',
    customAspectRatio: options.customAspectRatio ?? null,
    caption: options.caption ?? '',
  }
}

export const IMAGE_SIZE_WIDTH_RATIOS = {
  small: 0.32,
  medium: 0.52,
  large: 0.72,
  full: 0.88,
}

/**
 * @param {ImageBlock} block
 * @returns {number}
 */
export function getImageWidthRatio(block) {
  if (block.layout === 'full') return 1
  if (Number.isFinite(block.widthRatio)) return block.widthRatio
  return IMAGE_SIZE_WIDTH_RATIOS[block.size] ?? IMAGE_SIZE_WIDTH_RATIOS.medium
}

/**
 * @param {ImageBlock} block
 * @returns {string | null}
 */
export function getImageAspectRatioCss(block) {
  if (!block.aspectRatio || block.aspectRatio === 'original') return null
  if (block.aspectRatio === 'custom') {
    return Number.isFinite(block.customAspectRatio) ? String(block.customAspectRatio) : null
  }
  return block.aspectRatio.replace(':', ' / ')
}

/**
 * 将第一阶段纯文字编辑器内容映射为段落 Block。
 * 空行用于分隔段落，段落内换行会被保留。
 * 按顺序复用已有段落 ID，避免每次自动保存都制造同步冲突。
 * @param {string} text
 * @param {DiaryBlock[]} [existingBlocks]
 * @returns {ParagraphBlock[]}
 */
export function plainTextToBlocks(text, existingBlocks = []) {
  if (!text.trim()) return []

  const reusableParagraphs = existingBlocks.filter(
    (block) => block.type === 'paragraph' || block.type === 'heading',
  )

  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => {
      const reusable = reusableParagraphs[index]
      return {
        id: reusable?.id ?? createId('block'),
        type: 'paragraph',
        text: paragraph,
      }
    })
}

/**
 * @param {DiaryBlock[]} blocks
 * @returns {string}
 */
export function blocksToPlainText(blocks = []) {
  return blocks
    .filter((block) => block.type === 'paragraph' || block.type === 'heading')
    .map((block) => block.text ?? '')
    .join('\n\n')
}

/**
 * 规范化旧数据与缺失字段，保证升级后仍可读取。
 * @param {Partial<DiaryBlock> & { id?: string, type?: string }} input
 * @returns {DiaryBlock | null}
 */
export function normalizeBlock(input) {
  if (!input || typeof input !== 'object') return null
  const id = typeof input.id === 'string' && input.id ? input.id : createId('block')

  if (input.type === 'paragraph' || input.type === 'heading') {
    return {
      id,
      type: input.type,
      text: typeof input.text === 'string' ? input.text : '',
      ...(input.type === 'heading' ? { level: [1, 2, 3].includes(input.level) ? input.level : 2 } : {}),
    }
  }

  if (input.type === 'image' && typeof input.attachmentId === 'string') {
    const allowedLayouts = ['float-left', 'float-right', 'center', 'full']
    const allowedSizes = ['small', 'medium', 'large', 'full']
    return {
      id,
      type: 'image',
      attachmentId: input.attachmentId,
      layout: allowedLayouts.includes(input.layout) ? input.layout : 'center',
      size: allowedSizes.includes(input.size) ? input.size : 'medium',
      widthRatio: Number.isFinite(input.widthRatio) ? input.widthRatio : null,
      aspectRatio: ['original', '1:1', '4:3', '3:4', '16:9', 'custom'].includes(input.aspectRatio)
        ? input.aspectRatio
        : 'original',
      customAspectRatio: Number.isFinite(input.customAspectRatio) ? input.customAspectRatio : null,
      caption: typeof input.caption === 'string' ? input.caption : '',
    }
  }

  return null
}

/**
 * @param {unknown[]} blocks
 * @returns {DiaryBlock[]}
 */
export function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks.map(normalizeBlock).filter(Boolean)
}








