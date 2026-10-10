import { DEFAULT_THEME_SETTINGS, normalizeThemeSettings } from '@/models/Theme.js'
import { decorationThemes, getDecorationThemeById } from './decorationThemes.js'

const SETTINGS_KEY = 'theme.settings'
const DAILY_SELECTION_KEY = 'theme.dailySelection'

export class DecorationThemeService {
  /**
   * @param {import('../../repositories/interfaces/SettingsRepository.js').SettingsRepository} settingsRepository
   */
  constructor(settingsRepository) {
    this.settingsRepository = settingsRepository
    this.launchThemeId = null
  }

  getCatalog() {
    return decorationThemes
  }

  async getSettings() {
    const stored = await this.settingsRepository.get(SETTINGS_KEY)
    return normalizeThemeSettings(stored ?? DEFAULT_THEME_SETTINGS)
  }

  /** @param {Partial<import('../../models/Theme.js').ThemeSettings>} settings */
  async saveSettings(settings) {
    const normalized = normalizeThemeSettings({ ...(await this.getSettings()), ...settings })
    await this.settingsRepository.set(SETTINGS_KEY, normalized)
    return normalized
  }

  /**
   * Phase 1 先提供完整解析能力，主题设置 UI 在 Phase 3 接入。
   * @param {{ dateKey: string, forceNewLaunch?: boolean }} options
   */
  async getActiveTheme({ dateKey, forceNewLaunch = false }) {
    const settings = await this.getSettings()

    if (settings.mode === 'fixed') {
      return getDecorationThemeById(settings.fixedThemeId)
    }

    if (settings.rotation === 'each_launch') {
      if (!this.launchThemeId || forceNewLaunch) {
        this.launchThemeId = this.pickThemeId(settings.enabledThemes)
      }
      return getDecorationThemeById(this.launchThemeId)
    }

    const dailySelection = await this.settingsRepository.get(DAILY_SELECTION_KEY)
    if (dailySelection?.dateKey === dateKey && settings.enabledThemes.includes(dailySelection.themeId)) {
      return getDecorationThemeById(dailySelection.themeId)
    }

    const themeId = this.pickThemeId(settings.enabledThemes)
    await this.settingsRepository.set(DAILY_SELECTION_KEY, { dateKey, themeId })
    return getDecorationThemeById(themeId)
  }

  /** @param {string[]} enabledThemes */
  pickThemeId(enabledThemes) {
    const candidates = enabledThemes.length ? enabledThemes : DEFAULT_THEME_SETTINGS.enabledThemes
    return candidates[Math.floor(Math.random() * candidates.length)]
  }
}

