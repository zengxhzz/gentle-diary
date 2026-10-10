import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserMediaProvider } from '@/providers/media/BrowserMediaProvider.js'

let input

beforeEach(() => {
  input = Object.assign(new EventTarget(), {
    style: {}, files: [],
    setAttribute: vi.fn(), remove: vi.fn(), click: vi.fn(),
  })
  vi.stubGlobal('document', {
    createElement: vi.fn(() => input),
    body: { appendChild: vi.fn() },
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('BrowserMediaProvider file picker', () => {
  it('settles cancellation and removes the hidden input so adding an image can be retried', async () => {
    const pending = new BrowserMediaProvider().pickImage()
    input.dispatchEvent(new Event('cancel'))
    await expect(pending).resolves.toBeNull()
    expect(input.remove).toHaveBeenCalledOnce()
  })

  it('returns the chosen file and removes the input', async () => {
    const file = new Blob(['image'], { type: 'image/png' })
    const pending = new BrowserMediaProvider().openFilePicker('gallery')
    input.files = [file]
    input.dispatchEvent(new Event('change'))
    await expect(pending).resolves.toBe(file)
    expect(input.accept).toBe('image/*')
    expect(input.remove).toHaveBeenCalledOnce()
  })

  it('handles an empty file selection without creating an attachment', async () => {
    const pending = new BrowserMediaProvider().openFilePicker('camera')
    input.dispatchEvent(new Event('change'))
    await expect(pending).resolves.toBeNull()
    expect(input.capture).toBe('environment')
  })

  it('rejects file picker errors and removes its input', async () => {
    const pending = new BrowserMediaProvider().openFilePicker('gallery')
    input.dispatchEvent(new Event('error'))
    await expect(pending).rejects.toThrow('无法读取图片')
    expect(input.remove).toHaveBeenCalledOnce()
  })

  it('cleans up if opening the system picker throws synchronously', async () => {
    input.click.mockImplementation(() => { throw new Error('picker unavailable') })
    await expect(new BrowserMediaProvider().openFilePicker('gallery'))
      .rejects.toThrow('picker unavailable')
    expect(input.remove).toHaveBeenCalledOnce()
  })
})
