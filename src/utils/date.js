const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

/**
 * 将 Date 转成符合本地时区的 YYYY-MM-DD。
 * @param {Date} [date]
 * @returns {string}
 */
export function toDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 将 YYYY-MM-DD 转成本地时区的 Date。
 * @param {string} dateKey
 * @returns {Date}
 */
export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** @param {string} dateKey */
export function formatTodayHeading(dateKey) {
  const date = parseDateKey(dateKey)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

/** @param {string} dateKey */
export function formatMonthHeading(dateKey) {
  const date = parseDateKey(dateKey)
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

/** @param {string} dateKey */
export function formatDayNumber(dateKey) {
  return String(parseDateKey(dateKey).getDate())
}

/** @param {string} dateKey */
export function formatWeekday(dateKey) {
  return WEEKDAYS[parseDateKey(dateKey).getDay()]
}

/**
 * @param {string | null | undefined} isoValue
 * @returns {string}
 */
export function formatTime(isoValue) {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * @param {string} isoValue
 * @returns {string}
 */
export function formatDeletedTime(isoValue) {
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(isoValue)} 删除`
}
