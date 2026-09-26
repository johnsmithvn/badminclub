import test from 'node:test'
import assert from 'node:assert/strict'
import { eventDone, flowOf, tourDone } from '#lib/tournament/flow.js'

const R = { sets: 1, points: 21, winBy2: true, cap: 30 }
const ev = { id: 'e', kind: 'md', teamSize: 2 }

// n đội đủ 2 người của nội dung `e`.
function base(n, p = {}) {
  const teams = Array.from({ length: n }, (_, i) => ({ id: 't' + i, eventId: 'e' }))
  const registrations = teams.flatMap((t) => [0, 1].map((k) => ({ id: `${t.id}r${k}`, ratingSnapshot: 500, status: 'registered' })))
  const teamPlayers = teams.flatMap((t) => [0, 1].map((k) => ({ teamId: t.id, eventId: 'e', registrationId: `${t.id}r${k}` })))
  return { events: [ev], teams, registrations, teamPlayers, stages: [], stageLinks: [], groups: [], groupTeams: [], matches: [], ...p }
}
const stage = (id, seq, type, status, config = {}) => ({ id, eventId: 'e', seq, type, status, config, matchRule: R })
const m = (id, stageId, round, roundKind, a, b, status = 'ready', winner = null) => ({ id, stageId, round, roundKind, teamAId: a, teamBId: b, status, winner })

test('chưa có thể thức → không có sơ đồ', () => {
  assert.equal(flowOf(base(4), ev), null)
})

test('loại trực tiếp: đội vòng đầu, tiến độ bỏ trận bye, vô địch chỉ khi chung kết có kết quả', () => {
  const matches = [
    m('b1', 's1', 0, 'sf', 't0', null, 'bye', 'A'),
    m('b2', 's1', 0, 'sf', 't1', 't2', 'done', 'B'),
    m('f', 's1', 1, 'final', 't0', 't2'),
  ]
  const tr = base(3, { stages: [stage('s1', 1, 'knockout', 'running')], matches })
  const f = flowOf(tr, ev)
  assert.equal(f.teams, 3)
  assert.equal(f.first.labelKey, 'tournament.format.koStage')
  assert.equal(f.first.teams, 3)
  assert.deepEqual(f.first.matches, { done: 1, total: 2 }, 'trận bye không tính')
  assert.equal(f.first.winner, null)
  assert.deepEqual(f.next, [])

  tr.matches[2] = { ...tr.matches[2], status: 'done', winner: 'B' }
  assert.equal(flowOf(tr, ev).first.winner, 't2')
})

test('bảng + nhánh chính & phụ chưa có lịch: số đội dự kiến theo số bảng và link; nhãn chính / phụ', () => {
  const tr = base(8, {
    stages: [
      stage('s1', 1, 'round_robin', 'pending', { numGroups: 2, advancePerGroup: 2 }),
      stage('s3', 3, 'knockout', 'pending'),
      stage('s2', 2, 'knockout', 'pending'),
    ],
    stageLinks: [{ fromStageId: 's1', toStageId: 's3', ranks: [4, 3] }, { fromStageId: 's1', toStageId: 's2', ranks: [2, 1] }],
  })
  const f = flowOf(tr, ev)
  assert.equal(f.first.groups, 2)
  assert.equal(f.first.teams, 8)
  assert.deepEqual(f.next.map((x) => [x.labelKey, x.teams, x.ranks]), [
    ['tournament.stage.main', 4, [1, 2]],
    ['tournament.stage.plate', 4, [3, 4]],
  ])
})

test('vòng tròn 1 bảng: người thắng = hạng 1 ĐÃ CHỐT; chưa chốt thì chưa có', () => {
  const groups = [{ id: 'g', stageId: 's1', label: 'A', seq: 1 }]
  const gt = (rank) => ['t0', 't1', 't2'].map((id, i) => ({ groupId: 'g', teamId: id, finalRank: rank ? i + 1 : null }))
  const running = base(3, { stages: [stage('s1', 1, 'round_robin', 'running')], groups, groupTeams: gt(false) })
  assert.equal(flowOf(running, ev).first.winner, null)
  assert.equal(flowOf(running, ev).first.teams, 3)
  const done = base(3, { stages: [stage('s1', 1, 'round_robin', 'done')], groups, groupTeams: gt(true) })
  assert.equal(flowOf(done, ev).first.winner, 't0')
})

test('route sơ đồ: /giai-dau/:id/so-do ↔ tournamentFlow, không lẫn với Hub / nhánh', async () => {
  const { keyOfPath, pathOf } = await import('#routes')
  assert.equal(pathOf('tournamentFlow', 't1'), '/giai-dau/t1/so-do')
  assert.equal(keyOfPath('/giai-dau/t1/so-do'), 'tournamentFlow')
  assert.equal(keyOfPath('/giai-dau/t1'), 'tournament')
  assert.equal(keyOfPath('/giai-dau/t1/nhanh/e1'), 'tournamentBracket')
})

test('sơ đồ render: khối đội → vòng bảng → nhánh chính / phụ với nhãn hạng; giai đoạn chưa lịch không bấm được', async () => {
  const { text, html, load } = await import('./_render.js')
  const { db } = await import('./fixture.js')
  const { Pipeline } = await load('#pages/TournamentFlow.jsx')
  const tr = base(8, {
    stages: [
      stage('s1', 1, 'round_robin', 'running', { numGroups: 2, advancePerGroup: 2 }),
      stage('s2', 2, 'knockout', 'pending'),
      stage('s3', 3, 'knockout', 'pending'),
    ],
    stageLinks: [{ fromStageId: 's1', toStageId: 's2', ranks: [1, 2] }, { fromStageId: 's1', toStageId: 's3', ranks: [3, 4] }],
  })
  const props = { flow: flowOf(tr, ev), tour: tr, db, isMobile: false, onOpen: () => {} }
  const s = text(Pipeline, props)
  assert.match(s, /Đội tham gia 8 đội/)
  assert.match(s, /Vòng bảng ĐANG ĐÁ 2 bảng/)
  assert.match(s, /Hạng 1–2 .*Nhánh chính CHỜ ~4 đội \(dự kiến\)/)
  assert.match(s, /Hạng 3–4 .*Nhánh phụ CHỜ ~4 đội \(dự kiến\)/)
  assert.match(s, /Vô địch Chờ kết quả/)
  assert.match(s, /Nhất nhánh phụ Chờ kết quả/)
  const disabled = (html(Pipeline, props).match(/<button[^>]*disabled/g) || []).length
  assert.equal(disabled, 2, 'hai nhánh chưa có lịch → không bấm được; vòng bảng đang đánh thì bấm được')
})

test('nội dung / giải xong: nhánh cuối có vô địch, vòng tròn cuối đã chốt; chưa thể thức = chưa xong', () => {
  const ko = (winner) => base(2, {
    stages: [stage('s1', 1, 'knockout', 'running')],
    matches: [m('f', 's1', 0, 'final', 't0', 't1', winner ? 'done' : 'ready', winner)],
  })
  assert.equal(eventDone(ko(null), ev), false)
  assert.equal(eventDone(ko('A'), ev), true)
  assert.equal(eventDone(base(2), ev), false, 'chưa chọn thể thức')

  // Bảng → nhánh: vòng bảng đã chốt nhưng nhánh chưa đánh → chưa xong.
  const rrKo = base(4, {
    stages: [stage('s1', 1, 'round_robin', 'done'), stage('s2', 2, 'knockout', 'running')],
    stageLinks: [{ fromStageId: 's1', toStageId: 's2', ranks: [1, 2] }],
    matches: [m('f', 's2', 0, 'final', 't0', 't1')],
  })
  assert.equal(eventDone(rrKo, ev), false)
  rrKo.matches[0] = { ...rrKo.matches[0], status: 'walkover', winner: 'B' }
  assert.equal(eventDone(rrKo, ev), true)

  assert.equal(tourDone({ ...ko('A'), events: [] }), false, 'giải không có nội dung không "xong"')
  assert.equal(tourDone(ko('A')), true)
})
