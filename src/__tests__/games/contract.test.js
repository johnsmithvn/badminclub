// node src/__tests__/games/contract.test.js
// Hợp đồng chung mọi game trong registry phải giữ (docs/GAMES.md §3). Thêm game mới là tự bị kiểm.
// Sai ở đây là hai máy cùng phòng thấy hai bàn khác nhau, hoặc F5 xong ván cờ biến dạng.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GAMES, GAME_IDS, gameOf, idleOf, isContiguous, isStaleRoom, nextSeq, replay, seatedOf, statsOf, waitSinceOf, waitingOf } from '#lib/games/registry.js'
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

// Mất kết nối: hiện "mất kết nối" sau offlineSec. Chỉ người ván đang chờ mới bị đếm giờ xử thua, đếm từ lúc muộn hơn
// giữa nhịp cuối và lúc ván bắt đầu chờ họ (docs/GAMES.md §5.1b) — khoá máy lúc chờ đối thủ nghĩ không phải tội.
{
  const now = Date.parse('2026-11-06T12:00:00Z')
  const opts = { offlineSec: 45, graceSec: 120 }
  const ago = (sec) => new Date(now - sec * 1000).toISOString()
  const at = (sec) => ({ seenAt: ago(sec) })
  assert.deepEqual(idleOf(at(10), now, opts), { offline: false, leftSec: null }, 'ván không chờ người này thì không đếm giờ xử')
  assert.deepEqual(idleOf(at(600), now, opts), { offline: true, leftSec: null },
    'khoá máy 10 phút lúc đang chờ đối thủ nghĩ: chỉ hiện mất kết nối, không bị xử thua')
  assert.deepEqual(idleOf(at(60), now, opts, ago(300)), { offline: true, leftSec: 60 }, 'quá 45 giây không thấy nhịp là mất kết nối')
  assert.equal(idleOf(at(600), now, opts, ago(10)).leftSec, 110,
    'khoá máy từ trước rồi mới tới lượt: hạn tính từ lúc tới lượt — không bị xử ngay khi đối thủ vừa đi')
  assert.equal(idleOf(at(600), now, opts, ago(120)).leftSec <= 0, true, 'tới lượt mà vắng đủ 120 giây thì được đòi xử')
  assert.equal(idleOf(at(600), now, opts, ago(119)).leftSec > 0, true, 'chưa đủ hạn thì không được đòi')
  assert.deepEqual(idleOf({}, now, opts, ago(0)), { offline: false, leftSec: 120 }, 'chưa có nhịp nào (bản cũ) thì coi như vừa thấy')
}

// Lúc ván bắt đầu chờ = giờ server của nước gần nhất, chưa có nước thì lúc bắt đầu ván — game_claim 0085 đo y vậy.
{
  const room = { startedAt: '2026-11-06T12:00:00Z' }
  const log = [{ seq: 1, at: '2026-11-06T12:01:00Z' }, { seq: 2, at: '2026-11-06T12:02:00Z' }]
  assert.equal(waitSinceOf(room, []), room.startedAt, 'chưa ai đi: ván chờ người đi đầu từ lúc bắt đầu')
  assert.equal(waitSinceOf(room, log), '2026-11-06T12:02:00Z')
  assert.equal(waitSinceOf(room, [...log, { seq: 3 }]), null,
    'nước mình vừa hiện trước chưa có giờ server: tính theo nước trước đó là xử oan đối thủ sớm hơn hạn')
}

// Ghế ván đang chờ: game theo lượt là người tới lượt; bước cả bàn cùng đi thì game tự khai `waiting`.
{
  const caro = gameOf('caro')
  const c0 = caro.setup({ options: caro.defaultOptions, seed: 's', seats: [0, 1] })
  assert.deepEqual(waitingOf(caro, null), [])
  assert.deepEqual(waitingOf(caro, c0), [0], 'Caro: X đi trước — ván chờ ghế 0')
  assert.deepEqual(waitingOf(caro, caro.apply(c0, 0, { i: 112 })), [1], 'đi xong thì ván chờ đối thủ, không chờ mình')

  const tau = gameOf('bantau')
  const t0 = tau.setup({})
  const t1 = tau.apply(t0, 0, { placed: true })
  assert.deepEqual(waitingOf(tau, t0), [0, 1], 'Bắn tàu: lúc xếp tàu chờ cả hai')
  assert.deepEqual(waitingOf(tau, t1), [1], 'chốt tàu rồi thì khoá máy chờ đối thủ xếp không bị xử')
  assert.deepEqual(waitingOf(tau, tau.apply(t1, 1, { placed: true })), [0], 'xếp xong thì chờ người tới lượt bắn')

  const ms = gameOf('masoi')
  const m0 = ms.apply(ms.setup({ options: {} }), 0, { deal: { n: 5 } })
  const m1 = ms.apply(m0, 2, { night: true })
  assert.deepEqual(waitingOf(ms, m0), [0, 1, 2, 3, 4], 'Ma sói: đêm chờ mọi người còn sống bấm')
  assert.deepEqual(waitingOf(ms, m1), [0, 1, 3, 4], 'đã bấm rồi thì khoá máy chờ người khác không bị xử (chết oan)')
  const day = { ...m1, phase: 'day', alive: [true, false, true, true, true], votes: [3, null, null, null, -1] }
  assert.deepEqual(waitingOf(ms, day), [2, 3], 'ban ngày chờ người còn sống chưa bỏ phiếu — người chết không bị chờ')
  assert.deepEqual(waitingOf(ms, { ...m1, phase: 'hunter', hunter: 1, shot: null }), [1], 'Thợ săn đã chết vẫn được chờ bắn')
  const full = [0, 1, 3, 4].reduce((x, i) => ms.apply(x, i, { night: true }), m1)
  assert.deepEqual(waitingOf(ms, full), [], 'đủ người bấm thì máy nào cũng tự gửi { next } — không chờ ai, không xử ai')
}

// Hạn xử thua ở client phải bằng đúng hạn server dùng trong game_claim — lệch là máy cứ đòi mà server cứ từ chối
// (client ngắn hơn), hoặc người chơi chờ lâu hơn số đếm ngược đang hiện (client dài hơn).
{
  // 0078 rồi 0085 viết lại game_claim — bản mới nhất mới là bản chạy, nhưng mọi bản đều phải khớp.
  for (const f of ['0074_games.sql', '0078_games_tienlen.sql', '0085_games_claim.sql']) {
    const sql = readFileSync('supabase/migrations/' + f, 'utf8')
    const m = sql.match(/seen_at < now\(\) - interval '(\d+) seconds'/)
    assert.ok(m, 'không tìm thấy hạn xử thua trong game_claim (' + f + ')')
    assert.equal(Number(m[1]), cfg.games.reconnectGraceSec, 'app.json games.reconnectGraceSec phải khớp game_claim (' + f + ')')
  }
  // 0085 còn đo "ván đứng yên bao lâu" — máy khách đếm cả hai bằng cùng graceSec (idleOf), lệch là đếm ngược nói dối.
  const claim = readFileSync('supabase/migrations/0085_games_claim.sql', 'utf8')
  const hold = [...claim.matchAll(/interval '(\d+) seconds'/g)].map((x) => Number(x[1]))
  assert.ok(hold.length >= 2 && hold.every((x) => x === cfg.games.reconnectGraceSec), 'mọi hạn trong game_claim 0085 phải bằng reconnectGraceSec')
  // PostgREST gọi RPC theo TÊN tham số: lệch tên là mọi lần đòi xử đều lỗi (gameClaim nuốt lỗi) — ván treo mãi.
  assert.match(claim, /FUNCTION public\.game_claim\(p_room uuid, p_seats int\[\]\)/)
  assert.match(readFileSync('src/contexts/gameActions.js', 'utf8'), /'game_claim', \{ p_room: roomId, p_seats: seats \}/)
  assert.ok(cfg.games.offlineSec < cfg.games.reconnectGraceSec && cfg.games.pingSec < cfg.games.offlineSec,
    'nhịp < mất kết nối < xử thua, không thì người đang chơi bình thường cũng bị báo mất kết nối')
}

console.log('games contract check: OK')
