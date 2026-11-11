// Đồng hồ tổng mỗi bên + xin hoà cho Cờ vua / Cờ tướng (2 người, ghế 0 đi trước). Hàm thuần, dùng chung hai game.
// Server chép phần đồng hồ ở 0105 (game_chess_mins, game_chess_deadline) — đổi luật thì sửa cả hai.
//
// options.clock = 5 | 10 | 15 phút mỗi bên (khác = không đồng hồ). Mỗi nước đã đi được cộng INC_SEC giây.
// state.clock = { left: [ms, ms], since: ms | null } — since = giờ (server) bắt đầu lượt hiện tại; null = chưa chạy.
// Log nước đặc biệt (không đổi bàn, không đổi lượt):
//   { start: true }   — server ghi lúc bắt đầu phòng có đồng hồ (game_<id>_deal) → since = giờ dòng đó.
//   { timeout: true } — máy khách báo người tới lượt hết giờ; server chỉ nhận khi đã qua hạn → người tới lượt thua.
//   { draw: 'offer' | 'accept' | 'decline' } — xin hoà / nhận / từ chối. Nước thường nào cũng xoá lời xin hoà.

export const CLOCKS = [5, 10, 15]
export const INC_SEC = 5

export const clockMins = (o) => (CLOCKS.includes(o?.clock) ? o.clock : 0)

export const newClock = (o) => {
  const ms = clockMins(o) * 60000
  return ms ? { left: [ms, ms], since: null } : null
}

const atOf = (meta) => {
  const at = Date.parse(meta?.at)
  return Number.isFinite(at) ? at : null
}

/** Thời gian còn lại (ms) của ghế `seat` lúc `now` — chỉ người tới lượt bị trừ dần. */
export function leftOf(s, seat, now) {
  const c = s.clock
  if (!c) return null
  const used = c.since != null && s.turn === seat && !s.over ? Math.max(0, now - c.since) : 0
  return Math.max(0, c.left[seat] - used)
}

/** Hạn (ms) của người tới lượt; null = không đồng hồ / chưa chạy / hết ván. */
export const deadlineOf = (s) => (s.clock?.since != null && !s.over ? s.clock.since + s.clock.left[s.turn] : null)

/**
 * Nước đặc biệt: lỗi (key) | null nếu hợp lệ | undefined nếu là nước thường (game tự kiểm). `s.offer` = ghế đang xin hoà.
 */
export function validateExtra(s, seat, move) {
  if (move?.start === true) return s.clock && s.clock.since == null && s.ply === 0 ? null : 'games.err.badMove'
  if (s.over) return move?.timeout === true || move?.draw ? 'games.err.over' : undefined
  if (move?.timeout === true) return s.clock?.since != null ? null : 'games.err.badMove'
  if (move?.draw === 'offer') return s.offer == null && s.ply > 0 ? null : 'games.err.badMove'
  if (move?.draw === 'accept' || move?.draw === 'decline') return s.offer === 1 - seat ? null : 'games.err.badMove'
  if (move?.draw !== undefined) return 'games.err.badMove'
  return undefined
}

/** Áp nước đặc biệt → state mới, hoặc undefined nếu là nước thường. */
export function applyExtra(s, seat, move, meta) {
  if (move.start === true) return { ...s, clock: { ...s.clock, since: atOf(meta) ?? Date.now() } }
  if (move.timeout === true) return { ...s, over: true, winner: 1 - s.turn, reason: 'time', offer: null }
  if (move.draw === 'offer') return { ...s, offer: seat }
  if (move.draw === 'decline') return { ...s, offer: null }
  if (move.draw === 'accept') return { ...s, over: true, winner: null, reason: 'agreed', offer: null }
  return undefined
}

/**
 * Trước một nước thường của `seat`: trừ thời gian nghĩ, cộng INC_SEC, chuyển giờ sang lượt sau.
 * → { clock, flagged } — flagged = nước đi khi đã hết giờ (người đi thua, nước không tính).
 */
export function tick(s, seat, meta) {
  const c = s.clock
  if (!c || c.since == null) return { clock: c, flagged: false }
  const at = atOf(meta) ?? c.since
  const left = c.left.slice()
  left[seat] -= Math.max(0, at - c.since)
  if (left[seat] < 0) return { clock: c, flagged: true }
  left[seat] += INC_SEC * 1000
  return { clock: { left, since: at }, flagged: false }
}
