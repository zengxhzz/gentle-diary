import { afterEach, describe, expect, it, vi } from 'vitest'
import { DecorationThemeService } from '@/services/theme/DecorationThemeService.js'

class MemorySettingsRepository {
  constructor() {
    this.values = new Map()
  }

  async get(key) {
    return this.values.get(key) ?? null
  }

  async set(key, value) {
    this.values.set(key, structuredClone(value))
    return value
  }

  async delete(key) {
    this.values.delete(key)
  }
}

describe('DecorationThemeService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the fixed theme and persists settings', async () => {
    const repository = new MemorySettingsRepository()
    const service = new DecorationThemeService(repository)

    await service.saveSettings({ mode: 'fixed', fixedThemeId: 'plant' })
    const theme = await service.getActiveTheme({ dateKey: '2026-09-14' })

    expect(theme.id).toBe('plant')
  })

  it('keeps one daily random theme for the same date', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const repository = new MemorySettingsRepository()
    const service = new DecorationThemeService(repository)
    await service.saveSettings({
      mode: 'random',
      rotation: 'daily',
      enabledThemes: ['cloud', 'plant', 'cat'],
    })

    const first = await service.getActiveTheme({ dateKey: '2026-09-14' })
    const second = await service.getActiveTheme({ dateKey: '2026-09-14' })

    expect(first.id).toBe('plant')
    expect(second.id).toBe('plant')
  })

  it('keeps launch random stable until a forced new launch', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99)
    const service = new DecorationThemeService(new MemorySettingsRepository())
    await service.saveSettings({ mode: 'random', rotation: 'each_launch' })

    const first = await service.getActiveTheme({ dateKey: '2026-09-14' })
    const stable = await service.getActiveTheme({ dateKey: '2026-09-14' })
    const nextLaunch = await service.getActiveTheme({
      dateKey: '2026-09-14',
      forceNewLaunch: true,
    })

    expect(first.id).toBe('cloud')
    expect(stable.id).toBe('cloud')
    expect(nextLaunch.id).toBe('geometry')
    expect(random).toHaveBeenCalledTimes(2)
  })
})
