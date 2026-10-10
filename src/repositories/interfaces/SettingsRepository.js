/**
 * 键值设置 Repository 契约。
 * @interface
 */
export class SettingsRepository {
  async get(_key) { throw new Error('Not implemented') }
  async set(_key, _value) { throw new Error('Not implemented') }
  async delete(_key) { throw new Error('Not implemented') }
  async removeTagAndReferences(_settingsKey, _tagId) { throw new Error('Not implemented') }
}
