import { createId } from '@/utils/id.js'

/**
 * @typedef {Object} Tag
 * @property {string} id
 * @property {string} name
 * @property {string} createdAt
 */

export function createTag(name, options = {}) {
  return {
    id: options.id ?? createId('tag'),
    name: String(name).trim(),
    createdAt: options.createdAt ?? new Date().toISOString(),
  }
}

export function normalizeTag(input) {
  if (!input || typeof input !== 'object' || !String(input.name ?? '').trim()) return null
  return createTag(input.name, input)
}
