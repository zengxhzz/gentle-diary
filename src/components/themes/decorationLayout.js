/** UI 展示约束，不读写设置、日记或底层存储。 */
export const MAX_DECORATION_SIZE = 64
export const MAX_DECORATION_VIEWPORT_PERCENT = 18

/** 所有主题共用左下角锚点，不随素材切换改变位置。 */
export function getDecorationStyle(decoration = {}) {
  const requested = Number(decoration.size)
  const size = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, MAX_DECORATION_SIZE)
    : MAX_DECORATION_SIZE
  const boundedSize = `min(${size}px, ${MAX_DECORATION_VIEWPORT_PERCENT}vw)`

  return {
    left: 'max(var(--page-gutter), calc((100vw - var(--page-width)) / 2 + var(--page-gutter)))',
    bottom: 'calc(var(--safe-bottom) + 1.5rem)',
    width: boundedSize,
    height: boundedSize,
  }
}
