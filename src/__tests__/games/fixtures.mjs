// node src/__tests__/games/fixtures.mjs
// Sinh lại bộ ván mẫu trong file kiểm tay: 0075_games_results_check.sql (khối $fx$ = Ô ăn quan, $cg$ = Cờ gánh),
// 0076_games_colat_check.sql (khối $cl$ = Cờ lật), 0077_games_chamo_check.sql (khối $ch$ = Chấm ô) và
// 0089_games_covay_check.sql (khối $gv$ = Cờ vây), 0090_games_phom_check.sql (khối $ph$ = Phỏm — kịch bản đủ bài
// từng tay, nước người chơi gửi, nước server phải ghi / mã lỗi phải báo, kết quả chấm), 0107_games_xo_check.sql
// (khối $xo$ = Cờ X-O, đủ 3 chế độ).
// Ván do chính luật JS chơi ngẫu nhiên (tất định theo seed), trộn nước rác; kết quả ghi kèm là JS chấm.
// <game>.test.js chấm lại các ván này bằng JS; file kiểm chấm bằng SQL trên DB thật.
// CHỈ chạy khi cố ý đổi luật — rồi phải sửa SQL trong migration cho khớp và chạy lại file kiểm trên DB.

import { readFileSync, writeFileSync } from 'node:fs'
import oq, { sideOf } from '../../lib/games/oanquan.js'
import cg, { NEIGHBORS, forcedFrom, hasDiag, QUIET_LIMIT } from '../../lib/games/coganh.js'
import cl, { movesOf } from '../../lib/games/colat.js'
import ch from '../../lib/games/chamo.js'
import cv, { place as cvPlace } from '../../lib/games/covay.js'
import ph, { bestLay, cover as phCover, dealMove, judge, meldOk, meldsIn, pendingOf, referee, sendsFor, uOf } from '../../lib/games/phom.js'
import xo, { LINES as XO_LINES, moving as xoMoving } from '../../lib/games/xo.js'

// ponytail: nhân số thực vượt 2^53 rồi lấy `% n` theo bit thấp → rút lệch hẳn về vài lựa chọn. Giữ nguyên để bộ ván
// 0075 / 0076 không đổi; game mới đừng trông vào any() để phủ đủ loại nước rác — rút lần lượt như chTrash.
let seed = 1
const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
const any = (a) => a[rand(a.length)]

/** Nước rác phải bị luật từ chối — lỡ hợp lệ thì dừng luôn, kẻo bộ ván gác nhầm. */
function junk(game, s, list) {
  const m = any(list)
  if (game.validate(s, m.seat, m.move) == null) throw new Error('nước rác lại hợp lệ: ' + JSON.stringify(m))
  return m
}

/** Một ván ngẫu nhiên: legal(s) → nước hợp lệ, trash(s) → danh sách nước rác, có thì chèn xen vào. */
function play(game, sd, { legal, trash, after, options = {} }) {
  seed = sd
  let s = game.setup({ options, seats: [0, 1] })
  const moves = []
  const tags = new Set()
  while (!s.over) {
    if (rand(4) === 0) moves.push(junk(game, s, trash(s)))
    const prev = s
    const m = any(legal(s))
    s = game.apply(s, s.turn, m)
    moves.push({ seat: prev.turn, move: m })
    after?.(prev, s, tags)
  }
  moves.push(junk(game, s, [{ seat: s.turn ?? 0, move: legal({ ...s, over: false })[0] || { cell: 1, dir: 1 } }]))
  return { moves, s, tags, result: game.result(s) }
}

/** Ván ngắn nhất cho từng loại (theo `kind`), cộng nửa đầu một ván làm ván chưa xong. */
function pick(game, cfg, kind, half) {
  const best = {}
  for (let sd = 1; sd < cfg.seeds; sd++) {
    const g = play(game, sd, cfg)
    const k = kind(g)
    if (k && (!best[k] || g.moves.length < best[k].moves.length)) best[k] = { ...g, note: k }
  }
  const u = play(game, half, cfg)
  const part = u.moves.slice(0, Math.min(40, Math.floor(u.moves.length / 2)))
  const st = part.reduce((s, m) => (game.validate(s, m.seat, m.move) == null ? game.apply(s, m.seat, m.move) : s), game.setup({ options: cfg.options || {} }))
  if (st.over) throw new Error('nửa ván đã xong — đổi seed ván chưa xong')
  return [...Object.values(best), { note: 'chưa xong ván', moves: part, result: null }]
}

/**
 * Một dòng JSON mỗi ván. Ở ván đầu, nước HỢP LỆ đầu tiên viết số dạng 5.0 (JS đọc ra 5, jsonb giữ 5.0 — SQL phải
 * coi như nhau, không thì nước đó bị bỏ và cả ván lệch). `f.options` (nếu có) là tuỳ chọn phòng viết NGUYÊN VĂN
 * — để giữ được cả kiểu 6.0 — file kiểm tạo phòng bằng đúng tuỳ chọn đó.
 */
function block(game, fx, keys) {
  const re = new RegExp('^\\{' + keys.map((k) => `"${k}":(-?\\d+)`).join(',') + '\\}$')
  const to = '{' + keys.map((k, n) => `"${k}":$${n + 1}.0`).join(',') + '}'
  const line = (f, i) => {
    let s = game.setup({ options: f.options ? JSON.parse(f.options) : {} })
    let dot = i === 0
    const moves = f.moves.map((m) => {
      const raw = JSON.stringify(m)
      const ok = game.validate(s, m.seat, m.move) == null
      if (ok) s = game.apply(s, m.seat, m.move)
      if (!dot || !ok) return raw
      dot = false
      const mv = JSON.stringify(m.move)
      if (!re.test(mv)) throw new Error('không chèn được số dạng 5.0 vào ' + mv)
      return raw.replace(mv, mv.replace(re, to))
    })
    if (dot) throw new Error('ván đầu không có nước hợp lệ nào')
    const opts = f.options ? `,"options":${f.options}` : ''
    return `{"note":${JSON.stringify(f.note)}${opts},"result":${JSON.stringify(f.result)},"moves":[${moves.join(',')}]}`
  }
  return '[\n' + fx.map(line).join(',\n') + '\n]'
}

// ---------- Ô ăn quan ----------
const oqLegal = (s) => sideOf(s, s.turn).flatMap((cell) => [{ cell, dir: 1 }, { cell, dir: -1 }]).filter((m) => oq.validate(s, s.turn, m) == null)
const oqTrash = (s) => {
  const t = s.turn, own = sideOf(s, t), opp = sideOf(s, 1 - t)
  const list = [
    { seat: 1 - t, move: { cell: any(opp), dir: 1 } },
    { seat: t, move: { cell: any(opp), dir: -1 } },
    { seat: t, move: { cell: any([0, 6]), dir: 1 } },
    { seat: t, move: { cell: any(own), dir: any([0, 2]) } },
    { seat: t, move: { cell: String(any(own)), dir: 1 } },
    { seat: t, move: { cell: any(own) } },
    { seat: t, move: null },
    { seat: t, move: [own[0], 1] },
    { seat: t, move: { cell: any(own) + 0.5, dir: -1 } },
  ]
  const e = own.find((c) => s.stones[c] === 0)
  if (e != null) list.push({ seat: t, move: { cell: e, dir: 1 } })
  return list
}
const oqEmpty = (s, i) => s.stones[i] === 0 && !s.quan[i]
const oqFx = pick(oq, {
  seeds: 30000,
  legal: oqLegal,
  trash: oqTrash,
  after: (prev, s, tags) => { if (!s.over && s.score[s.turn] < prev.score[s.turn]) tags.add('refill') },
}, (g) => {
  const w = g.result.draw ? 'hoà' : 'ghế ' + g.result.winners[0] + ' thắng'
  const end = oqEmpty(g.s, 0) && oqEmpty(g.s, 6) ? 'hết quan' : 'hết dân mà thiếu 5 điểm rải lại'
  if (w === 'ghế 0 thắng' && end === 'hết quan' && g.tags.has('refill')) return w + ' · ' + end + ' · có rải lại · có nước rác'
  if (w === 'ghế 1 thắng' && end !== 'hết quan') return w + ' · ' + end + ' · có nước rác'
  if (w === 'hoà') return 'hoà · có nước rác'
  return null
}, 7)

// ---------- Cờ gánh ----------
const cgLegal = (s) => {
  const out = []
  for (let f = 0; f < 25; f++) {
    if (s.board[f] !== s.turn) continue
    for (const to of NEIGHBORS[f]) if (cg.validate(s, s.turn, { from: f, to }) == null) out.push({ from: f, to })
  }
  return out
}
const cgTrash = (s) => {
  const t = s.turn
  const mine = s.board.flatMap((v, i) => (v === t ? [i] : []))
  const theirs = s.board.flatMap((v, i) => (v === 1 - t ? [i] : []))
  const free = s.board.flatMap((v, i) => (v == null ? [i] : []))
  const list = [
    { seat: 1 - t, move: { from: any(theirs), to: any(free) } },
    { seat: t, move: { from: any(theirs), to: any(free) } },
    { seat: t, move: { from: String(mine[0]), to: 12 } },
    { seat: t, move: null },
    { seat: t, move: [1, 2] },
    { seat: t, move: { from: mine[0] + 0.5, to: 12 } },
    { seat: t, move: { from: mine[0] } },
  ]
  if (mine.length > 1) list.push({ seat: t, move: { from: mine[0], to: mine[1] } })
  const far = mine.flatMap((f) => free.filter((x) => !NEIGHBORS[f].includes(x)).map((x) => ({ from: f, to: x })))
  if (far.length) list.push({ seat: t, move: any(far) })
  const odd = mine.filter((f) => !hasDiag(f)).flatMap((f) => [f - 6, f - 4, f + 4, f + 6]
    .filter((x) => x >= 0 && x < 25 && Math.abs((x % 5) - (f % 5)) === 1 && s.board[x] == null).map((x) => ({ from: f, to: x })))
  if (odd.length) list.push({ seat: t, move: any(odd) })
  if (forcedFrom(s, t).length) {
    const dodge = mine.flatMap((f) => NEIGHBORS[f].filter((x) => s.board[x] == null && x !== s.open).map((x) => ({ from: f, to: x })))
    for (let k = 0; k < 4 && dodge.length; k++) list.push({ seat: t, move: any(dodge) })
  }
  return list
}
const cgFx = pick(cg, {
  seeds: 6000,
  legal: cgLegal,
  trash: cgTrash,
  after: (prev, s, tags) => { if (forcedFrom(prev, prev.turn).length) tags.add('forced') },
}, (g) => {
  const c = [0, 0]
  g.s.board.forEach((v) => { if (v != null) c[v] += 1 })
  const w = g.result.draw ? 'hoà' : 'ghế ' + g.result.winners[0] + ' thắng'
  if (c[0] === 0 || c[1] === 0) {
    if (w === 'ghế 0 thắng' && g.tags.has('forced')) return w + ' · hết quân · có nước bắt buộc gánh · có nước rác'
    if (w === 'ghế 1 thắng') return w + ' · hết quân · có nước rác'
    return null
  }
  return g.s.quiet >= QUIET_LIMIT ? 'im ' + QUIET_LIMIT + ' nước · đếm quân: ' + w + ' · có nước rác' : null
}, 11)

// ---------- Cờ lật ----------
// Nước "tràn mép": chỉ kẹp được nếu đi bằng cách cộng chỉ số (±1, ±7, ±9 tràn sang hàng bên) — luật đúng phải từ chối.
const naive = (b, i, t) => [-9, -8, -7, -1, 1, 7, 8, 9].some((d) => {
  let j = i + d
  let n = 0
  while (j >= 0 && j < 64 && b[j] === 1 - t) { j += d; n += 1 }
  return n > 0 && j >= 0 && j < 64 && b[j] === t
})
const clLegal = (s) => movesOf(s.board, s.turn).map((cell) => ({ cell }))
const clTrash = (s) => {
  const t = s.turn
  const legal = movesOf(s.board, t)
  const taken = s.board.flatMap((v, i) => (v != null ? [i] : []))
  const dead = s.board.flatMap((v, i) => (v == null && !legal.includes(i) ? [i] : []))
  const list = [
    { seat: 1 - t, move: { cell: any(legal) } },
    { seat: t, move: { cell: any(taken) } },
    { seat: t, move: { cell: String(any(legal)) } },
    { seat: t, move: { cell: any(legal) + 0.5 } },
    { seat: t, move: { cell: any([-1, 64]) } },
    { seat: t, move: null },
    { seat: t, move: [any(legal)] },
  ]
  if (dead.length) list.push({ seat: t, move: { cell: any(dead) } })
  for (const i of dead.filter((i) => naive(s.board, i, t))) list.push({ seat: t, move: { cell: i } }, { seat: t, move: { cell: i } })
  return list
}
const hasWrap = (moves) => {
  let s = cl.setup()
  return moves.some((m) => {
    if (cl.validate(s, m.seat, m.move) == null) { s = cl.apply(s, m.seat, m.move); return false }
    const i = m.move?.cell
    return !s.over && m.seat === s.turn && Number.isInteger(i) && s.board[i] == null && naive(s.board, i, s.turn)
  })
}
const clFx = pick(cl, {
  seeds: 4000,
  legal: clLegal,
  trash: clTrash,
  after: (prev, s, tags) => { if (!s.over && s.last.skipped != null) tags.add('skip') },
}, (g) => {
  const full = g.s.board.every((v) => v != null)
  const w = g.result.draw ? 'hoà' : 'ghế ' + g.result.winners[0] + ' thắng'
  if (!full) return 'hết nước trước khi đầy bàn · ' + w + ' · có nước rác'
  if (w === 'ghế 0 thắng' && g.tags.has('skip') && hasWrap(g.moves)) return w + ' · đầy bàn · có mất lượt · có nước rác tràn mép'
  if (w === 'ghế 1 thắng' && hasWrap(g.moves)) return w + ' · đầy bàn · có nước rác tràn mép'
  if (w === 'hoà') return 'hoà · đầy bàn · có nước rác'
  return null
}, 13)

// ---------- Chấm ô ----------
// Mỗi ván một cỡ bàn, tuỳ chọn viết nguyên văn (cả 6.0 và cỡ bậy phải về 5 × 5). Rác rút LẦN LƯỢT từng loại (any()
// rút lệch, xem rand) — đủ cả: sai lượt, nét đã nối, chuỗi, lẻ, -1, đúng bằng số nét (hợp lệ ở bàn to hơn), sai khoá,
// null, mảng. Người vừa ăn ô (đang được đi tiếp) thì loại nào cũng là người kia chen lượt — SQL quên "ăn ô thì đi
// tiếp" là lệch ngay.
const chFree = (s) => s.lines.flatMap((v, i) => (v == null ? [i] : []))
const chLegal = (s) => chFree(s).map((line) => ({ line }))
let chNext = 0
const chTrash = (s) => {
  const t = s.turn
  const free = chFree(s)
  const drawn = s.lines.flatMap((v, i) => (v != null ? [i] : []))
  if (s.last?.boxes.length) return [{ seat: 1 - t, move: { line: any(free) } }]
  const list = [
    { seat: 1 - t, move: { line: any(free) } },
    { seat: t, move: { line: any(drawn.length ? drawn : [-1]) } },
    { seat: t, move: { line: String(any(free)) } },
    { seat: t, move: { line: any(free) + 0.5 } },
    { seat: t, move: { line: -1 } },
    { seat: t, move: { line: s.lines.length } },
    { seat: t, move: { cell: any(free) } },
    { seat: t, move: null },
    { seat: t, move: [any(free)] },
  ]
  return [list[chNext++ % list.length]]
}
/** Có nước rác chen lượt lúc người kia đang được đi tiếp (nét còn trống, chỉ sai người) không. */
const stole = (moves, options) => {
  let s = ch.setup({ options })
  return moves.some((m) => {
    if (ch.validate(s, m.seat, m.move) == null) { s = ch.apply(s, m.seat, m.move); return false }
    const i = m.move?.line
    return !s.over && s.last?.boxes.length > 0 && m.seat === 1 - s.turn && Number.isInteger(i) && s.lines[i] == null
  })
}
/** Ván đầu tiên (seed từ `from`) thoả `ok`. Ván Chấm ô dài cố định theo cỡ bàn nên khỏi tìm ván ngắn nhất như pick(). */
function find(game, cfg, ok, from) {
  for (let sd = from; sd < from + 20000; sd++) {
    const g = play(game, sd, cfg)
    if (ok(g)) return g
  }
  throw new Error('không tìm được ván mẫu cho ' + JSON.stringify(cfg.options))
}
const chCfg = (options) => ({
  legal: chLegal,
  trash: chTrash,
  options,
  after: (prev, s, tags) => {
    if (s.last.boxes.length === 2) tags.add('double')
    if (s.trail.length >= 4) tags.add('chain')
  },
})
// Mỗi ván tìm từ một seed riêng (from) — ba ván 5 × 5 khỏi trùng nước với nhau.
const chRun = (text, note, from, ok = () => true) => {
  const g = find(ch, chCfg(JSON.parse(text)), ok, from)
  const w = g.result.draw ? 'hoà' : 'ghế ' + g.result.winners[0] + ' thắng'
  return { ...g, note: note + ' · ' + w + ' · có nước rác', options: text }
}
const chFx = [
  chRun('{}', 'bàn 5 × 5 mặc định · có nét khép hai ô · có ăn dây chuyền · có nước chen lượt lúc người kia được đi tiếp', 1,
    (g) => g.result.winners[0] === 0 && g.tags.has('double') && g.tags.has('chain') && stole(g.moves, {})),
  chRun('{"size":3}', 'bàn 3 × 3', 100, (g) => g.result.winners[0] === 1),
  chRun('{"size":4}', 'bàn 4 × 4', 200, (g) => g.result.draw),
  chRun('{"size":6.0}', 'cỡ viết 6.0 = bàn 6 × 6', 300),
  chRun('{"size":"3"}', 'cỡ là chuỗi 3 → về bàn 5 × 5', 400),
  chRun('{"size":9}', 'cỡ 9 quá lớn → về bàn 5 × 5', 500),
]
{
  const part = play(ch, 29, chCfg({})).moves.slice(0, 30)
  const st = part.reduce((s, m) => (ch.validate(s, m.seat, m.move) == null ? ch.apply(s, m.seat, m.move) : s), ch.setup())
  if (st.over) throw new Error('nửa ván Chấm ô đã xong')
  chFx.push({ note: 'chưa xong ván', moves: part, result: null })
}

// ---------- Cờ vây ----------
// Nước hợp lệ: mọi giao điểm đặt được + bỏ lượt. 30 nước đầu chỉ bỏ lượt khi hết chỗ; sau đó bỏ lượt chiếm khoảng 1/5
// lựa chọn để ván kết thúc sau vài chục nước thay vì đi tới trần 3 × số giao điểm.
const cvPoints = (s) => {
  const seat = s.turn ?? 0
  const out = []
  for (let i = 0; i < s.board.length; i++) if (s.board[i] == null && i !== s.ko && cvPlace(s.board, s.size, i, seat)) out.push({ i })
  return out
}
const cvLegal = (s) => {
  const pts = cvPoints(s)
  const pass = { pass: true }
  if (s.ply < 30) return pts.length ? pts : [pass]
  return [...pts, ...Array(Math.ceil(pts.length / 4) + 1).fill(pass)]
}
// Nước rác rút lần lượt (không qua any()) để đủ loại; có ko thì luôn thử ăn lại ko, có điểm tự sát thì thử tự sát.
let cvNth = 0
const cvTrash = (s) => {
  const t = s.turn
  const empty = s.board.findIndex((v) => v == null)
  const taken = s.board.findIndex((v) => v != null)
  const suicide = s.board.findIndex((v, i) => v == null && i !== s.ko && !cvPlace(s.board, s.size, i, t))
  if (s.ko >= 0) return [{ seat: t, move: { i: s.ko } }]
  if (suicide >= 0) return [{ seat: t, move: { i: suicide } }]
  const list = [
    { seat: 1 - t, move: { pass: true } },
    { seat: t, move: { i: s.board.length } },
    { seat: t, move: { i: -1 } },
    { seat: t, move: { i: String(Math.max(empty, 0)) } },
    { seat: t, move: { i: 2.5 } },
    { seat: t, move: {} },
    { seat: t, move: null },
    ...(empty >= 0 ? [{ seat: 1 - t, move: { i: empty } }] : []),
    ...(taken >= 0 ? [{ seat: t, move: { i: taken } }] : []),
  ]
  cvNth += 1
  return [list[cvNth % list.length]]
}
const cvCfg = (options = {}) => ({
  legal: cvLegal,
  trash: cvTrash,
  options,
  after: (prev, s, tags) => {
    if (s.last.captured?.length) tags.add('capture')
    if (s.last.captured?.length >= 2) tags.add('group')
    if (s.ko >= 0) tags.add('ko')
  },
})
const cvKind = (g) => (g.result.winners[0] === 0 ? 'Đen thắng' : 'Trắng thắng') +
  (g.tags.has('ko') ? ' · có ko' : '') + (g.tags.has('group') ? ' · ăn cả nhóm' : g.tags.has('capture') ? ' · có ăn quân' : '')
const cvFx = pick(cv, { ...cvCfg(), seeds: 120 }, cvKind, 7)
// Viết tay trên bàn 9 × 9 (i = hàng * 9 + cột): thế ko kinh điển góc trên trái — ăn lại ngay bị từ chối, đi nước khác
// rồi mới ăn lại được — và một nước tự sát ở góc dưới phải. [ghế, nước, phải hợp lệ?]
{
  const script = [
    [0, { i: 1 }, true], [1, { i: 2 }, true], [0, { i: 9 }, true], [1, { i: 12 }, true], [0, { i: 19 }, true], [1, { i: 20 }, true],
    [0, { i: 70 }, true], [1, { i: 10 }, true],
    [0, { i: 11 }, true], // Đen ăn quân Trắng ở 10 → ko tại 10
    [1, { i: 10 }, false], // Trắng ăn lại ko ngay → từ chối
    [1, { i: 71 }, true], [0, { i: 61 }, true],
    [1, { i: 10 }, true], // đi nước khác rồi mới được ăn lại → ko tại 11
    [0, { i: 11 }, false], // Đen ăn lại ko ngay → từ chối
    [0, { i: 40 }, true], [1, { i: 79 }, true],
    [0, { i: 80 }, false], // góc dưới phải kề Trắng 71, 79 (còn khí) → Đen tự sát → từ chối
    [0, { pass: true }, true], [1, { pass: true }, true],
  ]
  let s = cv.setup({ options: {} })
  for (const [seat, move, want] of script) {
    const good = cv.validate(s, seat, move) == null
    if (good !== want) throw new Error('ván ko viết tay sai kịch bản ở ' + JSON.stringify(move) + ': ' + cv.validate(s, seat, move))
    if (good) s = cv.apply(s, seat, move)
  }
  if (!s.over) throw new Error('ván ko viết tay chưa xong')
  cvFx.push({ note: 'viết tay · ko · ăn lại ngay bị từ chối, đi nước khác rồi được ăn lại · tự sát bị từ chối',
    moves: script.map(([seat, move]) => ({ seat, move })), result: cv.result(s) })
}
// Mỗi cỡ bàn / cỡ lạ một ván ngẫu nhiên (seed riêng): 13, 19, 13 viết 13.0, "13" chữ → 9, 7 lạ → 9.
const cvRun = (text, note, from) => {
  const g = find(cv, cvCfg(JSON.parse(text)), () => true, from)
  return { ...g, note: note + ' · ' + cvKind(g) + ' · có nước rác', options: text }
}
cvFx.push(
  cvRun('{"size":13}', 'bàn 13 × 13', 1000),
  cvRun('{"size":19}', 'bàn 19 × 19', 2000),
  cvRun('{"size":13.0}', 'cỡ viết 13.0 = bàn 13 × 13', 3000),
  cvRun('{"size":"13"}', 'cỡ là chuỗi 13 → về bàn 9 × 9', 4000),
  cvRun('{"size":7}', 'cỡ 7 không có → về bàn 9 × 9', 5000),
)

// ---------- Phỏm ----------
// Mỗi ván: bài từng tay + nọc → chơi bằng trọng tài JS (referee). Bước = nước người chơi gửi + nước server phải ghi
// (log), hoặc nước rác + mã lỗi server phải báo (err), hoặc { out } (game_leave ghi). Kết quả = judge().
const phTry = (pub, hands, stock, seat, move) => {
  try { return { ok: referee(pub, hands, stock, seat, move) } } catch (e) { return { err: e.message } }
}
/**
 * Nước rác hợp với lúc này — trọng tài phải báo lỗi; lỡ hợp lệ thì bỏ (không ghi). Nửa số lần rút từ nhóm "nhắm trúng"
 * (ăn không được, đánh lá giữ phỏm ăn, gửi sai, ù thiếu) để bộ mẫu phủ đủ mã lỗi.
 */
function phJunk(pub, hands, stock, seat) {
  const { list, aim } = phCandidates(pub, hands, seat)
  const pool = aim.length && rand(2) === 0 ? aim : list
  const m = pool[rand(pool.length)]
  const r = phTry(pub, hands, stock, m.seat, m.move)
  return r.err ? { seat: m.seat, move: m.move, err: r.err } : null
}
/** Mã lỗi bộ mẫu còn thiếu — mỗi thế cờ thử mọi nước rác, gặp mã còn thiếu thì ghi một bước (không dùng rand). */
const phHunt = new Set(['badMove', 'notYourTurn', 'nothingToEat', 'cantEat', 'notYourCard', 'keepEaten', 'badMeld', 'eatenMeld', 'momSend', 'badSend', 'notU'].map((k) => 'games.err.' + k))
function phHunting(pub, hands, stock, steps, tags) {
  if (!phHunt.size) return
  const { list, aim } = phCandidates(pub, hands, pub.turn)
  for (const m of [...aim, ...list]) {
    const r = phTry(pub, hands, stock, m.seat, m.move)
    if (r.err && phHunt.has(r.err)) { steps.push({ seat: m.seat, move: m.move, err: r.err }); phHunt.delete(r.err); tags.add(r.err) }
  }
}
function phCandidates(pub, hands, seat) {
  const hand = hands[seat]
  const pend = pendingOf(pub, seat)
  const non = hand.filter((c) => !pend.includes(c))
  const other = (seat + 1) % pub.n
  const outside = pub.piles.flat()[0] ?? hands[other][0]
  const list = [
    { seat: other, move: { draw: true } },
    { seat, move: { discard: outside } },
    { seat, move: { u: [hand.slice(0, 3)] } },
    { seat, move: { lay: [hand.slice(0, 3)], send: [] } },
    { seat, move: { lay: [], send: [[other, 0, hand[0]]] } },
    { seat, move: { lay: 'x' } },
    { seat, move: { u: [[hand[0], 60]] } },
    { seat, move: { draw: true } },
  ]
  const aim = []
  if (pub.step === 'take' && (!pub.last || !phCover(non, [...pend, pub.last.card]))) aim.push({ seat, move: { eat: true } })
  if (pub.step === 'discard') {
    if (pend.length) aim.push({ seat, move: { discard: pend[0] } })
    const breaker = non.find((c) => pend.length && !phCover(non.filter((x) => x !== c), pend))
    if (breaker != null) aim.push({ seat, move: { discard: breaker } })
  }
  if ((pub.step === 'discard' || pub.step === 'lay') && !pub.melds[seat]) {
    const one = meldsIn(hand).find((m) => m.filter((c) => pend.includes(c)).length === Math.min(1, pend.length) && pend.length <= 1)
    if (one) aim.push({ seat, move: { u: [one] } })
  }
  if (pub.step === 'lay' && pend.length) aim.push({ seat, move: { lay: [], send: [] } })
  if (pub.step === 'lay') {
    const melds = bestLay(hand, pend)
    const rest = hand.filter((c) => !melds.flat().includes(c))
    const to = pub.melds.findIndex((ms, i) => ms && ms.length && i !== seat)
    if (melds.length && rest.length && to >= 0) {
      const bad = rest.find((c) => !pub.melds[to].some((m) => meldOk([...m, c])))
      if (bad != null) aim.push({ seat, move: { lay: melds, send: [[to, 0, bad]] } })
      aim.push({ seat, move: { lay: melds, send: [[seat, 0, rest[0]]] } })
    }
  }
  return { list, aim }
}
/** Nước "thật" theo chính sách đơn giản: ù được thì ù; ăn được thì ăn 2/3; hạ theo cách ít điểm rác nhất + gửi bài. */
function phPick(pub, hands, seat, eatRate = 2) {
  const hand = hands[seat]
  const pend = pendingOf(pub, seat)
  if (pub.step === 'take') {
    const can = pub.last && phCover(hand.filter((c) => !pend.includes(c)), [...pend, pub.last.card])
    return can && rand(3) < eatRate ? { eat: true } : { draw: true }
  }
  const u = !pub.melds[seat] ? uOf(hand, pend) : null
  if (u) return { u }
  if (pub.step === 'lay') {
    const melds = bestLay(hand, pend)
    const rest = hand.filter((c) => !melds.flat().includes(c))
    const send = melds.length ? sendsFor(rest, pub.melds, seat) : []
    while (melds.flat().length + send.length > hand.length - 1) send.pop()
    return { lay: melds, send }
  }
  const ok = hand.filter((c) => !pend.includes(c) && phCover(hand.filter((x) => !pend.includes(x) && x !== c), pend))
  return { discard: ok[rand(ok.length)] }
}
/** Chơi một ván từ bài đã chia. `script(pub, hands)` (nếu có) trả nước cố định thay chính sách; `leave` = { at, seat }. */
function phPlay(hands0, stock0, first, { junk = 4, script, leave, eatRate, hunt = false } = {}) {
  let hands = hands0.map((h) => h.slice().sort((a, b) => a - b))
  let stock = stock0.slice()
  const deal = dealMove(hands, first, stock.length)
  let pub = ph.apply(ph.setup(), first, deal)
  const steps = []
  const tags = new Set()
  let k = 0
  while (!pub.over) {
    // Người rời: ghế cho sẵn, hoặc (seat null) người vừa đánh lá cuối.
    const who = leave && k === leave.at ? (leave.seat ?? pub.last?.seat ?? null) : null
    if (who != null && !pub.out[who]) {
      steps.push({ seat: who, out: true })
      pub = ph.apply(pub, who, { out: true })
      tags.add('out')
      // Người rời vừa đánh lá cuối → người kế không còn gì để ăn.
      if (!pub.over && pub.step === 'take' && !pub.last) {
        const r = phTry(pub, hands, stock, pub.turn, { eat: true })
        if (r.err) { steps.push({ seat: pub.turn, move: { eat: true }, err: r.err }); tags.add(r.err) }
      }
      k++
      continue
    }
    if (hunt) phHunting(pub, hands, stock, steps, tags)
    if (junk && rand(junk) === 0) { const j = phJunk(pub, hands, stock, pub.turn); if (j) { steps.push(j); tags.add(j.err) } }
    const seat = pub.turn
    const move = script?.(pub, hands, k) ?? phPick(pub, hands, seat, eatRate)
    const r = referee(pub, hands, stock, seat, move)
    if (r.move.eat !== undefined) tags.add(pub.last.chot ? 'chot' : 'eat')
    if (r.move.lay) tags.add(r.move.lay.length ? (r.move.send.length ? 'send' : 'lay') : 'mom')
    if (r.move.u) tags.add(r.move.tron ? 'tron' : 'u')
    steps.push({ seat, move, log: r.move })
    hands = r.hands
    stock = r.stock
    pub = ph.apply(pub, seat, r.move)
    k++
  }
  // Một nước sau khi hết ván — server phải báo over.
  steps.push({ seat: first, move: { draw: true }, err: 'games.err.over' })
  const result = judge(pub, hands)
  if (pub.u?.khan) tags.add('khan')
  if (result.u && pub.eaten.filter((e) => e.by === pub.u.seat).length >= 3) tags.add('den?')
  if (!pub.u && pub.order.join() !== [...pub.order].sort((a, b) => ((a - first + pub.n) % pub.n) - ((b - first + pub.n) % pub.n)).join()) tags.add('shift')
  return { first, hands: hands0.map((h) => h.slice().sort((a, b) => a - b)), stock: stock0, deal, steps, result, tags }
}
const phDeck = () => {
  const d = Array.from({ length: 52 }, (_, i) => i)
  for (let i = 51; i > 0; i--) { const j = rand(i + 1); [d[i], d[j]] = [d[j], d[i]] }
  return d
}
const phDealOut = (n, first) => {
  const d = phDeck()
  let pos = 0
  const hands = Array.from({ length: n }, (_, i) => { const k = i === first ? 10 : 9; const h = d.slice(pos, pos + k); pos += k; return h })
  return { hands, stock: d.slice(pos) }
}
// Ván ngẫu nhiên: tìm mỗi số người một ván có nhiều chuyện (ăn chốt, gửi bài, móm, hạ lệch thứ tự vì chuyển bài).
const phFx = []
seed = 4242
for (const [n, want] of [[4, ['chot', 'send', 'shift']], [3, ['chot', 'mom', 'send']], [2, ['eat', 'lay']], [4, ['out', 'send', 'games.err.nothingToEat']]]) {
  let got = null
  let sd = null
  for (let tries = 0; tries < 6000 && !got; tries++) {
    const first = rand(n)
    const { hands, stock } = phDealOut(n, first)
    // Người rời là người vừa đánh lá cuối (seat null) để người kế không còn gì để ăn.
    const leave = want.includes('out') ? { at: 9 + rand(12), seat: null } : undefined
    const keep = seed
    const g = phPlay(hands, stock, first, { leave, junk: 4 })
    if (!g.result.u && want.every((t) => g.tags.has(t))) { got = { hands, stock, first, leave }; sd = keep }
  }
  if (!got) throw new Error('không tìm được ván Phỏm ' + n + ' người có ' + want.join(', '))
  // Chơi lại đúng ván đó (cùng seed) và lần này săn thêm mã lỗi bộ mẫu còn thiếu.
  seed = sd
  const g = phPlay(got.hands, got.stock, got.first, { leave: got.leave, junk: 4, hunt: true })
  phFx.push({ ...g, note: n + ' người · ' + [...g.tags].filter((t) => !t.startsWith('games.')).join(' · ') + ' · có nước rác' })
}
if (phHunt.size) throw new Error('bộ mẫu Phỏm còn thiếu mã lỗi: ' + [...phHunt].join(', '))
// Ván có người ù thường (sau khi ăn / bốc).
{
  let got = null
  for (let tries = 0; tries < 20000 && !got; tries++) {
    const n = 2 + rand(3)
    const first = rand(n)
    const { hands, stock } = phDealOut(n, first)
    const g = phPlay(hands, stock, first, { eatRate: 3 })
    if (g.tags.has('u')) got = g
  }
  if (!got) throw new Error('không tìm được ván Phỏm có ù')
  phFx.push({ ...got, note: got.deal.deal.n.length + ' người · ù thường · có nước rác' })
}
// Viết tay — ù khan: người đi đầu không có đôi / cạ nào → thắng ngay lúc chia.
{
  const khan = [0, 12, 24, 36, 5, 17, 29, 10, 22, 34] // A♠ 4♠ 7♠ 10♠ · 2♣ 5♣ 8♣ · 3♦ 6♦ 9♦
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !khan.includes(c))
  const hands = [khan, rest.slice(0, 9), rest.slice(9, 18)]
  const g = phPlay(hands, rest.slice(18), 0, { junk: 0 })
  if (!g.tags.has('khan')) throw new Error('ván ù khan viết tay sai')
  phFx.push({ ...g, note: 'viết tay · ù khan lúc chia' })
}
// Viết tay — ù tròn: người đi đầu 10 lá đã đủ phỏm (3 + 3 + 4) → ù tròn ngay lượt đầu.
{
  const tron = [0, 1, 2, 4, 5, 6, 19, 23, 27, 31] // A♠A♣A♦ · 2♠2♣2♦ · 5♥6♥7♥8♥
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !tron.includes(c))
  const g = phPlay([rest.slice(0, 9), tron], rest.slice(9), 1, { junk: 0 })
  if (!g.tags.has('tron')) throw new Error('ván ù tròn viết tay sai')
  phFx.push({ ...g, note: 'viết tay · 2 người · ù tròn ngay lượt đầu' })
}
// Viết tay — đền: 3 người, B (ghế 1) ăn 3 lá của A (ghế 0) rồi ù → A trả thay cả C.
{
  const A = [32, 45, 15, 51, 47, 43, 39, 35, 3, 13] // 9♠ Q♣ 4♥ — B sẽ ăn — cùng 7 lá khác
  const B = [24, 28, 44, 46, 7, 11, 49, 42, 16] // 7♠8♠ · Q♠Q♦ · 2♥3♥ · rác K♣ J♦ 5♠
  const used = new Set([...A, ...B])
  const rest = Array.from({ length: 52 }, (_, i) => i).filter((c) => !used.has(c))
  const C = rest.slice(0, 9)
  const plan = { 0: [{ discard: 32 }, { draw: true }, { discard: 45 }, { draw: true }, { discard: 15 }], 1: [{ eat: true }, { discard: 49 }, { eat: true }, { discard: 42 }, { eat: true }], 2: [] }
  const at = { 0: 0, 1: 0, 2: 0 }
  const script = (pub, hands) => {
    const seat = pub.turn
    if (seat === 2) return pub.step === 'take' ? { draw: true } : { discard: hands[2][hands[2].length - 1] }
    if (seat === 1 && at[1] === 5) return null // tới lúc ù: để chính sách tự ù
    return plan[seat][at[seat]++]
  }
  const g = phPlay([A, B, C], rest.slice(9), 0, { junk: 0, script })
  if (!g.result.u || g.result.u.seat !== 1 || !g.tags.has('den?')) throw new Error('ván đền viết tay sai: ' + JSON.stringify(g.result))
  phFx.push({ ...g, note: 'viết tay · 3 người · B ăn 3 lá của A rồi ù → A đền thay cả làng' })
}
const phLine = (f) => JSON.stringify({ note: f.note, first: f.first, hands: f.hands, stock: f.stock, deal: f.deal, steps: f.steps, result: f.result })
const phBlock = '[\n' + phFx.map(phLine).join(',\n') + '\n]'

// ---------- Cờ X-O (0107) ----------
const xoLegal = (s) => (xoMoving(s, s.turn)
  ? s.q[s.turn].flatMap((from) => s.board.map((v, to) => (v == null ? { from, to } : null)).filter(Boolean))
  : s.board.map((v, i) => (v == null ? { i } : null)).filter(Boolean))
/** Nước không làm người đi thắng ngay — hai bên cùng "né" thì ván move / vanish chạy tới hết lượt (hoà). */
const xoCalm = (s) => {
  const all = xoLegal(s)
  const calm = all.filter((m) => !XO_LINES.some((l) => l.every((x) => xo.apply(s, s.turn, m).board[x] === s.turn)))
  return calm.length ? calm : all
}
// Rút lần lượt (không qua any() — xem ponytail ở đầu file) để phủ đủ loại nước rác.
let xoNth = 0
const xoTrash = (s) => {
  const t = s.turn
  const empty = s.board.findIndex((v) => v == null)
  const taken = s.board.findIndex((v) => v != null)
  const foe = s.board.findIndex((v) => v === 1 - t)
  const list = [
    { seat: 1 - t, move: { i: empty } },
    { seat: t, move: { i: 9 } },
    { seat: t, move: { i: -1 } },
    { seat: t, move: { i: String(empty) } },
    { seat: t, move: { i: 2.5 } },
    { seat: t, move: {} },
    { seat: t, move: null },
    ...(taken >= 0 ? [{ seat: t, move: { i: taken } }] : []),
    ...(xoMoving(s, t)
      ? [
        { seat: t, move: { i: empty } }, // phải di quân mà lại đặt quân
        { seat: t, move: { from: s.q[t][0], to: s.q[t][1] } }, // sang ô có quân
        { seat: t, move: { from: s.q[t][0], to: empty, i: empty } },
        ...(foe >= 0 ? [{ seat: t, move: { from: foe, to: empty } }] : []), // nhấc quân đối phương
      ]
      : [{ seat: t, move: { from: 0, to: empty } }, { seat: t, move: { i: empty, from: null } }]),
  ]
  xoNth += 1
  return [list[xoNth % list.length]]
}
const xoCfg = (mode, legal = xoLegal) => ({ legal, trash: xoTrash, options: mode === 'classic' ? {} : { mode } })
const xoKind = (g) => (g.result.draw ? 'hoà' : g.result.winners[0] === 0 ? 'X thắng' : 'O thắng')
const xoFx = []
for (const [mode, half] of [['classic', 11], ['move', 12], ['vanish', 13]]) {
  const opts = mode === 'classic' ? undefined : JSON.stringify({ mode })
  const name = { classic: 'cổ điển', move: '3 quân di chuyển', vanish: 'quân cũ biến mất' }[mode]
  for (const f of pick(xo, { ...xoCfg(mode), seeds: 400 }, xoKind, half)) xoFx.push({ ...f, note: name + ' · ' + f.note, options: opts })
}
// Hai bên cùng né thắng → move / vanish chạy hết 2 × CAP nước thì hoà.
for (const mode of ['move', 'vanish']) {
  const g = find(xo, xoCfg(mode, xoCalm), (x) => x.result.draw, 100)
  xoFx.push({ ...g, note: mode + ' · hết lượt thì hoà · có nước rác', options: JSON.stringify({ mode }) })
}
// Chế độ lạ → cổ điển.
{
  const g = find(xo, xoCfg('classic'), () => true, 200)
  xoFx.push({ ...g, note: 'chế độ lạ → cổ điển · ' + xoKind(g), options: '{"mode":"loco"}' })
}

const OUT = [
  ['supabase/manual/0075_games_results_check.sql', '$fx$', block(oq, oqFx, ['cell', 'dir'])],
  ['supabase/manual/0075_games_results_check.sql', '$cg$', block(cg, cgFx, ['from', 'to'])],
  ['supabase/manual/0076_games_colat_check.sql', '$cl$', block(cl, clFx, ['cell'])],
  ['supabase/manual/0077_games_chamo_check.sql', '$ch$', block(ch, chFx, ['line'])],
  ['supabase/manual/0089_games_covay_check.sql', '$gv$', block(cv, cvFx, ['i'])],
  ['supabase/manual/0090_games_phom_check.sql', '$ph$', phBlock],
  ['supabase/manual/0107_games_xo_check.sql', '$xo$', block(xo, xoFx, ['i'])],
]
for (const [file, tag, text] of OUT) {
  const parts = readFileSync(file, 'utf8').split(tag)
  if (parts.length !== 3) throw new Error(file + ' phải có đúng một khối ' + tag)
  writeFileSync(file, parts[0] + tag + '\n' + text + '\n' + tag + parts[2])
}
console.log('Phỏm:\n' + phFx.map((f) => '  ' + f.note + ' — ' + f.steps.length + ' bước, lỗi: ' +
  [...new Set(f.steps.filter((x) => x.err).map((x) => x.err.replace('games.err.', '')))].join(' ') + ' — ' + JSON.stringify(f.result)).join('\n'))
for (const [name, fx] of [['Ô ăn quan', oqFx], ['Cờ gánh', cgFx], ['Cờ lật', clFx], ['Chấm ô', chFx], ['Cờ vây', cvFx], ['Cờ X-O', xoFx]]) {
  console.log(name + ':\n' + fx.map((f) => '  ' + f.note + ' — ' + f.moves.length + ' nước, ' + JSON.stringify(f.result)).join('\n'))
}
