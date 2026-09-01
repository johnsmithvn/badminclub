// Chia sân, xếp thông minh, đếm số trận (handoff 05-chia-san-va-so-tran.md).
// Chia sân KHÔNG ảnh hưởng tiền — chỉ là công cụ điều phối trên sân.
// Toàn bộ hàm ở đây thuần: nhận dữ liệu, trả dữ liệu mới, không setState.

import { monthOf } from '#utils/dates.js'
import { isPresent, levelIdx, levelOf, sGuestsOnly, sessionMembers } from '#lib/money.js'
import cfg from '#config/app.json' with { type: 'json' }
import { t } from '#i18n'

/** Năm chế độ xếp. Nhãn và mô tả lấy từ i18n theo key. */
export const MODE_KEYS = ['balance', 'fewest', 'rest', 'same', 'random']
export const ASSIGN_MODES = MODE_KEYS.map((value) => ({
  value,
  label: t('assign.modes.' + value + '.label'),
  desc: t('assign.modes.' + value + '.desc'),
}))
export const modeToast = (mode) => t('assign.modes.' + mode + '.toast')

/** Buổi được xếp: từ hôm nay trở đi, đã mở, đã có ít nhất một người Có mặt. */
export function assignableSessions(db) {
  return db.sessions
    .filter((s) => {
      if (s.date < db.today || s.status !== 'open') return false
      const a = db.attendance[s.id] || {}
      return Object.keys(a).some((k) => isPresent(a[k]))
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Người tham gia một buổi: thành viên cố định có mặt + khách giao lưu của buổi. */
export function sessionPlayers(db, s) {
  if (!s) return []
  const month = monthOf(s.date)
  const att = db.attendance[s.id] || {}
  // sessionMembers chứ không groupMembers: người đi thêm cũng ra sân, cũng phải được xếp.
  const mem = sessionMembers(db, s)
    .filter((m) => isPresent(att[m.id]))
    .map((m) => ({ key: m.id, name: m.name, level: levelOf(m, month), gender: m.gender, guest: false }))
  // sGuestsOnly: thành viên đi buổi đột xuất đã có mặt trong `mem` qua bảng điểm danh. Lấy cả
  // dòng thu của họ nữa là họ đứng được hai ô trên sân cùng lúc, và matchStats đếm gấp đôi.
  const gs = sGuestsOnly(db, s.id).map((sg) => {
    const g = db.guests.find((x) => x.id === sg.guestId) || { name: '—' }
    return { key: sg.guestId, name: g.name, level: sg.level, gender: sg.gender, guest: true }
  })
  return mem.concat(gs)
}

/* ---------- slot ---------- */

/** Các chỗ của một sân: c{ci}t{team}s{seat} — 2 đội × 2 chỗ. */
export function courtSlotIds(ci) {
  const out = []
  for (let team = 0; team < cfg.match.teamsPerCourt; team++) {
    for (let seat = 0; seat < cfg.match.playersPerCourt / cfg.match.teamsPerCourt; seat++) {
      out.push('c' + ci + 't' + team + 's' + seat)
    }
  }
  return out
}
/** Index các sân còn chơi (sân đã bán không sinh slot). */
export function activeCourtIdxs(s) {
  const out = []
  ;(s.courts || []).forEach((c, i) => { if (!c.sold) out.push(i) })
  return out
}
/** Mọi slot của buổi, theo thứ tự sân. */
export function slotIds(s) {
  const out = []
  activeCourtIdxs(s).forEach((ci) => out.push(...courtSlotIds(ci)))
  return out
}
export const slotCourtIdx = (slot) => parseInt(slot.slice(1, slot.indexOf('t')), 10)

/* ---------- số trận ---------- */

/** { playerKey: { n: số trận, min: tổng phút } } — chỉ tính trong buổi đó. */
export function matchStats(matches, sid) {
  const out = {}
  ;(matches || []).filter((x) => x.sessionId === sid).forEach((mt) => {
    mt.playerKeys.forEach((k) => {
      if (!out[k]) out[k] = { n: 0, min: 0 }
      out[k].n++
      out[k].min += mt.minutes
    })
  })
  return out
}

/** Câu đánh giá độ đều lượt đánh — xanh khi lệch không quá ngưỡng cấu hình. */
export function fairness(players, stats) {
  const ns = players.map((p) => (stats[p.key] ? stats[p.key].n : 0))
  if (!ns.length) return { text: '', tone: 'muted' }
  const max = Math.max(...ns)
  const min = Math.min(...ns)
  if (max === 0) return { text: t('assign.fairNone'), tone: 'muted' }
  if (max - min <= cfg.assign.fairnessThreshold) return { text: t('assign.fairEven', { min, max }), tone: 'ok' }
  return { text: t('assign.fairSkewed', { min, max }), tone: 'warn' }
}

/**
 * Hai bên lưới của một sân có cân trình độ không — so trung bình levelIdx của từng đội.
 * @param levelOfKey (playerKey) => trình độ, hoặc undefined nếu ô trống
 * @param levels thang trình độ của CLB (db.levels)
 */
export function courtBalance(lineup, ci, levelOfKey, levels) {
  const avg = (slots) => {
    const lv = slots.map((s) => lineup[s]).filter(Boolean).map((k) => levelIdx(levelOfKey(k), levels))
    return lv.length ? lv.reduce((t, x) => t + x, 0) / lv.length : null
  }
  const ids = courtSlotIds(ci)
  const a = avg([ids[0], ids[1]])
  const b = avg([ids[2], ids[3]])
  if (a === null || b === null) {
    return { text: t('assign.needFour'), color: 'var(--text-muted)' }
  }
  return Math.abs(a - b) < cfg.assign.balanceThreshold
    ? { text: t('assign.balanced'), color: 'var(--status-delivered)' }
    : { text: t('assign.skewed'), color: 'var(--status-delayed)' }
}

/* ---------- xếp ---------- */

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

/**
 * Xếp thông minh. Thuần: trả về lineup mới, không đụng state.
 * @param players danh sách người của buổi
 * @param session buổi (để lấy sân)
 * @param mode balance | fewest | rest | same | random
 * @param stats matchStats của buổi
 * @param current lineup hiện tại (chỉ dùng khi mode='rest')
 * @param groupMode có bật cố định người theo sân
 * @param courtGroups { playerKey: courtIndex } khi groupMode bật
 */
export function arrange({ players, session, mode, stats = {}, current = {}, groupMode = false, courtGroups = {}, levels }) {
  const cnt = (k) => (stats[k] ? stats[k].n : 0)
  const mins = (k) => (stats[k] ? stats[k].min : 0)
  const lu = mode === 'rest' ? { ...current } : {}
  const kept = mode === 'rest' ? Object.keys(lu).map((k) => lu[k]) : []
  const idxs = activeCourtIdxs(session)

  const order = (arr) => {
    if (mode === 'fewest' || mode === 'rest') {
      return arr.slice().sort((a, b) => cnt(a.key) - cnt(b.key) || mins(a.key) - mins(b.key) || Math.random() - 0.5)
    }
    if (mode === 'balance' || mode === 'same') {
      return arr.slice().sort((a, b) => levelIdx(b.level, levels) - levelIdx(a.level, levels))
    }
    return shuffle(arr.slice())
  }

  // Ghép mạnh nhất với nhẹ nhất vào cùng một đôi (hi/lo dồn vào giữa).
  const fillPairs = (ps, slots) => {
    const teams = []
    for (let i = 0; i + 1 < slots.length; i += 2) teams.push([slots[i], slots[i + 1]])
    let hi = 0
    let lo = ps.length - 1
    let t = 0
    while (hi < lo && t < teams.length) {
      lu[teams[t][0]] = ps[hi].key
      lu[teams[t][1]] = ps[lo].key
      hi++
      lo--
      t++
    }
    if (hi === lo && t < teams.length) lu[teams[t][0]] = ps[hi].key
  }
  const fillSeq = (ps, slots) => slots.forEach((sl, i) => { if (ps[i]) lu[sl] = ps[i].key })

  if (groupMode) {
    // Mọi mode chạy độc lập trong từng sân, không ai bị đẩy sang sân khác.
    idxs.forEach((ci) => {
      const pool = order(players.filter((p) => courtGroups[p.key] === ci && kept.indexOf(p.key) < 0))
      const slots = courtSlotIds(ci).filter((sl) => lu[sl] === undefined)
      if (mode === 'balance') fillPairs(pool, slots)
      else fillSeq(pool, slots)
    })
  } else {
    const pool = order(players.filter((p) => kept.indexOf(p.key) < 0))
    const slots = slotIds(session).filter((sl) => lu[sl] === undefined)
    if (mode === 'balance') {
      fillPairs(pool, slots)
    } else if (mode === 'same') {
      let i = 0
      idxs.forEach((ci) => {
        const cs = courtSlotIds(ci).filter((sl) => lu[sl] === undefined)
        fillSeq(pool.slice(i, i + cs.length), cs)
        i += cs.length
      })
    } else {
      fillSeq(pool, slots)
    }
  }
  return { lineup: lu, count: Object.keys(lu).length }
}

/** Chia đều người vào các sân theo trình độ, kiểu serpentine (vòng 1 xuôi, vòng 2 ngược). */
export function autoSplit(players, courtIdxs, levels) {
  const ps = players.slice().sort((a, b) => levelIdx(b.level, levels) - levelIdx(a.level, levels))
  const cg = {}
  ps.forEach((p, i) => {
    const round = Math.floor(i / courtIdxs.length)
    const pos = i % courtIdxs.length
    cg[p.key] = round % 2 === 0 ? courtIdxs[pos] : courtIdxs[courtIdxs.length - 1 - pos]
  })
  return cg
}

/**
 * Đặt một người vào một slot. Nếu slot đang có người khác thì đổi chỗ hai người.
 * Trả về lineup mới.
 */
export function place(lineup, slot, key) {
  const lu = { ...lineup }
  const prev = lu[slot]
  const from = Object.keys(lu).find((k) => lu[k] === key)
  Object.keys(lu).forEach((k) => { if (lu[k] === key) delete lu[k] })
  lu[slot] = key
  if (prev && prev !== key && from && from !== slot) lu[from] = prev
  return lu
}

/** Bỏ một người khỏi mọi slot. */
export function removePlayer(lineup, key) {
  const lu = { ...lineup }
  Object.keys(lu).forEach((k) => { if (lu[k] === key) delete lu[k] })
  return lu
}
