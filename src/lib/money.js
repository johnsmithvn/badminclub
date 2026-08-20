// Công thức tiền — lấy nguyên từ prototype (handoff 04-cong-thuc-tien.md).
// Mọi số tiền là VND integer. CHỈ làm tròn khi hiển thị; ngoại lệ duy nhất được làm tròn
// khi lưu là đơn giá một buổi (unitPrice) — dùng để back tiền.
// Hàm ở đây thuần: nhận db (state) + tham số, không đụng React/Supabase.

import { hours, monthOf, monthsBetween } from '#utils/dates.js'
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
/**
 * Tên người trả một khoản chi. Ưu tiên bản ghi thành viên (payerId); chuỗi gõ tay chỉ còn để
 * đọc dữ liệu cũ — xem migration 0008.
 */
export const payerName = (db, payerId, legacy) => {
  // Tra thẳng, KHÔNG qua memberOf: memberOf trả placeholder '—' cho id không tìm thấy, mà '—'
  // là chuỗi truthy nên id chết sẽ nuốt mất cái tên cũ đang có.
  const m = payerId ? db.members.find((x) => x.id === payerId) : null
  return (m && m.name) || legacy || t('common.unknown')
}
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

/**
 * Kiểm kho: tính phần lệch và chia vào đâu. Dialog xem trước và action áp dụng dùng CHUNG hàm này.
 * Tháng lấy từ NGÀY KIỂM, không phải tháng đang chọn ở header: kiểm ngày 31/08 trong lúc header
 * đang ở tháng 09 thì phần lệch của tháng 8 sẽ chui vào các buổi tháng 9 — sai hai tháng cùng lúc.
 */
export function checkPreview(db, date, counted) {
  const month = monthOf(date || db.today)
  const systemLeft = stock(db).left
  const diff = systemLeft - (parseInt(counted, 10) || 0)
  const est = estSessions(db, month)
  return {
    month, systemLeft, diff, est, n: est.length, done: checkOf(db, month),
    share: est.length ? Math.round(diff / est.length) : 0,
  }
}

/** Lần kiểm kho của một tháng, nếu có. Mỗi tháng chỉ được một lần — xem uq_check_month. */
export const checkOf = (db, month) => (db.stockChecks || []).find((c) => c.month === month) || null

/** Chia phần lệch vào các buổi ước lượng; phần dư dồn vào buổi cuối để tổng khớp tuyệt đối. */
export function spreadDiff(est, diff) {
  const out = {}
  let rest = diff
  est.forEach((x, i) => {
    const share = i === est.length - 1 ? rest : Math.round(diff / est.length)
    rest -= share
    out[x.id] = share
  })
  return out
}

/**
 * Có nên nhắc kiểm kho không → '' | 'never' | 'stale' | 'low'.
 * Bỏ kiểm kho thì tồn kho và giá thành trôi mà KHÔNG AI BIẾT: sai số có hệ thống chứ không
 * random, nên càng để lâu càng lệch cùng một hướng. Quỹ không sai đồng nào, nhưng "quỹ bù mỗi
 * buổi" — con số dùng để quyết định có tăng quỹ tháng hay không — thì sai.
 */
export function checkDue(db) {
  if (!(db.purchases || []).length) return ''          // chưa mua đợt nào thì chưa có gì để đếm
  const month = monthOf(db.today)
  if (checkOf(db, month)) return ''
  const last = (db.stockChecks || []).map((c) => c.month).sort().pop()
  if (!last) return 'never'
  if (monthsBetween(last, month) > cfg.shuttle.checkRemindMonths) return 'stale'
  if (stock(db).left < cfg.shuttle.checkLowStock) return 'low'
  return ''
}

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

/**
 * Một ô điểm danh có ba giá trị: `true` có mặt · `false` vắng · `'extra'` đi thêm.
 * `'extra'` là người KHÔNG cố định của nhóm nhưng hôm đó có đánh — họ vẫn là người có mặt,
 * chỉ khác ở chỗ tiền của họ đi qua bảng đối chiếu chứ không qua quỹ tháng của nhóm.
 */
export const isPresent = (v) => v === true || v === 'extra'

/** Ai xuất hiện trong buổi: người cố định của nhóm + người đi thêm (có bản ghi điểm danh). */
export function sessionMembers(db, s) {
  const fixed = groupMembers(db, s.groupId, monthOf(s.date))
  const ids = new Set(fixed.map((m) => m.id))
  const a = db.attendance[s.id] || {}
  return fixed.concat(db.members.filter((m) => !ids.has(m.id) && a[m.id] !== undefined))
}

export function presentCount(db, s) {
  const a = db.attendance[s.id] || {}
  return sessionMembers(db, s).filter((m) => isPresent(a[m.id])).length
}
export function absentCount(db, s) {
  const a = db.attendance[s.id] || {}
  return groupMembers(db, s.groupId, monthOf(s.date)).filter((m) => a[m.id] === false).length
}

/* ---------- quỹ tháng và back tiền ---------- */

export const duesOf = (db, monthKey) => db.dues.filter((d) => d.month === monthKey)

/**
 * Trạng thái một khoản quỹ tháng — SUY RA từ số tiền đã nhận, không giữ cờ riêng.
 * Boolean `paid` không ghi được cảnh hay gặp nhất: phải đóng 250.000, đưa trước 150.000.
 * Tick thì sổ quỹ thừa 100.000, không tick thì thiếu 150.000.
 *
 *   state 'none'    chưa đóng đồng nào
 *         'partial' đóng thiếu, còn nợ `remain`
 *         'full'    đủ (hoặc đưa dư, phần dư giữ nguyên chứ không cắt)
 */
export function dueState(d) {
  const amount = d.amount || 0
  const paid = Math.max(0, d.paidAmount || 0)
  return {
    amount, paid,
    remain: Math.max(0, amount - paid),
    full: paid >= amount && amount > 0,
    state: paid <= 0 ? 'none' : paid >= amount ? 'full' : 'partial',
  }
}

/** Tổng đã thu / còn thiếu của một danh sách quỹ tháng. */
export function duesTotal(list) {
  return (list || []).reduce((acc, d) => {
    const st = dueState(d)
    return { amount: acc.amount + st.amount, paid: acc.paid + st.paid, remain: acc.remain + st.remain }
  }, { amount: 0, paid: 0, remain: 0 })
}

/**
 * Đơn giá một buổi của một người trong một nhóm — CHỈ dùng để đối chiếu (back tiền cho người
 * vắng, thu tiền người đi thêm). KHÔNG dùng để thu quỹ tháng: quỹ tháng thu trọn gói.
 *
 * n = số buổi của nhóm trong tháng chưa bị huỷ (tối thiểu 1).
 *
 * Tiền lấy từ `monthly_dues.amount` của CHÍNH NGƯỜI ĐÓ, không đọc `member_groups.fee_*` hiện
 * tại. Đọc cấu hình hiện tại thì sửa quỹ nam 250k → 280k giữa chừng là người đã đóng 250k lại
 * được back theo 280k — quỹ trả vượt. Cùng họ với luật "đừng đọc cấu hình hiện tại để tính
 * chuyện đã xảy ra" của đóng băng giá thành.
 *
 * Tháng chưa chốt danh sách thì chưa có dòng dues nào, lúc đó mới rơi về giá cấu hình của nhóm.
 */
export function unitPrice(db, m, g, monthKey) {
  const n = monthSessions(db, monthKey).filter((s) => s.groupId === g.id && s.status !== 'cancelled').length || 1
  const due = (db.dues || []).find((d) => d.month === monthKey && d.groupId === g.id && d.memberId === m.id)
  const fee = due ? due.amount : m.gender === 'nu' ? g.feeNu : g.feeNam
  const raw = fee / n
  const r = cfg.money.roundTo
  return { n, fee, raw, unit: db.club.roundUnit ? Math.round(raw / r) * r : Math.round(raw) }
}

/** Khoá của một dòng đối chiếu. Trùng khoá = cùng một khoản, không sinh dòng thứ hai. */
export const adjustKey = (month, gid, mid, kind) => [month, gid, mid, kind].join(':')

/** Dòng đối chiếu đã lưu (đã chốt cách trả, hoặc đã trả) — nếu có. */
export const savedAdjust = (db, key) => (db.adjustments || []).find((x) => x.key === key) || null

/**
 * ĐỐI CHIẾU BUỔI cuối tháng — hai chiều, cùng một đơn giá, chỉ khác dấu.
 *
 *   absent_back    người cố định của nhóm mà VẮNG buổi đã chốt   amount ÂM    quỹ nợ người
 *   extra_session  người đi thêm buổi không thuộc nhóm mình      amount DƯƠNG người nợ quỹ
 *
 * Dòng đã lưu (`db.adjustments`) thì ĐỌC số đã lưu, không tính lại — sửa điểm danh hay sửa quỹ
 * nhóm về sau không được làm đổi khoản đã chốt cách trả.
 */
export function adjustRows(db, monthKey) {
  const out = []
  const push = (g, m, kind, sessions, sign) => {
    if (!sessions) return
    const key = adjustKey(monthKey, g.id, m.id, kind)
    const saved = savedAdjust(db, key)
    const u = unitPrice(db, m, g, monthKey)
    const row = saved
      ? { sessions: saved.sessions, unit: saved.unit, amount: saved.amount }
      : { sessions, unit: u.unit, amount: sign * u.unit * sessions }
    out.push({
      key, month: monthKey, member: m, group: g, kind, groupId: g.id, memberId: m.id,
      total: u.n, fee: u.fee, ...row,
      settle: saved ? saved.settle : 'cash',
      paid: saved ? !!saved.paid : false,
      paidAt: saved ? saved.paidAt : null,
      saved: !!saved,
    })
  }

  db.groups.forEach((g) => {
    const sess = monthSessions(db, monthKey).filter((s) => s.groupId === g.id && s.status === 'closed')
    if (!sess.length) return
    const att = (s) => db.attendance[s.id] || {}
    const fixed = groupMembers(db, g.id, monthKey)
    const isFixed = new Set(fixed.map((m) => m.id))

    fixed.forEach((m) => {
      push(g, m, 'absent_back', sess.filter((s) => att(s)[m.id] === false).length, -1)
    })

    // Người đi thêm: có ô điểm danh 'extra' ở buổi của nhóm này.
    // Người ĐÃ cố định nhóm này thì bỏ qua, dù ô điểm danh có là 'extra' đi nữa — họ đã đóng
    // quỹ tháng cho nhóm, tính thêm tiền đi thêm buổi là thu hai lần cùng một buổi. Hay gặp ở
    // người cố định cả hai nhóm.
    const extras = {}
    sess.forEach((s) => {
      const a = att(s)
      Object.keys(a).forEach((mid) => {
        if (a[mid] === 'extra' && !isFixed.has(mid)) extras[mid] = (extras[mid] || 0) + 1
      })
    })
    Object.keys(extras).forEach((mid) => {
      const m = db.members.find((x) => x.id === mid)
      if (m) push(g, m, 'extra_session', extras[mid], 1)
    })
  })

  // Khoản to nhất lên trước, không phân biệt chiều.
  return out.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

/**
 * Khoản đối chiếu còn treo của một người, đã chọn "trừ vào quỹ tháng sau" mà chưa xử lý.
 * Dấu cộng thẳng vào `monthly_dues.amount`: âm thì tháng sau đóng ít đi, dương thì đóng thêm.
 */
export const pendingOffset = (db, mid, month) =>
  (db.adjustments || []).filter((x) => x.memberId === mid && x.settle === 'offset_next_dues' && !x.paid && x.month < month)

/** Số buổi còn lại của nhóm trong tháng tính từ hôm nay — dùng khi thêm người giữa tháng. */
export const remainSessions = (db, gid, month) =>
  monthSessions(db, month).filter((x) => x.groupId === gid && x.date >= db.today && x.status !== 'cancelled').length

/**
 * Quỹ tháng của người vào GIỮA THÁNG. Hai cảnh khác hẳn nhau:
 *
 *  - Nhóm CHƯA có buổi nào trong tháng — CLB vừa dựng giữa tháng, lịch tập chưa tạo. Người này
 *    rồi sẽ đánh đủ số buổi của tháng, nên thu TRỌN GÓI. Trước đây rơi vào nhánh "0 buổi còn
 *    lại" nên không sinh khoản nào, thành ra thêm người giữa tháng là không có gì để thu.
 *  - Nhóm ĐÃ có buổi — thu theo số buổi còn lại tính từ hôm nay, theo đơn giá một buổi.
 */
export function joinDues(db, m, g, month) {
  const all = monthSessions(db, month).filter((s) => s.groupId === g.id && s.status !== 'cancelled')
  if (!all.length) return { full: true, sessions: 0, amount: m.gender === 'nu' ? g.feeNu : g.feeNam }
  const sessions = remainSessions(db, g.id, month)
  return { full: false, sessions, amount: unitPrice(db, m, g, month).unit * sessions }
}

/* ---------- giá thành từng buổi · TẦNG B ---------- */

/**
 * Giá thành một buổi. Tầng B — KHÔNG BAO GIỜ sinh dòng ở sổ quỹ (xem DATABASE.md §3).
 *
 * Buổi đã đóng băng (`costFrozenAt`) thì ĐỌC số đã lưu, không tính lại: mua thêm một đợt cầu
 * giá khác hoặc chủ sân tăng giá thì buổi cũ phải giữ nguyên con số đã đọc hôm chốt.
 *
 * `quỹ bù = chi phí − thu khách`. KHÔNG trừ tiền bán sân: `courtNet` đã loại sân bán khỏi chi
 * phí rồi, trừ thêm `soldAmount` nữa là tính lợi ích bán sân hai lần.
 */
export function costRow(db, s) {
  if (s.costFrozenAt) {
    const people = s.costHeads || 0
    const cost = s.costTotal || 0
    const rev = s.costGuestRev || 0
    return {
      people, cost, rev, court: s.costCourt || 0, shuttle: s.costShuttle || 0,
      unit: s.costShuttleUnit || 0, per: cost / (people || 1), subsidy: cost - rev, frozen: true,
    }
  }
  const people = presentCount(db, s) + sGuests(db, s.id).length
  const unit = shuttleUnit(db)
  const court = courtNet(db, s)
  const shuttle = (s.shuttleUsed || 0) * unit
  const cost = court + shuttle
  const rev = guestRev(db, s.id)
  return { people, cost, rev, court, shuttle, unit, per: cost / (people || 1), subsidy: cost - rev, frozen: false }
}

/**
 * Ảnh chụp giá thành để gắn vào bản ghi buổi lúc chốt. Thuần — action chỉ việc merge vào buổi.
 * Cố tình đi qua costRow ở nhánh live để số đóng băng LUÔN BẰNG số đang hiện trên màn hình.
 */
export function freezeCost(db, s, at) {
  const c = costRow(db, { ...s, costFrozenAt: null })
  return {
    costCourt: c.court, costShuttleUnit: c.unit, costShuttle: c.shuttle, costTotal: c.cost,
    costGuestRev: c.rev, costHeads: c.people, costFrozenAt: at,
  }
}

/** Mở lại buổi → số quay về tính live. Xoá hẳn để không còn số cũ lảng vảng trong bản ghi. */
export const unfrozenCost = () => ({
  costCourt: null, costShuttleUnit: null, costShuttle: null, costTotal: null,
  costGuestRev: null, costHeads: null, costFrozenAt: null,
})

/**
 * Trạng thái con số giá thành — quyết định badge nào hiện trên UI.
 *   live  buổi chưa chốt, số còn đổi
 *   temp  đóng băng tạm, số cầu còn là định mức, kiểm kho sẽ chỉnh lại
 *   final số chốt, không đổi nữa
 */
export const costState = (s) => (!s.costFrozenAt ? 'live' : s.shuttleEst ? 'temp' : 'final')

/* ---------- màu và nhãn ---------- */

/** Bảng màu trình độ, yếu → mạnh. Thang dài hơn bảng màu thì các bậc cuối dùng chung màu mạnh nhất. */
const LEVEL_PALETTE = [
  ['var(--status-idle-bg)', 'var(--status-idle-fg)'],
  ['var(--status-scheduled-bg)', 'var(--status-scheduled-fg)'],
  ['var(--status-transit-bg)', 'var(--status-transit-fg)'],
  ['var(--status-delivered-bg)', 'var(--status-delivered-fg)'],
]

/**
 * Màu của một bậc trình độ, chia theo VỊ TRÍ trong thang của CLB chứ không theo tên.
 * Bảng cứng theo tên ('TBY', 'TB-'…) sẽ hỏng ngay khi CLB đặt thang riêng — mà thang trình độ
 * là dữ liệu của từng CLB (clubs.levels), không phải hằng số.
 */
export function levelStyle(l, levels) {
  const scale = levels && levels.length ? levels : LEVELS
  const i = scale.indexOf(l)
  const slot = i < 0 ? 0 : Math.min(LEVEL_PALETTE.length - 1,
    Math.floor((i * LEVEL_PALETTE.length) / Math.max(1, scale.length)))
  const pair = LEVEL_PALETTE[slot]
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
