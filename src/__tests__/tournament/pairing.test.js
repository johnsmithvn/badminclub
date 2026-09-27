import test from 'node:test'
import assert from 'node:assert/strict'
import { autoPair, balanceOf, chemistryOf, eventPlayers, eventTeams, lineupIssue, shuffle, suggestSwap } from '#lib/tournament/pairing.js'
import { defaultStage, drawNumbers, entrantsOf, koPreview, presetKeyOf, RULE_PRESETS } from '#lib/tournament/format.js'

const r = (id, gender, rating) => ({ id, gender, ratingSnapshot: rating, status: 'registered' })
// Nguồn ngẫu nhiên cố định — test lặp lại được.
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
const names = (pairs) => pairs.map((p) => p.map((x) => x.id).join('+'))

test('ghép cân bằng: mạnh nhất + yếu nhất, người lẻ để lại', () => {
  const pool = [r('a', 'nam', 800), r('b', 'nam', 700), r('c', 'nam', 500), r('d', 'nam', 300), r('e', 'nam', 200)]
  assert.deepEqual(names(autoPair(pool, { genderRule: 'male' })), ['a+e', 'b+d'],
    'mạnh ghép mạnh là đưa cả 2 người giỏi nhất vào một cặp — giải hết hay từ vòng 1')
})

test('đôi nam nữ: luôn 1 nam + 1 nữ; cân bằng = nam mạnh với nữ yếu; thừa bên nào thì bên đó chờ', () => {
  const pool = [r('m1', 'nam', 800), r('m2', 'nam', 500), r('m3', 'nam', 400), r('w1', 'nu', 600), r('w2', 'nu', 300)]
  const pairs = autoPair(pool, { genderRule: 'mixed' })
  assert.deepEqual(names(pairs), ['m1+w2', 'm2+w1'])
  assert.ok(pairs.every(([a, b]) => a.gender === 'nam' && b.gender === 'nu'), 'cặp nam-nam ở đôi nam nữ là sai luật giải')
  const rnd = autoPair(pool, { genderRule: 'mixed', mode: 'random', rand: seeded() })
  assert.equal(rnd.length, 2)
  assert.ok(rnd.every(([a, b]) => a.gender === 'nam' && b.gender === 'nu'), 'ngẫu nhiên vẫn giữ luật nam nữ')
})

test('ngẫu nhiên: đủ mọi người (trừ người lẻ), không trùng, lặp lại được với cùng nguồn', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => r(id, 'nu', 300 + i))
  const p1 = autoPair(pool, { genderRule: 'female', mode: 'random', rand: seeded(3) })
  const p2 = autoPair(pool, { genderRule: 'female', mode: 'random', rand: seeded(3) })
  assert.deepEqual(names(p1), names(p2))
  assert.equal(new Set(p1.flat().map((x) => x.id)).size, 6)
  assert.deepEqual(shuffle([1, 2, 3], seeded(1)).sort(), [1, 2, 3])
})

// tour tối thiểu: nội dung đôi nam nữ, 2 đội đã có + 1 người chưa cặp + 1 người rút
const tour = () => ({
  events: [{ id: 'xd', kind: 'xd', teamSize: 2, genderRule: 'mixed', status: 'draft' }],
  registrations: [r('m1', 'nam', 800), r('w1', 'nu', 300), r('m2', 'nam', 500), r('w2', 'nu', 600), r('m3', 'nam', 400),
    { ...r('x', 'nu', 999), status: 'withdrawn' }],
  entries: ['m1', 'w1', 'm2', 'w2', 'm3', 'x'].map((id) => ({ eventId: 'xd', registrationId: id })),
  teams: [{ id: 't1', eventId: 'xd', drawNo: 2 }, { id: 't2', eventId: 'xd', drawNo: 1 }],
  teamPlayers: [['t1', 'm1'], ['t1', 'w1'], ['t2', 'm2'], ['t2', 'w2']].map(([teamId, registrationId]) => ({ teamId, registrationId, eventId: 'xd' })),
})

test('người của nội dung và đội: bỏ người đã rút; đội có tổng rating, đủ người, xếp theo số bốc thăm', () => {
  const ps = eventPlayers(tour(), 'xd')
  assert.deepEqual(ps.map((p) => p.id), ['m1', 'w1', 'm2', 'w2', 'm3'])
  assert.equal(ps.find((p) => p.id === 'm3').teamId, null)
  const teams = eventTeams(tour(), 'xd')
  assert.deepEqual(teams.map((t) => t.id), ['t2', 't1'], 'Đ1 trước Đ2')
  assert.deepEqual(teams.map((t) => t.sum), [1100, 1100])
  assert.ok(teams.every((t) => t.full))
})

test('đội chưa bốc thăm (drawNo null hết): giữ nguyên thứ tự ghép, đội mới luôn ở cuối', () => {
  const t = tour()
  t.teams = [{ id: 'zzz-first', eventId: 'xd', drawNo: null }, { id: 'aaa-second', eventId: 'xd', drawNo: null }]
  const teams = eventTeams(t, 'xd')
  assert.deepEqual(teams.map((x) => x.id), ['zzz-first', 'aaa-second'],
    'không tiebreak theo id — id "aaa" đứng trước "zzz" theo bảng chữ cái nhưng phải giữ đúng thứ tự ghép')
})

test('độ cân bằng: lệch = cặp mạnh nhất − yếu nhất; màu theo ngưỡng kèo đấu', () => {
  const t = (sum, full = true) => ({ sum, full })
  assert.deepEqual(balanceOf([t(1000), t(1100)]), { spread: 100, tone: 'ok', avg: 1050 })
  assert.equal(balanceOf([t(1000), t(1200)]).tone, 'warn')
  assert.equal(balanceOf([t(1000), t(1300)]).tone, 'bad')
  assert.equal(balanceOf([t(1000), t(50, false)]).spread, null, 'cặp chưa đủ người không tính')
})

test('chốt đội hình: đủ 2 đội, đội nào cũng đủ, nam nữ đúng 1-1; đơn chỉ cần 2 người', () => {
  const xd = tour().events[0]
  const full = (players) => ({ full: true, players })
  const nam = { gender: 'nam' }
  const nu = { gender: 'nu' }
  assert.equal(lineupIssue(xd, [full([nam, nu]), full([nam, nu])], []), null)
  assert.equal(lineupIssue(xd, [full([nam, nu])], []), 'tournament.pairing.issueTooFew')
  assert.equal(lineupIssue(xd, [full([nam, nu]), full([nam, nu]), { full: false, players: [nam] }], []),
    'tournament.pairing.issueIncomplete', 'cặp thiếu người lọt vào nhánh = trận không có đối thủ')
  assert.equal(lineupIssue(xd, [full([nam, nu]), full([nam, nam])], []), 'tournament.pairing.issueMixed')
  const ms = { teamSize: 1, genderRule: 'male' }
  assert.equal(lineupIssue(ms, [], [nam, nam]), null)
  assert.equal(lineupIssue(ms, [], [nam]), 'tournament.pairing.issueTooFew')
})

test('thể thức mặc định theo quy chế mùa 1; nhận ra luật mẫu', () => {
  const md = defaultStage({ kind: 'md' })
  assert.deepEqual(md.matchRule, RULE_PRESETS.r1x30, 'đôi nam: chạm 30')
  assert.deepEqual(defaultStage({ kind: 'xd' }).matchRule, RULE_PRESETS.r1x21, 'đôi nam nữ: 21 cách 2, trần 30')
  assert.deepEqual(md.ruleOverrides.final, RULE_PRESETS.r3x15)
  assert.equal(md.config.thirdPlace, true)
  md.matchRule.points = 99
  assert.equal(RULE_PRESETS.r1x30.points, 30, 'sửa luật của giai đoạn không được sửa luôn bảng mẫu')
  assert.equal(presetKeyOf(RULE_PRESETS.r3x21), 'r3x21')
  assert.equal(presetKeyOf({ sets: 1, points: 25, winBy2: false, cap: 25 }), null)
})

test('đội vào nhánh: hạt giống theo tổng rating; bốc thăm thì cần đủ số', () => {
  const teams = [{ id: 'a', sum: 900, full: true }, { id: 'b', sum: 1200, full: true }, { id: 'c', sum: 1000, full: true },
    { id: 'z', sum: 5000, full: false }]
  assert.deepEqual(entrantsOf(teams, 'seed').entrants, [{ id: 'b', seed: 1 }, { id: 'c', seed: 2 }, { id: 'a', seed: 3 }],
    'đội thiếu người không vào nhánh')
  assert.equal(entrantsOf(teams, 'slot').error, 'tournament.format.needDraw')
  const drawn = drawNumbers(teams, seeded(5))
  assert.deepEqual(drawn.map((d) => d.drawNo).sort(), [1, 2, 3])
  const withDraw = teams.map((t) => ({ ...t, drawNo: drawn.find((d) => d.teamId === t.id)?.drawNo }))
  assert.equal(entrantsOf(withDraw, 'slot').entrants.length, 3)
})

test('xem trước nhánh: 8 đội = 24 trận/3 nội dung như mùa 1; 5 đội có 3 bye; 3 đội không có 3-4', () => {
  const st = defaultStage({ kind: 'md' })
  const p8 = koPreview(8, st)
  assert.deepEqual(p8.rounds.map((x) => [x.kind, x.matches]), [['qf', 4], ['sf', 2], ['final', 1], ['third', 1]])
  assert.equal(p8.total, 8)
  assert.deepEqual(p8.rounds.find((x) => x.kind === 'final').rule, RULE_PRESETS.r3x15)
  const p5 = koPreview(5, st)
  assert.equal(p5.byes, 3)
  assert.deepEqual(p5.rounds[0], { kind: 'qf', matches: 1, rule: RULE_PRESETS.r1x30 }, 'bye không phải trận phải đánh')
  assert.equal(koPreview(3, st).rounds.some((x) => x.kind === 'third'), false)
  assert.equal(koPreview(1, st).total, 0)
})

test('ghép hạt giống: mạnh + mạnh (1–2, 3–4); nam nữ: nam mạnh với nữ mạnh', () => {
  const pool = [r('a', 'nam', 800), r('b', 'nam', 700), r('c', 'nam', 500), r('d', 'nam', 300)]
  assert.deepEqual(names(autoPair(pool, { genderRule: 'male', mode: 'seeded' })), ['a+b', 'c+d'])
  const mix = [r('m1', 'nam', 800), r('m2', 'nam', 500), r('w1', 'nu', 600), r('w2', 'nu', 300)]
  assert.deepEqual(names(autoPair(mix, { genderRule: 'mixed', mode: 'seeded' })), ['m1+w1', 'm2+w2'])
})

// Trận CLB dạng `db.matches`: teamA/teamB là id thành viên (= registration.playerId).
const played = (a, b, won, n) => Array.from({ length: n }, (_, i) => ({
  id: `${a}${b}${i}`, teamA: [a, b], teamB: ['x', 'y'], winnerTeam: won ? 'A' : 'B', ratingEnabled: true,
}))
const p = (id, gender, rating) => ({ ...r(id, gender, rating), playerId: id })

test('ghép ăn ý: cặp đã đánh chung ≥ 2 trận, thắng nhiều ghép trước; người chưa có lịch sử ghép cân bằng', () => {
  const pool = [p('a', 'nam', 800), p('b', 'nam', 780), p('c', 'nam', 500), p('d', 'nam', 300), p('e', 'nam', 400), p('f', 'nam', 600)]
  const history = [...played('a', 'b', true, 3), ...played('c', 'd', true, 1)]
  assert.deepEqual(chemistryOf(history, pool[0], pool[1]), { games: 3, winPct: 100, known: true })
  assert.equal(chemistryOf(history, pool[2], pool[3]).known, false, '1 trận chung chưa đủ để tin')
  const pairs = names(autoPair(pool, { genderRule: 'male', mode: 'chemistry', history }))
  assert.equal(pairs[0], 'a+b', 'cặp ăn ý ghép trước dù cả hai đều mạnh')
  assert.deepEqual(pairs.slice(1), ['f+d', 'c+e'], 'còn lại ghép cân bằng')
  // Nam nữ: chỉ tính cặp khác giới, người nam đứng trước.
  const mix = [p('m', 'nam', 500), p('w', 'nu', 500), p('m2', 'nam', 500)]
  const mh = [...played('w', 'm', true, 2), ...played('m', 'm2', true, 5)]
  assert.deepEqual(names(autoPair(mix, { genderRule: 'mixed', mode: 'chemistry', history: mh })), ['m+w'])
})

const team = (id, players, pinned = false) => ({ id, players, pinned, full: true, sum: players.reduce((s, x) => s + x.ratingSnapshot, 0) })

test('gợi ý đổi người: chọn cú đổi giảm lệch nhiều nhất; bỏ đội ghim; nam nữ chỉ đổi cùng giới; lợi ít thì thôi', () => {
  const t1 = team('t1', [r('a', 'nam', 800), r('b', 'nam', 700)])
  const t2 = team('t2', [r('c', 'nam', 400), r('d', 'nam', 300)])
  const s = suggestSwap([t1, t2], 'male')
  assert.equal(s.before, 800)
  assert.equal(s.after, 0, 'đổi 800 ↔ 400 (hoặc 700 ↔ 300): 1100 vs 1100')
  assert.equal(suggestSwap([{ ...t1, pinned: true }, t2], 'male'), null, 'đội ghim không bị đụng')

  const close = [team('t1', [r('a', 'nam', 503), r('b', 'nam', 500)]), team('t2', [r('c', 'nam', 500), r('d', 'nam', 500)])]
  assert.equal(suggestSwap(close, 'male'), null, 'lệch 3 điểm — không đáng gợi ý')

  const mix = [team('x1', [r('m1', 'nam', 800), r('w1', 'nu', 600)]), team('x2', [r('m2', 'nam', 400), r('w2', 'nu', 300)])]
  const sm = suggestSwap(mix, 'mixed')
  assert.equal(sm.regA.gender, sm.regB.gender)
})

