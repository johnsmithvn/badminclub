// node src/__tests__/games/contract.test.js
// Hợp đồng chung mọi game trong registry phải giữ (docs/GAMES.md §3). Thêm game mới là tự bị kiểm.
// Sai ở đây là hai máy cùng phòng thấy hai bàn khác nhau, hoặc F5 xong ván cờ biến dạng.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GAMES, GAME_IDS, gameOf, idleOf, isContiguous, isStaleRoom, nextSeq, replay, seatedOf, statsOf } from '#lib/games/registry.js'
import cfg from '#config/app.json' with { type: 'json' }

assert.ok(GAME_IDS.length > 0, 'registry rỗng')
assert.equal(gameOf('nope'), null)

for (const id of GAME_IDS) {
  const g = GAMES[id]
  assert.equal(g.id, id, id + ': id trong file phải khớp key registry — phòng lưu key này')
  for (const fn of ['setup', 'validate', 'apply', 'view', 'result']) assert.equal(typeof g[fn], 'function', id + ' thiếu ' + fn)
  assert.ok(g.minPlayers >= 2 && g.maxPlayers >= g.minPlayers, id + ': số người không hợp lệ')

  const room = { options: g.defaultOptions, seed: 'seed-1', seats: [0, 1] }
  const a = g.setup(room)
  const b = g.setup(room)
  assert.deepEqual(a, b, id + ': setup phải tất định theo seed — hai máy phải ra cùng bàn')
  assert.equal(g.result(a), null, id + ': ván mới không được có kết quả')
}

// Dựng lại từ log: bỏ qua nước sai, ra đúng state của chuỗi apply hợp lệ. Dùng Caro làm mẫu.
{
  const g = gameOf('caro')
  const room = { options: g.defaultOptions, seed: 's', seats: [0, 1] }
  const log = [
    { seq: 1, seat: 0, move: { i: 112 } },
    { seq: 2, seat: 0, move: { i: 113 } }, // sai lượt → bỏ qua
    { seq: 3, seat: 1, move: { i: 112 } }, // đè ô → bỏ qua
    { seq: 4, seat: 1, move: { i: 0 } },
    { seq: 5, seat: 1, move: { foo: 1 } }, // rác → bỏ qua
  ]
  const s = replay(g, room, log)
  const expect = g.apply(g.apply(g.setup(room), 0, { i: 112 }), 1, { i: 0 })
  assert.deepEqual(s, expect, 'nước không hợp lệ phải bị bỏ qua khi dựng lại, như nhau trên mọi máy')
  assert.equal(nextSeq(log), 6, 'seq tiếp theo tính cả nước bị bỏ qua — server giữ PK (room_id, seq)')
  assert.equal(nextSeq([]), 1)
  assert.equal(isContiguous(log), true)
  assert.equal(isContiguous([log[0], log[2]]), false, 'hụt nước 2 thì phải nạp lại log')
}

// Ghế: bỏ người đã rời, xếp theo số ghế.
assert.deepEqual(
  seatedOf([{ seat: 1, memberId: 'b' }, { seat: 0, memberId: 'a' }, { seat: 2, memberId: 'c', leftAt: 'x' }]).map((p) => p.memberId),
  ['a', 'b'],
)

// Thắng thua của mình: ghế của MÌNH trong từng ván, không phải ghế 0.
{
  const s = statsOf([
    { game: 'caro', seat: 1, result: { winners: [1], draw: false } },
    { game: 'caro', seat: 0, result: { winners: [1], draw: false } },
    { game: 'caro', seat: 0, result: { winners: [], draw: true } },
    { game: 'caro', seat: 0, result: null },
  ])
  assert.deepEqual(s, { caro: { w: 1, l: 1, d: 1 } }, 'đếm sai thắng thua là bảng thành tích nói dối')
}

// Phòng chờ quá lâu thì ẩn; phòng đang chơi không bao giờ bị ẩn vì cũ.
{
  const now = Date.parse('2026-11-06T12:00:00Z')
  assert.equal(isStaleRoom({ status: 'waiting', createdAt: '2026-11-06T05:00:00Z' }, now, 6), true)
  assert.equal(isStaleRoom({ status: 'waiting', createdAt: '2026-11-06T07:00:00Z' }, now, 6), false)
  assert.equal(isStaleRoom({ status: 'playing', createdAt: '2026-11-01T00:00:00Z' }, now, 6), false)
}

// Mất kết nối: hiện "mất kết nối" sau offlineSec, được xử thắng sau graceSec.
{
  const now = Date.parse('2026-11-06T12:00:00Z')
  const opts = { offlineSec: 45, graceSec: 120 }
  const at = (sec) => ({ seenAt: new Date(now - sec * 1000).toISOString() })
  assert.deepEqual(idleOf(at(10), now, opts), { offline: false, leftSec: 110 })
  assert.deepEqual(idleOf(at(60), now, opts), { offline: true, leftSec: 60 }, 'quá 45 giây không thấy nhịp là mất kết nối')
  assert.equal(idleOf(at(120), now, opts).leftSec <= 0, true, 'đủ 120 giây thì được đòi xử thắng')
  assert.equal(idleOf(at(119), now, opts).leftSec > 0, true, 'chưa đủ hạn thì không được đòi')
  assert.deepEqual(idleOf({}, now, opts), { offline: false, leftSec: 120 }, 'chưa có nhịp nào (bản cũ) thì coi như vừa thấy')
}

// Hạn xử thua ở client phải bằng đúng hạn server dùng trong game_claim — lệch là máy cứ đòi mà server cứ từ chối
// (client ngắn hơn), hoặc người chơi chờ lâu hơn số đếm ngược đang hiện (client dài hơn).
{
  const sql = readFileSync('supabase/migrations/0074_games.sql', 'utf8')
  const m = sql.match(/seen_at < now\(\) - interval '(\d+) seconds'/)
  assert.ok(m, 'không tìm thấy hạn xử thua trong game_claim (0074)')
  assert.equal(Number(m[1]), cfg.games.reconnectGraceSec, 'app.json games.reconnectGraceSec phải khớp game_claim')
  assert.ok(cfg.games.offlineSec < cfg.games.reconnectGraceSec && cfg.games.pingSec < cfg.games.offlineSec,
    'nhịp < mất kết nối < xử thua, không thì người đang chơi bình thường cũng bị báo mất kết nối')
}

console.log('games contract check: OK')
