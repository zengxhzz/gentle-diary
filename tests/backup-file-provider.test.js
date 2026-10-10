import { describe, expect, it, vi } from 'vitest'
import { Directory, Encoding } from '@capacitor/filesystem'
import { PlatformBackupFileProvider } from '@/providers/backup/PlatformBackupFileProvider.js'

const FILE_NAME = 'gentle-diary-backup-2026-10-03.json'
const OPERATION_A = '00000000-0000-4000-8000-000000000001'
const OPERATION_B = '00000000-0000-4000-8000-000000000002'
const SOURCE_A = sourceName(OPERATION_A)
const PATH_A = 'gentle-diary/backups/' + SOURCE_A
const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 7)

describe('PlatformBackupFileProvider', () => {
  it('uses the iOS share sheet for default export without invoking the Android plugin', async () => {
    const { provider, filesystem, share, backupDocument } = nativeFixture({ getPlatform: () => 'ios' })

    await expect(provider.getRecoveryStatus()).resolves.toEqual({ state: 'idle' })
    await expect(provider.exportFile(new Blob(['{"日记":true}']), FILE_NAME))
      .resolves.toEqual({ method: 'share', fileName: FILE_NAME })

    expect(filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      directory: Directory.Cache, data: '{"日记":true}',
    }))
    expect(share.share).toHaveBeenCalledWith(expect.objectContaining({ files: [fileUri(Directory.Cache, PATH_A)] }))
    expect(backupDocument.save).not.toHaveBeenCalled()
    expect(backupDocument.getRecoveryStatus).not.toHaveBeenCalled()
  })

  it('rejects an unavailable iOS share sheet before staging backup data', async () => {
    const { provider, filesystem, backupDocument } = nativeFixture({
      getPlatform: () => 'ios',
      share: { canShare: vi.fn().mockResolvedValue({ value: false }) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME)).rejects.toThrow('无法打开系统分享')
    expect(filesystem.writeFile).not.toHaveBeenCalled()
    expect(backupDocument.save).not.toHaveBeenCalled()
  })

  it('retains the cached backup when iOS sharing is canceled', async () => {
    const { provider, filesystem, backupDocument } = nativeFixture({
      getPlatform: () => 'ios',
      share: { share: vi.fn().mockRejectedValue(new Error('User canceled')) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME))
      .resolves.toEqual({ method: 'share', fileName: FILE_NAME, canceled: true })
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
    expect(backupDocument.save).not.toHaveBeenCalled()
  })

  it('uses the browser download fallback without native staging', async () => {
    const browserDownload = vi.fn()
    const filesystem = { writeFile: vi.fn(), readdir: vi.fn(), deleteFile: vi.fn() }
    const operationId = vi.fn()
    const provider = new PlatformBackupFileProvider({
      isNativePlatform: () => false,
      browserDownload,
      filesystem,
      operationId,
    })
    const blob = new Blob(['{"ok":true}'], { type: 'application/json' })

    await expect(provider.exportFile(blob, 'backup.json'))
      .resolves.toEqual({ method: 'download', fileName: 'backup.json' })

    expect(browserDownload).toHaveBeenCalledWith(blob, 'backup.json')
    expect(operationId).not.toHaveBeenCalled()
    expect(filesystem.writeFile).not.toHaveBeenCalled()
    expect(filesystem.readdir).not.toHaveBeenCalled()
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it.each([false, true])('stages durable UTF-8 data and leaves native cleanup ownership (canceled=%s)', async canceled => {
    const { provider, filesystem, backupDocument } = nativeFixture({
      filesystem: { deleteFile: vi.fn().mockRejectedValue(new Error('cleanup failed')) },
      backupDocument: { save: vi.fn().mockResolvedValue({ canceled }) },
    })

    await expect(provider.exportFile(new Blob(['{"日记":true}']), FILE_NAME))
      .resolves.toEqual({ method: 'document', fileName: FILE_NAME, canceled })

    expect(filesystem.writeFile).toHaveBeenCalledWith({
      path: PATH_A,
      directory: Directory.Data,
      data: '{"日记":true}',
      encoding: Encoding.UTF8,
      recursive: true,
    })
    expect(backupDocument.save).toHaveBeenCalledWith({
      fileName: FILE_NAME,
      sourceFileName: SOURCE_A,
    })
    expect(filesystem.readdir).not.toHaveBeenCalled()
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it('keeps the sanitized public name separate from the unique source name', async () => {
    const { provider, filesystem, backupDocument } = nativeFixture()

    await provider.exportFile(new Blob(['{}']), 'diary backup?.json')

    expect(filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      path: 'gentle-diary/backups/diary-backup--' + OPERATION_A + '.json',
      directory: Directory.Data,
    }))
    expect(backupDocument.save).toHaveBeenCalledWith({
      fileName: 'diary-backup-.json',
      sourceFileName: 'diary-backup--' + OPERATION_A + '.json',
    })
  })

  it('propagates native cleanup warnings without deleting a successfully saved Data source', async () => {
    const cleanupWarning = '临时备份文件清理失败，将在稍后重试。'
    const { provider, filesystem } = nativeFixture({
      backupDocument: { save: vi.fn().mockResolvedValue({ canceled: false, cleanupWarning }) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME)).resolves.toEqual({
      method: 'document', fileName: FILE_NAME, canceled: false, cleanupWarning,
    })
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it.each(['save', 'share'])('uses unique source paths for repeated %s exports of the same public name', async method => {
    const operationId = vi.fn()
      .mockReturnValueOnce(OPERATION_A)
      .mockReturnValueOnce(OPERATION_B)
    const { provider, filesystem, backupDocument, share } = nativeFixture({ operationId })

    await provider.exportFile(new Blob(['snapshot-A']), FILE_NAME, { method })
    await provider.exportFile(new Blob(['snapshot-B']), FILE_NAME, { method })

    const directory = method === 'save' ? Directory.Data : Directory.Cache
    expect(filesystem.writeFile).toHaveBeenNthCalledWith(1, expect.objectContaining({
      path: PATH_A, directory, data: 'snapshot-A',
    }))
    expect(filesystem.writeFile).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: 'gentle-diary/backups/' + sourceName(OPERATION_B), directory, data: 'snapshot-B',
    }))
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
    if (method === 'save') {
      expect(backupDocument.save.mock.calls.map(([options]) => options.sourceFileName))
        .toEqual([SOURCE_A, sourceName(OPERATION_B)])
    } else {
      expect(share.share.mock.calls.map(([options]) => options.files[0]))
        .toEqual([
          fileUri(Directory.Cache, PATH_A),
          fileUri(Directory.Cache, 'gentle-diary/backups/' + sourceName(OPERATION_B)),
        ])
    }
  })

  it('defaults to different UUID source names for repeated exports', async () => {
    const { filesystem, share } = nativeFixture()
    const provider = new PlatformBackupFileProvider({
      isNativePlatform: () => true, filesystem, share,
    })

    await provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })
    await provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })

    const paths = filesystem.writeFile.mock.calls.map(([options]) => options.path)
    const pattern = /^gentle-diary\/backups\/gentle-diary-backup-2026-10-03-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i
    expect(paths).toHaveLength(2)
    paths.forEach(path => expect(path).toMatch(pattern))
    expect(paths[0]).not.toBe(paths[1])
  })

  it('rejects overlap before any filesystem mutation while share capability is pending', async () => {
    const capability = deferred()
    const { provider, filesystem, operationId, share, backupDocument } = nativeFixture({
      share: { canShare: vi.fn(() => capability.promise) },
    })
    const first = provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })

    await expect(provider.exportFile(new Blob(['second']), FILE_NAME))
      .rejects.toMatchObject({ code: 'BACKUP_BUSY' })

    expect(filesystem.readdir).not.toHaveBeenCalled()
    expect(filesystem.writeFile).not.toHaveBeenCalled()
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
    expect(operationId).not.toHaveBeenCalled()
    expect(backupDocument.save).not.toHaveBeenCalled()
    expect(share.canShare).toHaveBeenCalledTimes(1)
    capability.resolve({ value: true })
    await first
  })

  it('rejects save/share overlap while native owns the first source and releases the lock afterward', async () => {
    const saved = deferred()
    const operationId = vi.fn()
      .mockReturnValueOnce(OPERATION_A)
      .mockReturnValueOnce(OPERATION_B)
    const { provider, filesystem, backupDocument, share } = nativeFixture({
      operationId,
      backupDocument: { save: vi.fn(() => saved.promise) },
    })
    const first = provider.exportFile(new Blob(['snapshot-A']), FILE_NAME)
    await vi.waitFor(() => expect(backupDocument.save).toHaveBeenCalledTimes(1))

    await expect(provider.exportFile(new Blob(['snapshot-B']), FILE_NAME, { method: 'share' }))
      .rejects.toMatchObject({ code: 'BACKUP_BUSY' })

    expect(filesystem.writeFile).toHaveBeenCalledTimes(1)
    expect(filesystem.readdir).not.toHaveBeenCalled()
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
    expect(operationId).toHaveBeenCalledTimes(1)
    expect(share.canShare).not.toHaveBeenCalled()
    saved.resolve({ canceled: false })
    await first
    await expect(provider.exportFile(new Blob(['snapshot-B']), FILE_NAME, { method: 'share' }))
      .resolves.toEqual({ method: 'share', fileName: FILE_NAME })
  })

  it('cleans only its unaccepted Data source on native BACKUP_BUSY and preserves the error if cleanup fails', async () => {
    const error = Object.assign(new Error('native operation active'), { code: 'BACKUP_BUSY' })
    const operationId = vi.fn()
      .mockReturnValueOnce(OPERATION_A)
      .mockReturnValueOnce(OPERATION_B)
    const { provider, filesystem } = nativeFixture({
      operationId,
      filesystem: { deleteFile: vi.fn().mockRejectedValue(new Error('cleanup failed')) },
      backupDocument: {
        save: vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({ canceled: false }),
      },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME)).rejects.toBe(error)

    expect(filesystem.deleteFile).toHaveBeenCalledExactlyOnceWith({
      path: PATH_A, directory: Directory.Data,
    })
    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME))
      .resolves.toEqual({ method: 'document', fileName: FILE_NAME, canceled: false })
    expect(filesystem.deleteFile).toHaveBeenCalledTimes(1)
  })

  it('preserves an accepted native failure and leaves its source available for native recovery', async () => {
    const error = new Error('document provider unavailable')
    const { provider, filesystem, backupDocument } = nativeFixture({
      backupDocument: { save: vi.fn().mockRejectedValue(error) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME)).rejects.toBe(error)

    expect(filesystem.deleteFile).not.toHaveBeenCalled()
    expect(backupDocument.getRecoveryStatus).not.toHaveBeenCalled()
  })

  it('rejects an indeterminate save response without deleting a potentially recoverable source', async () => {
    const { provider, filesystem } = nativeFixture({
      backupDocument: { save: vi.fn().mockResolvedValue({}) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME))
      .rejects.toThrow('系统未确认备份写入')
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it.each(['save', 'share'])('cleans a failed %s staging write without replacing its original error', async method => {
    const error = new Error('partial write: disk full')
    const { provider, filesystem, share, backupDocument } = nativeFixture({
      filesystem: {
        writeFile: vi.fn().mockRejectedValue(error),
        deleteFile: vi.fn().mockRejectedValue(new Error('cleanup failed')),
      },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method })).rejects.toBe(error)

    expect(filesystem.deleteFile).toHaveBeenCalledExactlyOnceWith({
      path: PATH_A, directory: method === 'save' ? Directory.Data : Directory.Cache,
    })
    expect(backupDocument.save).not.toHaveBeenCalled()
    expect(share.share).not.toHaveBeenCalled()
    filesystem.writeFile.mockImplementation(async ({ path, directory }) => ({ uri: fileUri(directory, path) }))
    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method })).resolves.toBeDefined()
  })

  it('shares a unique Cache URI and retains the successful source', async () => {
    const { provider, filesystem, share } = nativeFixture()

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' }))
      .resolves.toEqual({ method: 'share', fileName: FILE_NAME })

    expect(filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      path: PATH_A, directory: Directory.Cache,
    }))
    expect(share.share).toHaveBeenCalledWith(expect.objectContaining({
      files: [fileUri(Directory.Cache, PATH_A)],
    }))
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it('retains the source after reported share cancellation for a recipient that may still read it', async () => {
    const { provider, filesystem } = nativeFixture({
      share: { share: vi.fn().mockRejectedValue(new Error('Share canceled')) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' }))
      .resolves.toEqual({ method: 'share', fileName: FILE_NAME, canceled: true })

    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it('cleans a failed share source without masking the original delivery error', async () => {
    const error = new Error('share failed')
    const { provider, filesystem } = nativeFixture({
      share: { share: vi.fn().mockRejectedValue(error) },
      filesystem: { deleteFile: vi.fn().mockRejectedValue(new Error('cleanup failed')) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })).rejects.toBe(error)

    expect(filesystem.deleteFile).toHaveBeenCalledExactlyOnceWith({
      path: PATH_A, directory: Directory.Cache,
    })
  })

  it('fails before staging when sharing is unavailable and unlocks for the next attempt', async () => {
    const { provider, filesystem, share } = nativeFixture({
      share: { canShare: vi.fn().mockResolvedValueOnce({ value: false }).mockResolvedValue({ value: true }) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' }))
      .rejects.toThrow('当前设备无法打开系统分享面板')
    expect(filesystem.writeFile).not.toHaveBeenCalled()
    expect(filesystem.readdir).not.toHaveBeenCalled()
    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })).resolves.toBeDefined()
    expect(share.share).toHaveBeenCalledTimes(1)
  })

  it('prunes only generated Cache files strictly older than 24 hours and keeps unknown timestamps', async () => {
    const old = { name: sourceName(OPERATION_B), mtime: NOW - DAY_MS - 1, type: 'file' }
    const metadata = [
      { name: sourceName(testId(3)), mtime: NOW - DAY_MS },
      { name: sourceName(testId(4)), mtime: NOW - DAY_MS + 1 },
      { name: sourceName(testId(5)), mtime: NOW + 1 },
      { name: sourceName(testId(6)) },
      { name: sourceName(testId(7)), mtime: null },
      { name: sourceName(testId(8)), mtime: 0 },
      { name: sourceName(testId(9)), mtime: NaN },
      { name: sourceName(testId(10)), mtime: Infinity },
      { name: sourceName(testId(11)), mtime: String(NOW - DAY_MS - 1) },
      { name: sourceName(testId(12)), mtime: NOW - DAY_MS - 1, type: 'directory' },
      { name: 'unrelated.json', mtime: NOW - DAY_MS - 1 },
      { name: '../' + SOURCE_A, mtime: NOW - DAY_MS - 1 },
      SOURCE_A,
      null,
    ]
    const { provider, filesystem } = nativeFixture({
      filesystem: { readdir: vi.fn().mockResolvedValue({ files: [old, ...metadata] }) },
    })

    await provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })

    expect(filesystem.readdir).toHaveBeenCalledExactlyOnceWith({
      path: 'gentle-diary/backups', directory: Directory.Cache,
    })
    expect(filesystem.deleteFile).toHaveBeenCalledExactlyOnceWith({
      path: 'gentle-diary/backups/' + old.name, directory: Directory.Cache,
    })
  })

  it.each([false, true])('preserves the share outcome and continues pruning when cleanup throws (canceled=%s)', async canceled => {
    const oldNames = [sourceName(OPERATION_B), sourceName(testId(3))]
    const { provider, filesystem } = nativeFixture({
      filesystem: {
        readdir: vi.fn().mockResolvedValue({
          files: oldNames.map(name => ({ name, mtime: NOW - DAY_MS - 1 })),
        }),
        deleteFile: vi.fn().mockRejectedValueOnce(new Error('cleanup denied')).mockResolvedValue(undefined),
      },
      share: { share: canceled ? vi.fn().mockRejectedValue(new Error('Share cancelled')) : vi.fn().mockResolvedValue({}) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' }))
      .resolves.toEqual(canceled
        ? { method: 'share', fileName: FILE_NAME, canceled: true }
        : { method: 'share', fileName: FILE_NAME })

    expect(filesystem.deleteFile.mock.calls).toEqual(oldNames.map(name => [{
      path: 'gentle-diary/backups/' + name, directory: Directory.Cache,
    }]))
  })

  it('preserves share success when cache listing fails', async () => {
    const { provider, filesystem } = nativeFixture({
      filesystem: { readdir: vi.fn().mockRejectedValue(new Error('cache inaccessible')) },
    })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' }))
      .resolves.toEqual({ method: 'share', fileName: FILE_NAME })
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it('keeps cached sources when the clock is unknown', async () => {
    const { provider, filesystem } = nativeFixture({ clock: () => NaN })

    await provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })

    expect(filesystem.readdir).not.toHaveBeenCalled()
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it('rejects an unsafe injected operation ID before filesystem mutations and unlocks', async () => {
    const operationId = vi.fn().mockReturnValueOnce('../unsafe').mockReturnValueOnce(OPERATION_A)
    const { provider, filesystem } = nativeFixture({ operationId })

    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' }))
      .rejects.toThrow('备份操作标识无效')
    expect(filesystem.readdir).not.toHaveBeenCalled()
    expect(filesystem.writeFile).not.toHaveBeenCalled()
    await expect(provider.exportFile(new Blob(['{}']), FILE_NAME, { method: 'share' })).resolves.toBeDefined()
  })

  it.each(['idle', 'choosing', 'copying', 'saved', 'failed'])('exposes native recovery state %s without filesystem mutations', async state => {
    const status = { state, message: 'native recovery detail' }
    const { provider, filesystem, backupDocument } = nativeFixture({
      backupDocument: { getRecoveryStatus: vi.fn().mockResolvedValue(status) },
    })

    await expect(provider.getRecoveryStatus()).resolves.toBe(status)

    expect(backupDocument.getRecoveryStatus).toHaveBeenCalledTimes(1)
    expect(filesystem.writeFile).not.toHaveBeenCalled()
    expect(filesystem.readdir).not.toHaveBeenCalled()
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it('returns idle recovery status on web without calling native', async () => {
    const backupDocument = { getRecoveryStatus: vi.fn() }
    const provider = new PlatformBackupFileProvider({
      isNativePlatform: () => false, backupDocument,
    })

    await expect(provider.getRecoveryStatus()).resolves.toEqual({ state: 'idle' })

    expect(backupDocument.getRecoveryStatus).not.toHaveBeenCalled()
  })

  it('propagates recovery-status errors instead of reporting idle', async () => {
    const error = new Error('native status unavailable')
    const { provider } = nativeFixture({
      backupDocument: { getRecoveryStatus: vi.fn().mockRejectedValue(error) },
    })

    await expect(provider.getRecoveryStatus()).rejects.toBe(error)
  })
})

function nativeFixture(overrides = {}) {
  const filesystem = {
    readdir: vi.fn().mockResolvedValue({ files: [] }),
    writeFile: vi.fn(async ({ path, directory }) => ({ uri: fileUri(directory, path) })),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    ...overrides.filesystem,
  }
  const share = {
    canShare: vi.fn().mockResolvedValue({ value: true }),
    share: vi.fn().mockResolvedValue({ activityType: '' }),
    ...overrides.share,
  }
  const backupDocument = {
    save: vi.fn().mockResolvedValue({ canceled: false }),
    getRecoveryStatus: vi.fn().mockResolvedValue({ state: 'idle' }),
    ...overrides.backupDocument,
  }
  const operationId = overrides.operationId ?? vi.fn(() => OPERATION_A)
  const provider = new PlatformBackupFileProvider({
    isNativePlatform: () => true,
    getPlatform: overrides.getPlatform ?? (() => 'android'),
    filesystem,
    share,
    backupDocument,
    operationId,
    clock: overrides.clock ?? (() => NOW),
  })
  return { provider, filesystem, share, backupDocument, operationId }
}

function sourceName(operationId) {
  return FILE_NAME.replace(/\.json$/, '') + '-' + operationId + '.json'
}

function testId(number) {
  return '00000000-0000-4000-8000-' + String(number).padStart(12, '0')
}

function fileUri(directory, path) {
  return 'file:///' + directory + '/' + path
}

function deferred() {
  let resolve
  const promise = new Promise(settle => { resolve = settle })
  return { promise, resolve }
}
