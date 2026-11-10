// Lô tô (trò dân gian hội chợ, ngày Tết). 2–10 người, mỗi người một tờ dò, không dính tiền.
//   Tờ dò 9 hàng × 9 cột; mỗi hàng 5 số ở 5 cột khác nhau, 4 ô trống. Cột 1 là số 1–9, cột 2 là 10–19 … cột 9 là 80–90;
//   cả tờ không trùng số. Người xướng bốc lần lượt các số 1–90; số trên tờ được tự dò (đánh dấu) cho tiện.
//   Hàng nào đủ cả 5 số đã xướng thì bấm "Kinh!" — ai kinh đúng trước thắng. Kinh sai (chưa đủ hàng) thì không tính.
//   Hàng còn thiếu đúng một số là đang "chờ".
//
// Server chia tờ (0097 game_loto_deal ghi nước 1 { deal: { tickets } }, tờ công khai — trò không có gì để giấu) và bốc số
// (game_loto_fill: { call: true } → { call: số }) bằng random() — không ai biết trước số kế. Nhịp xướng opts.time giây tính
// theo server từ created_at của số trước; 0097 từ chối gọi sớm (games.err.notYet, máy khách im lặng thử lại).
//
// state = { started, tickets[seat][45], called[], since, out[], over, winner, last, ply, opts }
//   tickets: 9 hàng × 5 số liền nhau, mỗi hàng xếp theo cột (tăng dần)
// move  = { deal: { tickets } } (server) · { call: true | số } · { kinh: true } · { out: true } (server)

export const ROWS = 9
export const PER_ROW = 5
export const MAX = 90
export const TIMES = [3, 5, 8]
export const optsOf = (o) => ({ time: TIMES.includes(o?.time) ? o.time : 5 })
export const deadlineOf = (s) => (s.started && !s.over && s.since != null ? s.since + s.opts.time * 1000 : null)

/** Cột của một số: 1–9 → 0, 10–19 → 1 … 80–90 → 8. */
export const colOf = (x) => Math.min(8, Math.floor(x / 10))
export const rowsOf = (ticket) => Array.from({ length: ROWS }, (_, r) => ticket.slice(r * PER_ROW, r * PER_ROW + PER_ROW))

/** Tờ hợp lệ: 45 số khác nhau 1–90, mỗi hàng 5 số ở 5 cột khác nhau, xếp tăng dần. */
export function validTicket(t) {
  if (!Array.isArray(t) || t.length !== ROWS * PER_ROW || !t.every((x) => Number.isInteger(x) && x >= 1 && x <= MAX)) return false
  if (new Set(t).size !== t.length) return false
  return rowsOf(t).every((row) => row.every((x, i) => i === 0 || colOf(x) > colOf(row[i - 1])))
}

/** Số hàng đủ (kinh được) và hàng chờ (thiếu đúng một số) của một tờ. */
export function marksOf(ticket, called) {
  const got = new Set(called)
  const miss = rowsOf(ticket).map((row) => row.filter((x) => !got.has(x)).length)
  return { full: miss.filter((k) => k === 0).length, waiting: miss.filter((k) => k === 1).length, miss }
}

const isN = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi

export default {
  id: 'loto',
  minPlayers: 2,
  maxPlayers: 10,
  defaultOptions: { time: 5 },

  setup({ options } = {}) {
    return { started: false, tickets: [], called: [], since: null, out: [], over: false, winner: null, last: null, ply: 0, opts: optsOf(options) }
  },

  validate(s, seat, move) {
    const d = move?.deal
    if (d && typeof d === 'object') {
      return !s.started && seat === 0 && Array.isArray(d.tickets) && isN(d.tickets.length, 2, 10) && d.tickets.every(validTicket)
        ? null : 'games.err.badMove'
    }
    if (!s.started) return 'games.err.badMove'
    if (s.over) return 'games.err.over'
    if (!isN(seat, 0, s.tickets.length - 1) || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (move?.kinh === true) return marksOf(s.tickets[seat], s.called).full ? null : 'games.err.noKinh'
    const c = move?.call
    if (c === true) return s.called.length < MAX ? null : 'games.err.badMove'
    return isN(c, 1, MAX) && !s.called.includes(c) ? null : 'games.err.badMove'
  },

  /** Bốc số: server bốc, máy này chờ bản server ghi. */
  request: (s, seat, move) => move?.call === true,

  apply(s0, seat, move, meta) {
    const t = Date.parse(meta?.at)
    const at = Number.isFinite(t) ? t : null
    const s = { ...s0, ply: s0.ply + 1 }
    if (move.deal) {
      const n = move.deal.tickets.length
      return { ...s, started: true, tickets: move.deal.tickets.map((x) => x.slice()), out: Array(n).fill(false), since: at }
    }
    if (move.out === true) return { ...s, out: s.out.map((o, i) => o || i === seat), last: { seat, out: true } }
    if (move.kinh === true) return { ...s, over: true, winner: seat, last: { seat, kinh: true } }
    return { ...s, called: [...s.called, move.call], since: at, last: { seat, call: move.call } }
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return { winners: [s.winner], draw: false }
  },
}
