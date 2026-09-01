// Lọc · tìm · sắp xếp danh sách thành viên. Thuần: (db, rows, …) => rows mới, không setState,
// không gọi mạng. Màn Members chỉ giữ `filter` / `sort` trong useState rồi gọi xuống đây.
//
// Ở đây vì hai lý do, không phải để gom cho đẹp:
//   1. thứ tự trình độ và trạng thái quỹ là LUẬT của CLB, sai là đọc sai bảng — phải test được;
//   2. cột "Quỹ tháng" và bộ lọc "trạng thái đóng" phải đọc CÙNG một hàm, không thì lọc
//      "Chưa đóng" ra một tập, còn cột lại tô màu theo tập khác.

import { dueState, rosterStatus } from '#lib/money.js'
// Cùng phép chuẩn hoá với lúc đọc tiêu đề CSV: bỏ dấu, bỏ khoảng trắng, hạ chữ thường.
// "Thuy" tìm ra "Thúy", "0327 279 292" tìm ra "0327279292". Đừng viết lại phép này lần hai.
import { normHeader as norm } from '#lib/csv.js'

/** Không lọc gì. Màn hình dùng làm state khởi tạo và để biết khi nào hiện nút xoá lọc. */
export const FILTER0 = { q: '', gender: '', level: '', group: '', dues: '' }

export const hasFilter = (f) => Object.keys(FILTER0).some((k) => f[k])

/** Nhóm cố định của một người trong tháng — theo roster của THÁNG đó, không theo `groupIds`. */
export const fixedGroups = (db, mid, month) =>
  (db.groups || []).filter((g) => rosterStatus(db, month, g.id, mid) === 'fixed')

/**
 * Trạng thái quỹ tháng: 'none' chưa sinh khoản nào · 'unpaid' còn thiếu · 'paid' đủ.
 * 'none' KHÁC 'paid' — chưa chốt danh sách nên chưa có gì để thu, không phải đã thu xong.
 */
export function duesStatusOf(db, mid, month) {
  const mine = (db.dues || []).filter((x) => x.month === month && x.memberId === mid)
  if (!mine.length) return 'none'
  return mine.some((x) => dueState(x).remain > 0) ? 'unpaid' : 'paid'
}

/**
 * `f.group`: id một nhóm · 'none' = đi lẻ (không cố định nhóm nào) · '' = không lọc.
 * `f.dues`: paid | unpaid | none | ''. `f.q` tìm trong tên VÀ số điện thoại.
 */
export function filterMembers(db, rows, f, month) {
  const q = norm(f.q)
  return rows.filter((m) => {
    if (q && norm(m.name).indexOf(q) < 0 && norm(m.phone).indexOf(q) < 0) return false
    if (f.gender && m.gender !== f.gender) return false
    if (f.level && m.level !== f.level) return false
    if (f.dues && duesStatusOf(db, m.id, month) !== f.dues) return false
    if (f.group) {
      const gs = fixedGroups(db, m.id, month)
      if (f.group === 'none' ? gs.length > 0 : !gs.some((g) => g.id === f.group)) return false
    }
    return true
  })
}

// Chưa đóng lên trước: sắp xếp cột quỹ tháng là để đi đòi tiền, không phải để ngắm.
const DUES_ORDER = { unpaid: 0, none: 1, paid: 2 }

/**
 * Khoá so sánh của từng cột — `key` trùng `key` của cột trong DataTable.
 *
 * Trình độ so theo VỊ TRÍ trong `db.levels` (thang mạnh dần của từng CLB), không so chữ cái:
 * theo alphabet thì 'TB+' đứng trước 'TBY', nhưng trong thang thật 'TB+' mạnh hơn — sắp theo
 * chữ cái là bảng xếp hạng trình độ sai, và người đọc không có cách nào biết.
 */
const KEY = {
  n: (db, m) => norm(m.name),
  g: (db, m) => (m.gender === 'nu' ? 1 : 0),
  l: (db, m) => (db.levels || []).indexOf(m.level),
  p: (db, m) => norm(m.phone),
  gr: (db, m, month) => fixedGroups(db, m.id, month).map((g) => g.short || g.name).join(','),
  d: (db, m, month) => DUES_ORDER[duesStatusOf(db, m.id, month)],
}

export const SORTABLE = Object.keys(KEY)

/** `sort` = { key, dir: 'asc' | 'desc' }. Key lạ hoặc rỗng → giữ nguyên thứ tự gốc. */
export function sortMembers(db, rows, sort, month) {
  const get = KEY[(sort || {}).key]
  if (!get) return rows
  const dir = sort.dir === 'desc' ? -1 : 1
  return rows.slice().sort((a, b) => {
    const x = get(db, a, month)
    const y = get(db, b, month)
    if (x === y) return 0
    return (x > y ? 1 : -1) * dir
  })
}

/** Bấm lại cột đang sắp → đảo chiều; bấm cột khác → xuôi từ đầu. */
export const nextSort = (sort, key) =>
  ((sort || {}).key === key && sort.dir === 'asc' ? { key, dir: 'desc' } : { key, dir: 'asc' })
