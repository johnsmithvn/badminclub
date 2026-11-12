// Kéo búa bao đấu với máy (chạy hẳn trong trình duyệt — không server, không xu). Mỗi ván hai bên cùng ra tay:
// Búa đập Kéo · Kéo cắt Bao · Bao bọc Búa; trùng nhau là hoà (không tính). Thể thức chạm 2 (best 3) hoặc chạm 3 (best 5):
// ai thắng đủ số ván trước là thắng trận.
// Máy: chủ yếu ra ngẫu nhiên; COUNTER phần trăm số ván thì ra tay khắc tay bạn vừa ra ván trước (người hay lặp lại).
// state = { best, me, bot, hist [{ mine, his, res }], over }

export const PICKS = ['rock', 'sc', 'paper']
/** Tay thắng → tay bị thắng. */
export const BEATS = { rock: 'sc', sc: 'paper', paper: 'rock' }
export const BESTS = [3, 5]
export const COUNTER = 0.25

/** Số ván phải thắng để thắng trận. */
export const needOf = (best) => Math.ceil((best + 1) / 2)

export const start = (best) => ({ best: BESTS.includes(best) ? best : 3, me: 0, bot: 0, hist: [], over: false })

/** Kết quả một ván theo phía mình: 'win' | 'lose' | 'draw'. */
export const judge = (mine, his) => (mine === his ? 'draw' : BEATS[mine] === his ? 'win' : 'lose')

/** Tay máy ra: đôi khi khắc tay bạn vừa ra ván trước, còn lại ngẫu nhiên. */
export function botPick(s, rand = Math.random) {
  const prev = s.hist.length ? s.hist[s.hist.length - 1].mine : null
  // Tay khắc `prev` = tay mà BEATS[tay] === prev.
  if (prev && rand() < COUNTER) return PICKS.find((p) => BEATS[p] === prev)
  return PICKS[Math.floor(rand() * PICKS.length)]
}

/** Ghi một ván → state mới (đã xong trận thì giữ nguyên). */
export function play(s, mine, his) {
  if (s.over || !PICKS.includes(mine) || !PICKS.includes(his)) return s
  const res = judge(mine, his)
  const me = s.me + (res === 'win' ? 1 : 0)
  const bot = s.bot + (res === 'lose' ? 1 : 0)
  const need = needOf(s.best)
  return { ...s, me, bot, hist: [...s.hist, { mine, his, res }], over: me >= need || bot >= need }
}
