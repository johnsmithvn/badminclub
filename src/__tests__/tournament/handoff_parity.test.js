// Đợt bám handoff: nhận xét cặp, so với TB, đổi chỗ vòng đầu, độ cân bảng, lượt miễn, tạo nhanh, mẫu CLB.
import test from 'node:test'
import assert from 'node:assert/strict'
import { teamInsights, vsAverage } from '#lib/tournament/pairing.js'
import { stageEditable, swapOrder } from '#lib/tournament/bracketView.js'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { byesOf, estimateOf, graphOf, groupBalanceOf, quickPlan, stagesFromGraph } from '#lib/tournament/canvas.js'

const r = (id, gender, rating, p = {}) => ({ id, playerId: id, gender, ratingSnapshot: rating, status: 'registered', ...p })
const team = (id, players) => ({ id, players, full: true, sum: players.reduce((s, x) => s + x.ratingSnapshot, 0) })
const keys = (list) => list.map((x) => x.key.split('.').pop())

test('nhận xét cặp: chênh trình, ăn ý / kém ăn ý / chưa đánh chung, có khách, sai luật nam nữ', () => {
  assert.deepEqual(keys(teamInsights(team('t', [r('a', 'nam', 700), r('b', 'nam', 500)]), { genderRule: 'male' })), ['insGap', 'insNoHistory'])
  const played = (win, n) => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, teamA: ['a', 'b'], teamB: ['y', 'z'], winnerTeam: i < win ? 'A' : 'B', ratingEnabled: true }))
  const close = team('t', [r('a', 'nam', 520), r('b', 'nam', 500)])
  assert.deepEqual(keys(teamInsights(close, { genderRule: 'male', history: played(3, 4) })), ['insChemGood'])
  assert.deepEqual(keys(teamInsights(close, { genderRule: 'male', history: played(1, 4) })), ['insChemBad'])
  assert.deepEqual(keys(teamInsights(close, { genderRule: 'male', history: played(1, 2) })), ['insChemMid'])
  const guest = team('t', [r('a', 'nam', 500), r('g', 'nu', 500, { playerType: 'guest' })])
  assert.ok(keys(teamInsights(guest, { genderRule: 'mixed' })).includes('insGuest'))
  assert.equal(teamInsights(team('t', [r('a', 'nam', 500), r('b', 'nam', 500)]), { genderRule: 'mixed' })[0].key, 'tournament.pairing.insMixed')
})

test('so với TB: lệch trung bình quá ngưỡng thì cảnh báo (handoff: tô vàng)', () => {
  const v = vsAverage([team('a', [r('1', 'nam', 600), r('2', 'nam', 600)]), team('b', [r('3', 'nam', 500), r('4', 'nam', 500)]), team('c', [r('5', 'nam', 550), r('6', 'nam', 550)])])
  assert.deepEqual(v.a, { diff: 100, warn: true })
  assert.deepEqual(v.c, { diff: 0, warn: false })
})

test('đổi chỗ vòng đầu: sinh lại kiểu bốc thăm với thứ tự mới → đúng nhánh cũ, chỉ 2 đội đổi chỗ (kể cả khi có bye)', () => {
  const stage = { id: 's', config: { seeding: 'seed', thirdPlace: true }, matchRule: { sets: 1, points: 21, winBy2: true, cap: 30 }, ruleOverrides: {} }
  for (const n of [8, 6, 5]) {
    let k = 0
    const entrants = Array.from({ length: n }, (_, i) => ({ id: 'T' + (i + 1), seed: i + 1 }))
    const before = buildKnockout({ stage, entrants, newId: () => 'a' + k++ })
    const pairs = (ms) => ms.filter((m) => m.round === 0 && m.roundKind !== 'third').sort((a, b) => a.slot - b.slot).map((m) => [m.teamAId, m.teamBId])
    const order = swapOrder(before, 's', 'T1', 'T2')
    const after = buildKnockout({ stage: { ...stage, config: { ...stage.config, seeding: 'slot' } }, entrants: order.map((id, i) => ({ id, drawNo: i + 1 })), newId: () => 'b' + k++ })
    const swap = (id) => (id === 'T1' ? 'T2' : id === 'T2' ? 'T1' : id)
    assert.deepEqual(pairs(after), pairs(before).map((p) => p.map(swap)), `${n} đội`)
  }
  assert.equal(swapOrder([], 's', 'x', 'y'), null)
})

test('nhánh còn sửa được: chưa trận nào có kết quả (bye không tính; "đang đánh" do mở bảng ghi điểm KHÔNG khoá)', () => {
  assert.equal(stageEditable([{ stageId: 's', status: 'bye' }, { stageId: 's', status: 'ready' }], 's'), true)
  assert.equal(stageEditable([{ stageId: 's', status: 'live' }], 's'), true)
  assert.equal(stageEditable([{ stageId: 's', status: 'done' }, { stageId: 'x', status: 'ready' }], 's'), false)
})

const full = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, sum: [1000, 980, 900, 800][i] }))

test('độ cân các bảng: TB từng bảng + lệch; lượt miễn của nhánh', () => {
  const bal = groupBalanceOf({ config: { numGroups: 2, manualGroups: [['a', 'b'], ['c', 'd']] } }, full)
  assert.deepEqual(bal.avgs, [990, 850])
  assert.equal(bal.spread, 140)
  assert.equal(bal.isBalanced, false)
  assert.deepEqual([byesOf(8), byesOf(6), byesOf(5), byesOf(1)], [0, 2, 3, 0])
})

test('tạo nhanh: số cặp mỗi bảng → số bảng; tóm tắt khối / đường nối / trận khớp mẫu', () => {
  const ev = { id: 'e', kind: 'md' }
  assert.deepEqual(quickPlan('rr_ko', ev, 12, 4), { numGroups: 3, advance: 2, blocks: 2, links: 1, matches: 18 + 5 + 1 }, '3 bảng × 6 trận + nhánh 6 đội: 5 trận + tranh 3-4')
  assert.equal(quickPlan('rr_ko_plate', ev, 16, 4).blocks, 3)
  assert.equal(quickPlan('ko', ev, 8).matches, 8)
  assert.equal(quickPlan('rr', ev, 5).numGroups, 1)
})

test('mẫu CLB: lưu hình sơ đồ (bỏ chia bảng tay), dựng lại đúng khối + đường nối', () => {
  const stages = [
    { id: 's1', seq: 1, type: 'round_robin', title: '', config: { numGroups: 2, manualGroups: [['x']] }, matchRule: {}, ruleOverrides: {}, canvasX: 10, canvasY: 20 },
    { id: 's2', seq: 2, type: 'knockout', title: 'Nhánh Vàng', config: { thirdPlace: true }, matchRule: {}, ruleOverrides: {} },
  ]
  const g = graphOf(stages, [{ fromStageId: 's1', toStageId: 's2', ranks: [1, 2] }])
  assert.equal(g.stages[0].config.manualGroups, undefined)
  assert.equal(g.stages[1].title, 'Nhánh Vàng')
  const back = stagesFromGraph(g)
  assert.deepEqual(back.links, [{ fromStageSeq: 1, toStageSeq: 2, ranks: [1, 2] }])
  assert.deepEqual(back.stages.map((s) => [s.seq, s.type, s.status, s.canvasX]), [[1, 'round_robin', 'pending', 10], [2, 'knockout', 'pending', null]])
})

test('mỗi đội đá ít nhất: vòng bảng = bảng nhỏ nhất − 1; loại trực tiếp = 1', () => {
  const mk = (stage, n) => {
    const teams = Array.from({ length: n }, (_, i) => ({ id: 't' + i, eventId: 'e' }))
    return {
      events: [{ id: 'e', teamSize: 1 }], teams, registrations: teams.map((x) => ({ id: x.id + 'r', ratingSnapshot: 500, status: 'registered' })),
      teamPlayers: teams.map((x) => ({ teamId: x.id, registrationId: x.id + 'r' })), stages: [stage], stageLinks: [], courtLabels: [],
    }
  }
  const rr = { id: 's', eventId: 'e', seq: 1, type: 'round_robin', config: { numGroups: 2 }, matchRule: {} }
  assert.equal(estimateOf(mk(rr, 7), { id: 'e' }).minPerTeam, 2, 'bảng 3 + 4 → bảng nhỏ đá 2 trận')
  assert.equal(estimateOf(mk({ ...rr, type: 'knockout', config: {} }, 7), { id: 'e' }).minPerTeam, 1)
})
