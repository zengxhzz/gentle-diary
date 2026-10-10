/**
 * Freeze same-width keyboard shrinkage, not orientation changes or keyboard dismissal.
 * Android can leave contenteditable focused after the keyboard is hidden.
 * @param {{ width: number, height: number }} previous
 * @param {{ width: number, height: number }} current
 * @param {boolean} editableFocused
 * @param {boolean} orientationSettling Android may send several resize events during rotation.
 */
export function resolveStableViewport(previous, current, editableFocused = false, orientationSettling = false) {
  if (!Number.isFinite(current.width) || current.width <= 0
    || !Number.isFinite(current.height) || current.height <= 0) return previous

  if (editableFocused && !orientationSettling && current.width === previous.width
    && current.height < previous.height) return previous

  return { width: current.width, height: current.height }
}

/** Only a width/orientation change needs explicit caret reveal, not normal typing. */
export function shouldRevealFocusedEditor(previous, current, editableFocused, orientationSettling = false) {
  return editableFocused && (previous.width !== current.width || orientationSettling)
}

/** A keyboard-sized shrink must not bring decoration behind long text during native caret panning. */
export function isWritingViewportCompressed(stableHeight, visibleHeight) {
  return Number.isFinite(stableHeight) && Number.isFinite(visibleHeight)
    && stableHeight > 0 && visibleHeight > 0 && stableHeight - visibleHeight >= 80
}
