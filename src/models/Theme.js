/**
 * @typedef {'random' | 'fixed'} ThemeMode
 * @typedef {'each_launch' | 'daily'} ThemeRotation
 *
 * @typedef {Object} ThemeSettings
 * @property {ThemeMode} mode
 * @property {ThemeRotation} rotation
 * @property {string | null} fixedThemeId
 * @property {string[]} enabledThemes
 */

/** @type {ThemeSettings} */
export const DEFAULT_THEME_SETTINGS = {
  mode: 'fixed',
  rotation: 'each_launch',
  fixedThemeId: 'cloud',
  enabledThemes: ['cloud', 'plant', 'cat', 'paper-plane', 'moon', 'geometry'],
}

/**
 * @param {Partial<ThemeSettings>} [input]
 * @returns {ThemeSettings}
 */
export function normalizeThemeSettings(input = {}) {
  const knownThemes = DEFAULT_THEME_SETTINGS.enabledThemes
  const enabledThemes = Array.isArray(input.enabledThemes)
    ? input.enabledThemes.filter((id) => knownThemes.includes(id))
    : DEFAULT_THEME_SETTINGS.enabledThemes

  return {
    mode: input.mode === 'random' ? 'random' : 'fixed',
    rotation: input.rotation === 'daily' ? 'daily' : 'each_launch',
    fixedThemeId: knownThemes.includes(input.fixedThemeId)
      ? input.fixedThemeId
      : DEFAULT_THEME_SETTINGS.fixedThemeId,
    enabledThemes: enabledThemes.length ? enabledThemes : DEFAULT_THEME_SETTINGS.enabledThemes,
  }
}
