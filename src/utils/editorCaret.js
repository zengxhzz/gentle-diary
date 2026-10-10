/** Reveal the caret line, not the center of a potentially very long paragraph. */
export function revealEditorCaret(editor, selection, container, visibleHeight) {
  if (!editor?.isConnected || !container || !selection?.rangeCount
    || !editor.contains(selection.anchorNode)) return false

  const range = selection.getRangeAt(0).cloneRange()
  range.collapse(true)
  const caret = range.getBoundingClientRect()
  if (!Number.isFinite(caret.top) || !Number.isFinite(caret.height) || caret.height <= 0) {
    editor.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    return false
  }

  const bounds = container.getBoundingClientRect()
  const height = Math.min(container.clientHeight, visibleHeight)
  if (!Number.isFinite(height) || height <= 0) return false
  const margin = Math.min(12, height / 4)
  const bottom = caret.top + caret.height
  if (caret.top >= bounds.top + margin && bottom <= bounds.top + height - margin) return true

  container.scrollTop = Math.max(0, container.scrollTop + caret.top - bounds.top - (height - caret.height) / 2)
  return true
}
