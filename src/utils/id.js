/**
 * 生成全局唯一 ID。
 * 优先使用 Web Crypto，保留回退方案以兼容旧 WebView。
 * @returns {string}
 */
export function createId(prefix = '') {
  const value =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return prefix ? `${prefix}-${value}` : value
}
