import { describe, expect, it } from 'vitest'
import { isWritingViewportCompressed, resolveStableViewport, shouldRevealFocusedEditor } from '@/utils/stableViewport.js'

describe('stable writing viewport', () => {
  const portrait = { width: 360, height: 730 }

  it('freezes height when an editable is focused and a same-width keyboard opens', () => {
    expect(resolveStableViewport(portrait, { width: 360, height: 448 }, true)).toBe(portrait)
  })

  it('updates orientation even while the editable remains focused after keyboard dismissal', () => {
    expect(resolveStableViewport(portrait, { width: 762, height: 328 }, true))
      .toEqual({ width: 762, height: 328 })
  })

  it('recovers full height after rotating with the keyboard still open', () => {
    const landscapeKeyboard = resolveStableViewport(portrait, { width: 762, height: 180 }, true)
    expect(resolveStableViewport(landscapeKeyboard, { width: 762, height: 328 }, true))
      .toEqual({ width: 762, height: 328 })
  })

  it('supports returning to portrait with focus retained', () => {
    expect(resolveStableViewport({ width: 762, height: 328 }, portrait, true)).toEqual(portrait)
  })

  it('allows viewport shrinkage outside text editing', () => {
    expect(resolveStableViewport(portrait, { width: 360, height: 680 }, false))
      .toEqual({ width: 360, height: 680 })
  })

  it('reveals the focused editor after orientation changes', () => {
    expect(shouldRevealFocusedEditor(portrait, { width: 762, height: 98 }, true)).toBe(true)
  })

  it('does not scroll on a same-width keyboard resize or without editor focus', () => {
    expect(shouldRevealFocusedEditor(portrait, { width: 360, height: 448 }, true)).toBe(false)
    expect(shouldRevealFocusedEditor(portrait, { width: 762, height: 328 }, false)).toBe(false)
  })

  it('accepts the later IME resize while rotation is settling', () => {
    const landscape = { width: 762, height: 328 }
    const keyboard = { width: 762, height: 98 }
    expect(resolveStableViewport(landscape, keyboard, true, true)).toEqual(keyboard)
    expect(shouldRevealFocusedEditor(landscape, keyboard, true, true)).toBe(true)
    expect(resolveStableViewport(landscape, keyboard, true, false)).toBe(landscape)
  })

  it.each([
    { width: 0, height: 730 },
    { width: 360, height: 0 },
    { width: NaN, height: 730 },
    { width: 360, height: Infinity },
  ])('ignores invalid intermediate dimensions (%o)', (current) => {
    expect(resolveStableViewport(portrait, current, true)).toBe(portrait)
  })

  it('hides decoration during keyboard-sized shrinkage and restores after dismissal', () => {
    expect(isWritingViewportCompressed(730, 448)).toBe(true)
    expect(isWritingViewportCompressed(730, 730)).toBe(false)
  })

  it('does not treat small chrome/inset changes as a keyboard', () => {
    expect(isWritingViewportCompressed(730, 680)).toBe(false)
    expect(isWritingViewportCompressed(730, 650)).toBe(true)
  })

  it.each([[730, 0], [NaN, 448]])('ignores invalid keyboard dimensions (%s, %s)', (stable, visible) => {
    expect(isWritingViewportCompressed(stable, visible)).toBe(false)
  })
})
