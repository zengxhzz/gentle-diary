import { describe, expect, it, vi } from 'vitest'
import { revealEditorCaret } from '@/utils/editorCaret.js'

function fixture(top = 600, height = 60) {
  const range = { cloneRange: null, collapse: vi.fn(), getBoundingClientRect: () => ({ top, height }) }
  range.cloneRange = () => range
  const editor = { isConnected: true, contains: () => true, scrollIntoView: vi.fn() }
  const selection = { rangeCount: 1, anchorNode: {}, getRangeAt: () => range }
  const container = { scrollTop: 400, clientHeight: 328, getBoundingClientRect: () => ({ top: 32 }) }
  return { editor, selection, container, range }
}

describe('editing caret visibility', () => {
  it('centers the actual caret line above a landscape IME, not the large paragraph', () => {
    const f = fixture()
    expect(revealEditorCaret(f.editor, f.selection, f.container, 98)).toBe(true)
    expect(f.container.scrollTop).toBe(949)
    expect(f.range.collapse).toHaveBeenCalledWith(true)
    expect(f.editor.scrollIntoView).not.toHaveBeenCalled()
  })

  it('does not scroll an already visible caret', () => {
    const f = fixture(48, 36)
    expect(revealEditorCaret(f.editor, f.selection, f.container, 98)).toBe(true)
    expect(f.container.scrollTop).toBe(400)
  })

  it('reveals a caret above the viewport and clamps negative scrolling', () => {
    const f = fixture(-1000, 36)
    revealEditorCaret(f.editor, f.selection, f.container, 98)
    expect(f.container.scrollTop).toBe(0)
  })

  it('uses nearest-element fallback for a zero-height empty caret range', () => {
    const f = fixture(0, 0)
    expect(revealEditorCaret(f.editor, f.selection, f.container, 98)).toBe(false)
    expect(f.editor.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })

  it('ignores disconnected editors and selections belonging to another element', () => {
    const f = fixture()
    f.editor.isConnected = false
    expect(revealEditorCaret(f.editor, f.selection, f.container, 98)).toBe(false)
    f.editor.isConnected = true
    f.editor.contains = () => false
    expect(revealEditorCaret(f.editor, f.selection, f.container, 98)).toBe(false)
    expect(f.container.scrollTop).toBe(400)
  })

  it('ignores missing selection or an unavailable viewport', () => {
    const f = fixture()
    expect(revealEditorCaret(f.editor, null, f.container, 98)).toBe(false)
    expect(revealEditorCaret(f.editor, f.selection, f.container, 0)).toBe(false)
  })
})
