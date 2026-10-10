const DEFAULT_MAX_DIMENSION = 480
const DEFAULT_QUALITY = 0.78

/**
 * 生成列表使用的 JPEG 缩略图。无法解码的格式返回 null，原图仍可正常保存。
 * @param {Blob} blob
 * @param {{ maxDimension?: number, quality?: number }} [options]
 */
export async function createImageThumbnail(blob, options = {}) {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const quality = options.quality ?? DEFAULT_QUALITY
  const source = await loadImageSource(blob)
  if (!source) return null

  try {
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
    const width = Math.max(1, Math.round(source.width * scale))
    const height = Math.max(1, Math.round(source.height * scale))
    const canvas = createCanvas(width, height)
    if (!canvas) return null
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillStyle = '#f7f4ee'
    context.fillRect(0, 0, width, height)
    context.drawImage(source.image, 0, 0, width, height)
    return canvasToBlob(canvas, 'image/jpeg', quality)
  } finally {
    source.release()
  }
}

async function loadImageSource(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // 继续尝试 HTMLImageElement，兼容部分 WebView 图片格式。
    }
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      resolve({
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height)
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function canvasToBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality })
  }
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}
