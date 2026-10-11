import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const font = readFileSync(new URL('../src/assets/fonts/ChillRoundM.ttf', import.meta.url))

// Inspect the original TrueType cmap/loca/glyf, without a runtime dependency.
// Checking both mapping and outlines catches the old half-round font's blank glyphs.
function glyphOutline(character) {
  const tables = {}
  for (let index = 0; index < font.readUInt16BE(4); index++) {
    const entry = 12 + index * 16
    tables[font.toString('ascii', entry, entry + 4)] = font.readUInt32BE(entry + 8)
  }
  const cmap = tables.cmap
  let subtable
  for (let index = 0; index < font.readUInt16BE(cmap + 2); index++) {
    const entry = cmap + 4 + index * 8
    const offset = cmap + font.readUInt32BE(entry + 4)
    if (font.readUInt16BE(entry) === 3 && font.readUInt16BE(entry + 2) === 1 && font.readUInt16BE(offset) === 4) {
      subtable = offset
      break
    }
  }
  if (!subtable) throw new Error('Missing Unicode BMP cmap')
  const count = font.readUInt16BE(subtable + 6) / 2
  const ends = subtable + 14
  const starts = ends + count * 2 + 2
  const deltas = starts + count * 2
  const ranges = deltas + count * 2
  const code = character.codePointAt(0)
  let glyph = 0
  for (let index = 0; index < count; index++) {
    if (code < font.readUInt16BE(starts + index * 2) || code > font.readUInt16BE(ends + index * 2)) continue
    const delta = font.readInt16BE(deltas + index * 2)
    const range = font.readUInt16BE(ranges + index * 2)
    if (!range) glyph = (code + delta) & 0xffff
    else {
      const address = ranges + index * 2 + range + 2 * (code - font.readUInt16BE(starts + index * 2))
      glyph = font.readUInt16BE(address)
      if (glyph) glyph = (glyph + delta) & 0xffff
    }
    break
  }
  const longOffsets = font.readInt16BE(tables.head + 50) === 1
  const offset = longOffsets ? font.readUInt32BE(tables.loca + glyph * 4) : font.readUInt16BE(tables.loca + glyph * 2) * 2
  const next = longOffsets ? font.readUInt32BE(tables.loca + (glyph + 1) * 4) : font.readUInt16BE(tables.loca + (glyph + 1) * 2) * 2
  return { glyph, length: next - offset, contours: next > offset ? font.readInt16BE(tables.glyf + offset) : 0 }
}

describe('bundled diary typography', () => {
  it('ships the exact unmodified approved v1.805 font', () => {
    expect(font.length).toBe(6515060)
    expect(createHash('sha256').update(font).digest('hex')).toBe('a7d2fb200b7336cbf7171c2205b7e4d75fdcf11f936da8a8e645cb061e7f0024')
  })

  it('has nonblank glyphs for the Chinese preview and mixed input', () => {
    const sample = '今天的风很轻，阳光落在窗边。走回家的路上，买了一小束花。没有特别的事情发生，但心里觉得安稳。想把这些平凡的小事留下来，以后翻到这一页，还能记得今天的温柔。记录……123ABCabc'
    for (const character of new Set(sample)) {
      const outline = glyphOutline(character)
      expect(outline.glyph, character).toBeGreaterThan(0)
      expect(outline.length, character).toBeGreaterThan(0)
      expect(outline.contours, character).not.toBe(0)
    }
  })

  it('distributes the copyright, reserved names and full OFL notice', () => {
    const license = read('public/licenses/ChillRoundM-OFL.txt')
    expect(license).toContain('© 2023 ChillType')
    expect(license).toContain("'ChillRoundF' 'ChillRoundM'")
    expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1')
    expect(license).toContain('TERMINATION')
    expect(license).toContain('DISCLAIMER')
  })

  it('loads the font locally with a readable fallback and relative body size', () => {
    const css = read('src/styles/fonts.css')
    expect(css).toContain("url('../assets/fonts/ChillRoundM.ttf')")
    expect(css).toContain('font-display: swap')
    expect(css).not.toMatch(/https?:\/\//)
    expect(read('src/styles/base.css')).toContain("@import './fonts.css'")
    expect(read('src/styles/tokens.css')).toContain('--font-diary: "ChillRoundM", var(--font-sans)')
    expect(read('src/styles/tokens.css')).toContain('--text-diary: 1rem')
  })

  it.each(['editor/EditableParagraph', 'editor/DiaryTextEditor', 'diary/DiaryBlocks'])('keeps %s reading and writing at the same font and size', (component) => {
    const source = read(`src/components/${component}.vue`)
    expect(source).toContain('font-family: var(--font-diary)')
    expect(source).toContain('font-size: var(--text-diary)')
  })

  it('preserves date and control typography', () => {
    expect(read('src/styles/tokens.css')).toContain('--font-reading: "Noto Serif SC", "Songti SC", "STSong", serif')
    expect(read('src/views/Today/TodayView.vue')).not.toContain('var(--font-diary)')
    expect(read('src/components/common/AppActionSheet.vue')).not.toContain('var(--font-diary)')
  })

  it('uses the body font for timeline and draft excerpts without changing dates', () => {
    for (const path of ['src/components/diary/DiaryTimeline.vue', 'src/views/DiaryDetail/DraftsView.vue']) {
      const source = read(path)
      expect(source).toContain('font-family: var(--font-diary)')
      expect(source).toContain('font-family: var(--font-reading)')
    }
  })
})
