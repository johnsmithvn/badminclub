// node src/__tests__/games/bots.test.js
// Máy chơi (lib/games/bots). Sai ở đây là máy đi nước sai luật (kẹt ván luyện tập), máy không chịu đi, hay mức Khó
// không hơn mức Dễ. Máy đấu máy bằng số ngẫu nhiên cố định nên lần nào chạy cũng ra một kết quả.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BOT_GAMES, GAMES } from '#lib/games/registry.js'
import { acceptsDraw, botToMove, fillLocal, levelsOf, think } from '#lib/games/bots/index.js'
import { chessFen, fromUci, xiangqiFen } from '#lib/games/bots/engine.js'
import { pick, CHESS, COUP } from '#lib/games/bots/search.js'
import { HIDDEN_SQUARES } from '#lib/games/coup.js'

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
    const s = duel(id, a, b, 7, { maxPly: ['covua', 'cotuong', 'coup'].includes(id) ? 40 : 400, override: fast })
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

// Cờ úp: fillLocal xáo mặt thật như server (0095) và điền flip / took theo ô xuất phát; bỏ flip / took máy khách tự gửi.
{
  const g = GAMES.coup
  const s = g.setup()
  const secret = { fleets: {} }
  const red = 6 * 9 + 0 // ô tốt đỏ ngoài cùng bên trái
  const m = fillLocal('coup', s, 0, { from: red, to: red - 9, flip: 'R' }, secret, seeded(5))
  assert.equal(m.flip, secret.faces[red], 'flip = mặt thật đã xáo ở ô xuất phát')
  assert.equal(m.took, undefined)
  for (const side of [0, 1]) {
    const sq = HIDDEN_SQUARES.filter((i) => (side === 0 ? i >= 45 : i < 45))
    assert.deepEqual(sq.map((i) => secret.faces[i]).sort(), [...'AACCEEHHPPPPPRR'], 'mỗi bên xáo đúng bộ 15 quân của mình')
  }
  assert.equal(COUP.evaluate(s, 0), 0, 'đầu ván cân bằng')
  assert.equal(COUP.evaluate(s, 1), 0)
}

// Cờ úp: máy không đọc mặt thật quân úp. Giữa ván, đổi chỗ mặt thật của các quân CÒN ÚP rồi đánh lại đúng chuỗi nước đó
// → thế cờ phải y hệt (state không mang mặt quân úp) và máy ra đúng nước cũ. Đồng thời: một ván máy đấu máy tới hết.
{
  const g = GAMES.coup
  const rand = seeded(11)
  const secret = { fleets: {} }
  const log = [] // nước máy chọn (chưa điền)
  let s = g.setup()
  let checked = 0
  for (let n = 0; n < 600 && !g.result(s); n++) {
    const seat = s.turn
    if (n % 40 === 20) {
      const other = { faces: secret.faces.slice() }
      for (const side of [0, 1]) {
        const up = HIDDEN_SQUARES.filter((i) => s.board[i] === (side === 0 ? 'X' : 'x'))
        const j = up.find((i) => other.faces[i] !== other.faces[up[0]])
        if (j != null) [other.faces[up[0]], other.faces[j]] = [other.faces[j], other.faces[up[0]]]
      }
      if (other.faces.some((f, i) => f !== secret.faces[i])) {
        let t = g.setup()
        for (const m of log) t = g.apply(t, t.turn, fillLocal('coup', t, t.turn, m, other))
        assert.deepEqual(t, s, 'state không được mang mặt quân còn úp')
        const opt = { depth: 2, ms: 1e9 }
        assert.deepEqual(think('coup', t, seat, 'normal', seeded(n), opt), think('coup', s, seat, 'normal', seeded(n), opt))
        checked++
      }
    }
    const move = think('coup', s, seat, seat === 0 ? 'hard' : 'easy', rand, { depth: 1, ms: 1e9 })
    const logged = fillLocal('coup', s, seat, move, secret, rand)
    assert.equal(g.validate(s, seat, logged), null, 'cờ úp: máy đi sai luật ' + JSON.stringify(logged))
    log.push(move)
    s = g.apply(s, seat, logged)
  }
  assert.ok(g.result(s), 'cờ úp máy đấu máy phải xong ván')
  assert.ok(checked > 0)
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
