// node src/__tests__/games/baibip.test.js
// Luật Bài bịp (lib/games/baibip.js). Sai ở đây là tố nhầm người thua, bỏ qua sai người hết bài, quên bắt tố,
// hay ván mới bắt đầu sai người.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import bb, { deadlineOf, fits, kindOf, mustCall, optsOf } from '#lib/games/baibip.js'
import { replay } from '#lib/games/registry.js'

const Q = [0, 1, 2, 3, 4, 5]
const K = [6, 7, 8, 9, 10, 11]
const A = [12, 13, 14, 15, 16, 17]
const J = [18, 19]
const deal = (out, first, table = 1) => ({ table, n: out.map((o) => (o ? 0 : 5)), first })
const begin = (n, first = 0, table = 1) => bb.apply(bb.setup(), first, { deal: deal(Array(n).fill(false), first, table) })
const step = (s, seat, move) => {
  const err = bb.validate(s, seat, move)
  assert.equal(err, null, JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return bb.apply(s, seat, move)
}

// Bộ lá: 6 Q, 6 K, 6 A, 2 Joker; Joker luôn là lá chủ.
assert.deepEqual([...Q, ...K, ...A, ...J].map(kindOf), [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3])
assert.equal(fits(K[0], 1), true)
assert.equal(fits(Q[0], 1), false)
assert.equal(fits(J[1], 0), true)

// Ván đầu: nước chia của server đúng hình dạng; người đi đầu đúng ghế.
{
  const s = bb.setup()
  assert.equal(bb.validate(s, 0, { deal: { table: 3, n: [5, 5], first: 0 } }), 'games.err.badMove', 'lá chủ chỉ Q / K / A')
  assert.equal(bb.validate(s, 1, { deal: deal([false, false], 0) }), 'games.err.badMove', 'nước chia ghi ở ghế người đi đầu')
  assert.equal(bb.validate(s, 0, { play: [K[0]] }), 'games.err.badMove', 'chưa chia thì chưa đánh')
  const g = begin(3, 2, 0)
  assert.deepEqual([g.round, g.table, g.counts, g.turn, g.phase], [1, 0, [5, 5, 5], 2, 'play'])
}

// Đánh: 1–3 lá, đúng lượt, log chỉ có số lá; tới người kế tiếp. Đầu ván chưa có gì để tố.
{
  let s = begin(3, 0)
  assert.equal(bb.request(s, 0, { play: [K[0]] }), true, 'lá thật chỉ server biết — không hiện trước')
  assert.equal(bb.validate(s, 1, { play: [K[0]] }), 'games.err.notYourTurn')
  assert.equal(bb.validate(s, 0, { play: [1, 2, 3, 4] }), 'games.err.playCount')
  assert.equal(bb.validate(s, 0, { play: [1, 1] }), 'games.err.badMove')
  assert.equal(bb.validate(s, 0, { call: true }), 'games.err.nothingToCall')
  assert.deepEqual(bb.apply(s, 0, { play: [K[0], K[1]] }), s, 'nước chưa qua server (còn mảng lá) thì không áp')
  s = step(s, 0, { play: 2 })
  assert.deepEqual([s.counts, s.pile, s.turn, s.lastPlay], [[3, 5, 5], 2, 1, { seat: 0, n: 2 }])
  assert.equal(bb.validate(s, 0, { call: true }), 'games.err.notYourTurn')
  s = step(s, 1, { play: 3 })
  assert.equal(bb.validate(s, 2, { call: true }), null)
  assert.equal(bb.validate(s, 2, { play: 6 }), 'games.err.playCount')
}

// Tố: có lá sai → người đánh thua; đúng hết (kể cả Joker) → người tố thua. Người thua phải cắt dây.
{
  let s = step(begin(2, 0, 1), 0, { play: 2 })
  assert.deepEqual(bb.apply(s, 1, { call: true }), s, 'chưa có lá lật từ server thì không áp')
  const truth = step(s, 1, { call: true, cards: [K[3], J[0]], liar: false })
  assert.deepEqual([truth.reveal.liar, truth.phase, truth.cutter, truth.turn], [false, 'cut', 1, 1], 'tố oan thì người tố cắt')
  const lie = step(s, 1, { call: true, cards: [K[3], A[0]], liar: true })
  assert.deepEqual([lie.reveal.liar, lie.phase, lie.cutter, lie.turn], [true, 'cut', 0, 0], 'nói dối bị bắt thì người đánh cắt')
  assert.equal(bb.validate(lie, 0, { play: 1 }), 'games.err.mustCut')
  assert.equal(bb.validate(lie, 1, { cut: 0 }), 'games.err.notYourTurn')
  assert.equal(bb.validate(lie, 0, { cut: 6 }), 'games.err.wireCut')

  // Cắt trúng dây thường: ván mới, người vừa cắt đi trước; dây đã cắt không cắt lại.
  const safe = step(lie, 0, { cut: 4, boom: false, deal: deal([false, false], 0, 2) })
  assert.deepEqual([safe.round, safe.table, safe.counts, safe.turn, safe.cuts, safe.phase], [2, 2, [5, 5], 0, [[4], []], 'play'])
  let again = step(step(safe, 0, { play: 1 }), 1, { call: true, cards: [Q[0]], liar: true })
  assert.equal(bb.validate(again, 0, { cut: 4 }), 'games.err.wireCut', 'dây đã cắt không nối lại')

  // Cắt trúng dây nổ: bị loại; còn một người là thắng.
  again = step(again, 0, { cut: 1, boom: true })
  assert.deepEqual([again.over, again.winner, again.blown, bb.result(again)], [true, 1, [true, false], { winners: [1], draw: false }])
}

// Nổ bom ở ván 3 người: ván mới chia cho hai người còn lại, người kế sau người nổ đi trước.
{
  let s = step(begin(3, 0), 0, { play: 1 })
  s = step(s, 1, { call: true, cards: [K[0]], liar: false }) // tố oan → ghế 1 cắt
  assert.equal(bb.validate(s, 1, { cut: 2, boom: true, deal: deal([false, false, false], 2) }), 'games.err.badMove',
    'ván mới không được chia cho người vừa nổ')
  s = step(s, 1, { cut: 2, boom: true, deal: deal([false, true, false], 2) })
  assert.deepEqual([s.out, s.counts, s.turn, s.over], [[false, true, false], [5, 0, 5], 2, false])
  // Bỏ qua người đã loại khi chuyển lượt.
  s = step(s, 2, { play: 3 })
  assert.equal(s.turn, 0)
  s = step(s, 0, { play: 1 })
  assert.equal(s.turn, 2, 'ghế 1 đã nổ — bỏ qua')
  assert.equal(bb.validate(s, 1, { out: true }), 'games.err.badMove', 'người đã loại rời bàn không đổi gì')
}

// Người hết bài được bỏ qua; những người khác đều hết bài thì phải tố.
{
  let s = begin(3, 0)
  s = step(s, 0, { play: 3 })
  s = step(s, 1, { play: 3 })
  s = step(s, 2, { play: 3 })
  s = step(s, 0, { play: 2 }) // ghế 0 hết bài
  assert.deepEqual([s.counts, s.turn], [[0, 2, 2], 1])
  s = step(s, 1, { play: 2 }) // ghế 1 hết bài → tới ghế 2, ghế 0 bị bỏ qua
  assert.deepEqual([s.counts, s.turn], [[0, 0, 2], 2])
  assert.equal(mustCall(s, 2), true)
  assert.equal(bb.validate(s, 2, { play: 1 }), 'games.err.mustCall')
  assert.equal(bb.validate(s, 2, { call: true }), null)
  s = step(s, 2, { call: true, cards: [K[0], K[1]], liar: false })
  assert.deepEqual([s.phase, s.cutter], ['cut', 2])
}

// Rời bàn giữa ván: ván dở huỷ, người tới lượt bấm chia lại. Đang chờ người khác cắt thì họ vẫn phải cắt.
{
  let s = step(begin(3, 0), 0, { play: 2 })
  const left = step(s, 2, { out: true })
  assert.deepEqual([left.phase, left.turn, left.out, left.lastPlay], ['redeal', 1, [false, false, true], null])
  assert.equal(bb.validate(left, 1, { play: 1 }), 'games.err.badMove')
  assert.equal(bb.validate(left, 0, { deal: true }), 'games.err.notYourTurn')
  assert.equal(bb.validate(left, 1, { deal: true }), null)
  assert.deepEqual(bb.apply(left, 1, { deal: true }), left, 'chia lại chưa qua server thì không áp')
  const re = step(left, 1, { deal: deal([false, false, true], 1, 0) })
  assert.deepEqual([re.round, re.phase, re.turn, re.counts], [2, 'play', 1, [5, 5, 0]])

  const cutting = step(step(s, 1, { play: 1 }), 2, { call: true, cards: [A[0]], liar: true }) // ghế 1 nói dối → ghế 1 cắt
  const stay = step(cutting, 0, { out: true })
  assert.deepEqual([stay.phase, stay.cutter, stay.turn], ['cut', 1, 1])
  const gone = step(cutting, 1, { out: true })
  assert.deepEqual([gone.phase, gone.turn], ['redeal', 2], 'người phải cắt rời bàn → chia lại, người kế sau họ bấm')
}

// Tố trúng người đã rời bàn: khỏi cắt, server chia ván mới ngay trong nước tố.
{
  let s = step(begin(3, 0), 0, { play: 1 })
  s = { ...s, out: [true, false, false], counts: [0, 5, 5] } // ghế 0 vừa rời nhưng nước đánh của họ vẫn bị tố
  s = step(s, 1, { call: true, cards: [Q[0]], liar: true, deal: deal([true, false, false], 1) })
  assert.deepEqual([s.round, s.phase, s.turn, s.reveal.liar], [2, 'play', 1, true])
}

// Dựng lại từ log: bỏ qua nước sai, như mọi máy.
{
  const room = { options: {}, seed: 's', seats: [0, 1] }
  const log = [
    { seq: 1, seat: 1, move: { deal: deal([false, false], 1, 0) } },
    { seq: 2, seat: 0, move: { play: 1 } }, // sai lượt → bỏ qua
    { seq: 3, seat: 1, move: { play: 2 } },
    { seq: 4, seat: 0, move: { call: true, cards: [Q[0], J[0]], liar: false } }, // đúng hết → ghế 0 cắt
    { seq: 5, seat: 0, move: { cut: 3, boom: false, deal: deal([false, false], 0, 2) } },
  ]
  const s = replay(bb, room, log)
  assert.deepEqual([s.round, s.table, s.turn, s.cuts, s.ply], [2, 2, 0, [[3], []], 4])
}

// Mã lỗi dùng ở JS lẫn SQL phải có trong i18n (smoke test quét cả 0082).
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0082_games_baibip.sql', import.meta.url), 'utf8')
  for (const k of ['mustCut', 'wireCut', 'nothingToCall', 'playCount', 'mustCall', 'notYourCard']) {
    assert.ok(sql.includes('games.err.' + k), '0082 phải dùng cùng mã lỗi ' + k)
  }
}

// Đồng hồ lượt: ai còn trụ cũng báo được hết giờ (server kiểm giờ); log ghi nước server đi thay người tới lượt.
{
  const at = (ms) => ({ at: new Date(Date.parse('2026-11-08T10:00:00Z') + ms).toISOString() })
  assert.deepEqual(optsOf({}), { time: 30 })
  assert.deepEqual(optsOf({ time: 0 }), { time: 0 })
  assert.deepEqual(optsOf({ time: 45 }), { time: 30 }, 'số lạ về mặc định — khớp 0082')
  let s = bb.apply(bb.setup({ options: { time: 20 } }), 0, { deal: deal([false, false, false], 0) }, at(0))
  assert.equal(deadlineOf(s) - Date.parse('2026-11-08T10:00:00Z'), 20000)
  assert.equal(bb.validate(s, 2, { timeout: true }), null, 'máy khác báo hộ được')
  assert.equal(bb.request(s, 2, { timeout: true }), true)
  assert.deepEqual(bb.apply(s, 2, { timeout: true }, at(21000)), s, 'chưa qua server thì không áp')
  assert.equal(bb.validate(bb.setup({ options: { time: 0 } }), 0, { timeout: true }), 'games.err.badMove')
  s = bb.apply(s, 2, { timeout: true, play: 1 }, at(21000)) // server đánh thay ghế 0 một lá
  assert.deepEqual([s.counts, s.turn, s.last, deadlineOf(s) - Date.parse('2026-11-08T10:00:00Z')],
    [[4, 5, 5], 1, { seat: 0, play: 1, timeout: true }, 41000])
  assert.equal(bb.validate(s, 0, { timeout: true, play: 1 }), null, 'bản đã ghi kiểm như nước của người tới lượt (ghế 1)')
  s = bb.apply(s, 0, { timeout: true, call: true, cards: [K[0]], liar: false }, at(42000)) // ghế 1 tố thay, ghế 0 đánh thật
  assert.deepEqual([s.phase, s.cutter, s.last.timeout], ['cut', 1, true])
  s = bb.apply(s, 0, { timeout: true, cut: 2, boom: false, deal: deal([false, false, false], 1) }, at(63000))
  assert.deepEqual([s.cuts[1], s.phase, s.turn], [[2], 'play', 1])
  const sql = readFileSync(new URL('../../../supabase/migrations/0082_games_baibip.sql', import.meta.url), 'utf8')
  assert.ok(sql.includes('IN (0, 20, 30, 60)') && sql.includes('ELSE 30 END'), 'bảng giờ + mặc định khớp TIMES / optsOf')
}

console.log('baibip check: OK')
