// Tiến lên miền Nam (bài tây dân gian, không có chủ). 2–4 người, mỗi người 13 lá. Chơi tới khi chỉ còn một người
// để xếp Nhất / Nhì / Ba / Bét, có tới trắng, chặt heo (kể cả 4 đôi thông chặt ngoài lượt), chặt chồng, cóng, thối.
//
// Game có THÔNG TIN ẨN (docs/GAMES.md §5.2): bài trên tay không nằm trong log. Server chia bài lúc bắt đầu
// (0078 game_tienlen_deal) vào bảng game_hands — mỗi người chỉ đọc được tay của mình — rồi ghi nước đầu tiên
// { deal: { first, low, n, white } } cho cả phòng: ai đi trước, lá bắt buộc của nước đầu (null nếu là ván "chơi lại",
// người về Nhất ván trước đi trước, hoặc phòng chọn options.lead = 'free'), mỗi người bao nhiêu lá, ai tới trắng
// (null nếu không ai).
// Vì vậy state ở đây KHÔNG biết bài người khác, chỉ biết số lá còn lại và các lá đã ra bàn (`gone`).
// Server kiểm nước đi bằng SQL (0078 game_tienlen_run) với ĐỦ bài từng tay, và chấm thêm phần THỐI (cần biết bài còn
// lại) — kết quả lưu trong phòng là của server. Đổi luật ở đây là phải đổi cả ở đó (tienlen.test.js chạy chung bộ
// mẫu với file kiểm 0078 để gác).
//
// Lá bài c = hạng * 4 + chất: hạng 0..12 = 3 4 5 6 7 8 9 10 J Q K A 2; chất 0..3 = bích nhép rô cơ.
// Lá to hơn = số to hơn (cùng hạng thì so chất), nên 3 bích (0) nhỏ nhất, 2 cơ (51) to nhất.
// Bộ: lẻ · đôi · sám (3 lá) · tứ quý · sảnh (≥ 3 hạng liền, không có 2) · đôi thông (≥ 3 đôi liền, không có 2).
// Chặn: cùng kiểu, cùng số lá, lá cao nhất to hơn. Chặt: 3 đôi thông chặt một heo; tứ quý chặt heo, đôi heo,
// 3 đôi thông; 4 đôi thông trở lên chặt cả tứ quý — và được chặt NGOÀI LƯỢT (kể cả đã bỏ lượt).
// Tiền chặt: hết vòng thì người bị chặt sau cùng trả người chặt sau cùng tổng giá cả chuỗi (heo đen 1, heo đỏ 2,
// 3 đôi thông 3, tứ quý 4, 4 đôi thông 4).
// Bỏ lượt là mất quyền tới hết vòng; cả bàn bỏ thì người đánh cuối mở vòng mới (người đó đã về thì người kế sau).
// Điểm hạng: 4 người +3 +1 −1 −3 · 3 người +2 0 −2 · 2 người +1 −1. Cóng (có người về Nhất mà chưa đánh lá nào):
// về chót, trừ gấp đôi điểm Bét. Rời ván: về Bét. Thối: hết ván còn heo / hàng trên tay thì trả người về Nhất.
//
// state = { started, n0[], counts[], out[], passed[], table, turn, low, gone[], order[], cong[], left[], pot, pay[],
//           over, last, ply }
//   table = null (vòng mới) | { cards, kind, len, top, seat }
//   order = ghế về đích theo thứ tự; hết ván thì là thứ hạng đủ mọi người
//   left  = ghế đã rời ván, rời sau đứng trước (rời trước về Bét)
//   pot   = null | { amount, from, to } — tiền chặt đang treo của vòng này
//   pay   = [{ from, to, amount }] — tiền chặt đã chốt
//   last  = { seat, play | pass | out, chop? }
// move  = { play: [lá] } · { pass: true } · { out: true } (server ghi khi người đó rời ván) · { deal } (server ghi)
//
// MIỀN BẮC (options.variant = 'bac', 0094): chặn phải ĐỒNG CHẤT — lẻ cùng chất, đôi / sám cùng bộ chất, sảnh phải cả
// dây cùng một chất (sảnh lẫn chất không đánh được). Heo chặn được mọi lẻ / đôi không phải heo. Không có đôi thông,
// không chặt ngoài lượt, không tới trắng, không cóng; tứ quý chặt heo, đôi heo, tứ quý nhỏ hơn. Về bằng nước có heo
// hoặc tứ quý thì bị tính "về chót" (xếp dưới người còn bài). Thối chỉ tính heo + tứ quý.
//
// ĐỒNG HỒ LƯỢT (options.time giây, 0 = không giới hạn, 0106): hạn = giờ server của nước gần nhất (`since`) + time.
// Hết giờ thì máy bất kỳ báo { timeout }; server (0106 game_tienlen_fill) kiểm theo giờ của nó rồi đi thay người tới
// lượt: đang có bộ trên bàn thì bỏ lượt, mở vòng thì đánh lá nhỏ nhất. Log ghi { timeout: true, pass | play }, áp như
// nước của người tới lượt — giống Bài bịp (0082).

export const TWO = 12
export const HAND = 13
/** Giây mỗi lượt; 0 = không giới hạn. Phòng cũ không có `time` = 0. PHẢI khớp phần đọc options ở 0106. */
export const TIMES = [0, 15, 20, 30]
export const timeOf = (o) => (TIMES.includes(o?.time) ? o.time : 0)
/** Hạn lượt hiện tại (ms, giờ server) hoặc null. */
export const deadlineOf = (s) => (s.time && s.since != null && s.started && !s.over && s.turn != null ? s.since + s.time * 1000 : null)
export const VARIANTS = ['nam', 'bac']
// Ván đầu ai cầm lá nhỏ nhất (đủ 4 người là 3♠) đi trước: 'must' = nước đầu phải có lá đó, 'free' = đánh tự do.
// Server đọc tuỳ chọn lúc chia (0094 game_tienlen_deal): 'free' thì ghi low = null — luật ở đây theo `low` của nước chia.
export const LEADS = ['must', 'free']
export const variantOf = (o) => (VARIANTS.includes(o?.variant) ? o.variant : 'nam')

export const rankOf = (c) => c >> 2
export const suitOf = (c) => c & 3

/** Mặt lá in trên bài — ký hiệu chung của bộ bài tây, không phải chữ cần dịch. Chất rô / cơ (2, 3) là chất đỏ. */
export const RANK_FACES = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
export const SUIT_MARKS = ['♠', '♣', '♦', '♥']
export const faceOf = (c) => RANK_FACES[rankOf(c)] + SUIT_MARKS[suitOf(c)]

/** Điểm theo thứ hạng, chỉ số = số người lúc chia bài. */
export const RANK_POINTS = { 2: [1, -1], 3: [2, 0, -2], 4: [3, 1, -1, -3] }

const isCard = (c) => Number.isInteger(c) && c >= 0 && c <= 51

/**
 * Kiểu của một bộ lá: { kind, len, top } hoặc null nếu không thành bộ. len = số lá (đôi thông: số đôi).
 * Miền Bắc (`bac`) thêm `mask` = các chất có trong bộ (bit 1 << chất) để so đồng chất; sảnh phải một chất, không có đôi thông.
 */
export function comboOf(cards, bac = false) {
  const k = comboNam(cards)
  if (!bac || !k) return k
  const mask = cards.reduce((m, c) => m | (1 << suitOf(c)), 0)
  if (k.kind === 'pairs' || (k.kind === 'straight' && (mask & (mask - 1)))) return null
  return { ...k, mask }
}

function comboNam(cards) {
  const cs = [...cards].sort((a, b) => a - b)
  const n = cs.length
  if (!n || new Set(cs).size !== n) return null
  const top = cs[n - 1]
  const rs = cs.map(rankOf)
  if (n === 1) return { kind: 'single', len: 1, top }
  if (n <= 4 && rs.every((r) => r === rs[0])) return { kind: ['', '', 'pair', 'triple', 'quad'][n], len: n, top }
  if (rs[n - 1] === TWO) return null
  if (n >= 3 && rs.every((r, i) => i === 0 || r === rs[i - 1] + 1)) return { kind: 'straight', len: n, top }
  if (n >= 6 && n % 2 === 0 && rs.every((r, i) => (i % 2 ? r === rs[i - 1] : i === 0 || r === rs[i - 1] + 1))) {
    return { kind: 'pairs', len: n / 2, top }
  }
  return null
}

export const isHeo = (k) => (k.kind === 'single' || k.kind === 'pair') && rankOf(k.top) === TWO
export const isBomb = (k) => k.kind === 'quad' || k.kind === 'pairs'

/** Bộ `a` có chặn / chặt được bộ đang trên bàn `t` không. */
export function beats(a, t, bac = false) {
  if (!t) return true
  if (bac) {
    if (a.kind === 'quad') return t.kind === 'quad' ? a.top > t.top : isHeo(t)
    if (a.kind !== t.kind || a.len !== t.len) return false
    if (isHeo(a) && !isHeo(t)) return true
    return a.top > t.top && (isHeo(a) || a.mask === t.mask)
  }
  if (a.kind === t.kind && a.len === t.len) return a.top > t.top
  const quad = a.kind === 'quad'
  const p3 = a.kind === 'pairs' && a.len === 3
  const p4 = a.kind === 'pairs' && a.len >= 4
  if (t.kind === 'single' && rankOf(t.top) === TWO) return quad || p3 || p4
  if (t.kind === 'pair' && rankOf(t.top) === TWO) return quad || p4
  if (t.kind === 'pairs' && t.len === 3) return quad || p4
  if (t.kind === 'quad') return p4
  if (t.kind === 'pairs' && t.len >= 4) return a.kind === 'pairs' && a.len > t.len
  return false
}

/** Giá một bộ khi bị chặt (heo đen 1, heo đỏ 2 — đôi heo cộng hai lá; 3 đôi thông 3; tứ quý, 4 đôi thông 4). */
export function priceOf(cards) {
  const k = comboOf(cards)
  if (!k) return 0
  if (isHeo(k)) return cards.reduce((sum, c) => sum + (suitOf(c) >= 2 ? 2 : 1), 0)
  if (k.kind === 'pairs') return k.len === 3 ? 3 : 4
  return k.kind === 'quad' ? 4 : 0
}

/** Số lá mỗi hạng trên một tay. */
const countRanks = (hand) => {
  const cnt = Array(13).fill(0)
  for (const c of hand) cnt[rankOf(c)] += 1
  return cnt
}

/**
 * Giá thối của bài còn trên tay: từng heo (đen 1, đỏ 2) + mỗi tứ quý (không phải heo) 4 + mỗi dải đôi thông
 * (≥ 3 hạng liền, mỗi hạng ≥ 2 lá, không có heo) 3 nếu dài 3, 4 nếu dài hơn. Server tính y vậy (0078).
 */
export function thoiOf(hand, bac = false) {
  const cnt = countRanks(hand)
  let v = hand.filter((c) => rankOf(c) === TWO).reduce((sum, c) => sum + (suitOf(c) >= 2 ? 2 : 1), 0)
  for (let r = 0; r < TWO; r++) if (cnt[r] === 4) v += 4
  if (bac) return v
  let run = 0
  for (let r = 0; r <= TWO; r++) {
    if (r < TWO && cnt[r] >= 2) { run += 1; continue }
    if (run >= 3) v += run === 3 ? 3 : 4
    run = 0
  }
  return v
}

/** Tới trắng khi vừa chia: sảnh rồng (3 → A), tứ quý heo, 5 đôi thông, hoặc 6 đôi (tứ quý tính hai đôi). */
export function whiteOf(hand) {
  const cnt = countRanks(hand)
  if (cnt.slice(0, TWO).every((k) => k >= 1)) return true
  if (cnt[TWO] === 4) return true
  if (cnt.reduce((sum, k) => sum + Math.floor(k / 2), 0) >= 6) return true
  let run = 0
  for (let r = 0; r < TWO; r++) {
    run = cnt[r] >= 2 ? run + 1 : 0
    if (run >= 5) return true
  }
  return false
}

/** Ghế đầu tiên sau `from` (vòng tròn, không tính chính nó) thoả `ok`, hoặc null. */
const nextFrom = (n, from, ok) => {
  for (let k = 1; k < n; k++) {
    const y = (from + k) % n
    if (ok(y)) return y
  }
  return null
}

/** Chốt tiền chặt đang treo của vòng. */
const closePot = (s) => (s.pot ? { ...s, pot: null, pay: [...s.pay, s.pot] } : s)

/** Hết ván: thứ hạng = người về đích theo thứ tự, người còn lại, người về chót (miền Bắc), người cóng, người rời ván. */
function end(s) {
  const s2 = closePot(s)
  const rest = s2.out.map((o, i) => (o ? null : i)).filter((i) => i != null)
  return { ...s2, order: [...s2.order, ...rest, ...s2.chot, ...s2.cong, ...s2.left], over: true, turn: null, table: null }
}

/**
 * Người `seat` vừa hết bài. Người về Nhất thì ai chưa đánh lá nào là cóng — ra khỏi ván luôn.
 * Miền Bắc: về bằng nước có heo / tứ quý (`chot`) thì ra khỏi ván nhưng xếp dưới người còn bài; không có cóng.
 */
function finish(s, seat, chot) {
  const out = s.out.map((o, i) => o || i === seat)
  if (chot) return { ...s, out, chot: [...s.chot, seat] }
  const order = [...s.order, seat]
  if (s.bac) return { ...s, out, order }
  if (order.length > 1) return { ...s, out, order }
  const cong = s.counts.map((k, i) => (!out[i] && k === s.n0[i] ? i : null)).filter((i) => i != null)
  return { ...s, out: out.map((o, i) => o || cong.includes(i)), order, cong }
}

/** Sau mỗi nước: còn ≤ 1 người → hết ván; cả bàn đã bỏ → vòng mới; còn thì chuyển lượt cho người kế chưa bỏ. */
function settle(s, seat) {
  const n = s.counts.length
  const active = s.out.map((o, i) => (o ? null : i)).filter((i) => i != null)
  if (active.length <= 1) return end(s)
  if (s.table) {
    const by = s.table.seat
    const left = active.filter((i) => !s.passed[i])
    if (!left.length || (left.length === 1 && left[0] === by)) {
      const lead = s.out[by] ? nextFrom(n, by, (y) => !s.out[y]) : by
      return { ...closePot(s), table: null, passed: s.passed.map(() => false), turn: lead }
    }
  }
  if (seat !== s.turn) return s
  return { ...s, turn: nextFrom(n, seat, (y) => !s.out[y] && !s.passed[y]) }
}

/**
 * Gợi ý: bộ nên đánh từ `hand` (lá còn trên tay mình) khi tới lượt, hoặc null nếu không bộ nào chặn được.
 * Mở vòng: bộ dài nhất có lá nhỏ nhất (nước đầu bắt lá `low` thì phải có lá đó). Chặn: bộ ít heo nhất, không phí
 * hàng (tứ quý / đôi thông), lá cao nhất nhỏ nhất. Server vẫn kiểm lại như mọi nước.
 */
export function hintOf(s, hand) {
  if (!hand?.length || s.over || !s.started) return null
  const ok = playsOf(s, hand)
  // Mở vòng: lá lẻ nhỏ nhất luôn có trong `ok` nên danh sách không bao giờ rỗng. Nước đầu thì `low` là lá nhỏ nhất.
  // Chặn: cùng kiểu cùng số lá thì lá cao nhất nhỏ hơn = ít heo hơn, nên chỉ cần đẩy hàng xuống cuối.
  const list = s.table ? ok : ok.filter(({ cs, k }) => cs.includes(s.low ?? Math.min(...hand)) && !isBomb(k))
  if (!list.length) return null
  list.sort(s.table ? (a, b) => isBomb(a.k) - isBomb(b.k) || a.k.top - b.k.top : (a, b) => b.cs.length - a.cs.length || a.k.top - b.k.top)
  return list[0].cs.slice().sort((a, b) => a - b)
}

/** Mọi bộ đánh được từ `hand` lúc này: thành bộ, chặn / chặt được bàn, nước đầu có lá `low` → [{ cs, k }]. */
export function playsOf(s, hand) {
  const ok = combosOf(hand, s.bac).map((cs) => ({ cs, k: comboOf(cs, s.bac) })).filter(({ k }) => k && beats(k, s.table, s.bac))
  return s.low != null ? ok.filter(({ cs }) => cs.includes(s.low)) : ok
}

/**
 * Các bộ có thể ghép từ `hand` (chưa xét bàn): lẻ, đôi / sám / tứ quý (mọi cách chọn), sảnh (lá nhỏ nhất mỗi hạng, hạng
 * chót thử từng lá), đôi thông (hai lá nhỏ nhất mỗi hạng). Miền Bắc: sảnh cả dây một chất, không có đôi thông.
 */
export function combosOf(hand, bac = false) {
  const by = Array.from({ length: 13 }, () => [])
  for (const c of [...hand].sort((a, b) => a - b)) by[rankOf(c)].push(c)
  const out = hand.map((c) => [c])
  // Đôi / sám / tứ quý: mọi cách chọn trong cùng hạng (miền Bắc cần đúng bộ chất).
  const pick = (xs, k, at = 0, acc = []) => {
    if (acc.length === k) { out.push(acc); return }
    for (let i = at; i < xs.length; i++) pick(xs, k, i + 1, [...acc, xs[i]])
  }
  for (const g of by) for (let k = 2; k <= g.length; k++) pick(g, k)
  // Sảnh: lá nhỏ nhất mỗi hạng, hạng chót thử từng lá (lá chót quyết định to nhỏ). Miền Bắc: cả dây một chất.
  for (let r0 = 0; r0 < TWO; r0++) {
    for (let r = r0 + 2; r < TWO && by.slice(r0, r + 1).every((g) => g.length); r++) {
      if (bac) {
        for (let su = 0; su < 4; su++) {
          const run = []
          for (let x = r0; x <= r; x++) run.push(x * 4 + su)
          if (run.every((c) => hand.includes(c))) out.push(run)
        }
      } else {
        const base = by.slice(r0, r).map((g) => g[0])
        for (const c of by[r]) out.push([...base, c])
      }
    }
  }
  // Đôi thông (miền Nam): hai lá nhỏ nhất mỗi hạng, hạng chót thử từng đôi.
  if (!bac) {
    for (let r0 = 0; r0 < TWO; r0++) {
      for (let r = r0 + 2; r < TWO && by.slice(r0, r + 1).every((g) => g.length >= 2); r++) {
        const base = by.slice(r0, r).flatMap((g) => g.slice(0, 2))
        const g = by[r]
        for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) out.push([...base, g[i], g[j]])
      }
    }
  }
  return out
}

const game = {
  id: 'tienlen',
  minPlayers: 2,
  maxPlayers: 4,
  defaultOptions: { variant: 'nam', lead: 'must', time: 20 },

  setup({ options } = {}) {
    return {
      bac: variantOf(options) === 'bac', time: timeOf(options), since: null,
      started: false, n0: [], counts: [], out: [], passed: [], table: null, turn: null, low: null, gone: [],
      order: [], cong: [], chot: [], left: [], pot: null, pay: [], over: false, last: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    if (move?.timeout === true) {
      const inner = { ...move }
      delete inner.timeout
      if (!s.started || s.over || s.turn == null) return s.over ? 'games.err.over' : 'games.err.badMove'
      // Server đã điền nước đi thay → kiểm như nước của người tới lượt.
      if (Object.keys(inner).length) return game.validate(s, s.turn, inner)
      // Máy khách báo hết giờ: chỉ server biết giờ thật (sớm thì games.err.notYet, máy tự thử lại).
      return s.time && Number.isInteger(seat) && seat >= 0 && seat < s.counts.length ? null : 'games.err.badMove'
    }
    const d = move?.deal
    if (d && typeof d === 'object') {
      if (s.started) return 'games.err.badMove'
      if (!Array.isArray(d.n) || d.n.length < 2 || d.n.length > 4 || !d.n.every((k) => Number.isInteger(k) && k >= 1 && k <= HAND)) return 'games.err.badMove'
      if (!Number.isInteger(d.first) || d.first < 0 || d.first >= d.n.length || seat !== d.first) return 'games.err.badMove'
      if (d.low != null && !isCard(d.low)) return 'games.err.badMove'
      if (d.white != null && (s.bac || !(Number.isInteger(d.white) && d.white >= 0 && d.white < d.n.length))) return 'games.err.badMove'
      return null
    }
    if (!s.started) return 'games.err.badMove'
    if (s.over) return 'games.err.over'
    if (!Number.isInteger(seat) || seat < 0 || seat >= s.counts.length || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    const mine = seat === s.turn
    if (move?.pass === true) {
      if (!mine) return 'games.err.notYourTurn'
      return s.table ? null : 'games.err.mustLead'
    }
    const p = move?.play
    // Ngoài lượt chỉ có thể là 4 đôi thông chặt (≥ 8 lá) — nước khác báo sai lượt ngay, khỏi xét bài.
    if (!mine && !(Array.isArray(p) && p.length >= 8)) return 'games.err.notYourTurn'
    if (!Array.isArray(p) || p.length < 1 || p.length > HAND || !p.every(isCard)) return 'games.err.badMove'
    // Máy này không biết bài người khác: chỉ chặn được lá đã ra bàn. Server chặn đủ (lá không có trên tay).
    if (p.some((c) => s.gone.includes(c))) return 'games.err.notYourCard'
    const k = comboOf(p, s.bac)
    if (!k) return 'games.err.badCombo'
    if (!mine) return k.kind === 'pairs' && k.len >= 4 && s.table && beats(k, s.table) ? null : 'games.err.notYourTurn'
    if (s.low != null && !p.includes(s.low)) return 'games.err.mustLow'
    if (!beats(k, s.table, s.bac)) return 'games.err.tooLow'
    return null
  },

  /** Báo hết giờ cần server đi thay — màn chơi không hiện trước. */
  request: (s, seat, move) => move?.timeout === true,
  // Dòng ở tab Nước đi (khoá i18n — lib không gọi t()). Nước hết giờ để phòng tự ghi "hết giờ".
  moveNote: (m) => (m?.timeout ? null
    : m?.deal ? { key: 'games.tienlen.noteDeal' }
      : m?.pass ? { key: 'games.tienlen.notePass' }
        : Array.isArray(m?.play) ? { key: 'games.tienlen.notePlay', params: { cards: [...m.play].sort((a, b) => a - b).map(faceOf).join(' ') } }
          : null),

  /** Áp nước; nước hết giờ áp như của người tới lượt. Ghi giờ server của nước (`since`) để tính hạn lượt sau. */
  apply(s0, seat, move, meta) {
    let s
    if (move.timeout === true) {
      const inner = { ...move }
      delete inner.timeout
      if (!Object.keys(inner).length) return s0 // chưa qua server
      s = game.act(s0, s0.turn, inner)
      s = { ...s, last: { ...s.last, timeout: true } }
    } else {
      s = game.act(s0, seat, move)
    }
    const at = Date.parse(meta?.at)
    return Number.isFinite(at) ? { ...s, since: at } : s
  },

  act(s0, seat, move) {
    const s = { ...s0, ply: s0.ply + 1 }
    if (move.deal) {
      const { n, first, low, white } = move.deal
      const base = {
        ...s, started: true, n0: n.slice(), counts: n.slice(), out: n.map(() => false), passed: n.map(() => false),
        turn: first, low: low ?? null, last: null,
      }
      if (white == null) return base
      return { ...base, over: true, turn: null, order: [white, ...n.map((_, i) => i).filter((i) => i !== white)], last: { seat: white, white: true } }
    }
    if (move.out === true) {
      return settle({ ...s, out: s.out.map((o, i) => o || i === seat), left: [seat, ...s.left], last: { seat, out: true } }, seat)
    }
    if (move.pass === true) {
      return settle({ ...s, passed: s.passed.map((v, i) => v || i === seat), last: { seat, pass: true } }, seat)
    }
    const cards = [...move.play].sort((a, b) => a - b)
    const k = comboOf(cards, s.bac)
    let pot = s.pot
    let chop = false
    if (s.table && isBomb(k)) {
      const t = comboOf(s.table.cards, s.bac)
      if (isHeo(t) || isBomb(t)) {
        chop = true
        pot = { amount: (pot?.amount || 0) + priceOf(s.table.cards), from: s.table.seat, to: seat }
      }
    }
    const counts = s.counts.map((x, i) => (i === seat ? x - cards.length : x))
    // Chặt ngoài lượt: coi như tới lượt người chặt, lượt sau đi tiếp từ họ. Người chặt được vào lại vòng.
    let next = {
      ...s, counts, gone: [...s.gone, ...cards], table: { cards, ...k, seat }, low: null, pot, turn: seat,
      passed: s.passed.map((v, i) => (i === seat ? false : v)), last: { seat, play: cards, ...(chop ? { chop: true } : {}) },
    }
    if (counts[seat] <= 0) next = finish(next, seat, s.bac && (k.kind === 'quad' || cards.some((c) => rankOf(c) === TWO)))
    return settle(next, seat)
  },

  view: (s) => s,

  /**
   * Thứ hạng + điểm (hạng, cóng, tiền chặt) khi hết ván. Server cộng thêm THỐI — bài còn trên tay — nên điểm
   * trong `room.result` mới là điểm chốt. `winners` = người về Nhất.
   */
  result(s) {
    if (!s.over) return null
    return { winners: [s.order[0]], draw: false, ranks: s.order, scores: tally(s) }
  },
}

export default game

/** Điểm hạng + cóng + tiền chặt, chưa tính thối. */
export function tally(s) {
  const n = s.n0.length
  const pts = RANK_POINTS[n]
  const scores = Object.fromEntries(s.n0.map((_, i) => [i, 0]))
  s.order.forEach((seat, pos) => { scores[seat] += s.cong.includes(seat) ? pts[n - 1] * 2 : pts[pos] })
  for (const p of s.pay) { scores[p.from] -= p.amount; scores[p.to] += p.amount }
  return scores
}
