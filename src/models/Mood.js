/**
 * @typedef {Object} MoodOption
 * @property {string} id
 * @property {string} label
 * @property {string} symbol
 */

/** @type {MoodOption[]} */
export const MOOD_OPTIONS = [
  { id: 'calm', label: '平静', symbol: '～' },
  { id: 'happy', label: '开心', symbol: '☺' },
  { id: 'tired', label: '疲惫', symbol: '…' },
  { id: 'sad', label: '低落', symbol: '☂' },
  { id: 'excited', label: '期待', symbol: '✦' },
  { id: 'grateful', label: '感恩', symbol: '♡' },
]

export function getMoodOption(id) {
  return MOOD_OPTIONS.find((mood) => mood.id === id) ?? null
}

export function getMoodLabel(id) {
  return getMoodOption(id)?.label ?? id ?? ''
}
