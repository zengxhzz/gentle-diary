import { beforeEach, describe, expect, it, vi } from 'vitest'

const filesystem = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  deleteFile: vi.fn(),
  readdir: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: filesystem,
}))

import { CapacitorFilesystemAttachmentProvider } from '@/providers/media/CapacitorFilesystemAttachmentProvider.js'

beforeEach(() => {
  vi.clearAllMocks()
  filesystem.mkdir.mockResolvedValue(undefined)
  filesystem.writeFile.mockResolvedValue({ uri: 'file://saved' })
  filesystem.deleteFile.mockResolvedValue(undefined)
})

function createContext() {
  const fallback = {
    getStorageUris: vi.fn((id) => ({
      localUri: `indexeddb://attachment/${id}`,
      thumbnailUri: `indexeddb://thumbnail/${id}`,
    })),
    save: vi.fn(async (attachment) => attachment),
    read: vi.fn(async (_attachment, variant) =>
      new Blob([variant === 'thumbnail' ? 'fallback-thumb' : 'fallback-original'], {
        type: variant === 'thumbnail' ? 'image/jpeg' : 'image/png',
      })),
    saveThumbnail: vi.fn(async (attachment) => attachment),
    delete: vi.fn(async () => undefined),
    cleanup: vi.fn(async () => undefined),
  }
  return { fallback, provider: new CapacitorFilesystemAttachmentProvider(fallback) }
}

const attachment = {
  id: 'attachment-1',
  localUri: 'filesystem://DATA/gentle-diary/attachments/attachment-1.bin',
  thumbnailUri: 'filesystem://DATA/gentle-diary/attachments/attachment-1.thumb',
  mimeType: 'image/png',
  thumbnailMimeType: 'image/jpeg',
}

describe('CapacitorFilesystemAttachmentProvider', () => {
  it('writes original and thumbnail to private Data storage after the IndexedDB fallback', async () => {
    const { fallback, provider } = createContext()
    const original = new Blob(['original'], { type: 'image/png' })
    const thumbnail = new Blob(['thumb'], { type: 'image/jpeg' })

    await provider.save(attachment, original, thumbnail)

    expect(fallback.save).toHaveBeenCalledWith(attachment, original, thumbnail)
    expect(filesystem.writeFile).toHaveBeenCalledTimes(2)
    expect(filesystem.writeFile.mock.calls[0][0]).toMatchObject({
      directory: 'DATA',
      path: 'gentle-diary/attachments/attachment-1.bin',
    })
  })

  it('reads native Base64 as a Blob and falls back to IndexedDB when the file is absent', async () => {
    const { fallback, provider } = createContext()
    filesystem.readFile.mockResolvedValueOnce({ data: btoa('native-image') })

    const nativeBlob = await provider.read(attachment, 'original')
    expect(await nativeBlob.text()).toBe('native-image')
    expect(nativeBlob.type).toBe('image/png')

    filesystem.readFile.mockRejectedValueOnce({ code: 'OS-PLUG-FILE-0008' })
    const fallbackBlob = await provider.read(attachment, 'thumbnail')
    expect(await fallbackBlob.text()).toBe('fallback-thumb')
    expect(fallback.read).toHaveBeenCalledWith(attachment, 'thumbnail')
  })

  it('deletes the canonical IndexedDB copy and both private mirror files', async () => {
    const { fallback, provider } = createContext()

    await provider.delete(attachment)

    expect(filesystem.deleteFile).toHaveBeenCalledTimes(2)
    expect(fallback.delete).toHaveBeenCalledWith(attachment)
  })

  it.each([
    ['original', '', 20],
    ['original', 'partial', 20],
    ['thumbnail', 'partial-thumb', 200],
  ])('falls back for an incomplete %s mirror', async (variant, contents, expectedSize) => {
    const { fallback, provider } = createContext()
    filesystem.readFile.mockResolvedValueOnce({ data: btoa(contents) })
    const metadata = {
      ...attachment,
      [variant === 'thumbnail' ? 'thumbnailSize' : 'size']: expectedSize,
    }

    const blob = await provider.read(metadata, variant)

    expect(await blob.text()).toBe(variant === 'thumbnail' ? 'fallback-thumb' : 'fallback-original')
    expect(fallback.read).toHaveBeenCalledWith(metadata, variant)
  })

  it('reads a complete mirror matching metadata without loading the canonical Blob', async () => {
    const { fallback, provider } = createContext()
    filesystem.readFile.mockResolvedValueOnce({ data: btoa('complete') })

    expect(await (await provider.read({ ...attachment, size: 8 })).text()).toBe('complete')
    expect(fallback.read).not.toHaveBeenCalled()
  })

  it('falls back to the canonical Blob for invalid Base64', async () => {
    const { fallback, provider } = createContext()
    filesystem.readFile.mockResolvedValueOnce({ data: 'not valid base64!' })

    expect(await (await provider.read(attachment)).text()).toBe('fallback-original')
    expect(fallback.read).toHaveBeenCalledWith(attachment, 'original')
  })

  it('deletes canonical data even when native mirror deletion fails', async () => {
    const { fallback, provider } = createContext()
    filesystem.deleteFile.mockRejectedValueOnce(new Error('disk busy'))

    await expect(provider.delete(attachment)).resolves.toBeUndefined()
    expect(fallback.delete).toHaveBeenCalledWith(attachment)
    expect(filesystem.deleteFile).toHaveBeenCalledTimes(2)
  })

  it('retains private mirror files when canonical deletion fails', async () => {
    const { fallback, provider } = createContext()
    fallback.delete.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(provider.delete(attachment)).rejects.toThrow('database unavailable')
    expect(filesystem.deleteFile).not.toHaveBeenCalled()
  })

  it('removes only unreferenced native mirror files', async () => {
    const { fallback, provider } = createContext()
    filesystem.readdir.mockResolvedValue({
      files: [
        { name: 'attachment-1.bin' },
        { name: 'attachment-1.thumb' },
        { name: 'orphan.bin' },
        { name: 'orphan.thumb' },
      ],
    })

    await provider.cleanup(['attachment-1'])

    expect(fallback.cleanup).toHaveBeenCalledWith(['attachment-1'])
    expect(filesystem.deleteFile).toHaveBeenCalledTimes(2)
    expect(filesystem.deleteFile.mock.calls.map(([options]) => options.path)).toEqual([
      'gentle-diary/attachments/orphan.bin',
      'gentle-diary/attachments/orphan.thumb',
    ])
  })
})
