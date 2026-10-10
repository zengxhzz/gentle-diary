import { blocksToPlainText } from '@/models/Block.js'

/**
 * @param {{ title?: string, blocks?: Array }} diary
 * @returns {string}
 */
export function getDiaryText(diary) {
  if (!diary?.blocks?.length) return ''
  return blocksToPlainText(diary.blocks).trim()
}

/**
 * 获取列表标题。显式标题优先，其次使用短的第一行。
 * @param {{ title?: string, blocks?: Array }} diary
 * @returns {string}
 */
export function getDiaryTitle(diary) {
  if (diary?.title?.trim()) return diary.title.trim()

  const text = getDiaryText(diary)
  if (!text) return ''

  const firstLine = text.split(/\r?\n/, 1)[0].trim()
  return firstLine.length <= 28 ? firstLine : ''
}

/**
 * 获取列表摘要。若第一行已成为标题，则从后续内容开始截取。
 * @param {{ title?: string, blocks?: Array }} diary
 * @returns {string}
 */
export function getDiarySummary(diary) {
  const text = getDiaryText(diary)
  if (!text) return ''

  const title = getDiaryTitle(diary)
  if (!title) return text.replace(/\s+/g, ' ').trim()

  const firstLine = text.split(/\r?\n/, 1)[0].trim()
  const withoutTitle = firstLine === title ? text.slice(firstLine.length).trim() : text
  return withoutTitle.replace(/\s+/g, ' ').trim()
}

/**
 * @param {{ title?: string, blocks?: Array }} diary
 * @returns {boolean}
 */
export function hasDiaryText(diary) {
  return Boolean(getDiaryText(diary) || diary?.title?.trim())
}
