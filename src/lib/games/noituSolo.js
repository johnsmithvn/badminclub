// Nối từ đấu máy (luyện tập, chạy hẳn trong trình duyệt, không server, không xu). Bạn và máy nối luân phiên từ 2 âm
// tiết tiếng Việt; ĐIỂM = số từ BẠN nối được: từ có trong từ điển 1 điểm, "từ lạ" (hai âm tiết đều có thật nhưng từ không
// có trong từ điển) nửa điểm, từ có âm tiết lạ 0 điểm. Không chặn cứng (chủ dự án chốt 2026-11-12): sai luật nối thì
// báo để gõ lại — không mất lượt; từ lạ vẫn được nhận.
// Hết ván: bạn bấm Chịu hoặc hết giờ lượt → giữ điểm đang có. Máy bí (hết từ để nối, hoặc mức Dễ / Vừa tự chịu) → bạn
// thắng, cộng BONUS. Máy không nối được sau một từ lạ / âm tiết lạ thì KHÔNG tính là máy bí — máy ra từ mới tự do (khỏi
// bị lừa bằng từ bịa). Kỷ lục lưu trên máy (localStorage) theo mức, không có bảng chung.
//
// State dùng lại khuôn của noitu.js (opts, chain[{ word, seat }], bad, fresh) để kiểm từ bằng đúng `wordErr` / `linkOf`
// của phòng thật. seat 0 = bạn, 1 = máy. Từ điển: public/words/vi.txt (chép từ 0100, tải lười — dictOf).

import { linkOf, normWord, optsOf, wordErr } from '#lib/games/noitu.js'

export const LEVELS = ['easy', 'normal', 'hard']
/** Giây mỗi lượt của bạn. */
export const TIMES = [15, 20, 30]
export const BONUS = 3
export const PTS = { dict: 1, strange: 0.5, unknown: 0 }
// Mức Dễ / Vừa: xác suất máy tự chịu mỗi lượt (Khó chỉ chịu khi hết từ thật).
const QUIT = { easy: 0.1, normal: 0.03, hard: 0 }
const ME = 0
const BOT = 1

/** Dòng file từ điển → danh sách từ (bỏ dòng chú thích `#`). */
export const parseWords = (text) => String(text).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

/** Từ điển tra nhanh: set từ, từ theo âm tiết đầu, mọi âm tiết có thật. */
export function dictOf(words) {
  const set = new Set(words)
  const by = new Map()
  const syl = new Set()
  for (const w of words) {
    const [a, b] = w.split(' ')
    syl.add(a)
    syl.add(b)
    if (!by.has(a)) by.set(a, [])
    by.get(a).push(w)
  }
  return { set, by, syl }
}

const tail = (w) => w.split(' ')[1]
const used = (s, w) => s.chain.some((c) => c.word === w)
/** Số từ nối tiếp được sau `w` (chưa dùng) — càng ít càng khó cho người nối sau. */
const exits = (s, dict, w) => (dict.by.get(tail(w)) || []).filter((x) => x !== w && !used(s, x)).length
const anyOf = (xs, rand) => xs[Math.floor(rand() * xs.length)]

/** Từ mở đầu / từ mới tự do của máy: từ nào sau nó còn nhiều đường nối (≥ 5). */
function opener(s, dict, rand) {
  const words = [...dict.set]
  for (let k = 0; k < 200; k++) {
    const w = anyOf(words, rand)
    if (!used(s, w) && exits(s, dict, w) >= 5) return w
  }
  return words.find((w) => !used(s, w))
}

/** Ván mới: máy ra từ đầu, tới lượt bạn. */
export function start(dict, rand = Math.random) {
  const s = { opts: optsOf({ lang: 'vi' }), chain: [], bad: [], fresh: false, score: 0, mine: 0, turn: ME, over: null }
  return { ...s, chain: [{ word: opener(s, dict, rand), seat: BOT }] }
}

/** Âm tiết phải nối ('' = từ tự do). */
export const needOf = (s) => linkOf(s).trim()

/**
 * Chữ bạn gõ → { err } (báo, không mất lượt) hoặc { word, kind, pts }. Gõ một âm tiết thì tự ghép sau âm phải nối
 * ("sinh" + gõ "viên" = "sinh viên").
 */
export function judge(s, dict, raw) {
  let w = normWord(raw)
  const need = needOf(s)
  if (need && w && !w.includes(' ')) w = need + ' ' + w
  const err = wordErr(s, w)
  if (err) return { err }
  const [a, b] = w.split(' ')
  const kind = dict.set.has(w) ? 'dict' : dict.syl.has(a) && dict.syl.has(b) ? 'strange' : 'unknown'
  return { word: w, kind, pts: PTS[kind] }
}

/** Ghi từ của bạn (kết quả `judge` không lỗi), sang lượt máy. */
export const playMine = (s, j) => ({
  ...s, chain: [...s.chain, { word: j.word, seat: ME, kind: j.kind, pts: j.pts }], score: s.score + j.pts, mine: s.mine + 1, fresh: false, turn: BOT,
})

/** Bạn chịu / hết giờ → hết ván, giữ điểm. */
export const endMine = (s, why) => ({ ...s, turn: null, over: { why, win: false } })

/**
 * Nước của máy → state mới. Có từ nối được: Dễ chọn từ còn nhiều đường nối (dễ cho bạn), Vừa chọn bừa, Khó chọn từ ít
 * đường nối nhất mà vẫn nối được (như luật "chặn từ cụt" của phòng thật — không ra từ cụt hẳn).
 * Không có từ nối: sau từ có trong từ điển = máy bí (bạn thắng); sau từ lạ / âm tiết lạ = máy ra từ mới tự do.
 */
export function botTurn(s, dict, level, rand = Math.random) {
  const last = s.chain[s.chain.length - 1]
  const cands = (dict.by.get(tail(last.word)) || []).filter((w) => !used(s, w))
  const lose = () => ({ ...s, turn: null, score: s.score + BONUS, over: { why: 'botStuck', win: true } })
  if (!cands.length) {
    if (last.kind === 'dict' || last.kind == null) return lose()
    return { ...s, chain: [...s.chain, { word: opener(s, dict, rand), seat: BOT, fresh: true }], fresh: false, turn: ME }
  }
  if (rand() < QUIT[level]) return lose()
  const scored = cands.map((w) => ({ w, n: exits(s, dict, w) }))
  let pick
  if (level === 'hard') {
    const open = scored.filter((x) => x.n > 0)
    const pool = open.length ? open : scored
    const min = Math.min(...pool.map((x) => x.n))
    pick = anyOf(pool.filter((x) => x.n === min), rand).w
  } else if (level === 'easy') {
    const wide = scored.filter((x) => x.n >= 5)
    pick = anyOf(wide.length ? wide : scored, rand).w
  } else {
    pick = anyOf(scored, rand).w
  }
  return { ...s, chain: [...s.chain, { word: pick, seat: BOT }], fresh: false, turn: ME }
}

