// node src/__tests__/games/masoi.test.js
// Luật công khai của Ma sói (lib/games/masoi.js). Vai và lựa chọn ban đêm chỉ server biết (0084) — ở đây giả lập
// các nước server ghi. Sai ở đây là chuyển pha sớm / kẹt pha, đếm nhầm người phải bấm, hay người rời bàn làm kẹt ván.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ms, { complete, CUPID, CURSED, deckOf, ELDER, GUARD, HUNTER, minPlayersOf, optsOf, rolesOf, rowOf, SEER, tableOf, tallyOf, VILLAGER, WITCH, WOLF } from '#lib/games/masoi.js'
import { replay } from '#lib/games/registry.js'

const begin = (n, options) => ms.apply(ms.setup({ options }), 0, { deal: { n } })
const step = (s, seat, move) => {
  const err = ms.validate(s, seat, move)
  assert.equal(err, null, JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return ms.apply(s, seat, move)
}
/** Mọi người còn sống chưa bấm thì bấm nốt bước đêm. */
const sleepAll = (s) => s.alive.reduce((x, a, i) => (a && !x.acted[i] ? step(x, i, { night: true }) : x), s)
const count = (t, r) => t.filter((x) => x === r).length

// Bộ vai theo số người — PHẢI khớp game_masoi_table ở 0084.
{
  for (let n = 5; n <= 12; n++) assert.equal(tableOf(n).length, n)
  assert.deepEqual(tableOf(5), [WOLF, SEER, GUARD, VILLAGER, VILLAGER])
  assert.equal(count(tableOf(6), WOLF), 2)
  assert.ok(!tableOf(6).includes(WITCH) && tableOf(7).includes(WITCH), 'Phù thủy từ 7 người')
  assert.deepEqual([tableOf(8)[0], count(tableOf(8), WOLF)], [CURSED, 1], '8 người: 1 Sói nguyền + 1 Sói')
  assert.equal(count(tableOf(12), WOLF) + count(tableOf(12), CURSED), 3)
  assert.ok(tableOf(11).includes(CUPID) && !tableOf(10).includes(CUPID), 'Thần tình yêu từ 11 người')
  assert.deepEqual(optsOf({}), { reveal: 'all', roles: null })
  assert.deepEqual(optsOf({ reveal: 'none' }), { reveal: 'none', roles: null })
  assert.deepEqual(optsOf({ reveal: 'x' }), { reveal: 'all', roles: null })
  assert.deepEqual(rowOf([1, 1, 0, 0, 1, 3, 0]), { role: 1, facts: [[1, 0, 0], [1, 3, 0]] })
  assert.equal(rowOf([]), null)
}

// Chia + đêm: mọi người còn sống đều phải bấm (dân thường bấm Ngủ) thì mới chốt được.
{
  assert.equal(ms.validate(ms.setup({}), 0, { deal: { n: 4 } }), 'games.err.badMove', 'tối thiểu 5 người')
  let s = begin(6)
  assert.deepEqual([s.phase, s.night, s.alive.length, s.turn], ['night', 1, 6, null])
  assert.equal(ms.request(s, 0, { night: { target: 2 } }), true)
  assert.equal(ms.request(s, 0, { out: true }), false)
  assert.deepEqual(ms.apply(s, 0, { night: { target: 2 } }), s, 'lựa chọn thật chưa qua server thì không áp')
  assert.equal(ms.validate(s, 0, { next: true }), 'games.err.notYet')
  s = step(s, 0, { night: true })
  assert.equal(ms.validate(s, 0, { night: true }), 'games.err.acted')
  assert.equal(ms.validate(s, 1, { vote: 2 }), 'games.err.badMove', 'đêm không bỏ phiếu')
  assert.deepEqual(ms.status(s), { key: 'games.masoi.statusNight', params: { n: 1, done: 1, total: 6 } })
  s = sleepAll(s)
  assert.equal(complete(s), true)
  assert.equal(ms.validate(s, 3, { next: true }), null, 'máy nào cũng chốt được')
  assert.deepEqual(ms.apply(s, 3, { next: true }), s, 'kết quả chỉ server biết')

  // Sáng: ghế 2 chết, lộ vai Tiên tri.
  s = step(s, 3, { next: 'day', dead: [2], shown: [[2, SEER]], hang: -1 })
  assert.deepEqual([s.phase, s.alive[2], s.shown[2], s.events.at(-1)], ['day', false, SEER, { k: 'dawn', night: 1, dead: [2] }])
  assert.equal(ms.validate(s, 2, { vote: 0 }), 'games.err.dead')
  assert.equal(ms.validate(s, 0, { vote: 0 }), 'games.err.badTarget', 'không tự bầu mình')
  assert.equal(ms.validate(s, 0, { vote: 2 }), 'games.err.badTarget', 'không bầu người đã chết')
  assert.equal(ms.validate(s, 0, { night: true }), 'games.err.badMove')
  s = step(s, 0, { vote: 1 })
  assert.equal(ms.validate(s, 0, { vote: 3 }), 'games.err.acted')
  s = step(step(step(step(s, 1, { vote: 0 }), 3, { vote: 1 }), 4, { vote: -1 }), 5, { vote: 1 })
  assert.deepEqual(tallyOf(s), { 0: 1, 1: 3, '-1': 1 })
  assert.equal(complete(s), true)
  s = step(s, 5, { next: 'night', hang: 1, dead: [1], shown: [] })
  assert.deepEqual([s.phase, s.night, s.alive[1], s.votes.every((v) => v === null), s.events.at(-1)],
    ['night', 2, false, true, { k: 'hang', night: 1, dead: [1], seat: 1 }])
  assert.deepEqual(ms.status(s).params, { n: 2, done: 0, total: 4 })
}

// Bước Phù thủy: chỉ có khi bộ vai có Phù thủy — server ghi { next: 'witch' }, mọi người bấm lại lần nữa.
{
  let s = sleepAll(begin(7))
  s = step(s, 0, { next: 'witch' })
  assert.deepEqual([s.phase, s.acted.some(Boolean), s.events.length], ['witch', false, 0])
  assert.equal(ms.status(s).key, 'games.masoi.statusWitch')
  s = sleepAll(s)
  s = step(s, 6, { next: 'day', dead: [], shown: [], hang: -1 })
  assert.deepEqual([s.phase, s.events.at(-1)], ['day', { k: 'dawn', night: 1, dead: [] }])
}

// Thợ săn chết lúc sáng → bắn (hoặc bỏ) rồi mới sang ngày; chết vì treo cổ → bắn rồi sang đêm.
{
  let s = sleepAll(begin(8))
  s = step(s, 0, { next: 'witch' })
  s = sleepAll(s)
  s = step(s, 1, { next: 'hunter', hunter: 4, dead: [4], shown: [[4, HUNTER]], hang: -1 })
  assert.deepEqual([s.phase, s.turn, s.hunter, s.after, s.shown[4]], ['hunter', 4, 4, 'day', HUNTER])
  assert.equal(ms.status(s).key, 'games.masoi.statusHunter')
  assert.equal(ms.validate(s, 3, { shoot: 0 }), 'games.err.badMove', 'chỉ Thợ săn được bắn')
  assert.equal(ms.validate(s, 4, { shoot: 4 }), 'games.err.badTarget')
  assert.equal(complete(s), false)
  s = step(s, 4, { shoot: 0 })
  assert.equal(ms.validate(s, 4, { shoot: 1 }), 'games.err.badMove', 'chỉ bắn một phát')
  s = step(s, 2, { next: 'day', dead: [0], shown: [[0, WOLF]], hang: -1 })
  assert.deepEqual([s.phase, s.alive[0], s.turn, s.events.at(-1)], ['day', false, null, { k: 'shot', night: 1, dead: [0], seat: 4, target: 0 }])

  // Ngày: Thợ săn khác (giả lập) bị treo → bắn bỏ (-1) → đêm 2.
  s = s.alive.reduce((x, a, i) => (a ? step(x, i, { vote: i === 1 ? 2 : 1 }) : x), s)
  s = step(s, 1, { next: 'hunter', hunter: 1, dead: [1], shown: [[1, HUNTER]], hang: 1 })
  assert.equal(s.after, 'night')
  s = step(step(s, 1, { shoot: -1 }), 3, { next: 'night', dead: [], shown: [], hang: -1 })
  assert.deepEqual([s.phase, s.night], ['night', 2])
}

// Rời bàn: người còn sống rời → chết, phải chốt (tình nhân chết theo, thắng thua) trước; bước đang dở giữ nguyên.
{
  let s = step(begin(6), 0, { night: true })
  s = ms.apply(s, 2, { out: true })
  assert.deepEqual([s.alive[2], s.left[2], s.settle, s.phase, s.acted[0]], [false, true, true, 'night', true])
  assert.equal(ms.status(s).key, 'games.masoi.statusSettle')
  assert.equal(complete(s), true, 'có người rời là phải chốt ngay')
  assert.equal(ms.validate(s, 1, { next: 'day', dead: [] }), 'games.err.badMove', 'đang chờ chốt người rời')
  s = step(s, 1, { next: 'settle', dead: [5], shown: [], hang: -1 }) // ghế 5 là tình nhân của ghế 2
  assert.deepEqual([s.settle, s.alive[5], s.phase, s.acted[0], s.events.map((e) => e.k)], [false, false, 'night', true, ['out', 'settle']])
  assert.equal(complete(s), false, 'ghế 1, 3, 4 chưa bấm')
  assert.equal(ms.validate(s, 1, { next: 'settle', dead: [] }), 'games.err.badMove', 'không còn gì để chốt')

  // Người đã chết (ghế 5 vừa chết theo) rời bàn: không phải chốt gì.
  assert.equal(ms.apply(s, 5, { out: true }).settle, false)

  // Đang bỏ phiếu: phiếu của người rời bị bỏ.
  let d = step(sleepAll(begin(5)), 0, { next: 'day', dead: [], shown: [], hang: -1 })
  d = step(d, 1, { vote: 0 })
  d = ms.apply(d, 1, { out: true })
  assert.deepEqual([d.votes[1], d.settle], [null, true])

  // Thợ săn đang chờ bắn mà rời → coi như không bắn, ván đi tiếp.
  let h = step(sleepAll(begin(8)), 0, { next: 'witch' })
  h = step(sleepAll(h), 0, { next: 'hunter', hunter: 3, dead: [3], shown: [[3, HUNTER]], hang: -1 })
  h = ms.apply(h, 3, { out: true })
  assert.deepEqual([h.shot, h.settle, complete(h)], [-1, false, true])
}

// Hết ván: server gửi đội thắng + lộ hết vai; sau đó không nhận nước nào nữa.
{
  let s = step(sleepAll(begin(5)), 0, { next: 'day', dead: [], shown: [], hang: -1 })
  s = s.alive.reduce((x, a, i) => (a ? step(x, i, { vote: i === 0 ? 1 : 0 }) : x), s)
  const roles = [WOLF, SEER, 4, VILLAGER, VILLAGER]
  s = step(s, 2, { next: 'over', hang: 0, dead: [0], shown: [[0, WOLF]], over: { team: 'village', winners: [1, 2, 3, 4], roles } })
  assert.deepEqual([s.over.team, s.phase, s.shown, ms.result(s)], ['village', null, roles, { winners: [1, 2, 3, 4], draw: false }])
  assert.equal(ms.status(s), null)
  assert.equal(ms.validate(s, 1, { vote: 2 }), 'games.err.over')
  // Đang chốt người rời cũng có thể hết ván luôn.
  const o = ms.apply(step(begin(5), 0, { night: true }), 0, { out: true })
  assert.equal(ms.validate(o, 1, { next: 'over', dead: [], over: { team: 'village', winners: [1, 2, 3, 4], roles } }), null)
}

// Dựng lại từ log: nước sai (bấm hai lần, bầu khi đang đêm) bị bỏ qua như mọi máy.
{
  const room = { options: { reveal: 'hanged' }, seed: 's', seats: [0, 1, 2, 3, 4] }
  const log = [
    { seq: 1, seat: 0, move: { deal: { n: 5 } } },
    { seq: 2, seat: 0, move: { night: true } },
    { seq: 3, seat: 0, move: { night: true } }, // bấm lại → bỏ
    { seq: 4, seat: 1, move: { vote: 0 } }, // sai pha → bỏ
    ...[1, 2, 3, 4].map((i) => ({ seq: 4 + i, seat: i, move: { night: true } })),
    { seq: 9, seat: 3, move: { next: 'day', dead: [4], shown: [], hang: -1 } },
    { seq: 10, seat: 1, move: { vote: 0 } },
  ]
  const s = replay(ms, room, log)
  assert.deepEqual([s.opts.reveal, s.phase, s.alive, s.votes[1], s.ply], ['hanged', 'day', [true, true, true, true, false], 0, 8])
}

// Chủ phòng tự chọn bộ vai (0087): chọn vai + số Sói, ai dư là Dân làng; server xáo rồi chia ngẫu nhiên.
{
  assert.deepEqual(rolesOf([SEER, WOLF, WOLF]), [WOLF, WOLF, SEER], 'Sói thường lặp được, thứ tự không quan trọng')
  for (const bad of [[], [SEER, SEER], [VILLAGER, WOLF], [WOLF, 9], [WOLF, 1.5], 'wolf', Array(13).fill(WOLF)]) {
    assert.equal(rolesOf(bad), null, JSON.stringify(bad) + ': sai dạng thì về Tự động — server đọc y vậy, lệch là hai bên chia khác bộ')
  }
  const opts = optsOf({ roles: [WOLF, WOLF, SEER, WITCH] })
  assert.deepEqual(deckOf(opts, 6).deck, [WOLF, WOLF, SEER, WITCH, VILLAGER, VILLAGER], 'thiếu vai thì bù Dân làng cho đủ người')
  assert.deepEqual(deckOf(optsOf({}), 7).deck, tableOf(7), 'không tự chọn thì như cũ')
  assert.equal(deckOf(optsOf({ roles: [SEER, GUARD] }), 6).err, 'games.err.noWolf')
  assert.equal(deckOf(opts, 3).err, 'games.err.tooManyRoles')
  assert.equal(deckOf(optsOf({ roles: [WOLF, WOLF, CURSED] }), 6).err, 'games.err.tooManyWolves', '3 Sói / 6 người: vừa chia đã thắng')
  assert.equal(deckOf(optsOf({ roles: [WOLF, WOLF, CURSED] }), 7).err, undefined)
  assert.equal(minPlayersOf([WOLF, WOLF, CURSED]), 7)
  assert.equal(minPlayersOf([WOLF, SEER, GUARD, WITCH, HUNTER, ELDER, CUPID]), 7)
  assert.equal(minPlayersOf([WOLF]), 5)
  assert.equal(ms.lobby({ roles: [WOLF, WOLF, CURSED] }, 6).block, true, 'phòng chờ chặn Bắt đầu khi bộ vai không hợp số người')
  assert.equal(ms.lobby({}, 4), null)
  assert.match(ms.lobby({ roles: [WOLF, WOLF, SEER] }, 6).params.list, /^2 .+, .+, 3 /)
  // Máy khách đếm vai trên bàn theo bộ đã chọn, không theo bảng tự động.
  assert.equal(begin(6, { roles: [WOLF, SEER, WITCH, HUNTER] }).opts.roles.length, 4)
}

// 0087: server đọc cùng luật bộ vai, cùng mã lỗi; bước Phù thủy theo bộ vai thật chứ không theo bảng tự động.
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0087_games_masoi_roles.sql', import.meta.url), 'utf8')
  for (const k of ['noWolf', 'tooManyRoles', 'tooManyWolves']) assert.ok(sql.includes("'games.err." + k + "'"), '0087 phải dùng mã lỗi ' + k)
  assert.ok(sql.includes('5 = ANY(game_masoi_deck('), 'bước Phù thủy theo bộ vai thật')
  assert.ok(!/game_masoi_table\(r\.o_n\)/.test(sql), 'không còn tra bảng tự động ở bước Phù thủy')
  assert.ok(sql.includes('2 * v_w >= p_n') && sql.includes('BETWEEN 1 AND 8'), 'luật số Sói + dạng vai khớp deckOf / rolesOf')
}

// SQL 0084 dùng cùng bảng vai, cùng mã lỗi.
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0084_games_masoi.sql', import.meta.url), 'utf8')
  assert.ok(sql.includes('WHEN p_n <= 5 THEN 1 WHEN p_n <= 8 THEN 2 ELSE 3'), 'số Sói khớp tableOf')
  assert.ok(sql.includes('LEAST(6, GREATEST(2, p_n - v_w - 2))') && sql.includes('i = 1 AND p_n >= 8 THEN 2'), 'vai đặc biệt khớp tableOf')
  assert.ok(sql.includes('ARRAY[3, 4, 5, 6, 7, 8]'), 'thứ tự vai đặc biệt khớp tableOf')
  for (const k of ['over', 'badMove', 'notYet', 'dead', 'acted', 'badTarget', 'guardTwice', 'noPotion']) {
    assert.ok(sql.includes("'games.err." + k + "'"), '0084 phải dùng mã lỗi ' + k)
  }
}

console.log('masoi check: OK')
