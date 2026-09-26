import test from 'node:test'
import assert from 'node:assert/strict'
import { canvasChecks, estimateOf, graphIssue, groupsForStage, koPreviewOf, layoutOf, manualGroupsOk, moveTeam, nextFreeRanks, nextSeq, teamsViaLink, unplacedTeams } from '#lib/tournament/canvas.js'

const st = (id, seq, type, p = {}) => ({ id, seq, type, status: 'pending', config: {}, ...p })
const link = (from, to, ranks) => ({ fromStageId: from, toStageId: to, ranks })

test('sơ đồ hợp lệ: vòng bảng nguồn → 3 nhánh, mỗi nhánh một bộ hạng riêng', () => {
  const stages = [st('rr', 1, 'round_robin'), st('a', 2, 'knockout'), st('b', 3, 'knockout'), st('c', 4, 'knockout')]
  const links = [link('rr', 'a', [1, 2]), link('rr', 'b', [3, 4]), link('rr', 'c', [5, 6])]
  assert.equal(graphIssue(stages, links), null)
  assert.equal(graphIssue([st('ko', 1, 'knockout')], []), null, 'một nhánh loại trực tiếp là đủ')
})

test('sơ đồ không sinh được lịch → báo đúng lỗi', () => {
  const rr = st('rr', 1, 'round_robin')
  const a = st('a', 2, 'knockout')
  const b = st('b', 3, 'knockout')
  assert.equal(graphIssue([], []), 'tournament.canvas.errEmpty')
  assert.equal(graphIssue([st('x', 2, 'knockout')], []), 'tournament.canvas.errNoSource')
  assert.equal(graphIssue([rr, a], []), 'tournament.canvas.errUnlinked', 'nhánh không có đội vào')
  assert.equal(graphIssue([rr, a], [link('rr', 'a', [])]), 'tournament.canvas.errUnlinked', 'link không chọn hạng nào')
  assert.equal(graphIssue([rr, a, b], [link('rr', 'a', [1, 2]), link('rr', 'b', [2, 3])]), 'tournament.canvas.errRankTwice')
  assert.equal(graphIssue([rr, a, b], [link('rr', 'a', [1]), link('a', 'b', [1])]), 'tournament.canvas.errChain', 'nhánh loại không có thứ hạng để đẩy tiếp')
  assert.equal(graphIssue([st('k', 1, 'knockout'), a], [link('k', 'a', [1])]), 'tournament.canvas.errKoSource')
  assert.equal(graphIssue([rr, st('r2', 2, 'round_robin')], [link('rr', 'r2', [1])]), 'tournament.canvas.errTargetType')
})

test('toạ độ: đã kéo thì giữ, chưa kéo thì nguồn trái, nhánh xếp dọc bên phải; seq mới nối tiếp', () => {
  const pos = layoutOf([st('b', 3, 'knockout'), st('rr', 1, 'round_robin'), st('a', 2, 'knockout', { canvasX: 500, canvasY: 9 })])
  assert.deepEqual(pos.a, { x: 500, y: 9 })
  assert.ok(pos.rr.x < pos.b.x)
  assert.equal(nextSeq([st('rr', 1, 'round_robin'), st('b', 3, 'knockout')]), 4)
})

const teams = ['t1', 't2', 't3', 't4', 't5'].map((id, i) => ({ id, sum: 1000 - i * 10 }))

test('chia bảng tay: dùng khi phủ đúng đội và mỗi bảng ≥ 2; lệch là quay về chia rắn', () => {
  const ids = teams.map((x) => x.id)
  assert.equal(manualGroupsOk([['t1', 't5'], ['t2', 't3', 't4']], ids, 2), true)
  assert.equal(manualGroupsOk([['t1'], ['t2', 't3', 't4', 't5']], ids, 2), false, 'bảng 1 đội không có trận')
  assert.equal(manualGroupsOk([['t1', 't2'], ['t3', 't4']], ids, 2), false, 'thiếu t5 (mới ghép thêm)')

  const manual = { config: { numGroups: 2, manualGroups: [['t1', 't5'], ['t2', 't3', 't4']] } }
  assert.deepEqual(groupsForStage(manual, teams).map((g) => g.teams.map((x) => x.teamId)), [['t1', 't5'], ['t2', 't3', 't4']])
  const stale = { config: { numGroups: 2, manualGroups: [['t1', 't2'], ['t3', 't4']] } }
  assert.deepEqual(groupsForStage(stale, teams).map((g) => g.teams.length), [3, 2], 'lệch → chia rắn 5 đội thành 3 + 2')
})

test('chuyển đội giữa các bảng: bắt đầu từ bản chia rắn khi chưa chia tay', () => {
  const stage = { config: { numGroups: 2 } }
  const next = moveTeam(stage, teams, 't1', 1)
  assert.ok(!next[0].includes('t1'))
  assert.equal(next[1][next[1].length - 1], 't1')
  assert.equal(next.flat().length, 5)
})

test('canvas render: khối + mũi tên có nhãn hạng + tên riêng; sơ đồ hỏng thì báo lỗi ngay', async () => {
  const { text, load, fakeActions } = await import('./_render.js')
  const { db, tour } = await import('./fixture.js')
  const { default: FlowCanvas } = await load('#components/tournament/FlowCanvas.jsx')
  const R = { sets: 1, points: 21, winBy2: true, cap: 30 }
  const ev = { id: 'e-md', kind: 'md', teamSize: 2, genderRule: 'male', status: 'draft' }
  const s = (id, seq, type, p = {}) => ({ id, eventId: 'e-md', seq, type, status: 'pending', config: { numGroups: 2 }, matchRule: R, ruleOverrides: {}, title: '', ...p })
  const tr = tour({
    events: [ev],
    stages: [s('rr', 1, 'round_robin'), s('a', 2, 'knockout'), s('b', 3, 'knockout', { title: 'Nhánh Bạc' })],
    stageLinks: [{ id: 'l1', fromStageId: 'rr', toStageId: 'a', ranks: [1, 2] }, { id: 'l2', fromStageId: 'rr', toStageId: 'b', ranks: [3] }],
  })
  const props = (x) => ({ tour: x, event: ev, db, a: fakeActions(), onBack: () => {}, onOpenBracket: () => {} })
  const out = text(FlowCanvas, props(tr))
  assert.match(out, /Sơ đồ thi đấu Đôi nam/)
  assert.match(out, /3 khối/)
  assert.match(out, /Vòng bảng Vòng tròn Loại trực tiếp Chung kết/, 'khay khối kéo vào')
  assert.match(out, /Hạng 1–2 · \d+ đội/)
  assert.match(out, /Hạng 3 · \d+ đội/)
  assert.match(out, /Vòng bảng .*Nhánh chính .*Nhánh Bạc/, 'tên riêng thay tên theo vai')
  assert.match(out, /Kiểm tra sơ đồ/)
  assert.match(out, /Chưa có cặp đủ người/)
  assert.doesNotMatch(out, /0 trận trên/, 'chưa có trận thì không ước tính giờ')

  const broken = { ...tr, stageLinks: [tr.stageLinks[0]] }
  assert.match(text(FlowCanvas, props(broken)), /Có nhánh chưa chọn hạng nhận vào/)
})

// Giải dựng sẵn: nội dung `e` có n cặp đủ người (tổng rating giảm dần), giờ 08:00–12:00, `courts` sân.
function tourOf(n, stages, links = [], courts = 2) {
  const teams = Array.from({ length: n }, (_, i) => ({ id: 'c' + i, eventId: 'e' }))
  const registrations = teams.flatMap((x, i) => [0, 1].map((k) => ({ id: `${x.id}r${k}`, ratingSnapshot: 600 - i * 10, status: 'registered' })))
  const teamPlayers = teams.flatMap((x) => [0, 1].map((k) => ({ teamId: x.id, eventId: 'e', registrationId: `${x.id}r${k}` })))
  return {
    events: [{ id: 'e', kind: 'md', teamSize: 2 }], teams, registrations, teamPlayers, stages, stageLinks: links,
    startTime: '08:00', endTime: '12:00', courtLabels: Array.from({ length: courts }, (_, i) => 'S' + i),
  }
}
const R21 = { sets: 1, points: 21, winBy2: true, cap: 30 }
const R3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }
const sg = (id, seq, type, config = {}, p = {}) => ({ id, eventId: 'e', seq, type, status: 'pending', config, matchRule: R21, ruleOverrides: {}, ...p })

test('ước tính: số đội từng khối theo link, số trận, phút sân, giờ xong theo số sân', () => {
  const tr = tourOf(12,
    [sg('rr', 1, 'round_robin', { numGroups: 4 }), sg('ko', 2, 'knockout', { thirdPlace: true }, { ruleOverrides: { final: R3x15 } })],
    [{ fromStageId: 'rr', toStageId: 'ko', ranks: [1, 2] }])
  const est = estimateOf(tr, tr.events[0])
  assert.deepEqual(est.stages.rr, { teams: 12, matches: 12, minutes: 12 * (14 + 3) })
  assert.equal(est.stages.ko.teams, 8)
  assert.equal(est.stages.ko.matches, 8, 'tứ kết 4 + bán kết 2 + chung kết + 3-4')
  assert.equal(est.stages.ko.minutes, 6 * (14 + 3) + 2 * (22 + 3))
  assert.equal(est.matches, 20)
  assert.equal(est.finish, '10:58', `08:00 + ceil(${est.minutes} / 2 sân)`)
  assert.equal(est.fits, true)
  assert.equal(teamsViaLink([3, 4], 7, 2), 3, 'bảng 3 đội không có hạng 4')
})

test('nhánh thu nhỏ: đúng cặp A1–B2 như lịch sẽ sinh, vòng sau là "thắng trận n", 3-4 là "thua trận n"', () => {
  const ko = sg('ko', 2, 'knockout', { thirdPlace: true })
  const rounds = koPreviewOf(ko, sg('rr', 1, 'round_robin', { numGroups: 2 }), { ranks: [1, 2] }, 8)
  const label = (x) => (x.kind === 'slot' ? x.label : x.kind + x.no)
  assert.deepEqual(rounds.map((r) => r.roundKind), ['sf', 'final', 'third'])
  assert.deepEqual(rounds[0].matches.map((m) => [m.no, label(m.a), label(m.b)]), [[1, 'A1', 'B2'], [2, 'B1', 'A2']])
  assert.deepEqual(rounds[1].matches.map((m) => [label(m.a), label(m.b)]), [['winner1', 'winner2']])
  assert.deepEqual(rounds[2].matches.map((m) => [label(m.a), label(m.b)]), [['loser1', 'loser2']])

  // Nguồn là chính nó (không vòng bảng): 3 đội → hạt giống 1 được miễn, đi thẳng chung kết.
  const solo = koPreviewOf(sg('k', 1, 'knockout', { thirdPlace: true }), null, null, 3)
  assert.deepEqual(solo.map((r) => r.matches.length), [1, 1])
  assert.deepEqual(solo[1].matches[0].a, { kind: 'seed', n: 1 })
})

test('khay cặp chưa xếp: chia tay dở dang giữ nguyên; kéo về khay / vào bảng', () => {
  const full = ['c0', 'c1', 'c2', 'c3', 'c4'].map((id, i) => ({ id, sum: 900 - i }))
  const stage = { config: { numGroups: 2, manualGroups: [['c0', 'c1'], ['c2']] } }
  assert.deepEqual(unplacedTeams(stage, full).map((x) => x.id), ['c3', 'c4'])
  assert.deepEqual(moveTeam(stage, full, 'c3', 1), [['c0', 'c1'], ['c2', 'c3']])
  assert.deepEqual(moveTeam(stage, full, 'c0', -1), [['c1'], ['c2']], 'thả về khay')
  assert.deepEqual(unplacedTeams({ config: { numGroups: 2 } }, full), [], 'chưa chia tay → chia rắn, không ai bị bỏ')
})

test('kiểm tra sơ đồ: liệt kê đủ lỗi + ước tính; link mới lấy 2 hạng nhỏ nhất còn trống', () => {
  const rr = sg('rr', 1, 'round_robin', { numGroups: 2, manualGroups: [['c0', 'c1'], ['c2']] })
  const tr = tourOf(5, [rr, sg('ko', 2, 'knockout')])
  const keys = canvasChecks(tr, tr.events[0]).map((c) => c.key)
  assert.ok(keys.includes('tournament.canvas.errUnlinked'))
  assert.ok(keys.includes('tournament.canvas.chkUnplaced'))
  assert.ok(keys.includes('tournament.canvas.chkSmallGroup'))
  assert.ok(keys.includes('tournament.canvas.chkFits'))
  assert.deepEqual(nextFreeRanks([{ fromStageId: 'rr', ranks: [1, 2] }], 'rr'), [3, 4])
  assert.deepEqual(nextFreeRanks([], 'rr'), [1, 2])
})

