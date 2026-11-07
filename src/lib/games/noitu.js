// Nối từ. 2–8 người, lần lượt nói một từ nối tiếp từ trước; bí từ / hết giờ là bị loại, còn một người là thắng.
//   - Tiếng Việt: từ 2 âm tiết, âm tiết đầu = âm tiết cuối của từ trước ("học sinh" → "sinh viên").
//   - English: từ bắt đầu bằng 1 hoặc 2 chữ cái cuối của từ trước (tuỳ phòng), dài hơn phần nối.
//   - Không lặp từ đã dùng / đã bị bác trong ván. Thứ tự lượt server xáo ngẫu nhiên mỗi ván.
//   - Mỗi lượt có hạn giờ (tuỳ phòng). Bấm Chịu hoặc hết giờ là bị loại; người kế tiếp bắt đầu lại bằng từ tự do.
//   - KHÔNG có từ điển: mỗi từ gửi lên được cả bàn duyệt trong 8 giây (đồng hồ của người gửi dừng lại). Không ai
//     phản đối là được; bị bác khi phiếu bác nhiều hơn phiếu chấp nhận. Bị bác thì người gửi được cộng 3 giây để tìm
//     từ khác; mỗi lượt gửi tối đa 2 từ.
//
// Thời gian lấy theo giờ SERVER: mỗi nước có `at` = game_moves.created_at (registry.replay đưa vào tham số thứ 4).
// Hết giờ / hết hạn duyệt do một máy bất kỳ báo bằng { timeout } / { close }; server (0083 game_noitu_check) chỉ nhận
// khi đúng là đã hết giờ, nên luật ở đây không cần đồng hồ. Đổi luật ở đây là phải đổi cả ở 0083.
//
// state = { opts, started, order[] (ghế theo thứ tự lượt), alive[] (theo ghế), turn, deadline (ms), now (ms của nước
//           gần nhất), chain[] ({ word, seat }), used[] (từ đã dùng + bị bác), vote { word, seat, at, left, yes[], no[] },
//           asks, fresh (từ tự do, không cần nối), verdict { word, seat, ok }, over, winner, last, ply }
// move  = { deal: { order } } (server) · { word } · { vote: bool } · { close } · { giveup } · { timeout } · { out } (server)

export const VOTE_MS = 8000
export const BONUS_MS = 3000
export const ASKS = 2
export const TIMES = [15, 20, 30]
export const MAX_PLAYERS = 8
const VI = 'a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ' // i18n-ok: bảng chữ cái của regex kiểm từ, dữ liệu chứ không phải nhãn
const WORD = { vi: new RegExp(`^[${VI}]{1,10} [${VI}]{1,10}$`), en: /^[a-z]{2,24}$/ }

/** Chuẩn hoá chữ gõ vào (máy khách gọi trước khi gửi): NFC, chữ thường, một dấu cách. */
export const normWord = (w) => String(w ?? '').normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')

/** Tuỳ chọn phòng — số / chữ lạ thì về mặc định. PHẢI khớp phần đọc options ở 0083. */
export function optsOf(o) {
  return { lang: o?.lang === 'en' ? 'en' : 'vi', link: o?.link === 2 ? 2 : 1, time: TIMES.includes(o?.time) ? o.time : 20 }
}

/** Phần nối bắt buộc cho từ kế tiếp ('' = từ tự do). */
export function linkOf(s) {
  if (s.fresh || !s.chain.length) return ''
  const prev = s.chain[s.chain.length - 1].word
  return s.opts.lang === 'vi' ? prev.split(' ')[1] + ' ' : prev.slice(-s.opts.link)
}

/** Từ hợp lệ không (đúng dạng, đúng phần nối, chưa dùng). */
export function wordErr(s, w) {
  if (typeof w !== 'string' || !WORD[s.opts.lang].test(w)) return 'games.err.badWord'
  const link = linkOf(s)
  if (link && (!w.startsWith(link) || w.length <= link.length)) return 'games.err.noLink'
  return s.used.includes(w) ? 'games.err.usedWord' : null
}

const atOf = (meta) => {
  const t = Date.parse(meta?.at)
  return Number.isFinite(t) ? t : null
}

function nextAlive(s, from) {
  const i = s.order.indexOf(from)
  for (let k = 1; k <= s.order.length; k++) {
    const y = s.order[(i + k) % s.order.length]
    if (s.alive[y]) return y
  }
  return from
}

/** Loại `who`; còn một người là hết ván, không thì người kế tiếp bắt đầu lại bằng từ tự do. */
function eliminate(s, who, at) {
  const alive = s.alive.map((a, i) => a && i !== who)
  const next = { ...s, alive, vote: null }
  if (alive.filter(Boolean).length <= 1) return { ...next, over: true, winner: alive.indexOf(true), turn: null, deadline: null }
  return { ...next, turn: nextAlive(next, who), deadline: at + s.opts.time * 1000, fresh: true, asks: 0 }
}

/** Chốt phiếu khi đã rõ kết quả (closing = hết 8 giây: tính theo phiếu đang có). */
function decide(s, at, closing) {
  const v = s.vote
  const voters = s.order.filter((x) => s.alive[x] && x !== v.seat)
  const yes = v.yes.filter((x) => voters.includes(x)).length
  const no = v.no.filter((x) => voters.includes(x)).length
  const und = voters.length - yes - no
  const ok = closing ? no <= yes : yes >= no + und
  if (!ok && !(closing || no > yes + und)) return s
  const verdict = { word: v.word, seat: v.seat, ok }
  if (ok) {
    return {
      ...s, chain: [...s.chain, { word: v.word, seat: v.seat }], used: [...s.used, v.word], vote: null, verdict,
      turn: nextAlive(s, v.seat), deadline: at + s.opts.time * 1000, fresh: false, asks: 0,
    }
  }
  return { ...s, used: [...s.used, v.word], vote: null, verdict, deadline: at + v.left + BONUS_MS }
}

export default {
  id: 'noitu',
  minPlayers: 2,
  maxPlayers: MAX_PLAYERS,
  defaultOptions: { lang: 'vi', link: 1, time: 20 },

  setup({ options } = {}) {
    return {
      opts: optsOf(options), started: false, order: [], alive: [], turn: null, deadline: null, now: null, chain: [], used: [],
      vote: null, asks: 0, fresh: true, verdict: null, over: false, winner: null, last: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    const d = move?.deal
    if (d !== undefined) {
      if (s.started || !Array.isArray(d?.order)) return 'games.err.badMove'
      const n = d.order.length
      if (n < 2 || n > MAX_PLAYERS || new Set(d.order).size !== n || !d.order.every((x) => Number.isInteger(x) && x >= 0 && x < n)) return 'games.err.badMove'
      return seat === d.order[0] ? null : 'games.err.badMove'
    }
    if (!s.started) return 'games.err.badMove'
    if (!Number.isInteger(seat) || seat < 0 || seat >= s.alive.length || !s.alive[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (move?.close === true) return s.vote ? null : 'games.err.noVote'
    if (move?.vote !== undefined) {
      if (!s.vote) return 'games.err.noVote'
      if (typeof move.vote !== 'boolean' || seat === s.vote.seat) return 'games.err.badMove'
      return s.vote.yes.includes(seat) || s.vote.no.includes(seat) ? 'games.err.voted' : null
    }
    if (s.vote) return 'games.err.voting'
    if (move?.timeout === true) return null // server kiểm đã hết giờ thật
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (move?.giveup === true) return null
    if (move?.word === undefined) return 'games.err.badMove'
    if (s.asks >= ASKS) return 'games.err.noAsks'
    return wordErr(s, move.word)
  },

  /** Mọi nước cần giờ server (created_at) — màn chơi không hiện trước, ghi xong nạp lại. */
  request: (s, seat, move) => move?.out !== true,

  apply(s0, seat, move, meta) {
    const at = atOf(meta)
    if (at == null && move.out !== true) return s0 // chưa có giờ server — chưa áp
    const now = at ?? s0.now
    const s = { ...s0, ply: s0.ply + 1, now }
    if (move.deal) {
      const order = move.deal.order.slice()
      return {
        ...s, started: true, order, alive: order.map(() => true), turn: order[0], deadline: now + s.opts.time * 1000, fresh: true, asks: 0,
      }
    }
    if (move.out === true) {
      const gone = { ...s, last: { seat, out: true } }
      if (s.vote && s.vote.seat !== seat) {
        const next = { ...gone, alive: s.alive.map((a, i) => a && i !== seat) }
        return next.alive.filter(Boolean).length <= 1 ? eliminate(gone, seat, now) : decide(next, now, false)
      }
      if (s.vote || s.turn === seat) return eliminate(gone, seat, now)
      const alive = s.alive.map((a, i) => a && i !== seat)
      return alive.filter(Boolean).length <= 1 ? eliminate(gone, seat, now) : { ...gone, alive }
    }
    if (move.word !== undefined) {
      return {
        ...s, asks: s.asks + 1, last: { seat, word: move.word },
        vote: { word: move.word, seat, at: now, left: Math.max(0, s.deadline - now), yes: [], no: [] },
      }
    }
    if (move.vote !== undefined) {
      const v = s.vote
      const vote = move.vote ? { ...v, yes: [...v.yes, seat] } : { ...v, no: [...v.no, seat] }
      return decide({ ...s, vote, last: { seat, vote: move.vote } }, now, false)
    }
    if (move.close === true) return decide({ ...s, last: { seat, close: true } }, now, true)
    // Chịu / hết giờ: người đang tới lượt bị loại (hết giờ có thể do máy người khác báo).
    const who = s.turn
    return eliminate({ ...s, last: { seat: who, [move.timeout ? 'timeout' : 'giveup']: true } }, who, now)
  },

  view: (s) => s,

  /** Dòng trạng thái của phòng khi cả bàn đang duyệt từ (GameRoom.jsx). */
  status(s) {
    if (s.over || !s.vote) return null
    return { key: 'games.noitu.statusVote', params: { word: s.vote.word } }
  },

  result(s) {
    if (!s.over) return null
    return { winners: [s.winner], draw: false }
  },
}
