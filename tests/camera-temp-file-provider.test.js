import { describe, expect, it, vi } from 'vitest'
import {
  CameraTempFileProvider,
  cameraTempFileName,
} from '@/providers/media/CameraTempFileProvider.js'

const photoName = 'JPEG_20261003_024124_4515601592634986521.jpg'
const photoUri = `file:///storage/emulated/0/Android/data/com.zhuanz1.diary.debug/files/Pictures/${photoName}`

function makeProvider(files, now = 1000000) {
  const filesystem = {
    readdir: vi.fn(async () => ({ files })),
    getUri: vi.fn(async () => ({ uri: photoUri })),
    deleteFile: vi.fn(async () => {}),
  }
  const capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    convertFileSrc: (uri) => `https://localhost/_capacitor_file_${uri}`,
  }
  return { provider: new CameraTempFileProvider(filesystem, capacitor, () => now), filesystem }
}

describe('CameraTempFileProvider', () => {
  it('only derives a deletable name from a camera-owned external Pictures path', () => {
    expect(cameraTempFileName({ path: photoUri })).toBe(photoName)
    expect(cameraTempFileName({ path: 'content://gallery/private.jpg' })).toBeNull()
    expect(cameraTempFileName({ path: 'file:///sdcard/DCIM/JPEG_20261003_024124_123.jpg' }))
      .toBeNull()
    expect(cameraTempFileName({ tempFileName: '../private.jpg' })).toBeNull()
  })

  it('recovers only a recent non-empty Camera output and deletes only that app-owned file', async () => {
    const { provider, filesystem } = makeProvider([
      { name: photoName, type: 'file', size: 100, mtime: 999000 },
      { name: 'JPEG_20261003_024124_123.jpg', type: 'file', size: 0, mtime: 999500 },
      { name: 'private.jpg', type: 'file', size: 100, mtime: 999900 },
    ])

    await expect(provider.recoverPhoto(998000)).resolves.toMatchObject({
      tempFileName: photoName, path: photoUri, format: 'jpeg',
    })
    expect(filesystem.getUri).toHaveBeenCalledWith({ path: `Pictures/${photoName}`, directory: 'EXTERNAL' })
    await provider.delete(photoName)
    await provider.delete('../private.jpg')
    expect(filesystem.deleteFile).toHaveBeenCalledTimes(1)
    expect(filesystem.deleteFile).toHaveBeenCalledWith({ path: `Pictures/${photoName}`, directory: 'EXTERNAL' })
  })

  it('removes zero-byte and older-than-24h camera temps while preserving recent recoverable photos', async () => {
    const now = 100000000
    const oldName = 'JPEG_20261001_024124_123.jpg'
    const emptyName = 'JPEG_20261003_024124_456.jpg'
    const { provider, filesystem } = makeProvider([
      { name: photoName, type: 'file', size: 100, mtime: now - 1000 },
      { name: oldName, type: 'file', size: 100, mtime: now - 90000000 },
      { name: emptyName, type: 'file', size: 0, mtime: now - 1000 },
    ], now)

    await provider.cleanupAbandoned()
    expect(filesystem.deleteFile.mock.calls.map(([options]) => options.path))
      .toEqual([`Pictures/${oldName}`, `Pictures/${emptyName}`])
  })
})
