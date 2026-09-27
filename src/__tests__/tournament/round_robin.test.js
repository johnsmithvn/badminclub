import test from 'node:test'
import assert from 'node:assert/strict'
import { snakeGroups, calcGroupBalance, circleMatches, buildRoundRobin } from '#lib/tournament/roundRobin.js'

test('snakeGroups: phân bổ con rắn vào 2 bảng và 3 bảng', () => {
  const teams8 = Array.from({ length: 8 }, (_, i) => ({ id: `T${i + 1}`, sum: 500 - i * 10 }))
  const g2 = snakeGroups(teams8, 2)
  assert.equal(g2.length, 2)
  assert.equal(g2[0].label, 'A')
  assert.equal(g2[1].label, 'B')
  // Bảng A: T1 (hạt giống 1), T4 (4), T5 (5), T8 (8)
  assert.deepEqual(g2[0].teams.map((t) => t.teamId), ['T1', 'T4', 'T5', 'T8'])
  // Bảng B: T2 (2), T3 (3), T6 (6), T7 (7)
  assert.deepEqual(g2[1].teams.map((t) => t.teamId), ['T2', 'T3', 'T6', 'T7'])
  assert.deepEqual(g2[0].teams.map((t) => t.seedInGroup), [1, 2, 3, 4])
  assert.deepEqual(g2[1].teams.map((t) => t.seedInGroup), [1, 2, 3, 4])

  // 12 đội vào 3 bảng
  const teams12 = Array.from({ length: 12 }, (_, i) => ({ id: `T${i + 1}`, sum: 600 - i * 10 }))
  const g3 = snakeGroups(teams12, 3)
  assert.deepEqual(g3[0].teams.map((t) => t.teamId), ['T1', 'T6', 'T7', 'T12'])
  assert.deepEqual(g3[1].teams.map((t) => t.teamId), ['T2', 'T5', 'T8', 'T11'])
  assert.deepEqual(g3[2].teams.map((t) => t.teamId), ['T3', 'T4', 'T9', 'T10'])
})

test('calcGroupBalance: lệch rating TRUNG BÌNH giữa các bảng, ngưỡng cân <= 15', () => {
  const balanced = [
    { teams: [{ sum: 500 }, { sum: 470 }] }, // tb 485
    { teams: [{ sum: 490 }, { sum: 470 }] }, // tb 480 -> lệch 5
  ]
  const resB = calcGroupBalance(balanced)
  assert.equal(resB.min, 480)
  assert.equal(resB.max, 485)
  assert.equal(resB.spread, 5)
  assert.equal(resB.isBalanced, true)

  const unbalanced = [
    { teams: [{ sum: 520 }, { sum: 510 }] }, // tb 515
    { teams: [{ sum: 450 }, { sum: 460 }] }, // tb 455 -> lệch 60
  ]
  const resU = calcGroupBalance(unbalanced)
  assert.equal(resU.spread, 60)
  assert.equal(resU.isBalanced, false)

  // 7 đội chia 4 + 3: cùng trình độ thì phải "cân" — tính theo tổng sẽ lệch 500 và báo sai.
  const uneven = [
    { teams: [{ sum: 500 }, { sum: 500 }, { sum: 500 }, { sum: 500 }] },
    { teams: [{ sum: 500 }, { sum: 500 }, { sum: 500 }] },
  ]
  assert.equal(calcGroupBalance(uneven).spread, 0)
  assert.equal(calcGroupBalance(uneven).isBalanced, true)
})

test('snakeGroups: tự xếp theo rating trước khi chia (đầu vào đang theo số bốc thăm)', () => {
  const byDraw = [{ id: 'W', sum: 400 }, { id: 'S', sum: 600 }, { id: 'M2', sum: 450 }, { id: 'M1', sum: 550 }]
  const g = snakeGroups(byDraw, 2)
  assert.deepEqual(g[0].teams.map((t) => t.teamId), ['S', 'W'])
  assert.deepEqual(g[1].teams.map((t) => t.teamId), ['M1', 'M2'])
})

test('circleMatches: thuật toán Berger cho số đội chẵn và lẻ, 1 hoặc 2 lượt', () => {
  // 4 đội chẵn: 3 vòng, 2 trận/vòng, tổng 6 trận. Không ai đánh 2 trận trong 1 vòng
  const m4 = circleMatches(['A', 'B', 'C', 'D'], 1)
  assert.equal(m4.length, 6)
  const byRound4 = {}
  m4.forEach((m) => {
    byRound4[m.round] = byRound4[m.round] || []
    byRound4[m.round].push(m)
  })
  assert.equal(Object.keys(byRound4).length, 3)
  Object.values(byRound4).forEach((roundMs) => {
    assert.equal(roundMs.length, 2)
    const involved = new Set()
    roundMs.forEach((m) => {
      assert.ok(!involved.has(m.teamAId))
      assert.ok(!involved.has(m.teamBId))
      involved.add(m.teamAId)
      involved.add(m.teamBId)
    })
    assert.equal(involved.size, 4)
  })

  // 3 đội lẻ: 3 vòng, mỗi vòng 1 trận, 1 đội nghỉ (không có dummy)
  const m3 = circleMatches(['A', 'B', 'C'], 1)
  assert.equal(m3.length, 3)
  const byRound3 = {}
  m3.forEach((m) => {
    byRound3[m.round] = byRound3[m.round] || []
    byRound3[m.round].push(m)
  })
  assert.equal(Object.keys(byRound3).length, 3)
  Object.values(byRound3).forEach((roundMs) => {
    assert.equal(roundMs.length, 1)
  })

  // 4 đội 2 lượt: 12 trận, lượt về đảo teamAId và teamBId
  const m4legs2 = circleMatches(['A', 'B', 'C', 'D'], 2)
  assert.equal(m4legs2.length, 12)
  const leg1 = m4legs2.slice(0, 6)
  const leg2 = m4legs2.slice(6)
  leg1.forEach((m1, idx) => {
    const m2 = leg2[idx]
    assert.equal(m2.round, m1.round + 3)
    assert.equal(m2.teamAId, m1.teamBId)
    assert.equal(m2.teamBId, m1.teamAId)
  })
})

test('buildRoundRobin: sinh cấu trúc trận vòng bảng hợp lệ', () => {
  let counter = 0
  const newId = () => `rr_${++counter}`
  const stage = {
    id: 'stg-1',
    matchRule: { sets: 1, points: 21, winBy2: true, cap: 30 },
  }
  const groups = [
    {
      id: 'grp-a',
      label: 'A',
      teams: [
        { teamId: 'T1', seedInGroup: 1 },
        { teamId: 'T2', seedInGroup: 2 },
        { teamId: 'T3', seedInGroup: 3 },
      ],
    },
    {
      id: 'grp-b',
      label: 'B',
      teams: [
        { teamId: 'T4', seedInGroup: 1 },
        { teamId: 'T5', seedInGroup: 2 },
        { teamId: 'T6', seedInGroup: 3 },
      ],
    },
  ]

  const matches = buildRoundRobin({ stage, groups, legs: 1, newId })
  assert.equal(matches.length, 6, 'Mỗi bảng 3 trận = tổng 6 trận')
  matches.forEach((m) => {
    assert.ok(m.id.startsWith('rr_'))
    assert.equal(m.stageId, 'stg-1')
    assert.ok(m.groupId === 'grp-a' || m.groupId === 'grp-b')
    assert.equal(m.roundKind, 'group')
    assert.equal(m.status, 'ready')
    assert.equal(m.rule.points, 21)
    assert.deepEqual(m.sets, [])
    assert.equal(m.winner, null)
    assert.equal(m.nextMatchId, null)
    assert.equal(m.sourceA.kind, 'seed')
    assert.equal(m.sourceB.kind, 'seed')
  })
})
