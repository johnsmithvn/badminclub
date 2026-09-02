// Công thức tiền — lấy nguyên từ prototype (handoff 04-cong-thuc-tien.md).
// Mọi số tiền là VND integer. CHỈ làm tròn khi hiển thị; ngoại lệ duy nhất được làm tròn
// khi lưu là đơn giá một buổi (unitPrice) — dùng để back tiền.
// Hàm ở đây thuần: nhận db (state) + tham số, không đụng React/Supabase.

import { hours, monthOf, monthsBetween } from '#utils/dates.js'
import { can } from '#lib/roles.js'
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

/**
 * Số nguyên đọc từ ô nhập của user. Bỏ mọi ký tự không phải chữ số trước khi parse.
 *
 * `parseInt` trần cắt ở dấu chấm: `parseInt('1.650.000')` ra **1**. Mà người Việt gõ tiền có
 * dấu phân cách nghìn là chuyện đương nhiên — app ăn nhầm 1.650.000 thành 1 đồng, im lặng,
 * không báo gì. Mọi ô nhập tiền/số lượng phải đi qua đây.
 */
export const intOf = (v) => {
  const digits = String(v == null ? '' : v).replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

/* ---------- tra cứu ---------- */

export const courtOf = (db, id) => db.courts.find((c) => c.id === id) || { name: t('common.unknown'), price: 0 }
export const memberOf = (db, id) => db.members.find((m) => m.id === id) || { name: t('common.unknown') }
/**
 * Tên người trả một khoản chi. Ưu tiên bản ghi thành viên (payerId); chuỗi gõ tay chỉ còn để
 * đọc dữ liệu cũ — xem migration 0008.
 */
export const payerName = (db, payerId, legacy) => {
  // Tra thẳng, KHÔNG qua memberOf: memberOf trả placeholder '—' cho id không tìm thấy, mà '—'
  // là chuỗi truthy nên id chết sẽ nuốt mất cái tên cũ đang có. Bỏ trống hoặc quỹ tự trả = Quỹ CLB.
  const m = payerId ? db.members.find((x) => x.id === payerId) : null
  return (m && m.name) || legacy || t('fund.payerFund')
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
export function levelOf(m, month) {
  // Mốc LỚN NHẤT còn <= tháng đang hỏi. Đổi trình độ nhiều lần thì đoạn giữa hai lần đổi vẫn
  // đúng — một ô `pendingLevel` không làm được: lần đổi thứ hai ghi đè lần thứ nhất và đoạn
  // giữa rơi về `level` gốc, sai lặng lẽ ở giá khách và ở cách cân sân của các buổi trong đoạn đó.
  const hist = m.levelHistory || []
  let best = null
  hist.forEach((h) => {
    if (h.from <= month && (!best || h.from > best.from)) best = h
  })
  if (best) return best.level
  // Tương thích ngược, và CHỈ khi chưa có mốc nào: DB chưa chạy 0011 thì dữ liệu vẫn nằm ở ô chờ
  // cũ. Có lịch sử rồi mà còn đọc ô đó là đọc hai lần cùng một lần đổi — 0011 đã backfill nó
  // thành một mốc, nên ô cũ chỉ còn là bản sao mồ côi.
  if (!hist.length && m.pendingLevel && month >= m.pendingLevelFrom) return m.pendingLevel
  return m.level
}

/** Mốc đổi trình độ gần nhất còn ở TƯƠNG LAI (để màn hình hiện "chờ lên X từ tháng Y"). */
export function nextLevelStep(m, month) {
  const hist = m.levelHistory || []
  let next = null
  hist.forEach((h) => {
    if (h.from > month && (!next || h.from < next.from)) next = h
  })
  if (next) return next
  if (!hist.length && m.pendingLevel && m.pendingLevelFrom > month) {
    return { from: m.pendingLevelFrom, level: m.pendingLevel }
  }
  return null
}

/** Trạng thái cố định của một người trong nhóm ở một tháng: fixed | off | pending | none */
export function rosterStatus(db, month, gid, mid) {
  // 1. Roster của tháng có bản ghi rõ ràng cho người này (fixed / off / pending)
  const r = (db.roster[month] || {})[gid]
  if (r && r[mid]) return r[mid]

  // 2. Nếu tháng này nhóm đã có danh sách quỹ tháng đã chốt (db.dues):
  // Người có trong quỹ tháng đó là 'fixed'; người không có là 'none'.
  const duesList = (db.dues || []).filter((d) => d.month === month && d.groupId === gid)
  if (duesList.length > 0) {
    return duesList.some((d) => d.memberId === mid) ? 'fixed' : 'none'
  }

  // 3. Nếu có roster của nhóm nhưng không có tên người này
  if (r) return 'none'

  // 4. Tháng mới hoàn toàn chưa chốt danh sách: dựa vào ca cố định cấu hình trên thành viên
  const m = (db.members || []).find((x) => x.id === mid)
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

/**
 * Tiền một dòng sân. Buổi đã chốt thì ĐỌC số đã đóng băng (`c.cost`), KHÔNG nhân lại giá hiện tại:
 * chủ sân tăng giá không được làm đổi tiền sân của buổi cũ (migration 0012).
 * Bốn hàm dưới cộng từ đúng chỗ này, nên khoá ở đây là cả bốn đứng yên cùng lúc — kể cả dòng chi
 * tiền sân trong `lib/ledger.js`, chỗ trước đây vẫn trôi trong khi card giá thành thì không.
 */
export const rowCost = (db, c) => (c.cost == null ? hours(c.from, c.to) * courtOf(db, c.courtId).price : c.cost)
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
  const diff = systemLeft - intOf(counted)
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

/* ---------- thành viên ứng tiền · LUẬT NGƯỜI GIỮ QUỸ (Issue 4) ---------- */

/**
 * Người này có phải "két" không — tiền qua tay họ mới là thu / chi thật.
 * Két = vai có quyền `money` (owner · treasurer). `payerId` rỗng = quỹ trả thẳng, cũng là két.
 * Id trỏ vào người không tìm thấy thì trả false: thà giữ lại một khoản nợ để người ta thấy còn
 * hơn nuốt mất nó im lặng.
 */
export const isVault = (db, payerId) => !payerId || can(memberOf(db, payerId).role, 'money')

/**
 * Các khoản thành viên bỏ tiền túi trả hộ CLB. `repaidAt` rỗng = quỹ đang nợ người đó và khoản
 * chi CHƯA vào sổ quỹ.
 *
 * Gộp mua cầu với hoá đơn sân làm một danh sách vì với người dùng đó là cùng một việc — ứng
 * tiền trước. Không có bảng riêng: khoản nợ chính là bản ghi mua cầu / hoá đơn đã có.
 */
export function advanceRows(db) {
  const out = []
  const add = (kind, x, amount, label) => {
    if (!(amount > 0) || isVault(db, x.payerId)) return
    out.push({
      kind, id: x.id, date: x.date, amount, label,
      memberId: x.payerId, name: memberOf(db, x.payerId).name, repaidAt: x.repaidAt || '',
    })
  }
  ;(db.courtBills || []).forEach((b) => add('court', b, b.amount, b.venue))
  ;(db.purchases || []).forEach((p) => add('shuttle', p, p.total,
    (db.shuttleTypes.find((x) => x.id === p.typeId) || { name: t('common.unknown') }).name))
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

/* ---------- cảnh báo sai im lặng (TASKS Phase 9 · P7 · B1 · B5 · B7) ---------- */

/** Miền giá trị của họ key `home.warn.*` — i18n test đọc từ đây để thêm cảnh báo là đòi key. */
export const WARN_KEYS = ['noBill', 'staleDraft', 'openOverdue']

/**
 * Ba chỗ sai KHÔNG tự lộ ra: không có gì để so nên không ai phát hiện.
 * Trả mảng `{ key, tone, n, ids }` — rỗng nghĩa là không có gì để nhắc.
 *
 * B5/B7 quét MỌI tháng chứ không riêng tháng đang xem: buổi tháng trước quên chốt vẫn đang
 * làm sai tồn kho và đơn giá back của tháng đó, đổi tháng ở header không làm nó đúng lên.
 */
export function homeAlerts(db) {
  const out = []
  const closed = monthSessions(db, db.month).filter((s) => s.status === 'closed')

  // B1 · Trả tiền sân theo THÁNG mà tháng đã có buổi chốt thì phải có hoá đơn. Mode `session`
  // ghi tiền sân ngay lúc chốt buổi nên không cần hoá đơn tháng — nhắc là nhắc sai.
  if (courtPayMode(db) === 'month' && closed.length && !billsOf(db, db.month).length)
    out.push({ key: 'noBill', tone: 'danger', n: closed.length, ids: null })

  // B5 · Buổi quá ngày còn `draft`: chưa ai nói nó có đánh hay không. Buổi huỷ mà để `draft`
  // vẫn bị đếm vào `n` → đơn giá một buổi thấp hơn thật → back trả thiếu.
  const stale = db.sessions.filter((s) => s.status === 'draft' && s.date < db.today)
  if (stale.length) out.push({ key: 'staleDraft', tone: 'warning', n: stale.length, ids: stale.map((s) => s.id) })

  // B7 · Buổi để `open` mãi: sai tồn kho (số cầu chưa trừ), sai back, mất khỏi báo cáo.
  const open = db.sessions.filter((s) => s.status === 'open' && s.date < db.today)
  if (open.length) out.push({ key: 'openOverdue', tone: 'warning', n: open.length, ids: open.map((s) => s.id) })

  return out
}

/* ---------- khách giao lưu ---------- */

export const sGuests = (db, sid) => db.sessionGuests.filter((g) => g.sessionId === sid)

/**
 * Một dòng `sessionGuests` là MỘT LƯỢT TRẢ TIỀN trong một buổi. Người đó là khách ngoài CLB
 * (`guestId`) hoặc thành viên đi buổi đột xuất (`memberId`) — đúng một trong hai, xem CHECK
 * `session_guests_who_chk` ở migration 0003.
 */
export const isMemberCharge = (sg) => !!sg.memberId
export const chargeName = (db, sg) =>
  (sg.memberId ? memberOf(db, sg.memberId).name : guestOf(db, sg.guestId).name)

/**
 * KHÁCH ngoài CLB của một buổi — bỏ dòng thu của thành viên. Mọi chỗ ĐẾM ĐẦU NGƯỜI hoặc liệt
 * kê khách phải đi qua đây: thành viên đã được `presentCount` đếm qua bảng điểm danh rồi, cộng
 * cả dòng thu của họ nữa là một người hoá hai.
 */
export const sGuestsOnly = (db, sid) => sGuests(db, sid).filter((g) => !isMemberCharge(g))
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
    // Thành viên nợ tiền buổi đột xuất cũng phải hiện ở đây, không thì khoản nợ chỉ nhìn thấy
    // khi mở đúng buổi đó ra — nợ mà không màn nào nhắc thì không ai đi đòi.
    const k = sg.memberId || sg.guestId
    if (!map[k]) {
      const who = sg.memberId ? memberOf(db, k) : guestOf(db, k)
      map[k] = {
        guest: { id: k, name: who.name, gender: who.gender || sg.gender, level: who.level || sg.level },
        sessions: 0, debt: 0, paidAmt: 0, rows: [],
      }
    }
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
    // Màn này để nhắc người RỦ khách đi thu hộ. Thành viên tự đi buổi đột xuất thì không ai rủ,
    // gom họ vào rổ "chưa rõ người rủ" chỉ tạo nhiễu.
    if (isMemberCharge(sg)) return
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
  return fixed.concat(db.members.filter((m) => !ids.has(m.id) && isPresent(a[m.id])))
}

export function presentCount(db, s) {
  const a = db.attendance[s.id] || {}
  return sessionMembers(db, s).filter((m) => isPresent(a[m.id])).length
}
export function absentCount(db, s) {
  const a = db.attendance[s.id] || {}
  return groupMembers(db, s.groupId, monthOf(s.date)).filter((m) => a[m.id] === false).length
}

/** Đầu người thật của một buổi: thành viên có mặt + khách ngoài CLB. Nguồn DUY NHẤT để đếm. */
export const headCount = (db, s) => presentCount(db, s) + sGuestsOnly(db, s.id).length

/** Buổi ngoài lịch cố định — không nằm trong gói quỹ tháng của ai. */
export const isAdhoc = (s) => !!s && !s.scheduleId

/**
 * BUỔI ĐỘT XUẤT: ai có mặt thì trả theo GIÁ GIAO LƯU, y như khách — buổi này không nằm trong
 * gói quỹ tháng của ai nên không ai được đánh miễn phí. Thuần: trả về việc phải làm với
 * `db.sessionGuests` sau khi bảng điểm danh đổi. Action gắn `id`, giống `lockDues`.
 *
 *   add     người vừa được đánh CÓ MẶT mà chưa có dòng thu — giá lấy từ bảng giá khách theo
 *           trình độ + giới tính, rồi ĐÓNG BĂNG (sửa bảng giá sau không làm đổi buổi cũ)
 *   remove  người bị bỏ điểm danh mà CHƯA THU. Đã thu thì giữ: tiền vào quỹ rồi, bỏ tick điểm
 *           danh không được làm nó bốc hơi khỏi sổ.
 *
 * Buổi của lịch cố định trả về rỗng — người cố định đã đóng trọn gói tháng, thu nữa là thu hai lần.
 */
export function adhocCharges(db, s, att) {
  if (!isAdhoc(s)) return { add: [], remove: [] }
  const rows = sGuests(db, s.id).filter(isMemberCharge)
  const had = new Set(rows.map((g) => g.memberId))
  const month = monthOf(s.date)
  const present = Object.keys(att || {})
    .filter((mid) => isPresent(att[mid]))
    .map((mid) => (db.members || []).find((m) => m.id === mid))
    .filter(Boolean)
  const want = new Set(present.map((m) => m.id))
  return {
    add: present.filter((m) => !had.has(m.id)).map((m) => {
      const level = levelOf(m, month)
      return {
        sessionId: s.id, memberId: m.id, guestId: null, level, gender: m.gender,
        price: guestPrice(db, level, m.gender), paid: false, invitedBy: '',
      }
    }),
    remove: rows.filter((g) => !want.has(g.memberId) && !g.paid).map((g) => g.id),
  }
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

  // CLB tự chốt "một buổi tính 60.000" thì dùng thẳng số đó, KHÔNG chia lại từ quỹ tháng.
  // Không làm tròn nữa: đây là số người ta gõ vào, tự ý làm tròn là sửa số của họ.
  const over = m.gender === 'nu' ? g.unitNu : g.unitNam
  if (over > 0) return { n, fee, raw: over, unit: over, override: true }

  const raw = fee / n
  const r = cfg.money.roundTo
  return {
    n, fee, raw, override: false,
    unit: db.club.roundUnit ? Math.round(raw / r) * r : Math.round(raw),
  }
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
    // Đơn giá này là số CLB tự đặt hay app tự chia — hiện ra để không ai phải đoán.
    out.push({
      key, month: monthKey, member: m, group: g, kind, groupId: g.id, memberId: m.id,
      total: u.n, fee: u.fee, unitOverride: !!u.override, ...row,
      settle: saved ? saved.settle : 'cash',
      paid: saved ? !!saved.paid : false,
      paidAt: saved ? saved.paidAt : null,
      saved: !!saved, orphan: false,
    })
  }

  db.groups.forEach((g) => {
    const sess = monthSessions(db, monthKey).filter((s) => s.groupId === g.id && s.status === 'closed')
    if (!sess.length) return
    const att = (s) => db.attendance[s.id] || {}
    const fixed = groupMembers(db, g.id, monthKey)
    const isFixed = new Set(fixed.map((m) => m.id))
    /**
     * Đã có khoản quỹ tháng cho ĐÚNG nhóm này chưa. Đây mới là điều kiện đúng để miễn tiền
     * "đi thêm buổi", chứ không phải "có tên trong danh sách cố định không":
     * người đóng trọn gói 250.000 đầu tháng rồi bị chuyển sang vãng lai giữa chừng vẫn đã trả
     * tiền cho các buổi của tháng đó — tính thêm đơn giá buổi nữa là thu hai lần.
     */
    const hasDue = (mid) =>
      (db.dues || []).some((x) => x.month === monthKey && x.groupId === g.id && x.memberId === mid)

    fixed.forEach((m) => {
      push(g, m, 'absent_back', sess.filter((s) => att(s)[m.id] === false).length, -1)
    })

    const extras = {}
    sess.forEach((s) => {
      const a = att(s)
      Object.keys(a).forEach((mid) => {
        if (a[mid] === 'extra' && !isFixed.has(mid) && !hasDue(mid)) extras[mid] = (extras[mid] || 0) + 1
      })
    })
    Object.keys(extras).forEach((mid) => {
      const m = db.members.find((x) => x.id === mid)
      if (m) push(g, m, 'extra_session', extras[mid], 1)
    })
  })

  /**
   * Dòng ĐÃ LƯU mà người đó không còn cố định nhóm nữa (bị chuyển sang vãng lai, bị gỡ khỏi
   * nhóm, hoặc điểm danh bị sửa lại) vẫn phải hiện. Bỏ đi thì:
   *   - khoản ĐÃ trả  → sổ quỹ còn dòng chi nhưng không còn gì giải thích nó, đối chiếu sổ ra
   *                     một khoản mồ côi;
   *   - khoản CHƯA trả → quỹ vẫn đang nợ người ta mà không còn chỗ nào nhắc.
   * Cờ `orphan` để UI nói rõ dòng này không còn khớp danh sách cố định hiện tại.
   */
  const shown = new Set(out.map((r) => r.key))
  ;(db.adjustments || []).forEach((x) => {
    if (x.month !== monthKey || shown.has(x.key)) return
    const m = db.members.find((y) => y.id === x.memberId)
    const g = db.groups.find((y) => y.id === x.groupId)
    if (!m || !g) return
    const u = unitPrice(db, m, g, monthKey)
    out.push({
      key: x.key, month: monthKey, member: m, group: g, kind: x.kind,
      groupId: x.groupId, memberId: x.memberId,
      sessions: x.sessions, unit: x.unit, amount: x.amount, total: u.n, fee: u.fee,
      settle: x.settle, paid: !!x.paid, paidAt: x.paidAt, saved: true, orphan: true,
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

/**
 * CHỐT DANH SÁCH THÁNG — sinh ra toàn bộ tiền phải thu của một tháng. Thuần: trả về các dòng
 * quỹ tháng cần thêm (chưa có `id`, action tự gắn) và danh sách khoá đối chiếu đã tiêu vào đó.
 *
 * Ba luật gói trong đây:
 *  - chỉ người `fixed` của tháng đó, và mỗi người mỗi nhóm chỉ một khoản;
 *  - khoản tháng trước xin "trừ vào quỹ tháng sau" cộng THẲNG dấu vào số phải đóng — âm thì
 *    đóng ít đi, dương thì đóng thêm; một người ở hai nhóm chỉ được trừ MỘT lần;
 *  - người đã NGƯNG HOẠT ĐỘNG thì thôi thu. Họ không còn hiện ở màn nào nữa (mọi danh sách
 *    lọc `active !== false`) nên cũng không có cách nào gỡ khỏi danh sách cố định — không
 *    chặn ở đây thì tháng nào chốt danh sách cũng đẻ thêm một khoản nợ cho người đã nghỉ.
 */
export function lockDues(db, month) {
  const rows = []
  const used = []
  const seen = new Set()   // một người ở hai nhóm chỉ tiêu khoản đối chiếu một lần
  ;(db.groups || []).forEach((g) => {
    const r = ((db.roster || {})[month] || {})[g.id] || {}
    Object.keys(r).forEach((mid) => {
      if (r[mid] !== 'fixed') return
      if ((db.dues || []).some((x) => x.month === month && x.groupId === g.id && x.memberId === mid)) return
      const mb = (db.members || []).find((x) => x.id === mid)
      if (!mb || mb.active === false) return
      const base = mb.gender === 'nu' ? g.feeNu : g.feeNam
      const pend = seen.has(mid) ? [] : pendingOffset(db, mid, month)
      seen.add(mid)
      pend.forEach((x) => used.push(x.key))
      const off = pend.reduce((x, y) => x + y.amount, 0)
      rows.push({
        month, groupId: g.id, memberId: mid,
        amount: Math.max(0, (base || 0) + off), paidAmount: 0, paidAt: null, method: '',
        note: off ? t('debts.offsetNote', { amount: fmtK(Math.abs(off)) }) : '',
      })
    })
  })
  return { rows, used }
}

/**
 * Những chỗ đang trỏ tới một thành viên. Rỗng = xoá cứng được; có = chỉ được NGƯNG HOẠT ĐỘNG.
 *
 * Xoá cứng người đã dính điểm danh hoặc tiền là mất lịch sử của những tháng đã chốt, và dưới DB
 * thì khoá ngoại chặn thẳng — báo cáo cũ sẽ trỏ vào khoảng không. Trả về danh sách KEY lý do để
 * màn hình nói rõ vướng cái gì, thay vì chỉ bảo "không xoá được".
 */
export function memberRefs(db, id) {
  const why = []
  const any = (k, cond) => { if (cond) why.push(k) }
  any('attend', Object.keys(db.attendance || {}).some((sid) => (db.attendance[sid] || {})[id] !== undefined))
  any('dues', (db.dues || []).some((x) => x.memberId === id))
  any('adjust', (db.adjustments || []).some((x) => x.memberId === id))
  any('guest', (db.sessionGuests || []).some((x) => x.invitedBy === id) ||
    (db.guests || []).some((x) => x.invitedBy === id))
  any('match', (db.matches || []).some((m) => (m.playerKeys || []).indexOf(id) >= 0))
  any('payer', (db.courtBills || []).some((x) => x.payerId === id) ||
    (db.purchases || []).some((x) => x.payerId === id))
  any('change', (db.changes || []).some((x) => x.memberId === id))
  any('account', !!(db.members.find((m) => m.id === id) || {}).userId)
  return why
}

/**
 * Vì sao KHÔNG xoá cứng được một nhóm cố định — cùng khuôn với `memberRefs`.
 *
 * Mọi khoá ngoại trỏ về `member_groups` đều là REFERENCES TRẦN (không cascade): `monthly_dues`,
 * `member_adjustments`, `back_credits`, `group_memberships`, `group_courts`, `sessions`,
 * `schedules`. Xoá nhóm còn dòng nào trong số đó là Postgres 23503 — mà theo `storage.js: flush`
 * thì op hỏng nằm lại trong hàng đợi MÃI, mọi thay đổi sau nó không xuống được DB, trong khi
 * màn hình vẫn báo đã lưu. Nên phải chặn ở client TRƯỚC, và nói rõ vướng cái gì.
 *
 * `club_member_groups` cố ý không có ở đây: nó CASCADE theo nhóm, gỡ người khỏi nhóm là chuyện
 * bình thường chứ không phải lịch sử cần giữ.
 */
export function groupRefs(db, gid) {
  const why = []
  const any = (k, cond) => { if (cond) why.push(k) }

  // Tách buổi làm HAI lý do, vì hai loại này khác nhau về bản chất:
  //   history — buổi đã mở / đã chốt / đã qua ngày. Chặn VĨNH VIỄN, không có đường gỡ: xoá
  //             nhóm là mọi dòng tiền lịch sử mất nhãn (`ledger` đọc `groupOf(db, s.groupId)`)
  //             và khoá ngoại trần của `sessions.group_id` nổ 23503.
  //   session — buổi chưa mở, còn ở tương lai. Chặn TẠM: xoá lịch và buổi đó là gỡ được.
  // Gộp hai cái làm một thì người dùng ngồi gỡ mãi một thứ không bao giờ gỡ nổi, mà app không
  // nói ra là vô vọng.
  const mine = (db.sessions || []).filter((x) => x.groupId === gid)
  const isHistory = (x) => x.status !== 'draft' || x.date <= db.today
  any('history', mine.some(isHistory))
  any('session', mine.some((x) => !isHistory(x)))
  any('schedule', (db.schedules || []).some((x) => x.groupId === gid))
  any('dues', (db.dues || []).some((x) => x.groupId === gid))
  any('adjust', (db.adjustments || []).some((x) => x.groupId === gid))
  any('roster', Object.keys(db.roster || {}).some((mo) => {
    const g = (db.roster[mo] || {})[gid]
    return !!g && Object.keys(g).length > 0
  }))
  return why
}

/**
 * Vì sao KHÔNG xoá cứng được một buổi — cùng khuôn `memberRefs` / `groupRefs`.
 *
 * `sessions` có SÁU bảng con `ON DELETE CASCADE` (attendances · session_courts · session_guests ·
 * session_lineups · session_court_groups · matches → match_players). Xoá cứng là mất sạch, âm
 * thầm, trong đó có TIỀN KHÁCH ĐÃ THU của buổi đó — dòng thu biến khỏi sổ quỹ mà không ai
 * hoàn tiền cho khách.
 *
 * Nên xoá cứng CHỈ dành cho buổi chưa ai chạm vào. Buổi đã có dấu vết thì dùng HUỶ
 * (`status: 'cancelled'`): mọi công thức tiền đã loại buổi huỷ sẵn rồi (`unitPrice`,
 * `remainSessions`, `joinDues`), mà lịch sử vẫn còn nguyên và bỏ huỷ lại được.
 */
export function sessionRefs(db, sid) {
  const why = []
  const any = (k, cond) => { if (cond) why.push(k) }
  any('attend', Object.keys((db.attendance || {})[sid] || {}).length > 0)
  any('guest', (db.sessionGuests || []).some((g) => g.sessionId === sid))
  any('match', (db.matches || []).some((m) => m.sessionId === sid))
  any('closed', !!(db.sessions || []).find((s) => s.id === sid && (s.status === 'closed' || s.costFrozenAt)))
  return why
}

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

/**
 * ĐỔI NHÓM CỐ ĐỊNH của một người — tính lại quỹ tháng của tháng bị ảnh hưởng. Thuần: trả về
 * mảng `dues` mới, các dòng cần THÊM (chưa có `id`, action tự gắn), và hai con số để bắn toast.
 *
 *   gỡ nhóm · chưa đóng đồng nào  → XOÁ khoản, không thì bị nhắc một khoản không còn phải đóng
 *   gỡ nhóm · đã đóng một phần    → GIỮ nguyên trong sổ quỹ + ghi chú lý do. Tiền đã vào quỹ
 *                                   thật thì không được tự bốc hơi, và họ đã trả cho các buổi
 *                                   của tháng đó rồi
 *   vào nhóm · tháng ĐÃ chốt      → sinh khoản bằng joinDues, không thì thu hụt
 *
 * `member` phải là bản ghi SAU khi sửa: đổi giới tính cùng lúc thì tiền phải theo giá mới.
 */
export function regroupDues(db, member, groupIds, month) {
  const want = new Set(groupIds || [])
  const locked = !!(db.locked || {})[month]
  let dues = (db.dues || []).slice()
  const add = []
  let kept = 0
  let dropped = 0

  ;(db.groups || []).forEach((g) => {
    const row = dues.find((x) => x.month === month && x.groupId === g.id && x.memberId === member.id)
    if (!want.has(g.id)) {
      if (!row) return
      if (dueState(row).paid > 0) {
        kept += dueState(row).paid
        dues = dues.map((x) => (x.id === row.id ? { ...x, note: t('members.keptDueNote') } : x))
      } else {
        dropped++
        dues = dues.filter((x) => x.id !== row.id)
      }
      return
    }
    if (row || !locked) return
    const jd = joinDues(db, member, g, month)
    if (jd.amount <= 0) return
    add.push({
      month, groupId: g.id, memberId: member.id, amount: jd.amount,
      paidAmount: 0, paidAt: null, method: '',
      note: jd.full ? t('members.joinFull') : t('members.joinPartial', { n: jd.sessions }),
    })
  })
  return { dues, add, kept, dropped }
}

/**
 * Ngưng hoạt động một người ĐANG cố định và ĐÃ đóng tiền tháng này thì quỹ đang giữ tiền của
 * những buổi họ sẽ không đánh nữa. `joinDues` chạy ngược: đơn giá × số buổi còn lại.
 *
 * Trả `null` = ngưng thẳng, không hỏi gì. Chưa đóng đồng nào cũng trả `null`: không có tiền
 * nào để trả lại thì hiện hộp thoại là hỏi thừa.
 *
 * Chỉ GỢI Ý số tiền — người dùng sửa đè hoặc bỏ qua. Cố ý không tự ghi: back hay không là
 * thoả thuận của CLB, không phải phép tính.
 */
export function offBackSuggest(db, id) {
  const m = (db.members || []).find((x) => x.id === id)
  if (!m) return null
  const month = db.month
  const groups = []
  let sessions = 0
  let amount = 0
  ;(db.groups || []).forEach((g) => {
    if (rosterStatus(db, month, g.id, id) !== 'fixed') return
    const due = (db.dues || []).find((d) => d.month === month && d.groupId === g.id && d.memberId === id)
    if (!due || dueState(due).paid <= 0) return
    const n = remainSessions(db, g.id, month)
    groups.push(g.name)
    sessions += n
    amount += unitPrice(db, m, g, month).unit * n
  })
  return groups.length ? { name: m.name, groups: groups.join(', '), sessions, amount } : null
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
  const people = headCount(db, s)
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
    // Đóng băng luôn TỪNG dòng sân (0012). `rowCost` đọc `cost` trước nên chốt lại lần nữa
    // (kiểm kho cuối tháng gọi `freezeCost` lại) là idempotent, không nhân lại theo giá mới.
    courts: (s.courts || []).map((r) => ({ ...r, cost: rowCost(db, r) })),
  }
}

/**
 * Mở lại buổi → số quay về tính live. Xoá hẳn để không còn số cũ lảng vảng trong bản ghi.
 * Truyền `s` để thả băng luôn từng dòng sân; gọi trần thì chỉ thả 7 số ở tầng buổi — cố ý giữ
 * nhánh đó để gọi thiếu tham số KHÔNG hoá thành `courts: []` xoá sạch sân của buổi.
 */
export const unfrozenCost = (s) => ({
  costCourt: null, costShuttleUnit: null, costShuttle: null, costTotal: null,
  costGuestRev: null, costHeads: null, costFrozenAt: null,
  ...(s ? { courts: (s.courts || []).map((r) => ({ ...r, cost: null })) } : {}),
})

/**
 * Trạng thái con số giá thành — quyết định badge nào hiện trên UI.
 *   live  buổi chưa chốt, số còn đổi
 *   temp  đóng băng tạm, số cầu còn là định mức, kiểm kho sẽ chỉnh lại
 *   final số chốt, không đổi nữa
 */
export const costState = (s) => (!s.costFrozenAt ? 'live' : s.shuttleEst ? 'temp' : 'final')

/* ---------- chốt buổi: cảnh báo trước và sau ---------- */

/** Miền giá trị hai họ key `session.closeWarn.*` và `session.drift.*` — i18n test đọc từ đây. */
export const CLOSE_WARN_KEYS = ['noAttend', 'soldBlank']
export const DRIFT_KEYS = ['heads', 'rev', 'shuttle']

/**
 * Việc còn treo trước khi chốt buổi. CHỈ CẢNH BÁO, không chặn: chặn thì có ngày bán sân cho CLB
 * khác mà chưa biết họ trả bao nhiêu là không chốt được buổi, trong khi chẳng có lỗi gì.
 *
 * Cố ý KHÔNG nhắc: khách còn ghi nợ (nợ nằm ở màn Công nợ, chốt hay không đều hiện) · số cầu
 * đang là định mức (CLB không đếm cầu thì định mức là bình thường, nhắc là phiền).
 */
export function closeWarnings(db, s) {
  if (!s) return []
  const out = []
  const map = (db.attendance || {})[s.id] || {}
  if (!Object.keys(map).some((k) => isPresent(map[k]))) out.push({ key: 'noAttend', n: 0 })
  // Đánh dấu "đã bán" mà ô tiền để trống: hai ô đang chỏi nhau, không phải quên nhập chung chung.
  const blank = rows(s).filter((c) => c.sold && !(c.soldAmount > 0)).length
  if (blank) out.push({ key: 'soldBlank', n: blank })
  return out
}

/**
 * Buổi đã chốt mà dữ liệu buổi đổi sau đó → số đóng băng KHÔNG tự cập nhật. Đóng băng là cố ý
 * (giá sân / giá cầu đổi không được làm đổi buổi cũ), nhưng người vừa sửa điểm danh thì không có
 * gì báo cho họ biết là sửa vô ích. Trả `null` khi chưa chốt hoặc không lệch.
 *
 * CHỈ so ba thứ ĐẾM ĐƯỢC: số người · thu khách · số cầu. Ba cái này chỉ đổi khi có người sửa dữ
 * liệu buổi. KHÔNG so tiền sân — giá sân đổi là đủ làm nó lệch mà chẳng ai sửa gì, cảnh báo oan
 * đúng vào cái mà đóng băng sinh ra để chống.
 */
export function costDrift(db, s) {
  if (!s || !s.costFrozenAt) return null
  const out = []
  const heads = headCount(db, s)
  if (heads !== (s.costHeads || 0)) out.push({ key: 'heads', was: s.costHeads || 0, now: heads })

  // Giá khách chốt ngay lúc thêm (sessionGuests.price) nên rev chỉ lệch khi thêm/bớt khách.
  const rev = guestRev(db, s.id)
  if (rev !== (s.costGuestRev || 0)) out.push({ key: 'rev', was: s.costGuestRev || 0, now: rev })

  // Số cầu lúc chốt suy ra từ tiền cầu ÷ đơn giá đã lưu. Chưa mua đợt nào thì đơn giá 0, bỏ qua.
  const unit = s.costShuttleUnit || 0
  if (unit > 0) {
    const was = Math.round((s.costShuttle || 0) / unit)
    if ((s.shuttleUsed || 0) !== was) out.push({ key: 'shuttle', was, now: s.shuttleUsed || 0 })
  }
  return out.length ? out : null
}

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
