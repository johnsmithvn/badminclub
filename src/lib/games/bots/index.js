// Chơi với máy (luyện tập): chạy hẳn trong trình duyệt, không qua server, không ghi log, không tính thống kê.
// `think(id, state, seat, level)` → nước đi của máy (đúng dạng move của game, qua được validate).
// `fillLocal` thay phần server điền ở phòng thật: đổ xúc xắc (Cờ cá ngựa, 0079) và cất tàu / tra trúng trượt
// (Bắn tàu, 0080) — bí mật (tàu của từng bên) nằm ở `secret` do màn chơi giữ, máy không đọc tàu người chơi.
//
// Mức: easy / normal / hard tự viết (search.js, heuristics.js). master = engine nhúng (engine.js, chỉ Cờ vua /
// Cờ tướng) — chạy ở luồng chính nên không nằm ở đây.

import { CHESS, COGANH, OANQUAN, pick, XIANGQI } from '#lib/games/bots/search.js'
import { bantauBot, canguaBot, caroBot, chamoBot } from '#lib/games/bots/heuristics.js'
import { SHIPS } from '#lib/games/bantau.js'

export const LEVELS = ['easy', 'normal', 'hard', 'master']

// depth = số nửa nước tìm tối đa · ms = hạn nghĩ · noise = nước kém nước tốt nhất bao nhiêu điểm vẫn có thể chọn.
const SEARCH = {
  covua: { rule: CHESS, easy: { depth: 1, noise: 180 }, normal: { depth: 2, ms: 800, noise: 35 }, hard: { depth: 4, ms: 2500, noise: 8 } },
  cotuong: { rule: XIANGQI, easy: { depth: 1, noise: 200 }, normal: { depth: 2, ms: 1000, noise: 40 }, hard: { depth: 4, ms: 3000, noise: 10 } },
  oanquan: { rule: OANQUAN, easy: { depth: 1, noise: 6 }, normal: { depth: 3, ms: 800, noise: 1.5 }, hard: { depth: 8, ms: 2000, noise: 0.3 } },
  coganh: { rule: COGANH, easy: { depth: 1, noise: 15 }, normal: { depth: 3, ms: 800, noise: 4 }, hard: { depth: 6, ms: 2000, noise: 1 } },
}
const HEUR = { caro: caroBot, chamo: chamoBot, cangua: canguaBot, bantau: bantauBot }

/** Mức của từng trò (danh sách trò: BOT_GAMES ở registry.js). master chỉ có ở trò có engine nhúng. */
export const levelsOf = (id) => (id === 'covua' || id === 'cotuong' ? LEVELS : LEVELS.slice(0, 3))

/** Nước của máy. `level` master không có ở đây → dùng hard (engine.js gọi lại khi không chạy được engine). */
export function think(id, s, seat, level, rand = Math.random, override) {
  const lv = level === 'master' ? 'hard' : level
  if (HEUR[id]) return HEUR[id](s, seat, lv, rand)
  const g = SEARCH[id]
  return pick(g.rule, s, seat, { ...g[lv], ...override, rand })
}

/**
 * Ghế nào máy phải đi bây giờ (null = chờ người). Bắn tàu: lúc xếp tàu máy xếp ngay, không chờ lượt.
 * `bots` = các ghế của máy. Hết ván (game.result khác null) → null.
 */
export function botToMove(game, s, bots) {
  if (game.result(s)) return null
  if (game.id === 'bantau' && s.phase === 'place') return bots.find((b) => !s.placed[b]) ?? null
  return bots.includes(s.turn) ? s.turn : null
}

/** Nước sẽ ghi vào "log" sau khi điền thay server. secret = { fleets: { [ghế]: [[ô…] × 5] } } — sửa tại chỗ. */
export function fillLocal(id, s, seat, move, secret, rand = Math.random) {
  if (id === 'cangua' && move?.roll === true) return { roll: true, dice: 1 + Math.floor(rand() * 6) }
  if (id !== 'bantau') return move
  if (move?.place !== undefined) {
    secret.fleets[seat] = move.place
    return { placed: true }
  }
  if (move?.fire !== undefined && move.hit === undefined) {
    const fleet = secret.fleets[1 - seat] || []
    const ship = fleet.find((cells) => cells.includes(move.fire))
    if (!ship) return { fire: move.fire, hit: false }
    const shot = s.shots[seat]
    const sunk = ship.every((c) => c === move.fire || shot[c] === 'hit')
    return { fire: move.fire, hit: true, ...(sunk ? { sunk: ship } : {}) }
  }
  return move
}

/** Tàu theo ghế, dạng phẳng như game_hands (BanTauBoard cắt lại theo SHIPS). */
export const flatFleet = (fleet) => (fleet?.length === SHIPS.length ? fleet.flat() : null)
