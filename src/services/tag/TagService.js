import { createTag, normalizeTag } from '@/models/Tag.js'

const TAGS_KEY = 'diary.tags'

export class TagService {
  constructor(settingsRepository) {
    this.settingsRepository = settingsRepository
  }

  async list() {
    const stored = await this.settingsRepository.get(TAGS_KEY)
    return Array.isArray(stored) ? stored.map(normalizeTag).filter(Boolean) : []
  }

  async create(name) {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) return null

    const tags = await this.list()
    const existing = tags.find((tag) => tag.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
    if (existing) return existing

    const tag = createTag(trimmed)
    await this.settingsRepository.set(TAGS_KEY, [...tags, tag])
    return tag
  }

  async remove(id) {
    await this.settingsRepository.removeTagAndReferences(TAGS_KEY, id)
  }
}
