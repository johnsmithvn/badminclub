// Bầu cua cá cọp (trò dân gian ngày Tết). 2–10 người, chơi bằng điểm, không dính tiền.
//   Sáu linh vật: bầu, cua, tôm, cá, gà, nai — mỗi mặt xúc xắc một con, lắc ba hột.
//   Mỗi ván một người làm cái, lần lượt theo ghế. Người khác đặt điểm vào các con mình chọn (tổng tối đa CAP mỗi ván)
//   rồi chốt — chốt rồi không sửa, chốt 0 điểm là bỏ ván. Cả bàn chốt hoặc hết giờ đặt thì mở bát: con nào ra k hột thì người đặt được k lần số điểm đặt (cái trả),
//   con không ra thì mất số điểm đặt (cái ăn).
//   Hết số ván (mỗi người làm cái `laps` lượt) → ai nhiều điểm nhất thắng (bằng nhau thì cùng thắng).
//   Cái rời bàn giữa ván: ván đó bỏ, chuyển cái. Người đặt rời bàn: điểm đặt ván đó bỏ.
//
// Xúc xắc do server lắc lúc ghi nước (0087 game_baucua_fill): client gửi { roll: true }, log ghi { roll: true, dice }.
// Giờ đặt tính theo server: từ created_at của nước mở ván (chia / mở bát trước) + opts.time giây; 0087 chỉ nhận mở bát
// khi cả bàn đã Xong hoặc đã hết giờ (sớm → games.err.notYet, máy khách im lặng thử lại). Ở đây nhận mọi { roll } server
// đã ghi — server đã kiểm.
//
// state = { started, n0, out[], round, rounds, banker, bets[seat][6], ready[], since, scores[], dice, last, over, ply, opts }
// move  = { deal: { n } } (server ghi lúc bắt đầu) · { bet: [6 số] } (đặt + chốt) · { roll: true, dice? } · { out: true }

export const SYMS = ['bau', 'cua', 'tom', 'ca', 'ga', 'nai']
export const CAP = 10
export const CHIPS = [1, 2, 5]
export const TIMES = [15, 20, 30]
export const LAPS = [1, 2, 3]
export const optsOf = (o) => ({ time: TIMES.includes(o?.time) ? o.time : 20, laps: LAPS.includes(o?.laps) ? o.laps : 1 })
export const deadlineOf = (s) => (s.started && !s.over && s.since != null ? s.since + s.opts.time * 1000 : null)

const isN = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi
const zero = () => SYMS.map(() => 0)
const sum = (a) => a.reduce((x, y) => x + y, 0)

/** Điểm một người đặt ăn / thua theo ba hột xúc xắc. */
export function payOf(bet, dice) {
  return bet.reduce((v, stake, sym) => {
    const k = dice.filter((d) => d === sym).length
    return v + (k ? stake * k : -stake)
  }, 0)
}

/** Ghế còn chơi kế sau `from` (vòng tròn, không tính chính nó). */
const nextAlive = (out, from) => {
  for (let k = 1; k <= out.length; k++) {
    const y = (from + k) % out.length
    if (!out[y]) return y
  }
  return null
}

/** Ai còn chưa chốt ván này. */
export const waitingOf = (s) => s.out.map((o, i) => (!o && i !== s.banker && !s.ready[i] ? i : null)).filter((i) => i != null)

/** Sang ván mới (hoặc hết trận). */
function nextRound(s, at) {
  const round = s.round + 1
  const alive = s.out.filter((o) => !o).length
  if (round >= s.rounds || alive < 2) return { ...s, round, over: true, banker: null }
  return { ...s, round, banker: nextAlive(s.out, s.banker), bets: s.out.map(zero), ready: s.out.map(() => false), since: at }
}

export default {
  id: 'baucua',
  minPlayers: 2,
  maxPlayers: 10,
  defaultOptions: { time: 20, laps: 1 },

  setup({ options } = {}) {
    return {
      started: false, n0: 0, out: [], round: 0, rounds: 0, banker: null, bets: [], ready: [], since: null, scores: [],
      dice: null, last: null, over: false, ply: 0, opts: optsOf(options),
    }
  },

  validate(s, seat, move) {
    const d = move?.deal
    if (d && typeof d === 'object') return !s.started && isN(d.n, 2, 10) && seat === 0 ? null : 'games.err.badMove'
    if (!s.started) return 'games.err.badMove'
    if (s.over) return 'games.err.over'
    if (!isN(seat, 0, s.n0 - 1) || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (move?.roll === true) {
      return move.dice == null || (Array.isArray(move.dice) && move.dice.length === 3 && move.dice.every((x) => isN(x, 0, 5)))
        ? null : 'games.err.badMove'
    }
    if (seat === s.banker) return 'games.err.badMove'
    if (s.ready[seat]) return 'games.err.badMove'
    const b = move?.bet
    if (!Array.isArray(b) || b.length !== SYMS.length || !b.every((x) => isN(x, 0, CAP)) || sum(b) > CAP) return 'games.err.badMove'
    return null
  },

  /** Mở bát: server lắc xúc xắc, máy này chờ bản server ghi. */
  request: (s, seat, move) => move?.roll === true,

  apply(s0, seat, move, meta) {
    const t = Date.parse(meta?.at)
    const at = Number.isFinite(t) ? t : null
    const s = { ...s0, ply: s0.ply + 1 }
    if (move.deal) {
      const n = move.deal.n
      return {
        ...s, started: true, n0: n, out: Array(n).fill(false), rounds: s.opts.laps * n, banker: 0,
        bets: Array.from({ length: n }, zero), ready: Array(n).fill(false), scores: Array(n).fill(0), since: at,
      }
    }
    if (move.out === true) {
      const out = s.out.map((o, i) => o || i === seat)
      const t = { ...s, out, last: { seat, out: true } }
      if (seat === s.banker) return nextRound({ ...t, bets: s.bets.map(zero) }, at)
      return { ...t, bets: s.bets.map((b, i) => (i === seat ? zero() : b)), ready: s.ready.map((r, i) => r || i === seat) }
    }
    if (move.bet) {
      return { ...s, bets: s.bets.map((b, i) => (i === seat ? move.bet.slice() : b)), ready: s.ready.map((r, i) => r || i === seat), last: { seat, bet: true } }
    }
    // Mở bát.
    const dice = move.dice.slice()
    const scores = s.scores.slice()
    const won = s.bets.map((b) => payOf(b, dice))
    won.forEach((v, i) => { scores[i] += v; scores[s.banker] -= v })
    return nextRound({ ...s, scores, dice, last: { seat, roll: true, dice, banker: s.banker, bets: s.bets, won } }, at)
  },

  view: (s) => s,

  /** Người còn ngồi nhiều điểm nhất thắng (bằng nhau cùng thắng); ai cũng rời thì xét cả bàn. */
  result(s) {
    if (!s.over) return null
    const pool = s.scores.map((_, i) => i).filter((i) => !s.out[i])
    const from = pool.length ? pool : s.scores.map((_, i) => i)
    const best = Math.max(...from.map((i) => s.scores[i]))
    return { winners: from.filter((i) => s.scores[i] === best), draw: false, scores: Object.fromEntries(s.scores.map((v, i) => [i, v])) }
  },
}
