// Công thức tiền — lấy nguyên từ prototype (handoff 04-cong-thuc-tien.md).
// Mọi số tiền là VND integer. CHỈ làm tròn khi hiển thị; ngoại lệ duy nhất được làm tròn
// khi lưu là đơn giá một buổi (unitPrice) — dùng để back tiền.
// Hàm ở đây thuần: nhận db (state) + tham số, không đụng React/Supabase.

import { hours, monthOf } from '#utils/dates.js'
import cfg from '#config/app.json' with { type: 'json' }
import { t } from '#i18n'

/** Thứ tự trình độ tăng dần MẶC ĐỊNH cho CLB mới. Mỗi CLB tự sửa được (clubs.levels),
 *  khi đó dùng db.levels — xem levelIdx. */
export const LEVELS = cfg.levelsDefault
export const SHUTTLE_UNIT_FALLBACK = cfg.money.shuttleUnitFallback // đ/quả khi chưa có đợt mua nào

/* ---------- hiển thị ---------- */

/** Làm tròn nghìn gần nhất, không có đơn vị: 1234567 → '1.235.000' */
export function fmtK(n) {
  const r = cfg.money.roundTo
  const v = Math.round((n || 0) / r) * r
  return (v < 0 ? '-' : '') + Math.abs(v).toLocaleString(cfg.locale + '-VN')
}
/** Như fmtK, thêm đuôi đơn vị tiền */
export const fmt = (n) => fmtK(n) + ' ' + t('units.dong')

/* ---------- tra cứu ---------- */

export const courtOf = (db, id) => db.courts.find((c) => c.id === id) || { name: t('common.unknown'), price: 0 }
export const memberOf = (db, id) => db.members.find((m) => m.id === id) || { name: t('common.unknown') }
export const guestOf = (db, id) => db.guests.find((g) => g.id === id) || { name: t('common.unknown') }
export const sessionOf = (db, id) => db.sessions.find((s) => s.id === id)

export function groupOf(db, id) {
  if (id === 'ALL') {
    return {
      id: 'ALL', name: t('group.allClub'), short: t('group.allClubShort'), courtIds: [],
      feeNam: 0, feeNu: 0, from: '18:00', to: '20:00', quota: cfg.shuttle.quotaDefault || 24,
    }
  }
  return db.groups.find((g) => g.id === id) ||
    { name: t('common.unknown'), short: '', courtIds: [], feeNam: 0, feeNu: 0, quota: 24 }
}

/** Vị trí trình độ trong thang của CLB (càng lớn càng mạnh). `levels` bỏ trống thì dùng mặc định. */
export const levelIdx = (l, levels) => Math.max(0, (levels && levels.length ? levels : LEVELS).indexOf(l))

/** Trình độ hiệu lực trong một tháng — tôn trọng thay đổi đang chờ áp dụng. */
export const levelOf = (m, month) =>
  m.pendingLevel && month >= m.pendingLevelFrom ? m.pendingLevel : m.level

/** Trạng thái cố định của một người trong nhóm ở một tháng: fixed | off | pending | none */
export function rosterStatus(db, month, gid, mid) {
  const r = (db.roster[month] || {})[gid]
  if (r) return r[mid] || 'none'
  const m = db.members.find((x) => x.id === mid)
  return m && (m.groupIds || []).indexOf(gid) >= 0 ? 'fixed' : 'none'
}

/** Thành viên cố định của một nhóm trong tháng — nguồn duy nhất để tính quỹ và điểm danh. */
export function groupMembers(db, gid, month) {
  if (gid === 'ALL') return db.members.filter((m) => m.active !== false)
  return db.members.filter((m) => m.active !== false && rosterStatus(db, month, gid, m.id) === 'fixed')
}

export const monthSessions = (db, m) =>
  db.sessions.filter((s) => monthOf(s.date) === m).sort((a, b) => (a.date < b.date ? -1 : 1))

/* ---------- tiền sân ---------- */

const rows = (s) => (s && s.courts) || []

export const rowCost = (db, c) => hours(c.from, c.to) * courtOf(db, c.courtId).price
/** Tổng tiền mọi dòng sân của buổi. */
export const courtCost = (db, s) => rows(s).reduce((t, c) => t + rowCost(db, c), 0)
/** Tiền các sân trong hoá đơn tháng (không thuê thêm). */
export const courtBase = (db, s) => rows(s).filter((c) => !c.extra).reduce((t, c) => t + rowCost(db, c), 0)
/** Tiền các sân thuê thêm ngoài hoá đơn tháng. */
export const courtExtraCost = (db, s) => rows(s).filter((c) => c.extra).reduce((t, c) => t + rowCost(db, c), 0)
/** Chi phí sân thực CLB gánh: bỏ các sân đã bán cho CLB khác. */
export const courtNet = (db, s) => rows(s).filter((c) => !c.sold).reduce((t, c) => t + rowCost(db, c), 0)
/** Tiền bán sân dư. */
export const soldTotal = (s) => rows(s).filter((c) => c.sold).reduce((t, c) => t + (c.soldAmount || 0), 0)
/** Số sân CLB thực chơi. */
export const playedCourts = (s) => rows(s).filter((c) => !c.sold).length
export const courtPayMode = (db) => db.club.courtPayMode || 'month'
export const billsOf = (db, month) => (db.courtBills || []).filter((b) => b.month === month)

export function courtTxt(db, s) {
  const n = rows(s).length
  if (!n) return t('session.noCourt')
  const names = rows(s).map((c) => {
    const nm = courtOf(db, c.courtId).name.replace(t('session.courtPrefix'), '')
    return nm + (c.sold ? ' ' + t('session.soldMark') : c.extra ? ' ' + t('session.extraMark') : '')
  })
  return n + ' ' + t('units.court') + ' · ' + names.join(', ')
}

export function timeTxt(s) {
  const c = rows(s)[0]
  return c ? c.from + ' → ' + c.to : '--:--'
}

/* ---------- tiền cầu ---------- */

/** Giá bình quân toàn kho (đ/quả) — không dùng giá tham chiếu của loại cầu. */
export function shuttleUnit(db) {
  const p = db.purchases.filter((x) => x.total > 0)
  const q = p.reduce((t, x) => t + x.qty, 0)
  const s = p.reduce((t, x) => t + x.total, 0)
  return q ? s / q : SHUTTLE_UNIT_FALLBACK
}

export function perTube(db, s) {
  const type = db.shuttleTypes.find((x) => x.id === ((s && s.shuttleTypeId) || db.shuttleTypes[0]?.id))
  return (type && type.perTube) || cfg.shuttle.perTubeDefault
}

/** Định mức cầu của buổi, giảm theo số sân CLB còn thực chơi. Sàn 6 quả. */
export function quotaFor(db, s) {
  const g = groupOf(db, s.groupId)
  const base = g.quota || 24
  const total = rows(s).filter((c) => !c.extra).length || (g.courtIds || []).length || 1
  return Math.max(cfg.shuttle.quotaMin, Math.round((base * (playedCourts(s) || 1)) / total))
}

export const shuttleCost = (db, s) => (s.shuttleUsed || 0) * shuttleUnit(db)
/** Chi phí thực của một buổi: sân CLB gánh + cầu. */
export const sessionCost = (db, s) => courtNet(db, s) + shuttleCost(db, s)

export function stock(db) {
  const bought = db.purchases.reduce((t, x) => t + x.qty, 0)
  const used = db.sessions.filter((s) => s.status === 'closed').reduce((t, s) => t + s.shuttleUsed, 0)
  return { bought, used, left: bought - used }
}

/** Buổi đã chốt còn lấy định mức — kiểm kho cuối tháng chia phần lệch vào đây. */
export const estSessions = (db, month) =>
  monthSessions(db, month).filter((s) => s.status === 'closed' && s.shuttleEst)

/* ---------- khách giao lưu ---------- */

export const sGuests = (db, sid) => db.sessionGuests.filter((g) => g.sessionId === sid)
export const guestRev = (db, sid) => sGuests(db, sid).reduce((t, g) => t + g.price, 0)
export const guestPaidRev = (db, sid) => sGuests(db, sid).filter((g) => g.paid).reduce((t, g) => t + g.price, 0)

/** Giá khách theo trình độ và giới tính, chốt tại thời điểm buổi. */
export function guestPrice(db, level, gender) {
  const r = db.guestPrices.find((x) => x.level === level)
  if (!r) return 0
  return gender === 'nu' ? r.nu : r.nam
}

/** Công nợ khách, gộp theo từng khách trong tháng. */
export function guestDebtRows(db, monthKey) {
  const map = {}
  db.sessionGuests.forEach((sg) => {
    const s = sessionOf(db, sg.sessionId)
    if (!s || monthOf(s.date) !== monthKey) return
    const k = sg.guestId
    if (!map[k]) map[k] = { guest: guestOf(db, k), sessions: 0, debt: 0, paidAmt: 0, rows: [] }
    map[k].sessions++
    map[k].rows.push(sg)
    if (sg.paid) map[k].paidAmt += sg.price
    else map[k].debt += sg.price
  })
  return Object.keys(map).map((k) => map[k]).sort((a, b) => b.debt - a.debt)
}

/** Nợ khách gộp theo người rủ — để nhắc thu hộ. */
export function guestDebtByInviter(db, monthKey) {
  const map = {}
  db.sessionGuests.forEach((sg) => {
    const s = sessionOf(db, sg.sessionId)
    if (!s || monthOf(s.date) !== monthKey) return
    const mid = sg.invitedBy || guestOf(db, sg.guestId).invitedBy || ''
    const k = mid || 'none'
    if (!map[k]) {
      map[k] = { mid, name: mid ? memberOf(db, mid).name : 'Chưa rõ người rủ', guests: 0, debt: 0, paid: 0 }
    }
    map[k].guests++
    if (sg.paid) map[k].paid += sg.price
    else map[k].debt += sg.price
  })
  return Object.keys(map).map((k) => map[k]).sort((a, b) => b.debt - a.debt)
}

/* ---------- điểm danh ---------- */

export function presentCount(db, s) {
  const a = db.attendance[s.id] || {}
  return groupMembers(db, s.groupId, monthOf(s.date)).filter((m) => a[m.id] === true).length
}
export function absentCount(db, s) {
  const a = db.attendance[s.id] || {}
  return groupMembers(db, s.groupId, monthOf(s.date)).filter((m) => a[m.id] === false).length
}

/* ---------- quỹ tháng và back tiền ---------- */

export const duesOf = (db, monthKey) => db.dues.filter((d) => d.month === monthKey)

/**
 * Đơn giá một buổi của một người trong một nhóm — CHỈ dùng để back tiền, không dùng để thu.
 * n = số buổi của nhóm trong tháng chưa bị hủy (tối thiểu 1).
 */
export function unitPrice(db, m, g, monthKey) {
  const n = monthSessions(db, monthKey).filter((s) => s.groupId === g.id && s.status !== 'cancelled').length || 1
  const fee = m.gender === 'nu' ? g.feeNu : g.feeNam
  const raw = fee / n
  const r = cfg.money.roundTo
  return { n, fee, raw, unit: db.club.roundUnit ? Math.round(raw / r) * r : Math.round(raw) }
}

/** Back tiền cuối tháng: đơn giá × số buổi đã chốt mà người cố định bị đánh Vắng. */
export function backRows(db, monthKey) {
  const out = []
  db.groups.forEach((g) => {
    const sess = monthSessions(db, monthKey).filter((s) => s.groupId === g.id && s.status === 'closed')
    groupMembers(db, g.id, monthKey).forEach((m) => {
      const ab = sess.filter((s) => (db.attendance[s.id] || {})[m.id] === false).length
      if (!ab) return
      const u = unitPrice(db, m, g, monthKey)
      const key = monthKey + ':' + g.id + ':' + m.id
      out.push({
        key, member: m, group: g, absent: ab, total: u.n, unit: u.unit, fee: u.fee,
        amount: u.unit * ab, paid: !!db.backPaid[key],
      })
    })
  })
  return out.sort((a, b) => b.amount - a.amount)
}

/** Số buổi còn lại của nhóm trong tháng tính từ hôm nay — dùng khi thêm người giữa tháng. */
export const remainSessions = (db, gid, month) =>
  monthSessions(db, month).filter((x) => x.groupId === gid && x.date >= db.today && x.status !== 'cancelled').length

/* ---------- giá thành từng buổi (tab Báo cáo) ---------- */

export function costRow(db, s) {
  const people = presentCount(db, s) + sGuests(db, s.id).length
  const cost = courtNet(db, s) + (s.shuttleUsed || 0) * shuttleUnit(db)
  const rev = guestRev(db, s.id)
  return { people, cost, rev, per: cost / (people || 1), subsidy: cost - rev }
}

/* ---------- màu và nhãn ---------- */

export function levelStyle(l) {
  const map = {
    Newbie: ['var(--status-idle-bg)', 'var(--status-idle-fg)'],
    TBY: ['var(--status-scheduled-bg)', 'var(--status-scheduled-fg)'],
    'TB-': ['var(--status-transit-bg)', 'var(--status-transit-fg)'],
    TB: ['var(--status-delivered-bg)', 'var(--status-delivered-fg)'],
  }
  const pair = map[l] || map.Newbie
  return { background: pair[0], color: pair[1] }
}

const STATUS_STYLE = {
  closed: { pill: 'delivered', color: 'var(--status-delivered)' },
  open: { pill: 'transit', color: 'var(--status-transit)' },
  cancelled: { pill: 'cancelled', color: 'var(--status-idle)' },
  draft: { pill: 'scheduled', color: 'var(--status-scheduled)' },
}
export function statusMeta(st) {
  const key = STATUS_STYLE[st] ? st : 'draft'
  return { ...STATUS_STYLE[key], label: t('sessionState.' + key) }
}

/** Nhãn giới tính — dùng khắp nơi, đừng viết lại 'Nam'/'Nữ' trong màn hình. */
export const genderTxt = (g) => t('gender.' + (g === 'nu' ? 'nu' : 'nam'))
