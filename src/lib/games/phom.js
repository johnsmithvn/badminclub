// Phỏm / Tá lả — bản miền Bắc phổ biến, chủ dự án duyệt 2026-11-09 (docs/GAMES.md §12). 2–4 người, bộ 52 lá.
//   - Chia: mỗi người 9 lá, người đi đầu 10 lá, còn lại úp làm nọc. Ván đầu server bốc ngẫu nhiên người đi đầu, ván chơi
//     lại người về Nhất ván trước đi đầu (0090 game_phom_deal).
//   - Lượt: ăn lá người ngồi trước vừa đánh nếu nó ghép thành phỏm với bài trên tay, không thì bốc 1 lá nọc; rồi đánh 1
//     lá vào chồng bài trước mặt. Người đi đầu lượt đầu chỉ đánh. Lá ăn để ngửa, khi hạ phải nằm trong phỏm, một phỏm
//     không chứa hai lá ăn — nên chỉ được ăn khi vẫn xếp được mọi lá ăn vào các phỏm rời nhau, và không được đánh lá làm
//     hỏng điều đó (kể cả đánh chính lá đã ăn).
//   - Chuyển bài: Q ăn lá của P → lá đó rời chồng P, lá trên cùng chồng Q chuyển sang chồng P (Q chưa có lá nào thì
//     thôi). Chồng P giữ số lá, chồng Q thiếu một → Q đánh thêm một lượt, hạ muộn hơn. Số lá phải bốc luôn là
//     4 × số người − 1 (4 người: đúng 15 lá nọc).
//   - Phỏm: ≥ 3 lá cùng số, hoặc ≥ 3 lá liên tiếp cùng chất (A = 1: A-2-3 được, Q-K-A không).
//   - Hạ: tới lượt mà chồng đã có 3 lá thì sau khi ăn / bốc phải hạ (không có phỏm là móm), được gửi lá rác vào phỏm của
//     người hạ trước (phải hạ ít nhất một phỏm mới được gửi), rồi đánh lá thứ 4 — lá chốt. Chồng đủ 4 lá là xong; mọi
//     người xong thì hết ván. (Người đã hạ mà chồng lại thiếu lá thì đánh thêm lượt, không hạ lại — với luật chuyển bài
//     trên thì không xảy ra, chỉ để ván không kẹt.)
//   - Ù: chưa hạ, sau khi ăn / bốc (hoặc người đi đầu ở lượt đầu) mà 9 lá thành phỏm (lá thứ 10 đánh luôn) → thắng ngay;
//     cả 10 lá → ù tròn. Ù khan: vừa chia đã không có đôi / cạ nào (server kiểm lúc chia).
//   - Điểm rác: A = 1 … K = 13. Ít điểm nhất về Nhất; bằng điểm ai hạ trước hơn. Móm xếp sau mọi người không móm; người
//     rời ván xếp cuối (rời trước đứng dưới).
//   - Thưởng / phạt (điểm): Nhì −1, Ba −2, người xếp cuối −3, móm −4 thay điểm hạng; Nhất nhận tổng. Mỗi lá bị ăn: người
//     bị ăn trả người ăn 1, ăn lá chốt (lá đánh sau khi đã hạ) trả 4. Ù: mỗi người trả 5 (ù tròn 10, ù khan 5); người ù
//     đã ăn ≥ 3 lá của cùng một người thì người đó đền thay cả làng.
//
// THÔNG TIN ẨN (docs/GAMES.md §5.2): bài trên tay ở game_hands (nọc ở ghế -1). Máy khách gửi { draw } · { eat } ·
// { discard } · { lay, send } · { u }; server (0090 game_phom_fill) kiểm với bài thật, sửa game_hands rồi ghi log:
// { draw: true } (không lộ lá) · { eat: lá } · { discard: lá } · { lay, send } · { u, tron, discard }. Kết quả (cần điểm
// rác trên tay) chỉ server chấm (game_phom_result) — result() ở đây trả `pending`.
// `referee` / `judge` / `dealMove` bên dưới là bản JS của server, chỉ test và bộ mẫu dùng. Đổi luật ở đây là phải đổi
// cả 0090 (phom.test.js chạy chung bộ ván mẫu với file kiểm 0090).
//
// Lá c = 0..51: hạng r = c >> 2 (0 = A … 12 = K), chất c & 3 (♠ ♣ ♦ ♥). Điểm lá = hạng + 1.
// state = { started, n, first, out[], left[] (ghế rời, theo thứ tự rời), counts[] (số lá trên tay), stock (số lá nọc),
//   piles[][] (chồng bài đã đánh trước mặt từng người, lá trên cùng ở cuối), turn, step ('take' | 'lay' | 'discard'),
//   last { seat, card, chot } (lá vừa đánh, còn ăn được) | null, eaten [{ card, by, from, chot }], melds[] (null = chưa
//   hạ | [[lá]] — gửi bài cộng vào đây), order[] (thứ tự hạ), mom[], u { seat, tron, khan } | null, over, act, ply }

export const HAND = 9
export const PILE = 4
export const PAY = { eat: 1, chot: 4, u: 5, tron: 10, mom: 4, last: 3 }

export const rankOf = (c) => c >> 2
export const suitOf = (c) => c & 3
export const pointsOf = (c) => rankOf(c) + 1
/** Mặt lá in trên bài — ký hiệu chung của bộ bài tây, không phải chữ cần dịch. */
export const RANK_FACES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUIT_MARKS = ['♠', '♣', '♦', '♥']
export const faceOf = (c) => RANK_FACES[rankOf(c)] + SUIT_MARKS[suitOf(c)]

const isCard = (c) => Number.isInteger(c) && c >= 0 && c <= 51
const sortNum = (a) => [...a].sort((x, y) => x - y)

/** Phỏm hợp lệ: ≥ 3 lá khác nhau, cùng số — hoặc cùng chất và hạng liên tiếp (A thấp nhất, không vòng). */
export function meldOk(cards) {
  if (!Array.isArray(cards) || cards.length < 3 || !cards.every(isCard) || new Set(cards).size !== cards.length) return false
  const rs = cards.map(rankOf)
  if (rs.every((r) => r === rs[0])) return true
  if (!cards.every((c) => suitOf(c) === suitOf(cards[0]))) return false
  return Math.max(...rs) - Math.min(...rs) === cards.length - 1
}

/** Các cặp lá trên tay ghép với lá e thành phỏm 3 lá (bộ hoặc dây). */
function pairsFor(e, hand) {
  const r = rankOf(e)
  const s = suitOf(e)
  const out = []
  const same = hand.filter((c) => rankOf(c) === r)
  for (let i = 0; i < same.length; i++) for (let j = i + 1; j < same.length; j++) out.push([same[i], same[j]])
  const at = (k) => (k >= 0 && k <= 12 && hand.includes(k * 4 + s) ? k * 4 + s : null)
  for (const [a, b] of [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]]) {
    const x = at(a)
    const y = at(b)
    if (x != null && y != null) out.push([x, y])
  }
  return out
}

/**
 * Xếp được mọi lá ăn (`eaten`) vào các phỏm rời nhau, mỗi phỏm đúng một lá ăn + lá trên tay (`hand`, không gồm lá ăn)
 * không. Đủ xét phỏm 3 lá: phỏm dài hơn có lá ăn luôn rút được về 3 lá còn chứa nó. PHẢI khớp game_phom_cover (0090).
 */
export function cover(hand, eaten) {
  if (!eaten.length) return true
  const [e, ...rest] = eaten
  return pairsFor(e, hand).some(([a, b]) => cover(hand.filter((c) => c !== a && c !== b), rest))
}

/** Ù khan: không có hai lá nào cùng số, hay cùng chất cách nhau ≤ 2 hạng (đôi / cạ). PHẢI khớp game_phom_khan. */
export function khanOf(hand) {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const a = hand[i]
      const b = hand[j]
      if (rankOf(a) === rankOf(b) || (suitOf(a) === suitOf(b) && Math.abs(rankOf(a) - rankOf(b)) <= 2)) return false
    }
  }
  return true
}

/** Mọi phỏm có thể ghép từ `cards`: bộ 3–4 lá cùng số (mọi tổ hợp) và mọi đoạn dây ≥ 3 lá cùng chất. */
export function meldsIn(cards) {
  const out = []
  for (let r = 0; r < 13; r++) {
    const g = sortNum(cards.filter((c) => rankOf(c) === r))
    if (g.length === 3) out.push(g)
    if (g.length === 4) out.push(g, ...g.map((skip) => g.filter((c) => c !== skip)))
  }
  for (let s = 0; s < 4; s++) {
    for (let lo = 0; lo < 13; lo++) {
      const run = []
      for (let r = lo; r < 13 && cards.includes(r * 4 + s); r++) {
        run.push(r * 4 + s)
        if (run.length >= 3) out.push(run.slice())
      }
    }
  }
  return out
}

/**
 * Cách xếp phỏm tốt nhất cho `hand` (gồm cả lá ăn `eaten`): các phỏm rời nhau, mỗi lá ăn nằm trong đúng một phỏm, không
 * phỏm nào có hai lá ăn. `better(a, b)` so hai cách (mảng phỏm) — mặc định: bớt được nhiều điểm rác hơn, rồi nhiều lá
 * hơn. null nếu không xếp nổi lá ăn. Chỉ máy khách dùng để gợi ý (server không cần — người chơi tự gửi cách xếp).
 */
export function bestLay(hand, eaten = [], better = byPoints) {
  const pool = meldsIn(hand).filter((m) => m.filter((c) => eaten.includes(c)).length <= 1)
  let best = null
  const walk = (k, used, picked) => {
    if (eaten.every((e) => used.has(e)) && (!best || better(picked, best))) best = picked.slice()
    for (let i = k; i < pool.length; i++) {
      const m = pool[i]
      if (m.some((c) => used.has(c))) continue
      for (const c of m) used.add(c)
      picked.push(m)
      walk(i + 1, used, picked)
      picked.pop()
      for (const c of m) used.delete(c)
    }
  }
  walk(0, new Set(), [])
  return best
}
const sumPts = (melds) => melds.flat().reduce((a, c) => a + pointsOf(c), 0)
const byPoints = (a, b) => sumPts(a) > sumPts(b) || (sumPts(a) === sumPts(b) && a.flat().length > b.flat().length)
const byCount = (a, b) => a.flat().length > b.flat().length || (a.flat().length === b.flat().length && byPoints(a, b))

/** Ù được không với `hand` (10 lá, gồm lá ăn `eaten`) → phỏm phủ ≥ 9 lá, hoặc null. */
export function uOf(hand, eaten = []) {
  const best = bestLay(hand, eaten, byCount)
  return best && best.flat().length >= hand.length - 1 ? best : null
}

/**
 * Gợi ý gửi bài: lá rác `rest` nào ghép được vào phỏm đã hạ của người khác (`melds`, theo ghế) → [[ghế, phỏm, lá]].
 * Tham lam theo lá điểm cao trước; dây có thể nối dài dần (gửi 5 rồi 6).
 */
export function sendsFor(rest, melds, seat) {
  const work = melds.map((ms) => (ms ? ms.map((m) => m.slice()) : null))
  const left = sortNum(rest).reverse()
  const out = []
  let moved = true
  while (moved) {
    moved = false
    for (const c of left.slice()) {
      let done = false
      work.forEach((ms, to) => {
        if (done || !ms || to === seat) return
        ms.forEach((m, k) => {
          if (done || !meldOk([...m, c])) return
          ms[k] = sortNum([...m, c])
          out.push([to, k, c])
          left.splice(left.indexOf(c), 1)
          done = true
          moved = true
        })
      })
    }
  }
  return out
}

/** Lá ăn của ghế chưa nằm trong phỏm đã hạ (chưa hạ thì là mọi lá đã ăn). */
export const pendingOf = (s, seat) => (s.melds[seat] ? [] : s.eaten.filter((e) => e.by === seat).map((e) => e.card))

/** Lá `c` đã lộ ra ở chỗ khác (chồng bài, phỏm đã hạ, lá người khác ăn) — chắc chắn không nằm trên tay `seat`. */
function seen(s, c, seat) {
  if (s.piles.some((p) => p.includes(c))) return true
  if (s.melds.some((ms) => ms && ms.some((m) => m.includes(c)))) return true
  return s.eaten.some((e) => e.card === c && e.by !== seat)
}

const laid = (s, seat) => s.melds[seat] != null
const done = (s, seat) => laid(s, seat) && s.piles[seat].length >= PILE

/** Người kế tiếp còn chơi (chưa rời, chưa xong) sau `from` — kể cả chính `from` ở vòng cuối; không còn ai thì null. */
function nextActive(s, from) {
  for (let k = 1; k <= s.n; k++) {
    const y = (from + k) % s.n
    if (!s.out[y] && !done(s, y)) return y
  }
  return null
}

/** Bước sau khi ăn / bốc: chưa hạ mà chồng đủ 3 lá thì phải hạ; còn lại là đánh. */
const stepAfterTake = (s, seat) => (!laid(s, seat) && s.piles[seat].length === PILE - 1 ? 'lay' : 'discard')

/** Mảng các phỏm, mỗi phỏm là mảng lá 0..51 — dạng khác thì server trả badMove (game_phom_melds trả NULL). */
const meldsShape = (m) => Array.isArray(m) && m.every((x) => Array.isArray(x) && x.every(isCard))
/** Mảng phỏm → mỗi phỏm sắp tăng dần; sai dạng trả nguyên để kiểm báo lỗi. */
const normMelds = (m) => (meldsShape(m) ? m.map(sortNum) : m)

/**
 * Kiểm một cách xếp phỏm (hạ hoặc ù): đúng dạng, phỏm hợp lệ, rời nhau, lá là của người này (`owns` — máy khách: chưa lộ
 * ở chỗ khác; trọng tài / server: có trên tay), lá ăn đặt đúng luật. THỨ TỰ KIỂM = thứ tự mã lỗi, PHẢI khớp 0090.
 */
function meldsErr(s, seat, melds, owns) {
  if (!meldsShape(melds)) return 'games.err.badMove'
  if (!melds.every(meldOk)) return 'games.err.badMeld'
  const all = melds.flat()
  if (new Set(all).size !== all.length) return 'games.err.badMeld'
  if (!all.every(owns)) return 'games.err.notYourCard'
  const pend = pendingOf(s, seat)
  if (!pend.every((p) => melds.filter((m) => m.includes(p)).length === 1)) return 'games.err.eatenMeld'
  if (melds.some((m) => m.filter((c) => pend.includes(c)).length > 1)) return 'games.err.eatenMeld'
  return null
}

function layErr(s, seat, melds, sends, owns) {
  const e = meldsErr(s, seat, melds, owns)
  if (e) return e
  if (!Array.isArray(sends)) return 'games.err.badMove'
  if (sends.length && !melds.length) return 'games.err.momSend'
  const all = melds.flat()
  const pend = pendingOf(s, seat)
  const work = s.melds.map((ms) => (ms ? ms.map((m) => m.slice()) : null))
  const sent = []
  for (const x of sends) {
    if (!Array.isArray(x) || x.length !== 3 || !x.every(Number.isInteger)) return 'games.err.badSend'
    const [to, k, c] = x
    if (to === seat || to < 0 || to >= s.n || !work[to] || k < 0 || k >= work[to].length) return 'games.err.badSend'
    if (!isCard(c) || all.includes(c) || sent.includes(c) || pend.includes(c) || !owns(c)) return 'games.err.badSend'
    if (!meldOk([...work[to][k], c])) return 'games.err.badSend'
    work[to][k] = sortNum([...work[to][k], c])
    sent.push(c)
  }
  // Hạ / gửi xong vẫn phải còn ít nhất một lá để đánh — phỏm phủ hết bài là ù, không phải hạ.
  return all.length + sent.length <= s.counts[seat] - 1 ? null : 'games.err.badMove'
}

function uErr(s, seat, move) {
  const melds = move.u
  const e = meldsErr(s, seat, melds, (c) => !seen(s, c, seat))
  if (e) return e
  const k = melds.flat().length
  const n = s.counts[seat]
  if (move.tron === undefined) return k === n || k === n - 1 ? null : 'games.err.notU'
  if (typeof move.tron !== 'boolean') return 'games.err.badMove'
  if (move.tron) return k === n && move.discard == null ? null : 'games.err.notU'
  const d = move.discard
  return k === n - 1 && isCard(d) && !melds.flat().includes(d) && !seen(s, d, seat) ? null : 'games.err.notU'
}

function dealOk(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.n) || d.n.length < 2 || d.n.length > 4) return false
  const n = d.n.length
  if (!Number.isInteger(d.first) || d.first < 0 || d.first >= n) return false
  if (!d.n.every((k, i) => k === (i === d.first ? HAND + 1 : HAND))) return false
  if (d.stock !== 52 - d.n.reduce((a, b) => a + b, 0)) return false
  return d.khan == null || (Number.isInteger(d.khan) && d.khan >= 0 && d.khan < n)
}

export default {
  id: 'phom',
  minPlayers: 2,
  maxPlayers: 4,
  defaultOptions: {},

  setup() {
    return {
      started: false, n: 0, first: null, out: [], left: [], counts: [], stock: 0, piles: [], turn: null, step: null,
      last: null, eaten: [], melds: [], order: [], mom: [], u: null, over: false, act: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (move?.deal !== undefined) return !s.started && dealOk(move.deal) && seat === move.deal.first ? null : 'games.err.badMove'
    if (!s.started) return 'games.err.badMove'
    if (!Number.isInteger(seat) || seat < 0 || seat >= s.n || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (move?.draw === true) return s.step !== 'take' ? 'games.err.badMove' : s.stock > 0 ? null : 'games.err.pileEmpty'
    if (move?.eat !== undefined) {
      if (s.step !== 'take') return 'games.err.badMove'
      if (!s.last) return 'games.err.nothingToEat'
      return move.eat === true || move.eat === s.last.card ? null : 'games.err.badMove'
    }
    if (move?.u !== undefined) {
      if ((s.step !== 'discard' && s.step !== 'lay') || laid(s, seat)) return 'games.err.badMove'
      return uErr(s, seat, move)
    }
    if (move?.lay !== undefined) {
      return s.step === 'lay' ? layErr(s, seat, move.lay, move.send ?? [], (c) => !seen(s, c, seat)) : 'games.err.badMove'
    }
    if (move?.discard !== undefined) {
      if (s.step !== 'discard') return 'games.err.badMove'
      const c = move.discard
      if (!isCard(c) || seen(s, c, seat)) return 'games.err.notYourCard'
      return pendingOf(s, seat).includes(c) ? 'games.err.keepEaten' : null
    }
    return 'games.err.badMove'
  },

  /** Mọi nước của người chơi đều cần server (bài thật trên tay) — màn chơi không hiện trước, ghi xong nạp lại. */
  request: (s, seat, move) => move?.out !== true,

  apply(s0, seat, move) {
    const s = { ...s0, ply: s0.ply + 1 }
    if (move.deal) {
      const { n: counts, first, stock, khan } = move.deal
      const n = counts.length
      const base = {
        ...s, started: true, n, first, out: Array(n).fill(false), left: [], counts: counts.slice(), stock,
        piles: Array.from({ length: n }, () => []), turn: first, step: 'discard', last: null, eaten: [],
        melds: Array(n).fill(null), order: [], mom: Array(n).fill(false), act: null,
      }
      return khan == null ? base : { ...base, over: true, turn: null, step: null, u: { seat: khan, tron: false, khan: true } }
    }
    if (move.out === true) {
      const next = { ...s, out: s.out.map((o, i) => o || i === seat), left: [...s.left, seat], act: { seat, out: true } }
      if (next.last?.seat === seat) next.last = null
      if (next.out.filter((o) => !o).length <= 1) return { ...next, over: true, turn: null, step: null }
      if (s.turn !== seat) return next
      const t = nextActive(next, seat)
      return t == null ? { ...next, over: true, turn: null, step: null } : { ...next, turn: t, step: 'take' }
    }
    if (move.draw === true) {
      const next = { ...s, counts: s.counts.map((k, i) => (i === seat ? k + 1 : k)), stock: s.stock - 1, act: { seat, draw: true } }
      return { ...next, step: stepAfterTake(next, seat) }
    }
    if (move.eat !== undefined) {
      const { card, seat: from, chot } = s.last
      const piles = s.piles.map((p) => p.slice())
      piles[from] = piles[from].filter((c) => c !== card)
      // Chuyển bài: lá trên cùng chồng người ăn sang chồng người bị ăn (người ăn chưa đánh lá nào thì thôi).
      if (piles[seat].length) piles[from].push(piles[seat].pop())
      const next = {
        ...s, piles, last: null, counts: s.counts.map((k, i) => (i === seat ? k + 1 : k)),
        eaten: [...s.eaten, { card, by: seat, from, chot }], act: { seat, eat: card, from, chot },
      }
      return { ...next, step: stepAfterTake(next, seat) }
    }
    if (move.u !== undefined) {
      const melds = normMelds(move.u)
      const tron = typeof move.tron === 'boolean' ? move.tron : melds.flat().length === s.counts[seat]
      return { ...s, over: true, turn: null, step: null, u: { seat, tron, khan: false }, act: { seat, u: melds, tron } }
    }
    if (move.lay !== undefined) {
      const melds = normMelds(move.lay)
      const sends = move.send ?? []
      const all = s.melds.map((ms, i) => (i === seat ? melds : ms ? ms.map((m) => m.slice()) : null))
      for (const [to, k, c] of sends) all[to][k] = sortNum([...all[to][k], c])
      const gone = melds.flat().length + sends.length
      return {
        ...s, melds: all, order: [...s.order, seat], mom: s.mom.map((v, i) => (i === seat ? melds.length === 0 : v)),
        counts: s.counts.map((k, i) => (i === seat ? k - gone : k)), step: 'discard', act: { seat, lay: melds, send: sends },
      }
    }
    // Đánh một lá — lá đánh sau khi đã hạ là lá chốt.
    const c = move.discard
    const piles = s.piles.map((p, i) => (i === seat ? [...p, c] : p))
    const next = {
      ...s, piles, counts: s.counts.map((k, i) => (i === seat ? k - 1 : k)), last: { seat, card: c, chot: laid(s, seat) },
      act: { seat, discard: c },
    }
    const t = nextActive(next, seat)
    return t == null ? { ...next, over: true, turn: null, step: null } : { ...next, turn: t, step: 'take' }
  },

  view: (s) => s,

  /** Hết ván: thứ hạng và điểm cần bài trên tay → server chấm (game_phom_result); người ù thì đã biết. */
  result(s) {
    if (!s.over) return null
    return { winners: s.u ? [s.u.seat] : [], draw: false, pending: true }
  },
}

// ---------- Bản JS của server (0090) — chỉ test và bộ ván mẫu dùng ----------

/** Nước chia (game_phom_deal ghi) từ các tay đã chia; ù khan xét từ người đi đầu theo vòng. */
export function dealMove(hands, first, stockLen) {
  const n = hands.length
  let khan = null
  for (let k = 0; k < n && khan == null; k++) if (khanOf(hands[(first + k) % n])) khan = (first + k) % n
  return { deal: { first, n: hands.map((h) => h.length), stock: stockLen, khan } }
}

/**
 * Trọng tài — như game_phom_fill: nước máy khách gửi + bài thật → { move (nước ghi log), hands, stock }, hoặc throw
 * Error(mã lỗi). `pub` = state công khai (đã dựng lại từ log), `hands[ghế]` = bài đang cầm, `stock` = nọc (bốc lá đầu).
 */
export function referee(pub, hands, stock, seat, move) {
  const fail = (k) => { throw new Error(k) }
  if (move == null || typeof move !== 'object' || Array.isArray(move) || move.out !== undefined || move.deal !== undefined) fail('games.err.badMove')
  if (pub.over) fail('games.err.over')
  if (seat !== pub.turn) fail('games.err.notYourTurn')
  const hand = hands[seat]
  const pend = pendingOf(pub, seat)
  const non = hand.filter((c) => !pend.includes(c))
  const put = (h) => hands.map((x, i) => (i === seat ? sortNum(h) : x))
  if (move.draw === true) {
    if (pub.step !== 'take') fail('games.err.badMove')
    if (!stock.length) fail('games.err.pileEmpty')
    return { move: { draw: true }, hands: put([...hand, stock[0]]), stock: stock.slice(1) }
  }
  if (move.eat === true) {
    if (pub.step !== 'take') fail('games.err.badMove')
    if (!pub.last) fail('games.err.nothingToEat')
    const c = pub.last.card
    if (!cover(non, [...pend, c])) fail('games.err.cantEat')
    return { move: { eat: c }, hands: put([...hand, c]), stock }
  }
  const owns = (c) => hand.includes(c)
  if (move.u !== undefined) {
    if ((pub.step !== 'discard' && pub.step !== 'lay') || laid(pub, seat)) fail('games.err.badMove')
    const melds = normMelds(move.u)
    const e = meldsErr(pub, seat, melds, owns)
    if (e) fail(e)
    const all = melds.flat()
    if (all.length < hand.length - 1) fail('games.err.notU')
    const tron = all.length === hand.length
    return { move: { u: melds, tron, discard: tron ? null : hand.find((c) => !all.includes(c)) }, hands, stock }
  }
  if (move.lay !== undefined) {
    if (pub.step !== 'lay') fail('games.err.badMove')
    const melds = normMelds(move.lay)
    const sends = move.send ?? []
    const e = layErr(pub, seat, melds, sends, owns)
    if (e) fail(e)
    const gone = [...melds.flat(), ...sends.map((x) => x[2])]
    return { move: { lay: melds, send: sends }, hands: put(hand.filter((c) => !gone.includes(c))), stock }
  }
  if (move.discard !== undefined) {
    if (pub.step !== 'discard') fail('games.err.badMove')
    const c = move.discard
    if (!Number.isInteger(c) || !hand.includes(c)) fail('games.err.notYourCard')
    if (pend.includes(c) || !cover(non.filter((x) => x !== c), pend)) fail('games.err.keepEaten')
    return { move: { discard: c }, hands: put(hand.filter((x) => x !== c)), stock }
  }
  return fail('games.err.badMove')
}

/** Chấm ván — như game_phom_result: cần bài còn trên tay (`hands`) để tính điểm rác. null khi chưa xong. */
export function judge(pub, hands) {
  if (!pub.over) return null
  const n = pub.n
  const pay = Array(n).fill(0)
  for (const e of pub.eaten) {
    const amt = e.chot ? PAY.chot : PAY.eat
    pay[e.from] -= amt
    pay[e.by] += amt
  }
  const scores = () => Object.fromEntries(pay.map((v, i) => [i, v]))
  if (pub.u) {
    const w = pub.u.seat
    const amt = pub.u.tron ? PAY.tron : PAY.u
    const from = {}
    for (const e of pub.eaten) if (e.by === w) from[e.from] = (from[e.from] || 0) + 1
    const den = Object.keys(from).map(Number).sort((a, b) => a - b).find((x) => from[x] >= 3) ?? null
    for (let x = 0; x < n; x++) {
      if (x === w) continue
      pay[den ?? x] -= amt
      pay[w] += amt
    }
    const ranks = [w, ...Array.from({ length: n }, (_, i) => i).filter((i) => i !== w)]
    return { winners: [w], draw: false, ranks, scores: scores(), u: { seat: w, tron: pub.u.tron, khan: pub.u.khan } }
  }
  const pts = hands.map((h) => h.reduce((a, c) => a + pointsOf(c), 0))
  const layAt = (x) => (pub.order.includes(x) ? pub.order.indexOf(x) : 99)
  const active = Array.from({ length: n }, (_, i) => i).filter((i) => !pub.out[i])
    .sort((a, b) => (pub.mom[a] - pub.mom[b]) || (pts[a] - pts[b]) || (layAt(a) - layAt(b)))
  const ranks = [...active, ...pub.left.slice().reverse()]
  ranks.forEach((x, p) => {
    if (p === 0) return
    const amt = pub.mom[x] ? PAY.mom : p === n - 1 ? PAY.last : p
    pay[x] -= amt
    pay[ranks[0]] += amt
  })
  const points = Object.fromEntries(active.slice().sort((a, b) => a - b).map((i) => [i, pts[i]]))
  return { winners: [ranks[0]], draw: false, ranks, scores: scores(), points }
}
