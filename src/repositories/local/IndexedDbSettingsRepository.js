import { STORE_NAMES } from '@/database/schemas/schema.js'

/** @implements {import('../interfaces/SettingsRepository.js').SettingsRepository} */
export class IndexedDbSettingsRepository {
  /** @param {import('../../providers/storage/IndexedDbStorageProvider.js').IndexedDbStorageProvider} storage */
  constructor(storage) {
    this.storage = storage
  }

  /** @param {string} key */
  async get(key) {
    const record = await this.storage.get(STORE_NAMES.SETTINGS, key)
    return record?.value ?? null
  }

  /**
   * @param {string} key
   * @param {unknown} value
   */
  async set(key, value) {
    await this.storage.put(STORE_NAMES.SETTINGS, { key, value })
    return value
  }

  /** @param {string} key */
  async delete(key) {
    await this.storage.delete(STORE_NAMES.SETTINGS, key)
  }

  /** @param {string} settingsKey @param {string} tagId */
  async removeTagAndReferences(settingsKey, tagId) {
    await this.storage.removeTagAndReferences(settingsKey, tagId)
  }
}
