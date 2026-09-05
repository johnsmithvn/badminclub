// Ngày tháng — timezone Asia/Ho_Chi_Minh, buổi tập lưu 'YYYY-MM-DD', tháng lưu 'YYYY-MM'.
// Cắt chuỗi thay vì new Date() ở mọi chỗ có thể, để không bị lệch múi giờ.

import { t, tBranch } from '#i18n'

// Nhãn thứ lấy từ i18n, không viết cứng ở đây.
export const WD = tBranch('weekday').short
export const WD_FULL = tBranch('weekday').full

/** Thứ của một ngày ISO: 'CN' … 'T7' */
export const wd = (iso) => WD[new Date(iso + 'T00:00:00').getDay()]
/** Số thứ trong tuần: 0=CN … 6=T7 */
export const weekdayOf = (iso) => new Date(iso + 'T00:00:00').getDay()
/** '2026-08-16' → '16/08' */
export const dd = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7)
/** '2026-08-16' → '16/08/2026' */
export const ddmy = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)
/** '2026-08-16' → '2026-08' */
export const monthOf = (iso) => iso.slice(0, 7)
/** '2026-08' → 'Tháng 08/2026' */
export const monthTxt = (m) => t('monthPrefix') + ' ' + m.slice(5, 7) + '/' + m.slice(0, 4)
/** '2026-08' → '08/2026' */
export const monthShort = (m) => m.slice(5, 7) + '/' + m.slice(0, 4)

/** Cộng/trừ tháng: ('2026-08', 1) → '2026-09' */
export function addMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

/** Giờ thập phân giữa hai mốc: ('18:00','20:00') → 2 */
export function hours(from, to) {
  const p = from.split(':').map(Number)
  const q = to.split(':').map(Number)
  return ((q[0] * 60 + q[1]) - (p[0] * 60 + p[1])) / 60
}

const iso = (d) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

/** Mọi ngày trong [start,end] rơi vào các thứ đã chọn. Trần 400 ngày để không sinh vô hạn. */
export function genDates(weekdays, start, end) {
  if (!weekdays || !weekdays.length || !start) return []
  const out = []
  const s = new Date(start + 'T00:00:00')
  const e = new Date((end || start) + 'T00:00:00')
  for (const d = new Date(s); d <= e && out.length < 400; d.setDate(d.getDate() + 1)) {
    if (weekdays.indexOf(d.getDay()) >= 0) out.push(iso(d))
  }
  return out
}

/** Lưới 6×7 của một tháng, bắt đầu từ Chủ nhật — dùng cho màn Lịch tháng. */
export function monthGrid(month) {
  const [y, mo] = month.split('-').map(Number)
  const first = new Date(y, mo - 1, 1)
  const start = new Date(y, mo - 1, 1 - first.getDay())
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i)
      days.push({ iso: iso(d), day: d.getDate(), inMonth: d.getMonth() === mo - 1 })
    }
    weeks.push(days)
  }
  return weeks
}
