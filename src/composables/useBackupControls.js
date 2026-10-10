import { ref } from 'vue'

/**
 * 设置页备份交互状态。校验和持久化仍由 BackupService 负责。
 * @param {{
 *   backupService: import('../services/backup/BackupService.js').BackupService,
 *   onRestored?: () => Promise<void>,
 *   wait?: (milliseconds: number) => Promise<void>,
 * }} dependencies
 */
export function useBackupControls({
  backupService,
  onRestored = async () => {},
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const backupBusy = ref(false)
  const backupNotice = ref('')
  const backupError = ref('')
  const importInput = ref(null)
  const pendingImportFile = ref(null)
  const importConfirmOpen = ref(false)
  const canShareBackup = backupService.supportsShareDelivery?.() ?? false

  async function exportBackup({ method = 'save' } = {}) {
    if (backupBusy.value) return
    backupBusy.value = true
    backupNotice.value = ''
    backupError.value = ''

    try {
      const { backup, delivery } = await backupService.exportBackupFile({ method })
      if (delivery?.canceled) {
        backupNotice.value = '已取消保存，现有数据未受影响。'
        return
      }
      const counts = `${backup.data.diaries.length} 篇日记，${backup.data.attachments.length} 个附件`
      backupNotice.value = delivery?.method === 'share'
        ? `备份已交给所选应用（${counts}），请在目标位置核对文件。`
        : delivery?.method === 'download'
          ? `已触发备份下载（${counts}），请核对浏览器保存位置。`
          : `备份已保存（${counts}），请妥善保管未加密文件。`
      if (delivery?.cleanupWarning) backupNotice.value += ` ${delivery.cleanupWarning}`
    } catch (error) {
      backupError.value = error?.message ?? '备份导出失败，现有数据未被修改。'
    } finally {
      backupBusy.value = false
    }
  }

  async function loadExportRecoveryStatus() {
    if (backupBusy.value || !backupService.getExportRecoveryStatus) return
    backupBusy.value = true
    try {
      let status = await backupService.getExportRecoveryStatus()
      for (let attempt = 0; status.state === 'copying' && attempt < 60; attempt++) {
        backupNotice.value = '正在继续保存中断的备份，请稍候。'
        await wait(500)
        status = await backupService.getExportRecoveryStatus()
      }
      if (status.state === 'saved') {
        backupNotice.value = status.message || '备份保存已完成，请核对目标文件。'
      } else if (status.state === 'failed') {
        backupNotice.value = ''
        backupError.value = status.message || '上次备份保存失败，请重新导出并核对目标文件。'
      } else if (status.state === 'copying') {
        backupNotice.value = '备份仍在后台保存，请稍后重新打开设置页核对结果。'
      }
    } catch (error) {
      backupError.value = `无法核对上次备份保存状态。${error?.message ?? ''}`
    } finally {
      backupBusy.value = false
    }
  }

  function chooseImportFile() {
    if (backupBusy.value) return
    importInput.value?.click()
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    pendingImportFile.value = file
    backupNotice.value = ''
    backupError.value = ''
    importConfirmOpen.value = true
  }

  function cancelImport() {
    if (backupBusy.value) return
    importConfirmOpen.value = false
    pendingImportFile.value = null
  }

  async function confirmImport() {
    if (backupBusy.value || !pendingImportFile.value) return
    backupBusy.value = true
    importConfirmOpen.value = false
    backupNotice.value = '正在校验并恢复备份，请不要重复操作。'
    backupError.value = ''

    try {
      let result
      try {
        result = await backupService.importFromFile(pendingImportFile.value, {
          mode: 'replace',
        })
      } catch (error) {
        backupNotice.value = ''
        backupError.value = `${error?.message ?? '备份导入失败。'} 原有数据未被替换。`
        return
      }

      const counts = `${result.diaryCount} 篇日记，${result.attachmentCount} 个附件`
      try {
        await onRestored()
        backupNotice.value = `恢复完成：${counts}。`
      } catch (error) {
        backupNotice.value = `数据已恢复：${counts}。`
        backupError.value = `设置页刷新失败，请重新打开设置页。${error?.message ? ` ${error.message}` : ''}`
      }
    } finally {
      pendingImportFile.value = null
      backupBusy.value = false
    }
  }

  return {
    backupBusy,
    backupNotice,
    backupError,
    importInput,
    pendingImportFile,
    importConfirmOpen,
    canShareBackup,
    exportBackup,
    loadExportRecoveryStatus,
    chooseImportFile,
    handleImportFile,
    cancelImport,
    confirmImport,
  }
}
