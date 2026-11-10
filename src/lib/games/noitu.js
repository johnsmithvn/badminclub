// Nối từ. 2–8 người, lần lượt nói một từ nối tiếp từ trước; bí từ / hết giờ là bị loại, còn một người là thắng.
//   - Tiếng Việt: từ 2 âm tiết, âm tiết đầu = âm tiết cuối của từ trước ("học sinh" → "sinh viên").
//   - English: từ bắt đầu bằng 1 hoặc 2 chữ cái cuối của từ trước (tuỳ phòng), dài hơn phần nối.
//   - Từ bị bác không gửi lại được; từ đã nhận được nhận lại tối đa `repeat` lần (0 / 1 / 2, tuỳ phòng).
//     Tuỳ phòng cấm đảo từ vừa dùng (`flip` = false: "học sinh" → "sinh học"). Thứ tự lượt server xáo mỗi ván.
//   - Mỗi lượt có hạn giờ (tuỳ phòng). Bấm Chịu hoặc hết giờ là bị loại; người kế tiếp bắt đầu lại bằng từ tự do.
//   - Kiểm từ (`dict`, chỉ tiếng Việt — từ điển ở bảng game_words_vi, 0091/0092, chỉ server đọc):
//       'vote' — cả bàn duyệt mỗi từ trong 8 giây (đồng hồ của người gửi dừng lại). Không ai phản đối là được; bị bác
//                khi phiếu bác nhiều hơn phiếu chấp nhận. Bị bác thì được cộng 3 giây; mỗi lượt gửi tối đa 2 từ.
//       'mix'  — từ có trong từ điển được nhận ngay (server ghi kèm { ok: true }), từ lạ thì cả bàn duyệt như trên.
//       'dict' — chỉ nhận từ có trong từ điển (server báo games.err.notInDict, không mất lượt gửi).
//     `cut` (chặn từ cụt): từ phải còn ít nhất một từ trong từ điển nối tiếp được (games.err.deadEnd).
//     Từ điển chỉ server kiểm — validate ở đây không biết, nên hai lỗi trên chỉ đến từ server.
//
// Thời gian lấy theo giờ SERVER: mỗi nước có `at` = game_moves.created_at (registry.replay đưa vào tham số thứ 4).
// Hết giờ / hết hạn duyệt do một máy bất kỳ báo bằng { timeout } / { close }; server (0083 game_noitu_check) chỉ nhận
// khi đúng là đã hết giờ, nên luật ở đây không cần đồng hồ. Đổi luật ở đây là phải đổi cả ở 0083.
//
// state = { opts, started, order[] (ghế theo thứ tự lượt), alive[] (theo ghế), turn, deadline (ms), now (ms của nước
//           gần nhất), chain[] ({ word, seat }), bad[] (từ bị bác), vote { word, seat, at, left, yes[], no[] },
//           asks, fresh (từ tự do, không cần nối), verdict { word, seat, ok, dict? }, over, winner, last, ply }
// move  = { deal: { order } } (server) · { word, ok? } (ok do server điền) · { vote: bool } · { close } · { giveup } ·
//         { timeout } · { out } (server)

export const VOTE_MS = 8000
export const BONUS_MS = 3000
export const ASKS = 2
export const TIMES = [15, 20, 30]
export const MAX_PLAYERS = 8
export const DICTS = ['mix', 'dict', 'vote']
export const REPEATS = [0, 1, 2]
const VI = 'a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ' // i18n-ok: bảng chữ cái của regex kiểm từ, dữ liệu chứ không phải nhãn
const WORD = { vi: new RegExp(`^[${VI}]{1,10} [${VI}]{1,10}$`), en: /^[a-z]{2,24}$/ }

// Dấu thanh của vần oa / oe / uy cuối âm tiết đặt ở chữ đầu (kiểu cũ): "hoà" → "hòa", "thuỷ" → "thủy" (trừ "qu").
// Không dùng lookbehind: Safari < 16.4 (iPhone đời cũ) không hiểu, hỏng cả chunk game.
const TONE = /(^|[^q])([ou])([aey])([\u0300\u0301\u0303\u0309\u0323])(?=\s|$)/g

/** Chuẩn hoá chữ gõ vào (máy khách gọi trước khi gửi): NFC, chữ thường, một dấu cách, dấu oa / oe / uy kiểu cũ
 *  (từ điển 0092 cũng chuẩn hoá y vậy — hai người gõ hai kiểu vẫn ra cùng một từ). */
export const normWord = (w) => String(w ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
  .normalize('NFD').replace(TONE, '$1$2$4$3').normalize('NFC')

/** Tuỳ chọn phòng — số / chữ lạ thì về mặc định (phòng cũ: bỏ phiếu, cho đảo, không lặp). PHẢI khớp 0091. */
export function optsOf(o) {
  const vi = o?.lang !== 'en'
  const dict = vi && DICTS.includes(o?.dict) ? o.dict : 'vote'
  return {
    lang: vi ? 'vi' : 'en', link: o?.link === 2 ? 2 : 1, time: TIMES.includes(o?.time) ? o.time : 20,
    dict, cut: dict !== 'vote' && o?.cut === true, flip: !(vi && o?.flip === false), repeat: REPEATS.includes(o?.repeat) ? o.repeat : 0,
  }
}

/** Phần nối bắt buộc cho từ kế tiếp ('' = từ tự do). */
export function linkOf(s) {
  if (s.fresh || !s.chain.length) return ''
  const prev = s.chain[s.chain.length - 1].word
  return s.opts.lang === 'vi' ? prev.split(' ')[1] + ' ' : prev.slice(-s.opts.link)
}

/** Từ hợp lệ không (đúng dạng, đúng phần nối, không đảo / lặp quá luật). Từ điển chỉ server kiểm. */
export function wordErr(s, w) {
  if (typeof w !== 'string' || !WORD[s.opts.lang].test(w)) return 'games.err.badWord'
  const link = linkOf(s)
  if (link && (!w.startsWith(link) || w.length <= link.length)) return 'games.err.noLink'
  if (link && !s.opts.flip && w === link + s.chain[s.chain.length - 1].word.split(' ')[0]) return 'games.err.flipWord'
  if (s.bad.includes(w) || s.chain.filter((c) => c.word === w).length > s.opts.repeat) return 'games.err.usedWord'
  return null
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

/** Nhận từ: vào chuỗi, sang người kế. */
function take(s, word, seat, at, verdict) {
  return {
    ...s, chain: [...s.chain, { word, seat }], vote: null, verdict,
    turn: nextAlive(s, seat), deadline: at + s.opts.time * 1000, fresh: false, asks: 0,
  }
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
  if (ok) return take(s, v.word, v.seat, at, verdict)
  return { ...s, bad: [...s.bad, v.word], vote: null, verdict, deadline: at + v.left + BONUS_MS }
}

export default {
  id: 'noitu',
  minPlayers: 2,
  maxPlayers: MAX_PLAYERS,
  defaultOptions: { lang: 'vi', link: 1, time: 20, dict: 'mix', cut: false, flip: true, repeat: 0 },

  setup({ options } = {}) {
    return {
      opts: optsOf(options), started: false, order: [], alive: [], turn: null, deadline: null, now: null, chain: [], bad: [],
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
      if (move.ok === true) return take({ ...s, last: { seat, word: move.word } }, move.word, seat, now, { word: move.word, seat, ok: true, dict: true })
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
