// Ma sói. 5–12 người, server làm quản trò. Mỗi người một vai bí mật (game_hands), ván xen kẽ Đêm và Ngày.
//   - Đêm: Sói (cả bầy) chọn người để cắn; Tiên tri soi một người có phải Sói không; Bảo vệ che một người (không
//     che một người hai đêm liền); Thần tình yêu đêm đầu ghép đôi hai người. Có Phù thủy thì sang bước 2: Phù thủy
//     biết ai bị cắn, có một bình cứu và một bình độc (mỗi đêm dùng tối đa một bình).
//   - Sáng: lộ ai chết. Sói nguyền một lần trong ván biến nạn nhân thành Sói thay vì giết; Già làng sống sót qua lần
//     đầu bị cắn trúng. Một người trong đôi tình nhân chết thì người kia chết theo. Thợ săn chết là được bắn một người.
//   - Ngày: mọi người còn sống bỏ phiếu treo cổ một người hoặc bỏ qua. Nhiều phiếu nhất (hơn hẳn cả "bỏ qua") thì
//     bị treo; hoà thì không ai bị treo.
//   - Thắng: hết Sói → Dân làng; Sói ≥ số người còn lại → Sói; đôi tình nhân khác phe là hai người cuối → đôi đó.
//   - Lộ vai khi chết (chủ phòng chọn): mọi người chết · chỉ người bị treo cổ · không ai. Hết ván lộ hết.
//   - Rời bàn = chết (không lộ vai, không được bắn).
//   - Đồng hồ (tuỳ phòng, 0 = không giới hạn): mỗi bước đêm / Phù thủy / Thợ săn NIGHT_SEC giây, ban ngày opts.time giây,
//     tính từ giờ server ghi nước mở bước (`since`). Hết giờ thì máy bất kỳ gửi { next } dù chưa đủ người — server
//     (0084) kiểm giờ; ai chưa bấm coi như ngủ / bỏ phiếu trống / Thợ săn không bắn.
//
// KHÔNG LỘ AI CÓ VAI: mỗi bước đêm MỌI người còn sống đều gửi một nước { night } (dân thường bấm Ngủ). Server
// (0084 game_masoi_fill) đọc vai, kiểm, cất lựa chọn vào ghế âm và log chỉ ghi { night: true }. Xong bước (đủ người,
// đủ phiếu, Thợ săn đã bắn, hoặc có người vừa rời) thì một máy bất kỳ gửi { next: true }; server tính ai chết, lộ vai
// nào, ai thắng, rồi log đúng kết quả đó. Luật ở đây chỉ là phần ai cũng thấy. Đổi luật ở đây là phải đổi cả ở 0084.
//
// game_hands ghế ≥ 0 = [vai, k, a, b, k, a, b, …] — vai rồi các dữ kiện riêng (F bên dưới) của người đó.
// state = { opts, started, n, alive[], left[], phase ('night' | 'witch' | 'day' | 'hunter'), night, acted[], votes[]
//           (ghế bị bầu, -1 = bỏ qua, null = chưa bầu), hunter, shot, after, settle, shown[] (vai đã lộ), events[],
//           over { team, winners, roles }, turn, last, ply }
// move  = { deal: { n } } (server) · { night: lựa chọn } → log { night: true } · { vote } · { shoot }
//       · { next: true } → log { next: pha mới | 'settle' | 'over', dead, shown, hunter?, hang?, over? } · { out } (server)

import { t } from '#i18n'

export const ROLE_IDS = ['villager', 'wolf', 'cursed', 'seer', 'guard', 'witch', 'hunter', 'elder', 'cupid']
export const [VILLAGER, WOLF, CURSED, SEER, GUARD, WITCH, HUNTER, ELDER, CUPID] = ROLE_IDS.map((_, i) => i)
export const REVEALS = ['all', 'hanged', 'none']
export const MIN_PLAYERS = 5
export const MAX_PLAYERS = 12
/** Loại dữ kiện riêng trong hàng game_hands. */
export const F = { MATE: 1, SEEN: 2, BITTEN: 3, LOVERS: 4, PICK: 5, POTIONS: 6, GUARDED: 7, CURSE: 8, TURNED: 9 }
const NEXT = ['witch', 'day', 'night', 'hunter', 'settle', 'over']
/** Giây bàn bạc ban ngày; 0 = không giới hạn (cả đêm cũng không). PHẢI khớp 0084. */
export const DAY_TIMES = [0, 60, 120, 180, 300]
export const NIGHT_SEC = 45

export const isWolf = (r) => r === WOLF || r === CURSED
/** Vai đặc biệt chủ phòng bật / tắt được khi tự chọn bộ vai (mỗi vai tối đa 1). */
export const SPECIALS = [CURSED, SEER, GUARD, WITCH, HUNTER, ELDER, CUPID]
export const optsOf = (o) => ({
  reveal: REVEALS.includes(o?.reveal) ? o.reveal : 'all',
  time: DAY_TIMES.includes(o?.time) ? o.time : 120,
  roles: rolesOf(o?.roles),
})

/** Hạn của bước hiện tại (ms, giờ server) hoặc null (không giới hạn / chưa biết giờ). */
export const deadlineOf = (s) =>
  s.opts.time && s.since != null && s.phase && !s.over ? s.since + (s.phase === 'day' ? s.opts.time : NIGHT_SEC) * 1000 : null

/** Bộ vai theo số người (chế độ Tự động) — 0084 game_masoi_table dùng đúng bảng này. */
export function tableOf(n) {
  const wolves = n <= 5 ? 1 : n <= 8 ? 2 : 3
  const specials = Math.min(6, Math.max(2, n - wolves - 2))
  const out = Array.from({ length: wolves }, (_, i) => (i === 0 && n >= 8 ? CURSED : WOLF))
  out.push(...[SEER, GUARD, WITCH, HUNTER, ELDER, CUPID].slice(0, specials))
  while (out.length < n) out.push(VILLAGER)
  return out
}

/**
 * Bộ vai chủ phòng tự chọn (`options.roles`): danh sách các vai KHÔNG phải Dân làng — Sói thường lặp được, vai khác
 * tối đa 1. Sai dạng → null = chế độ Tự động. PHẢI khớp phần đọc options của game_masoi_deck ở 0087.
 */
export function rolesOf(r) {
  if (!Array.isArray(r) || !r.length || r.length > MAX_PLAYERS) return null
  if (!r.every((x) => Number.isInteger(x) && x >= WOLF && x <= CUPID)) return null
  const other = r.filter((x) => x !== WOLF)
  if (new Set(other).size !== other.length) return null
  return [...r].sort((a, b) => a - b)
}

/**
 * Bộ vai của ván n người → { deck } (server xáo rồi chia ngẫu nhiên) hoặc { err } (key i18n — chặn nút Bắt đầu).
 * Tự chọn: các vai đã chọn + Dân làng cho đủ n. Luật: có ít nhất 1 Sói, Sói ít hơn số người còn lại (không thì vừa
 * chia đã thắng), không quá n vai. PHẢI khớp game_masoi_deck ở 0087.
 */
export function deckOf(opts, n) {
  const r = opts?.roles
  if (!r) return { deck: tableOf(n) }
  const wolves = r.filter(isWolf).length
  if (!wolves) return { err: 'games.err.noWolf' }
  if (r.length > n) return { err: 'games.err.tooManyRoles' }
  if (2 * wolves >= n) return { err: 'games.err.tooManyWolves' }
  return { deck: [...r, ...Array(n - r.length).fill(VILLAGER)] }
}

/** Ít nhất bao nhiêu người thì bộ vai tự chọn chơi được (5 = mức tối thiểu của game). */
export const minPlayersOf = (roles) => Math.max(MIN_PLAYERS, roles.length, 2 * roles.filter(isWolf).length + 1)

/** "2 Sói, Tiên tri, Bảo vệ, 3 Dân làng" — bộ vai đọc cho người chơi (phòng chờ, bàn chơi, form tạo phòng). */
export function lineupOf(deck) {
  const count = (r) => deck.filter((x) => x === r).length
  return [WOLF, ...SPECIALS, VILLAGER].filter((r) => count(r))
    .map((r) => (count(r) > 1 ? t('games.masoi.roleCount', { n: count(r), name: t('games.masoi.role.' + ROLE_IDS[r]) }) : t('games.masoi.role.' + ROLE_IDS[r])))
    .join(', ')
}

/** Hàng bài riêng → { role, facts: [[k, a, b]…] } (null nếu chưa có). */
export function rowOf(cards) {
  if (!Array.isArray(cards) || !cards.length) return null
  const facts = []
  for (let i = 1; i + 2 < cards.length; i += 3) facts.push(cards.slice(i, i + 3))
  return { role: cards[0], facts }
}

/** Bước hiện tại đã xong chưa — xong thì máy nào cũng gửi được { next }. Có người vừa rời thì phải chốt trước. */
export function complete(s) {
  if (!s.started || s.over) return false
  if (s.settle) return true
  if (s.phase === 'night' || s.phase === 'witch') return s.alive.every((a, i) => !a || s.acted[i])
  if (s.phase === 'day') return s.alive.every((a, i) => !a || s.votes[i] != null)
  return s.phase === 'hunter' && s.shot != null
}

/**
 * Ghế mà bước hiện tại đang chờ (registry.waitingOf — mất kết nối chỉ xử những ghế này): Thợ săn chưa bắn, hoặc
 * người còn sống chưa bấm / chưa bỏ phiếu. Bước đã đủ thì không chờ ai — máy nào cũng tự gửi { next }.
 */
export function waitingFor(s) {
  if (!s.started || s.over || complete(s)) return []
  if (s.phase === 'hunter') return [s.hunter]
  const done = s.phase === 'day' ? s.votes.map((v) => v != null) : s.acted
  return s.alive.map((a, i) => (a && !done[i] ? i : null)).filter((i) => i != null)
}

/** Phiếu đang có: { [ghế]: số phiếu }, ghế -1 = bỏ qua. */
export function tallyOf(s) {
  const out = {}
  s.votes.forEach((v, i) => { if (v != null && s.alive[i]) out[v] = (out[v] || 0) + 1 })
  return out
}

const pickOk = (s, t, self) => t === -1 || (Number.isInteger(t) && t >= 0 && t < s.n && t !== self && s.alive[t])

export default {
  id: 'masoi',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  defaultOptions: { reveal: 'all', time: 120 },

  setup({ options } = {}) {
    return {
      opts: optsOf(options), since: null, started: false, n: 0, alive: [], left: [], phase: null, night: 0, acted: [], votes: [],
      hunter: null, shot: null, after: null, settle: false, shown: [], events: [], over: null, turn: null, last: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (move?.deal !== undefined) {
      const n = move.deal?.n
      return !s.started && Number.isInteger(n) && n >= MIN_PLAYERS && n <= MAX_PLAYERS ? null : 'games.err.badMove'
    }
    if (!s.started || !Number.isInteger(seat) || seat < 0 || seat >= s.n) return 'games.err.badMove'
    if (move?.out === true) return null
    if (move?.next !== undefined) {
      // Bản đã ghi (server điền): đang chờ chốt người rời thì chỉ 'settle' hoặc 'over'.
      const nx = move.next
      if (nx !== true && nx !== 'over' && !(NEXT.includes(nx) && (nx === 'settle') === s.settle)) return 'games.err.badMove'
      // Có đồng hồ thì chưa đủ người vẫn chốt được khi hết giờ — giờ thật chỉ server biết, server kiểm.
      return complete(s) || (s.opts.time && s.phase) ? null : 'games.err.notYet'
    }
    if (move?.night !== undefined) {
      if (s.phase !== 'night' && s.phase !== 'witch') return 'games.err.badMove'
      if (!s.alive[seat]) return 'games.err.dead'
      return s.acted[seat] ? 'games.err.acted' : null
    }
    if (move?.vote !== undefined) {
      if (s.phase !== 'day') return 'games.err.badMove'
      if (!s.alive[seat]) return 'games.err.dead'
      if (s.votes[seat] != null) return 'games.err.acted'
      return pickOk(s, move.vote, seat) ? null : 'games.err.badTarget'
    }
    if (move?.shoot !== undefined) {
      if (s.phase !== 'hunter' || seat !== s.hunter || s.shot != null) return 'games.err.badMove'
      return pickOk(s, move.shoot, seat) ? null : 'games.err.badTarget'
    }
    return 'games.err.badMove'
  },

  /** Mọi nước của người chơi đều qua server (vai chỉ server biết) — màn chơi không hiện trước. */
  request: (s, seat, move) => move?.out !== true,

  /** Cả bàn cùng đi, `turn` thường là null — ghế đang được chờ khai riêng (registry.waitingOf). */
  waiting: waitingFor,

  /**
   * Dòng ở phòng chờ (GameRoom.jsx): bộ vai sẽ chia với `n` người đang ngồi. Bộ vai tự chọn không hợp số người thì
   * `block` = chặn nút Bắt đầu (server cũng từ chối — game_masoi_deck 0087).
   */
  lobby(options, n) {
    if (n < MIN_PLAYERS) return null
    const d = deckOf(optsOf(options), n)
    if (d.err) return { key: d.err, params: { n }, block: true }
    return { key: 'games.masoi.lineup', params: { list: lineupOf(d.deck) }, block: false }
  },

  apply(s0, seat, move, meta) {
    const s = { ...s0, ply: s0.ply + 1 }
    const t = Date.parse(meta?.at)
    const at = Number.isFinite(t) ? t : null
    if (move.deal) {
      const n = move.deal.n
      return {
        ...s, since: at, started: true, n, alive: Array(n).fill(true), left: Array(n).fill(false), phase: 'night', night: 1,
        acted: Array(n).fill(false), votes: Array(n).fill(null), shown: Array(n).fill(null),
      }
    }
    if (move.out === true) {
      const left = s.left.map((x, i) => x || i === seat)
      // Thợ săn đang chờ bắn mà rời bàn → coi như không bắn.
      const shot = s.phase === 'hunter' && s.hunter === seat && s.shot == null ? -1 : s.shot
      const last = { seat, out: true }
      if (!s.alive[seat]) return { ...s, left, shot, last }
      return {
        ...s, left, shot, last, settle: true,
        alive: s.alive.map((a, i) => a && i !== seat),
        votes: s.votes.map((v, i) => (i === seat ? null : v)),
        events: [...s.events, { k: 'out', night: s.night, seat }],
      }
    }
    if (move.night !== undefined) {
      if (move.night !== true) return s0 // lựa chọn thật chỉ server đọc
      return { ...s, acted: s.acted.map((a, i) => a || i === seat), last: { seat, night: true } }
    }
    if (move.vote !== undefined) return { ...s, votes: s.votes.map((v, i) => (i === seat ? move.vote : v)), last: { seat, vote: move.vote } }
    if (move.shoot !== undefined) return { ...s, shot: move.shoot, last: { seat, shoot: move.shoot } }

    const nx = move.next
    if (typeof nx !== 'string') return s0 // chưa qua server
    const dead = Array.isArray(move.dead) ? move.dead : []
    const alive = s.alive.map((a, i) => a && !dead.includes(i))
    const shown = s.shown.slice()
    for (const [x, r] of move.shown || []) shown[x] = r
    const k = s.settle ? 'settle' : s.phase === 'day' ? 'hang' : s.phase === 'hunter' ? 'shot' : 'dawn'
    const ev = { k, night: s.night, dead }
    if (k === 'hang') ev.seat = move.hang ?? -1
    if (k === 'shot') Object.assign(ev, { seat: s.hunter, target: s.shot ?? -1 })
    const events = nx === 'witch' || (k === 'settle' && !dead.length) ? s.events : [...s.events, ev]
    // Bước mới bắt đầu tính giờ từ nước này; chốt người rời giữ nguyên bước nên giữ nguyên giờ.
    const since = nx === 'settle' ? s.since : at
    const base = { ...s, since, alive, shown, events, votes: s.votes.map((v, i) => (alive[i] ? v : null)), last: { seat, next: nx } }

    if (nx === 'over') {
      const o = move.over || {}
      return { ...base, over: { team: o.team, winners: o.winners || [], roles: o.roles || [] }, shown: o.roles || shown, phase: null, turn: null, settle: false }
    }
    if (nx === 'settle') return { ...base, settle: false }
    if (nx === 'witch') return { ...base, phase: 'witch', acted: s.acted.map(() => false) }
    if (nx === 'hunter') {
      return { ...base, phase: 'hunter', hunter: move.hunter, shot: null, after: s.phase === 'day' ? 'night' : 'day', turn: move.hunter }
    }
    if (nx === 'day') return { ...base, phase: 'day', votes: s.votes.map(() => null), turn: null }
    return { ...base, phase: 'night', night: s.night + 1, acted: s.acted.map(() => false), votes: s.votes.map(() => null), turn: null }
  },

  view: (s) => s,

  /** Dòng trạng thái của khung phòng — cả bàn cùng đi, không có "lượt của ai". */
  status(s) {
    if (!s.started || s.over) return null
    const total = s.alive.filter(Boolean).length
    const done = (s.phase === 'day' ? s.votes.map((v) => v != null) : s.acted).filter((a, i) => a && s.alive[i]).length
    const key = s.settle ? 'statusSettle' : { night: 'statusNight', witch: 'statusWitch', day: 'statusDay' }[s.phase] || 'statusHunter'
    return { key: 'games.masoi.' + key, params: { n: s.night, done, total } }
  },

  result(s) {
    if (!s.over) return null
    return { winners: s.over.winners, draw: false }
  },
}
