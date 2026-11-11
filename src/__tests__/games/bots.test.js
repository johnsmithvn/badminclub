// node src/__tests__/games/bots.test.js
// Máy chơi (lib/games/bots). Sai ở đây là máy đi nước sai luật (kẹt ván luyện tập), máy không chịu đi, hay mức Khó
// không hơn mức Dễ. Máy đấu máy bằng số ngẫu nhiên cố định nên lần nào chạy cũng ra một kết quả.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BOT_GAMES, GAMES } from '#lib/games/registry.js'
import { acceptsDraw, botToMove, fillLocal, levelsOf, think } from '#lib/games/bots/index.js'
import { chessFen, fromUci, xiangqiFen } from '#lib/games/bots/engine.js'
import { pick, CHESS } from '#lib/games/bots/search.js'

/** Số ngẫu nhiên có hạt giống (mulberry32) — ván lặp lại được. */
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** Máy (lv0 ở ghế 0, lv1 ở ghế 1) đánh tới hết ván hoặc `maxPly`; mọi nước phải qua validate. → state cuối. */
function duel(id, lv0, lv1, seed, { maxPly = 400, override, seats = 2 } = {}) {
  const game = GAMES[id]
  const rand = seeded(seed)
  const secret = { fleets: {} }
  let s = game.setup({ options: game.defaultOptions, seats: Array.from({ length: seats }, (_, i) => i) })
  const bots = Array.from({ length: seats }, (_, i) => i)
  for (let n = 0; n < maxPly; n++) {
    const seat = botToMove(game, s, bots)
    if (seat == null) break
    const move = think(id, s, seat, seat === 0 ? lv0 : lv1, rand, override)
    assert.ok(move, id + ': máy không ra nước ở ghế ' + seat)
    const logged = fillLocal(id, s, seat, move, secret, rand)
    const err = game.validate(s, seat, logged)
    assert.equal(err, null, id + ': máy đi sai luật ' + JSON.stringify(logged) + ' → ' + err)
    s = game.apply(s, seat, logged)
  }
  return s
}

const winner = (id, s) => GAMES[id].result(s)?.winners?.[0] ?? null

// Mọi trò, mọi mức: đánh được, không kẹt, không sai luật.
for (const id of BOT_GAMES) {
  assert.ok(levelsOf(id).length >= 3)
  const fast = { ms: 40, depth: 2 }
  for (const [a, b] of [['easy', 'normal'], ['hard', 'easy']]) {
    const s = duel(id, a, b, 7, { maxPly: id === 'covua' || id === 'cotuong' ? 40 : 400, override: fast })
    assert.ok(s.ply > 0 || s.moves > 0, id + ' phải có nước đi')
  }
}

// Mức Khó hơn mức Dễ: thắng đa số ván (đổi bên cho công bằng).
for (const id of ['caro', 'oanquan', 'coganh', 'chamo', 'bantau']) {
  let won = 0
  for (let k = 0; k < 6; k++) {
    const hardFirst = k % 2 === 0
    const s = duel(id, hardFirst ? 'hard' : 'easy', hardFirst ? 'easy' : 'hard', 100 + k, { override: { ms: 60 } })
    if (winner(id, s) === (hardFirst ? 0 : 1)) won++
  }
  assert.ok(won >= 4, id + ': mức Khó chỉ thắng mức Dễ ' + won + '/6 ván')
}

// Cờ cá ngựa 4 người: máy đi tới hết ván.
{
  const s = duel('cangua', 'hard', 'easy', 3, { seats: 4, maxPly: 5000 })
  assert.equal(s.over, true, 'cá ngựa 4 máy phải xong ván')
}

// Tìm kiếm thấy nước chiếu hết một nước (Cờ vua) và không bỏ quân miễn phí.
{
  const g = GAMES.covua
  const fromFen = (rows, turn) => ({ ...g.setup(), board: [...rows.join('')].map((ch) => (ch === '.' ? null : ch)), turn, castle: '', reps: {} })
  // Trắng: Hậu h5, Tượng c4 — Hxf7# (cờ học trò).
  const s = fromFen(['r.bqkb.r', 'pppp.ppp', '..n..n..', '....p..Q', '..B.P...', '........', 'PPPP.PPP', 'RNB.K.NR'], 0)
  const m = pick(CHESS, s, 0, { depth: 2, ms: 2000, rand: seeded(1) })
  assert.deepEqual([m.from, m.to], [31, 13], 'phải thấy Hxf7 chiếu hết')
}

// Bắn tàu: điền thay server — trúng / trượt / chìm theo tàu cất trong secret.
{
  const g = GAMES.bantau
  const secret = { fleets: {} }
  const fleet = [[0, 1, 2, 3, 4], [10, 11, 12, 13], [20, 21, 22], [30, 31, 32], [40, 41]]
  let s = g.setup()
  assert.deepEqual(fillLocal('bantau', s, 1, { place: fleet }, secret), { placed: true })
  s = g.apply(g.apply(s, 1, { placed: true }), 0, { placed: true })
  assert.deepEqual(fillLocal('bantau', s, 0, { fire: 99 }, secret), { fire: 99, hit: false })
  s = g.apply(s, 0, fillLocal('bantau', s, 0, { fire: 40 }, secret))
  assert.deepEqual(fillLocal('bantau', s, 0, { fire: 41 }, secret), { fire: 41, hit: true, sunk: [40, 41] })
  assert.equal(fillLocal('cangua', {}, 0, { roll: true }, secret, () => 0.99).dice, 6)
}

// Engine nhúng: đổi thế cờ sang FEN chuẩn và nước UCI về nước của game.
{
  assert.equal(chessFen(GAMES.covua.setup()), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  assert.equal(xiangqiFen(GAMES.cotuong.setup()), 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1')
  const c = GAMES.covua.setup()
  assert.deepEqual(fromUci('covua', c, 'e2e4'), { from: 52, to: 36 })
  assert.deepEqual(fromUci('covua', c, 'a7a8q'), { from: 8, to: 0, promo: 'q' })
  const x = GAMES.cotuong.setup()
  // Pháo đỏ h3 → e3 (pháo đầu): hàng 3 tính từ phía đỏ = hàng 7 của mảng (hàng 0 ở trên).
  assert.deepEqual(fromUci('cotuong', x, 'h3e3'), { from: 7 * 9 + 7, to: 7 * 9 + 4 })
  assert.equal(GAMES.cotuong.validate(x, 0, fromUci('cotuong', x, 'h3e3')), null)
  assert.deepEqual(fromUci('cotuong', x, 'a10a9'), { from: 0, to: 9 })
}

// Mức Cao thủ cờ tướng cần trang được cách ly (COOP / COEP) — vercel.json và vite.config.js phải khai báo.
{
  const vercel = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'))
  const h = vercel.headers?.find((x) => x.source.includes('may-cotuong'))
  assert.ok(h?.headers.some((x) => x.key === 'Cross-Origin-Embedder-Policy'), 'vercel.json thiếu COEP cho trang cờ tướng với máy')
  assert.ok(readFileSync(new URL('../../../vite.config.js', import.meta.url), 'utf8').includes('Cross-Origin-Embedder-Policy'))
}

// Xin hoà: máy nhận khi thế cờ không nghiêng về nó; trò không chấm được thế cờ thì không nhận.
{
  const o = GAMES.oanquan.setup()
  assert.equal(acceptsDraw('oanquan', o, 1), true) // đầu ván: cân bằng
  assert.equal(acceptsDraw('oanquan', { ...o, score: { 0: 0, 1: 10 } }, 1), false) // máy đang hơn 10 điểm
  assert.equal(acceptsDraw('oanquan', { ...o, score: { 0: 10, 1: 0 } }, 1), true)
  assert.equal(acceptsDraw('caro', GAMES.caro.setup({ options: GAMES.caro.defaultOptions, seats: [0, 1] }), 1), false)
}

console.log('bots check: OK')
