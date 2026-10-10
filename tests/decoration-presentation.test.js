import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, it } from 'vitest'
import DecorationScene from '@/components/themes/DecorationScene.vue'
import ThemeSwatch from '@/components/themes/ThemeSwatch.vue'
import { getDecorationStyle } from '@/components/themes/decorationLayout.js'
import { decorationThemes, getDecorationThemeById } from '@/services/theme/decorationThemes.js'
import { DEFAULT_THEME_SETTINGS } from '@/models/Theme.js'

const themeIds = ['cloud', 'plant', 'cat', 'paper-plane', 'moon', 'geometry']

// Read alpha without an image-library dependency. PNG scanlines use lossless filters.
function inspectPng(png) {
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  const chunks = []
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset)
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      chunks.push(png.subarray(offset + 8, offset + 8 + length))
    }
    offset += length + 12
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * 4
  let previous = Buffer.alloc(stride)
  let transparent = 0
  let visible = 0
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    if (filter > 4) throw new Error('Invalid PNG scanline filter')
    const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? row[x - 4] : 0
      const above = previous[x]
      const corner = x >= 4 ? previous[x - 4] : 0
      let predictor = 0
      if (filter === 1) predictor = left
      if (filter === 2) predictor = above
      if (filter === 3) predictor = Math.floor((left + above) / 2)
      if (filter === 4) predictor = paeth(left, above, corner)
      row[x] = (row[x] + predictor) & 255
      if (x % 4 === 3) {
        if (row[x] === 0) transparent += 1
        else visible += 1
      }
    }
    previous = row
  }
  return { width, height, transparent, visible }
}

describe('轻描纸印 theme presentation', () => {
  it('keeps existing IDs and defaults compatible with saved theme settings', () => {
    expect(decorationThemes.map((theme) => theme.id)).toEqual(themeIds)
    expect(DEFAULT_THEME_SETTINGS.enabledThemes).toEqual(themeIds)
    expect(getDecorationThemeById('unknown').id).toBe('cloud')
    for (const theme of decorationThemes) {
      expect(getDecorationThemeById(theme.id)).toBe(theme)
      expect(theme.styleVariant).toBe('light-paper')
      expect(theme.palette).toEqual({ accent: '#9EA99C', soft: '#E5E9DE', warm: '#D9C8AC' })
      expect(theme.decorations).toHaveLength(1)
      expect(theme.decorations[0].size).toBe(64)
      expect(theme.decorations[0].image).toContain(`${theme.id}.png`)
      expect(theme.decorations[0].svg).toBeUndefined()
    }
  })

  it('anchors every theme at the same safe lower-left corner with a bounded size', () => {
    const styles = decorationThemes.map((theme) => getDecorationStyle(theme.decorations[0]))
    for (const style of styles) {
      expect(style).toEqual(styles[0])
      expect(style.width).toBe('min(64px, 18vw)')
      expect(style.height).toBe(style.width)
      expect(style.left).toContain('var(--page-gutter)')
      expect(style.bottom).toBe('calc(var(--safe-bottom) + 1.5rem)')
      expect(style.right).toBeUndefined()
      expect(style.top).toBeUndefined()
    }
  })

  it.each([undefined, null, -1, 0, NaN, Infinity, 'large', 1000])(
    'does not permit invalid or oversized dimensions (%s)', (size) => {
      expect(getDecorationStyle({ size, position: { top: '1%', right: '1%' } }).width)
        .toBe('min(64px, 18vw)')
    },
  )

  it('allows a smaller decoration without enlarging it', () => {
    expect(getDecorationStyle({ size: 48 }).width).toBe('min(48px, 18vw)')
  })

  it.each(themeIds)('ships actual transparent pixels and visible artwork for %s', (id) => {
    const png = readFileSync(resolve('src/assets/themes/light-paper', `${id}.png`))
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png[24]).toBe(8)
    expect(png[25]).toBe(6) // RGBA, not an opaque paper-colored rectangle.
    expect(png[28]).toBe(0) // Non-interlaced.
    const image = inspectPng(png)
    expect(image.width).toBeGreaterThanOrEqual(128)
    expect(image.height).toBeGreaterThanOrEqual(128)
    expect(image.transparent).toBeGreaterThan(image.width * image.height * 0.1)
    expect(image.visible).toBeGreaterThan(image.width * image.height * 0.001)
  })

  it.each(themeIds)('renders matching noninteractive artwork in scene and swatch for %s', async (id) => {
    const theme = getDecorationThemeById(id)
    const scene = await renderToString(createSSRApp(DecorationScene, { theme }))
    const swatch = await renderToString(createSSRApp(ThemeSwatch, { theme, selected: true }))
    for (const html of [scene, swatch]) {
      expect(html.match(/<img\b/g)).toHaveLength(1)
      expect(html).toContain(theme.decorations[0].image)
      expect(html).toContain('alt=""')
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('draggable="false"')
      expect(html).not.toContain('<svg')
      expect(html).not.toContain('<button')
    }
    expect(scene).toContain('width:min(64px, 18vw)')
    expect(swatch).toContain(theme.name)
    expect(swatch).toContain('已选')
  })

  it('renders no decoration scene until a theme is available', async () => {
    expect(await renderToString(createSSRApp(DecorationScene))).not.toContain('<img')
  })
})
