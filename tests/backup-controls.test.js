import { describe, expect, it, vi } from 'vitest'
import { useBackupControls } from '@/composables/useBackupControls.js'

function createContext(overrides = {}) {
  const backupService = {
    exportBackupFile: vi.fn(async () => ({
      blob: new Blob(['{}'], { type: 'application/json' }),
      fileName: 'backup.json',
      backup: { data: { diaries: [{ id: 'd1' }], attachments: [{ id: 'a1' }] } },
      delivery: { method: 'document', canceled: false },
    })),
    importFromFile: vi.fn(async () => ({ diaryCount: 2, attachmentCount: 1 })),
    ...overrides,
  }
  const onRestored = vi.fn(async () => undefined)
  const controls = useBackupControls({ backupService, onRestored })
  return { backupService, onRestored, controls }
}

describe('settings backup controls', () => {
  it('shows a persisted native recovery failure without claiming any database loss', async () => {
    const { controls } = createContext({
      getExportRecoveryStatus: vi.fn(async () => ({ state: 'failed', message: '目标可能是不完整文件，请勿用于恢复。' })),
    })

    await controls.loadExportRecoveryStatus()

    expect(controls.backupError.value).toBe('目标可能是不完整文件，请勿用于恢复。')
    expect(controls.backupBusy.value).toBe(false)
  })

  it('blocks new actions until interrupted native saving completes', async () => {
    let finishWait
    const backupService = {
      getExportRecoveryStatus: vi.fn()
        .mockResolvedValueOnce({ state: 'copying' })
        .mockResolvedValueOnce({ state: 'saved', message: '保存已完成' }),
      exportBackupFile: vi.fn(),
    }
    const controls = useBackupControls({ backupService,
      wait: () => new Promise((resolve) => { finishWait = resolve }),
    })
    const checking = controls.loadExportRecoveryStatus()
    await Promise.resolve()
    expect(controls.backupBusy.value).toBe(true)
    await controls.exportBackup()
    expect(backupService.exportBackupFile).not.toHaveBeenCalled()
    finishWait()
    await checking
    expect(controls.backupNotice.value).toBe('保存已完成')
    expect(controls.backupBusy.value).toBe(false)
  })

  it('keeps successful delivery feedback when only private source cleanup needs attention', async () => {
    const { controls } = createContext({
      exportBackupFile: vi.fn(async () => ({
        backup: { data: { diaries: [], attachments: [] } },
        delivery: { method: 'document', canceled: false, cleanupWarning: '稍后重试清理临时文件。' },
      })),
    })
    await controls.exportBackup()
    expect(controls.backupNotice.value).toContain('备份已保存')
    expect(controls.backupNotice.value).toContain('稍后重试清理')
    expect(controls.backupError.value).toBe('')
  })
  it('exports once and reports the generated backup counts', async () => {
    const { backupService, controls } = createContext()

    await controls.exportBackup()

    expect(backupService.exportBackupFile).toHaveBeenCalledTimes(1)
    expect(backupService.exportBackupFile).toHaveBeenCalledWith({ method: 'save' })
    expect(controls.backupNotice.value).toBe('备份已保存（1 篇日记，1 个附件），请妥善保管未加密文件。')
    expect(controls.backupBusy.value).toBe(false)
  })

  it('requires file selection and confirmation before replace import', async () => {
    const { backupService, onRestored, controls } = createContext()
    const file = new Blob(['{}'], { type: 'application/json' })
    const input = { files: [file], value: 'selected' }

    controls.handleImportFile({ target: input })
    expect(input.value).toBe('')
    expect(controls.importConfirmOpen.value).toBe(true)
    expect(backupService.importFromFile).not.toHaveBeenCalled()

    await controls.confirmImport()
    expect(backupService.importFromFile).toHaveBeenCalledWith(file, { mode: 'replace' })
    expect(onRestored).toHaveBeenCalledTimes(1)
    expect(controls.backupNotice.value).toBe('恢复完成：2 篇日记，1 个附件。')
    expect(controls.importConfirmOpen.value).toBe(false)
  })

  it('reports native share cancellation without treating it as a data failure', async () => {
    const { controls } = createContext({
      exportBackupFile: vi.fn(async () => ({
        backup: { data: { diaries: [{ id: 'd1' }], attachments: [] } },
        delivery: { method: 'share', canceled: true },
      })),
    })

    await controls.exportBackup()

    expect(controls.backupNotice.value).toBe('已取消保存，现有数据未受影响。')
    expect(controls.backupError.value).toBe('')
  })

  it('blocks duplicate actions while importing and reports a safe failure', async () => {
    let rejectImport
    const importFromFile = vi.fn(
      () => new Promise((_resolve, reject) => { rejectImport = reject }),
    )
    const { backupService, controls } = createContext({ importFromFile })
    const input = { files: [new Blob(['{}'])], value: 'selected' }
    controls.handleImportFile({ target: input })

    const pending = controls.confirmImport()
    expect(controls.backupBusy.value).toBe(true)
    await controls.exportBackup()
    expect(backupService.exportBackupFile).not.toHaveBeenCalled()

    rejectImport(new Error('文件损坏'))
    await pending
    expect(controls.backupBusy.value).toBe(false)
    expect(controls.backupError.value).toBe('文件损坏 原有数据未被替换。')
  })

  it('does not claim rollback when post-import settings refresh fails', async () => {
    const backupService = {
      importFromFile: vi.fn(async () => ({ diaryCount: 2, attachmentCount: 1 })),
    }
    const controls = useBackupControls({
      backupService,
      onRestored: async () => { throw new Error('主题读取失败') },
    })
    controls.handleImportFile({ target: { files: [new Blob(['{}'])], value: 'selected' } })

    await controls.confirmImport()

    expect(backupService.importFromFile).toHaveBeenCalledTimes(1)
    expect(controls.backupNotice.value).toBe('数据已恢复：2 篇日记，1 个附件。')
    expect(controls.backupError.value).toContain('设置页刷新失败')
    expect(controls.backupError.value).not.toContain('原有数据未被替换')
    expect(controls.backupBusy.value).toBe(false)
  })
})
