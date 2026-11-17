// Máy Cờ vây (phòng chơi với máy): Monte Carlo phẳng — mỗi nước ứng viên được thử bằng nhiều ván ngẫu nhiên đánh tới hết
// (hai bên đặt quân bừa nhưng không lấp mắt mình), chấm theo vùng + komi như covay.js, chọn nước thắng nhiều nhất. Lượt
// thử chia cho các ứng viên theo UCB1 (nước đang tốt được thử thêm). Dừng khi đủ số ván thử hoặc hết hạn giờ (`ms`) —
// bàn 19 × 19 thử được ít ván hơn nên yếu hơn bàn 9 × 9.
// Bàn trong lúc thử là mảng số (0 trống · 1 Đen · 2 Trắng) + danh sách ô trống, không chép state của luật — nhanh hơn
// covay.place nhiều lần. Ứng viên ở gốc vẫn lọc bằng đúng luật covay.js (validate) nên máy không bao giờ đi sai luật.
// Mức Dễ: không thử, ăn quân được thì ăn, không thì đặt bừa (không lấp mắt mình).
// Bỏ lượt: không còn nước nào ngoài lấp mắt mình, hoặc đối thủ vừa bỏ lượt mà đếm vùng lúc này mình đang thắng.

import covay, { areaOf, KOMI } from '#lib/games/covay.js'

/** Số ván thử / hạn giờ (ms) mỗi nước theo mức. */
export const GO_LEVELS = { easy: { playouts: 0, ms: 0 }, normal: { playouts: 1500, ms: 900 }, hard: { playouts: 6000, ms: 2500 } }

// Hình học theo cỡ bàn (ô kề) + mảng nháp dùng lại — Worker chạy một luồng nên dùng chung được.
const GEO = new Map()
function geometry(n) {
  if (GEO.has(n)) return GEO.get(n)
  const NN = n * n
  const nb = new Int32Array(NN * 4).fill(-1)
  for (let i = 0; i < NN; i++) {
    const r = Math.floor(i / n)
    const c = i % n
    if (r > 0) nb[i * 4] = i - n
    if (r < n - 1) nb[i * 4 + 1] = i + n
    if (c > 0) nb[i * 4 + 2] = i - 1
    if (c < n - 1) nb[i * 4 + 3] = i + 1
  }
  const g = { n, NN, nb, stamp: new Int32Array(NN), stack: new Int32Array(NN), group: new Int32Array(NN), mark: 0 }
  GEO.set(n, g)
  return g
}

/** Nhóm chứa p: còn khí → -1; hết khí → số quân (các quân nằm ở g.group[0..số quân)). */
function groupDead(g, b, p) {
  const color = b[p]
  const m = ++g.mark
  let sp = 0
  let cnt = 0
  g.stack[sp++] = p
  g.stamp[p] = m
  while (sp) {
    const x = g.stack[--sp]
    g.group[cnt++] = x
    for (let k = 0; k < 4; k++) {
      const y = g.nb[x * 4 + k]
      if (y < 0) continue
      const v = b[y]
      if (v === 0) return -1
      if (v === color && g.stamp[y] !== m) { g.stamp[y] = m; g.stack[sp++] = y }
    }
  }
  return cnt
}

const addEmpty = (st, p) => { st.pos[p] = st.nEmpty; st.empties[st.nEmpty++] = p }
const dropEmpty = (st, p) => {
  const i = st.pos[p]
  const last = st.empties[--st.nEmpty]
  st.empties[i] = last
  st.pos[last] = i
}

/** Đặt quân `color` (1 | 2) vào p — false nếu không được (có quân, ko, tự sát). Sửa `st` tại chỗ. */
function play(g, st, p, color) {
  const b = st.b
  if (b[p] !== 0 || p === st.ko) return false
  b[p] = color
  const opp = 3 - color
  let captured = 0
  let capAt = -1
  for (let k = 0; k < 4; k++) {
    const y = g.nb[p * 4 + k]
    if (y < 0 || b[y] !== opp) continue
    const c = groupDead(g, b, y)
    if (c <= 0) continue
    for (let j = 0; j < c; j++) { const z = g.group[j]; b[z] = 0; addEmpty(st, z) }
    captured += c
    capAt = y
  }
  if (captured === 0 && groupDead(g, b, p) !== -1) { b[p] = 0; return false }
  dropEmpty(st, p)
  // Ko: vừa ăn đúng một quân bằng một quân đơn còn đúng một khí → cấm ăn lại ngay ở điểm vừa bị ăn.
  let own = 0
  let libs = 0
  for (let k = 0; k < 4; k++) {
    const y = g.nb[p * 4 + k]
    if (y < 0) continue
    if (b[y] === color) own++
    else if (b[y] === 0) libs++
  }
  st.ko = captured === 1 && own === 0 && libs === 1 ? capAt : -1
  return true
}

/** Mắt một ô của `color`: mọi ô kề (trong bàn) đều là quân `color`. */
function isEye(g, b, p, color) {
  for (let k = 0; k < 4; k++) {
    const y = g.nb[p * 4 + k]
    if (y >= 0 && b[y] !== color) return false
  }
  return true
}

/** Điểm vùng (Đen − Trắng − komi) của bàn cuối ván thử: quân + ô trống chỉ giáp một màu. */
function score(g, b) {
  let black = 0
  let white = 0
  for (let p = 0; p < g.NN; p++) {
    let v = b[p]
    if (v === 0) {
      let seen = 0
      for (let k = 0; k < 4; k++) {
        const y = g.nb[p * 4 + k]
        if (y >= 0 && b[y]) seen |= b[y]
      }
      v = seen === 1 || seen === 2 ? seen : 0
    }
    if (v === 1) black++
    else if (v === 2) white++
  }
  return black - white - KOMI
}

/** Đánh ngẫu nhiên tới khi hai bên cùng hết nước (hoặc quá dài) → điểm Đen − Trắng − komi. */
function playout(g, st, color, rand) {
  let passes = 0
  const limit = g.NN * 3
  for (let moves = 0; passes < 2 && moves < limit; moves++) {
    let played = false
    const n = st.nEmpty
    if (n) {
      const start = Math.floor(rand() * n)
      for (let t = 0; t < n; t++) {
        const p = st.empties[(start + t) % n]
        if (isEye(g, st.b, p, color)) continue
        if (play(g, st, p, color)) { played = true; break }
      }
    }
    if (played) passes = 0
    else { passes++; st.ko = -1 }
    color = 3 - color
  }
  return score(g, st.b)
}

/** State của luật → bàn thử. */
function fromState(g, s) {
  const b = new Int8Array(g.NN)
  const st = { b, ko: s.ko ?? -1, empties: new Int32Array(g.NN), pos: new Int32Array(g.NN), nEmpty: 0 }
  s.board.forEach((v, p) => { if (v == null) addEmpty(st, p); else b[p] = v + 1 })
  return st
}
const clone = (st) => ({ b: st.b.slice(), ko: st.ko, empties: st.empties.slice(), pos: st.pos.slice(), nEmpty: st.nEmpty })

/** Nước của máy cho ghế `seat` → { i } | { pass: true }. `override` = { playouts, ms } (test). */
export function goBot(s, seat, level, rand = Math.random, override) {
  const g = geometry(s.size)
  const color = seat + 1
  const base = fromState(g, s)
  // Ứng viên: đúng luật (covay.validate) và không lấp mắt mình.
  const cands = []
  for (let p = 0; p < g.NN; p++) {
    if (s.board[p] != null || isEye(g, base.b, p, color)) continue
    if (covay.validate(s, seat, { i: p }) == null) cands.push(p)
  }
  const area = areaOf(s.board, s.size)
  const lead = (seat === 0 ? 1 : -1) * (area.b - area.w - KOMI)
  if (!cands.length || (s.last?.pass && s.last.seat !== seat && lead > 0)) return { pass: true }

  const cfg = { ...GO_LEVELS[level] || GO_LEVELS.normal, ...override }
  if (!cfg.playouts) {
    // Dễ: ăn được nhiều quân nhất thì ăn, không thì đặt bừa.
    let best = null
    let most = 0
    for (const p of cands) {
      const st = clone(base)
      const before = st.nEmpty
      play(g, st, p, color)
      const took = st.nEmpty - before + 1
      if (took > most) { most = took; best = p }
    }
    return { i: best ?? cands[Math.floor(rand() * cands.length)] }
  }

  const wins = new Float64Array(cands.length)
  const runs = new Float64Array(cands.length)
  const end = Date.now() + (cfg.ms || Infinity)
  let total = 0
  for (; total < cfg.playouts && (total & 31 || Date.now() < end); total++) {
    // UCB1: chưa thử thì thử trước, rồi ưu tiên nước tỉ lệ thắng cao + ít được thử.
    let k = total < cands.length ? total : 0
    if (total >= cands.length) {
      let bestV = -Infinity
      const lg = Math.log(total)
      for (let j = 0; j < cands.length; j++) {
        const v = wins[j] / runs[j] + Math.sqrt((1.4 * lg) / runs[j])
        if (v > bestV) { bestV = v; k = j }
      }
    }
    const st = clone(base)
    play(g, st, cands[k], color)
    const sc = playout(g, st, 3 - color, rand)
    runs[k]++
    if ((sc > 0) === (seat === 0)) wins[k]++
  }
  // Nước được thử nhiều nhất (ổn định hơn tỉ lệ cao nhất của nước ít thử); bằng nhau thì xem tỉ lệ thắng.
  let pick = 0
  for (let j = 1; j < cands.length; j++) {
    if (runs[j] > runs[pick] || (runs[j] === runs[pick] && wins[j] > wins[pick])) pick = j
  }
  // Ván đã ngã ngũ (gần như chắc thua) và đối thủ vừa bỏ lượt → bỏ lượt cho xong ván.
  if (s.last?.pass && s.last.seat !== seat && runs[pick] && wins[pick] / runs[pick] < 0.02) return { pass: true }
  return { i: cands[pick] }
}
