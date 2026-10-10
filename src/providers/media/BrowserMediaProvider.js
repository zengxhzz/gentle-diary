import { MediaProvider } from './MediaProvider.js'

/**
 * 浏览器与 Capacitor WebView 可用的文件选择 Provider。
 * 后续可替换为 CapacitorCameraMediaProvider，而不修改 AttachmentService。
 */
export class BrowserMediaProvider extends MediaProvider {
  /**
   * @param {{ source?: 'gallery' | 'camera' }} [options]
   * @returns {Promise<null | {
   *   blob: Blob,
   *   fileName: string,
   *   mimeType: string,
   *   size: number,
   *   width: number | null,
   *   height: number | null
   * }>}
   */
  async pickImage(options = {}) {
    const file = await this.openFilePicker(options.source ?? 'gallery')
    if (!file) return null
    if (!file.type.startsWith('image/')) {
      throw new Error('请选择图片文件')
    }

    const dimensions = await readImageDimensions(file)
    return {
      blob: file,
      fileName: file.name,
      mimeType: file.type || 'image/*',
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
    }
  }

  /** @param {'gallery' | 'camera'} source */
  openFilePicker(source) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      if (source === 'camera') input.capture = 'environment'
      input.style.position = 'fixed'
      input.style.left = '-9999px'
      input.setAttribute('aria-hidden', 'true')

      const cleanup = () => input.remove()
      input.addEventListener('cancel', () => {
        cleanup()
        resolve(null)
      }, { once: true })
      input.addEventListener(
        'change',
        () => {
          const file = input.files?.[0] ?? null
          cleanup()
          resolve(file)
        },
        { once: true },
      )
      input.addEventListener(
        'error',
        () => {
          cleanup()
          reject(new Error('无法读取图片'))
        },
        { once: true },
      )

      try {
        document.body.appendChild(input)
        input.click()
      } catch (error) {
        cleanup()
        reject(error)
      }
    })
  }
}

export async function readImageDimensions(blob) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    const dimensions = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dimensions
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }
    image.onerror = () => {
      resolve({ width: null, height: null })
      URL.revokeObjectURL(url)
    }
    image.src = url
  })
}

