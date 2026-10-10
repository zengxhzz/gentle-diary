import { normalizeBlocks } from '@/models/Block.js'
import { createId } from '@/utils/id.js'
import { toDateKey } from '@/utils/date.js'

/**
 * @typedef {import('./Block.js').DiaryBlock} DiaryBlock
 *
 * @typedef {Object} DiarySyncState
 * @property {number} revision
 * @property {string | null} deviceId
 * @property {string | null} lastSyncedAt
 * @property {'local-only' | 'pending' | 'synced' | 'conflict'} status
 *
 * @typedef {Object} DiaryEncryptionState
 * @property {boolean} encrypted
 * @property {number | null} version
 *
 * @typedef {Object} Diary
 * @property {string} id
 * @property {string} title
 * @property {DiaryBlock[]} blocks
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} diaryDate
 * @property {string | null} mood
 * @property {string[]} tagIds
 * @property {boolean} favorite
 * @property {boolean} draft
 * @property {string[]} attachmentIds
 * @property {Object | null} location
 * @property {Object | null} weather
 * @property {DiaryEncryptionState} encryption
 * @property {DiarySyncState} sync
 * @property {string | null} deletedAt
 */

/**
 * @param {string} [diaryDate]
 * @param {{ deviceId?: string | null, now?: Date }} [options]
 * @returns {Diary}
 */
export function createEmptyDiary(diaryDate = toDateKey(), options = {}) {
  const now = options.now ?? new Date()
  const timestamp = now.toISOString()

  return {
    id: createId('diary'),
    title: '',
    blocks: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    diaryDate,
    mood: null,
    tagIds: [],
    favorite: false,
    draft: true,
    attachmentIds: [],
    location: null,
    weather: null,
    encryption: { encrypted: false, version: null },
    sync: {
      revision: 0,
      deviceId: options.deviceId ?? null,
      lastSyncedAt: null,
      status: 'local-only',
    },
    deletedAt: null,
  }
}

/**
 * 读取时补齐历史版本缺失字段，不更改业务内容。
 * @param {Partial<Diary>} input
 * @returns {Diary}
 */
export function normalizeDiary(input) {
  const now = new Date().toISOString()
  const base = createEmptyDiary(input.diaryDate ?? toDateKey())

  return {
    ...base,
    ...input,
    id: input.id ?? base.id,
    title: typeof input.title === 'string' ? input.title : '',
    blocks: normalizeBlocks(input.blocks ?? []),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? input.createdAt ?? now,
    diaryDate: input.diaryDate ?? base.diaryDate,
    mood: typeof input.mood === 'string' ? input.mood : null,
    tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
    favorite: Boolean(input.favorite),
    draft: input.draft ?? true,
    attachmentIds: Array.isArray(input.attachmentIds) ? input.attachmentIds : [],
    location: input.location ?? null,
    weather: input.weather ?? null,
    encryption: {
      encrypted: Boolean(input.encryption?.encrypted),
      version: input.encryption?.version ?? null,
    },
    sync: {
      revision: Number.isFinite(input.sync?.revision) ? input.sync.revision : 0,
      deviceId: input.sync?.deviceId ?? null,
      lastSyncedAt: input.sync?.lastSyncedAt ?? null,
      status: input.sync?.status ?? 'local-only',
    },
    deletedAt: input.deletedAt ?? null,
  }
}
