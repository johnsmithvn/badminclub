// Bài bịp (trò "nói dối" dân gian kiểu Cheat / I Doubt It, thêm quả bom cắt dây). 2–4 người.
//   - Bộ 20 lá: 6 Q, 6 K, 6 A, 2 Joker. Mỗi ván chia mỗi người còn trụ 5 lá và chọn "lá chủ" (Q, K hoặc A).
//   - Đến lượt: úp 1–3 lá và nhận đó đều là lá chủ (nói dối cũng được; Joker luôn tính là lá chủ).
//     Hoặc tố "Bịp!": lật các lá người vừa đánh. Có lá sai → người đánh thua; đúng hết → người tố thua.
//   - Người thua cắt một dây trên quả bom của mình: 6 dây, một dây nổ (server giấu), bom giữ nguyên cả trận.
//     Trúng dây nổ → bị loại. Cắt xong là ván mới: người vừa cắt đi trước, nổ rồi thì người kế tiếp.
//   - Người hết bài được bỏ qua; khi những người khác đều hết bài thì bắt buộc phải tố. Còn một người là thắng.
//   - Rời bàn = bị loại. Đang đánh dở mà có người rời thì ván đó huỷ, chia lại (người tới lượt bấm chia).
//   - Đồng hồ lượt (tuỳ phòng, 0 = không giới hạn): hết giờ thì máy bất kỳ báo { timeout }; server kiểm theo giờ của nó
//     rồi đi thay người tới lượt — đánh 1 lá ngẫu nhiên (bắt buộc tố thì tố), cắt 1 dây ngẫu nhiên, hoặc chia ván mới.
//     Log ghi { timeout: true, ...nước server đi thay }, áp như nước của người tới lượt.
//
// Game có THÔNG TIN ẨN (docs/GAMES.md §5.2): bài trên tay ở game_hands, dây nổ ở ghế -1, lá vừa úp ở ghế -2.
// Server (0082 game_baibip_fill) kiểm từng nước, bớt lá khỏi tay, log chỉ ghi SỐ lá ({ play: k }). Tố: server lật
// đúng các lá vừa úp ({ call, cards, liar }). Cắt: server tra dây nổ ({ cut, boom }). Mỗi lần ván mới, server chia
// lại và gắn { deal } vào chính nước đó. Đổi luật ở đây là phải đổi cả ở 0082.
//
// Lá c = 0..19: 0–5 Q, 6–11 K, 12–17 A, 18–19 Joker. Lá chủ table = 0 (Q) · 1 (K) · 2 (A).
// state = { started, n, round, table, counts[], out[], blown[] (bị loại vì nổ bom), cuts[][] (dây đã cắt), phase ('play' | 'cut' |
//           'redeal'), turn, pile, lastPlay { seat, n }, reveal { seat, caller, cards, liar, round }, cutter,
//           over, winner, last, ply }
// move  = { play: [lá] } (máy khách) → log { play: k } · { call: true } → { call, cards, liar, deal? }
//       · { cut: dây } → { cut, boom, deal? } · { deal: true } (chia lại) → { deal } · { out: true } (server)
//   deal = { table, n[] (5 cho người còn trụ, 0 cho người đã loại), first }

export const KINDS = ['Q', 'K', 'A', 'J']
export const DECK = 20
export const HAND = 5
export const WIRES = 6
export const JOKER = 3
/** Giây mỗi lượt; 0 = không giới hạn. PHẢI khớp phần đọc options ở 0082. */
export const TIMES = [0, 20, 30, 60]
export const optsOf = (o) => ({ time: TIMES.includes(o?.time) ? o.time : 30 })
/** Hạn lượt hiện tại (ms, giờ server = giờ ghi nước gần nhất + thời gian lượt) hoặc null. */
export const deadlineOf = (s) => (s.opts.time && s.since != null && !s.over ? s.since + s.opts.time * 1000 : null)

/** Loại lá: 0 Q · 1 K · 2 A · 3 Joker. */
export const kindOf = (c) => (c >= 18 ? JOKER : Math.floor(c / 6))
/** Lá có đúng là lá chủ không (Joker luôn đúng). */
export const fits = (c, table) => kindOf(c) === JOKER || kindOf(c) === table

const isCard = (c) => Number.isInteger(c) && c >= 0 && c < DECK
const alive = (s) => s.out.filter((o) => !o).length

function nextAlive(s, from) {
  for (let k = 1; k <= s.n; k++) {
    const y = (from + k) % s.n
    if (!s.out[y]) return y
  }
  return from
}

/** Người kế tiếp còn bài; không ai khác còn bài thì người kế tiếp còn trụ (người đó phải tố). */
function nextHolder(s, from) {
  for (let k = 1; k < s.n; k++) {
    const y = (from + k) % s.n
    if (!s.out[y] && s.counts[y] > 0) return y
  }
  return nextAlive(s, from)
}

/** Những người khác đều hết bài → chỉ được tố. */
export const mustCall = (s, seat) => s.counts.every((c, i) => i === seat || s.out[i] || c === 0)

/** Nước chia hợp lệ với danh sách người đã loại `out` (null = ván đầu, chưa biết số ghế). */
function dealOk(out, d) {
  if (!d || typeof d !== 'object' || ![0, 1, 2].includes(d.table) || !Array.isArray(d.n)) return false
  if (out ? d.n.length !== out.length : d.n.length < 2 || d.n.length > 4) return false
  if (!d.n.every((k, i) => k === (out?.[i] ? 0 : HAND))) return false
  return Number.isInteger(d.first) && d.first >= 0 && d.first < d.n.length && d.n[d.first] === HAND
}

const start = (s, d) => ({
  ...s, round: s.round + 1, table: d.table, counts: d.n.slice(), phase: 'play', turn: d.first, pile: 0, lastPlay: null, cutter: null,
})
const finish = (s) => ({ ...s, over: true, winner: s.out.findIndex((o) => !o), turn: null, phase: null })

const game = {
  id: 'baibip',
  minPlayers: 2,
  maxPlayers: 4,
  defaultOptions: { time: 30 },

  setup({ options } = {}) {
    return {
      opts: optsOf(options), since: null, started: false, n: 0, round: 0, table: null, counts: [], out: [], blown: [], cuts: [], phase: null, turn: null, pile: 0,
      lastPlay: null, reveal: null, cutter: null, over: false, winner: null, last: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (move?.timeout === true) {
      const inner = { ...move }
      delete inner.timeout
      if (Object.keys(inner).length) return s.started && s.turn != null ? game.validate(s, s.turn, inner) : 'games.err.badMove'
      // Máy khách báo hết giờ: server mới biết giờ thật (sớm thì games.err.notYet, máy tự thử lại).
      return s.started && s.opts.time && Number.isInteger(seat) && seat >= 0 && seat < s.n && !s.out[seat] ? null : 'games.err.badMove'
    }
    const d = move?.deal
    if (d !== undefined && d !== true && move.call === undefined && move.cut === undefined) {
      if (!s.started) return dealOk(null, d) && seat === d.first ? null : 'games.err.badMove'
      if (s.phase !== 'redeal' || seat !== s.turn) return 'games.err.badMove'
      return dealOk(s.out, d) ? null : 'games.err.badMove'
    }
    if (!s.started) return 'games.err.badMove'
    if (!Number.isInteger(seat) || seat < 0 || seat >= s.n || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (d === true) return s.phase === 'redeal' ? null : 'games.err.badMove'
    if (s.phase === 'redeal') return 'games.err.badMove'
    if (s.phase === 'cut') {
      const w = move?.cut
      if (w === undefined) return 'games.err.mustCut'
      if (!Number.isInteger(w) || w < 0 || w >= WIRES || s.cuts[seat].includes(w)) return 'games.err.wireCut'
      if (move.boom !== undefined && typeof move.boom !== 'boolean') return 'games.err.badMove'
      if (d !== undefined && !dealOk(move.boom ? s.out.map((o, i) => o || i === seat) : s.out, d)) return 'games.err.badMove'
      return null
    }
    if (move?.cut !== undefined) return 'games.err.badMove'
    if (move?.call === true) {
      if (!s.lastPlay || s.lastPlay.seat === seat) return 'games.err.nothingToCall'
      const c = move.cards
      if (c !== undefined && (!Array.isArray(c) || c.length !== s.lastPlay.n || !c.every(isCard))) return 'games.err.badMove'
      if (d !== undefined && !dealOk(s.out, d)) return 'games.err.badMove'
      return null
    }
    const p = move?.play
    const k = Array.isArray(p) ? p.length : p
    if (Array.isArray(p) && (!p.every(isCard) || new Set(p).size !== k)) return 'games.err.badMove'
    if (!Number.isInteger(k) || k < 1 || k > 3) return 'games.err.playCount'
    if (k > s.counts[seat]) return 'games.err.badMove'
    return mustCall(s, seat) ? 'games.err.mustCall' : null
  },

  /** Mọi nước của người chơi đều cần server (lá thật, dây nổ, chia bài) — màn chơi không hiện trước. */
  request: (s, seat, move) => move?.out !== true,

  /** Áp nước; nước hết giờ áp như của người tới lượt. Ghi lại giờ server của nước (`since`) để tính hạn lượt sau. */
  apply(s0, seat, move, meta) {
    let s
    if (move.timeout === true) {
      const inner = { ...move }
      delete inner.timeout
      if (!Object.keys(inner).length) return s0 // chưa qua server
      s = game.act(s0, s0.turn, inner)
      if (s !== s0) s = { ...s, last: { ...s.last, timeout: true } }
    } else {
      s = game.act(s0, seat, move)
    }
    const at = Date.parse(meta?.at)
    return s === s0 || !Number.isFinite(at) ? s : { ...s, since: at }
  },

  act(s0, seat, move) {
    const s = { ...s0, ply: s0.ply + 1 }
    const d = move.deal && typeof move.deal === 'object' ? move.deal : null
    if (d && move.call === undefined && move.cut === undefined) {
      if (s.started) return start({ ...s, last: { seat, deal: true } }, d)
      const n = d.n.length
      return start({ ...s, started: true, n, out: Array(n).fill(false), blown: Array(n).fill(false), cuts: Array.from({ length: n }, () => []) }, d)
    }
    if (move.out === true) {
      const out = s.out.map((o, i) => o || i === seat)
      const next = { ...s, out, counts: s.counts.map((c, i) => (i === seat ? 0 : c)), last: { seat, out: true } }
      if (alive(next) <= 1) return finish(next)
      // Đang chờ người khác cắt dây thì người đó vẫn phải cắt; còn lại thì ván dở huỷ, chia lại.
      if (s.phase === 'cut' && s.cutter !== seat) return next
      const turn = s.turn != null && s.turn !== seat ? s.turn : nextAlive(next, seat)
      return { ...next, phase: 'redeal', turn, pile: 0, lastPlay: null, cutter: null }
    }
    if (move.call === true) {
      if (!Array.isArray(move.cards)) return s0 // chưa qua server
      const liar = move.cards.some((c) => !fits(c, s.table))
      const loser = liar ? s.lastPlay.seat : seat
      const next = {
        ...s, reveal: { seat: s.lastPlay.seat, caller: seat, cards: move.cards.slice(), liar, round: s.round },
        last: { seat, call: true, liar, loser },
      }
      if (d) return start(next, d)
      if (next.out[loser]) return { ...next, phase: 'redeal', turn: nextAlive(next, loser), lastPlay: null }
      return { ...next, phase: 'cut', cutter: loser, turn: loser }
    }
    if (move.cut !== undefined) {
      if (typeof move.boom !== 'boolean') return s0 // chưa qua server
      const cuts = s.cuts.map((c, i) => (i === seat ? [...c, move.cut] : c))
      const out = move.boom ? s.out.map((o, i) => o || i === seat) : s.out
      const blown = move.boom ? s.blown.map((b, i) => b || i === seat) : s.blown
      const next = { ...s, cuts, out, blown, cutter: null, counts: s.counts.map(() => 0), last: { seat, cut: move.cut, boom: move.boom } }
      if (alive(next) <= 1) return finish(next)
      if (d) return start(next, d)
      return { ...next, phase: 'redeal', turn: move.boom ? nextAlive(next, seat) : seat, lastPlay: null }
    }
    if (move.deal === true) return s0
    const k = move.play
    if (!Number.isInteger(k)) return s0 // lá thật chỉ server biết — chưa qua server thì không áp
    const next = { ...s, counts: s.counts.map((c, i) => (i === seat ? c - k : c)), pile: s.pile + k, lastPlay: { seat, n: k }, last: { seat, play: k } }
    return { ...next, turn: nextHolder(next, seat) }
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return { winners: [s.winner], draw: false }
  },
}

export default game
