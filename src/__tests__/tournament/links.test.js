import test from 'node:test'
import assert from 'node:assert/strict'
import { entrantsFromLinks } from '#lib/tournament/links.js'
import { buildKnockout } from '#lib/tournament/bracket.js'

test('entrantsFromLinks: 2 bảng lấy Nhất Nhì -> chéo nhánh A1-B2 và B1-A2', () => {
  const link = { fromStageId: 'stg-1', toStageId: 'stg-2', ranks: [1, 2] }
  const groups = [
    { id: 'grp-a', seq: 1, label: 'A' },
    { id: 'grp-b', seq: 2, label: 'B' },
  ]
  const groupTeams = [
    { groupId: 'grp-a', teamId: 'A1', finalRank: 1 },
    { groupId: 'grp-a', teamId: 'A2', finalRank: 2 },
    { groupId: 'grp-b', teamId: 'B1', finalRank: 1 },
    { groupId: 'grp-b', teamId: 'B2', finalRank: 2 },
  ]

  const { entrants, error } = entrantsFromLinks({ link, groups, groupTeams })
  assert.equal(error, null)
  assert.equal(entrants.length, 4)

  assert.deepEqual(entrants, [
    { id: 'A1', seed: 1 },
    { id: 'B1', seed: 2 },
    { id: 'A2', seed: 3 },
    { id: 'B2', seed: 4 },
  ])

  // Dựng nhánh knockout 4 đội từ entrants này
  let counter = 0
  const stage = { id: 'stg-2', matchRule: { sets: 1, points: 21, winBy2: true, cap: 30 } }
  const matches = buildKnockout({ stage, entrants, newId: () => `m${++counter}` })

  const sf = matches.filter((m) => m.roundKind === 'sf')
  assert.equal(sf.length, 2)
  // Bán kết 1: A1 vs B2 (hạt giống 1 vs 4)
  assert.equal(sf[0].teamAId, 'A1')
  assert.equal(sf[0].teamBId, 'B2')
  // Bán kết 2: B1 vs A2 (hạt giống 2 vs 3)
  assert.equal(sf[1].teamAId, 'B1')
  assert.equal(sf[1].teamBId, 'A2')
})

test('entrantsFromLinks: 4 bảng lấy Nhất Nhì -> xoay G/2 tách 2 nửa nhánh khác nhau', () => {
  const link = { fromStageId: 'stg-1', toStageId: 'stg-2', ranks: [1, 2] }
  const groups = [
    { id: 'grp-a', seq: 1, label: 'A' },
    { id: 'grp-b', seq: 2, label: 'B' },
    { id: 'grp-c', seq: 3, label: 'C' },
    { id: 'grp-d', seq: 4, label: 'D' },
  ]
  const groupTeams = [
    { groupId: 'grp-a', teamId: 'A1', finalRank: 1 },
    { groupId: 'grp-a', teamId: 'A2', finalRank: 2 },
    { groupId: 'grp-b', teamId: 'B1', finalRank: 1 },
    { groupId: 'grp-b', teamId: 'B2', finalRank: 2 },
    { groupId: 'grp-c', teamId: 'C1', finalRank: 1 },
    { groupId: 'grp-c', teamId: 'C2', finalRank: 2 },
    { groupId: 'grp-d', teamId: 'D1', finalRank: 1 },
    { groupId: 'grp-d', teamId: 'D2', finalRank: 2 },
  ]

  const { entrants, error } = entrantsFromLinks({ link, groups, groupTeams })
  assert.equal(error, null)
  assert.equal(entrants.length, 8)

  assert.deepEqual(entrants, [
    { id: 'A1', seed: 1 },
    { id: 'B1', seed: 2 },
    { id: 'C1', seed: 3 },
    { id: 'D1', seed: 4 },
    { id: 'C2', seed: 5 },
    { id: 'D2', seed: 6 },
    { id: 'A2', seed: 7 },
    { id: 'B2', seed: 8 },
  ])

  // Dựng nhánh knockout 8 đội từ entrants
  let counter = 0
  const stage = { id: 'stg-2', matchRule: { sets: 1, points: 21, winBy2: true, cap: 30 } }
  const matches = buildKnockout({ stage, entrants, newId: () => `m${++counter}` })

  const qf = matches.filter((m) => m.roundKind === 'qf')
  assert.equal(qf.length, 4)
  // TK 1: 1 vs 8 = A1 vs B2
  assert.equal(qf[0].teamAId, 'A1')
  assert.equal(qf[0].teamBId, 'B2')
  // TK 2: 4 vs 5 = D1 vs C2
  assert.equal(qf[1].teamAId, 'D1')
  assert.equal(qf[1].teamBId, 'C2')
  // TK 3: 2 vs 7 = B1 vs A2
  assert.equal(qf[2].teamAId, 'B1')
  assert.equal(qf[2].teamBId, 'A2')
  // TK 4: 3 vs 6 = C1 vs D2
  assert.equal(qf[3].teamAId, 'C1')
  assert.equal(qf[3].teamBId, 'D2')

  // Kiểm tra nửa trên: TK1 và TK2 dẫn vào Bán kết 1
  const topTeams = new Set([qf[0].teamAId, qf[0].teamBId, qf[1].teamAId, qf[1].teamBId])
  assert.deepEqual(Array.from(topTeams).sort(), ['A1', 'B2', 'C2', 'D1'])
  // Không có 2 đội nào cùng bảng ở nửa trên:
  assert.ok(!topTeams.has('A2'))
  assert.ok(!topTeams.has('B1'))
  assert.ok(!topTeams.has('C1'))
  assert.ok(!topTeams.has('D2'))

  // Nửa dưới: TK3 và TK4 dẫn vào Bán kết 2
  const bottomTeams = new Set([qf[2].teamAId, qf[2].teamBId, qf[3].teamAId, qf[3].teamBId])
  assert.deepEqual(Array.from(bottomTeams).sort(), ['A2', 'B1', 'C1', 'D2'])
})

test('entrantsFromLinks: kiểm tra lỗi khi thiếu bảng hoặc chưa chốt hạng', () => {
  // Thiếu rank
  const res1 = entrantsFromLinks({ link: { ranks: [] }, groups: [], groupTeams: [] })
  assert.equal(res1.error, 'tournament.err.invalidLink')

  // Chưa có bảng
  const res2 = entrantsFromLinks({ link: { ranks: [1] }, groups: [], groupTeams: [] })
  assert.equal(res2.error, 'tournament.err.noGroups')

  // Chưa xếp hạng đủ
  const groups = [{ id: 'g1', seq: 1 }]
  const res3 = entrantsFromLinks({
    link: { ranks: [1, 2] },
    groups,
    groupTeams: [{ groupId: 'g1', teamId: 'T1', finalRank: 1 }],
  })
  assert.equal(res3.error, 'tournament.err.rankNotAssigned')
})

test('entrantsFromLinks: nhánh phụ lấy hạng 3–4, bảng 3 đội không có hạng 4 → bỏ qua, không chặn', () => {
  const link = { fromStageId: 's1', toStageId: 's3', ranks: [3, 4] }
  const groups = [{ id: 'gA', seq: 1 }, { id: 'gB', seq: 2 }]
  const groupTeams = [
    ...['A1', 'A2', 'A3', 'A4'].map((id, i) => ({ groupId: 'gA', teamId: id, finalRank: i + 1 })),
    ...['B1', 'B2', 'B3'].map((id, i) => ({ groupId: 'gB', teamId: id, finalRank: i + 1 })),
  ]
  const { entrants, error } = entrantsFromLinks({ link, groups, groupTeams })
  assert.equal(error, null)
  assert.deepEqual(entrants.map((e) => e.id), ['A3', 'B3', 'A4'])
  assert.deepEqual(entrants.map((e) => e.seed), [1, 2, 3])

  // Bảng đủ 4 đội mà hạng 4 chưa chốt → vẫn là lỗi.
  const unclosed = groupTeams.map((gt) => (gt.teamId === 'A4' ? { ...gt, finalRank: null } : gt))
  assert.equal(entrantsFromLinks({ link, groups, groupTeams: unclosed }).error, 'tournament.err.rankNotAssigned')
})

test('entrantsFromLinks: 2/3/4 bảng lấy nhất nhì → đội cùng bảng không gặp nhau vòng đầu, ở 2 nửa nhánh', () => {
  const R = { sets: 1, points: 21, winBy2: true, cap: 30 }
  for (const G of [2, 3, 4]) {
    const labels = 'ABCD'.slice(0, G).split('')
    const groups = labels.map((l, i) => ({ id: l, seq: i + 1 }))
    const groupTeams = labels.flatMap((l) => [1, 2].map((r) => ({ groupId: l, teamId: l + r, finalRank: r })))
    const { entrants } = entrantsFromLinks({ link: { ranks: [1, 2] }, groups, groupTeams })
    let n = 0
    const ms = buildKnockout({ stage: { id: 's', config: { seeding: 'seed' }, matchRule: R, ruleOverrides: {} }, entrants, newId: () => 'x' + n++ })
    const first = ms.filter((m) => m.round === 0).sort((a, b) => a.slot - b.slot)
    first.forEach((m) => {
      if (m.teamAId && m.teamBId) assert.notEqual(m.teamAId[0], m.teamBId[0], `${G} bảng: ${m.teamAId} gặp ${m.teamBId} ngay vòng đầu`)
    })
    const half = (id) => (first.findIndex((m) => m.teamAId === id || m.teamBId === id) < first.length / 2 ? 'top' : 'bottom')
    labels.forEach((l) => assert.notEqual(half(l + '1'), half(l + '2'), `${G} bảng: ${l}1 và ${l}2 cùng nửa nhánh`))
  }
})
