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

/** Chỉ giữ chữ số. SĐT "0327 279 292" và "0327279292" là cùng một số. */
export const digits = (x) => String(x || '').replace(/\D/g, '')

/* ==================== Ghép hồ sơ tài khoản vào bản ghi thành viên ==================== */

/**
 * Bốn trường có thể lấy từ hồ sơ TÀI KHOẢN (`profiles`) đè lên hồ sơ THÀNH VIÊN
 * (`club_members`) lúc chủ CLB duyệt ghép. Khớp đúng `p_fields` mà RPC `approve_join_request`
 * chấp nhận (`0009_profile_merge.sql`) — thêm trường ở một bên mà quên bên kia thì ô tick hiện
 * ra nhưng bấm xong không có gì đổi, và không ai biết vì sao.
 *
 * `role` KHÔNG có ở đây và sẽ không bao giờ có: vai trò là dữ liệu của CLB.
 */
export const MERGE_FIELDS = ['name', 'phone', 'gender', 'level']

/** Giá trị của một trường trong hồ sơ tài khoản. Tên hiển thị ưu tiên `nick` — cả app gọi nhau bằng nick. */
const userValue = (user, field) =>
  (field === 'name' ? user.nick || user.name : user[field]) || ''

/**
 * So từng trường giữa bản ghi thành viên và hồ sơ tài khoản → dữ liệu cho bảng chọn ghi đè.
 *
 * `block` là LÝ DO không cho tick, rỗng = ghép được:
 *   'empty'    hồ sơ tài khoản bỏ trống trường đó — ghi đè là xoá mất dữ liệu CLB đang có;
 *   'same'     hai bên đã giống nhau, tick cũng không đổi gì;
 *   'offScale' trình độ không thuộc thang của CLB này. Thang là dữ liệu RIÊNG từng CLB
 *              (RULES §3.4): lấy 'TB+' của CLB khác đè vào CLB chỉ có 4 bậc thì
 *              `levels.indexOf(level)` ra -1 — cột trình độ sắp sai, thuật toán cân sân đọc sai
 *              bậc, không màn nào lộ ra. RPC cũng bỏ qua trường này, hai bên phải cùng một luật.
 *
 * SĐT so theo chữ số: "0912 345 678" và "0912345678" là cùng một số, hỏi người duyệt có muốn
 * ghi đè hay không là hỏi thừa.
 */
export function mergeRows(member, user, levels) {
  const m = member || {}
  const u = user || {}
  return MERGE_FIELDS.map((field) => {
    const from = String(m[field] || '')
    const to = String(userValue(u, field))
    const same = field === 'phone'
      ? digits(from) === digits(to)
      : from.trim() === to.trim()
    let block = ''
    if (!to.trim()) block = 'empty'
    else if (same) block = 'same'
    else if (field === 'level' && (levels || []).indexOf(to) < 0) block = 'offScale'
    return { field, from, to, block }
  })
}

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
