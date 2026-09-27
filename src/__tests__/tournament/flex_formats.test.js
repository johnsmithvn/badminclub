// Thể thức linh hoạt với số đội lẻ (mùa 2 có thể khác mùa 1). Ví dụ 10 nam 8 nữ:
// Đôi nam 5 đội · Đôi nữ 4 đội · Đôi nam nữ 8 đội — bảng to bảng nhỏ lệch nhau 1 đội.
import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceCounts, groupSizes, koPreview, rrPreview } from '#lib/tournament/format.js'
import { buildRoundRobin, snakeGroups } from '#lib/tournament/roundRobin.js'
import { groupStandings } from '#lib/tournament/standings.js'
import { entrantsFromLinks } from '#lib/tournament/links.js'
import { buildKnockout } from '#lib/tournament/bracket.js'

const R21 = { sets: 1, points: 21, winBy2: true, cap: 30 }
const teams = (n) => Array.from({ length: n }, (_, i) => ({ id: 'T' + (i + 1), sum: 1000 - i * 10 }))
const rrStage = (numGroups) => ({ id: 's1', config: { numGroups, legs: 1 }, matchRule: R21 })
let seq = 0
const newId = () => 'x' + seq++

/** Vòng bảng → đánh hết (đội rating cao thắng) → chốt hạng → đội vào nhánh theo link. */
function runGroups(n, G, ranks) {
  const groups = snakeGroups(teams(n), G).map((g) => ({ ...g, id: 'g' + g.label }))
  const sum = new Map(teams(n).map((t) => [t.id, t.sum]))
  const matches = buildRoundRobin({ stage: rrStage(G), groups, newId }).map((m) => {
    const w = sum.get(m.teamAId) > sum.get(m.teamBId) ? 'A' : 'B'
    return { ...m, status: 'done', winner: w, sets: [w === 'A' ? [21, 15] : [15, 21]] }
  })
  const groupTeams = groups.flatMap((g) => groupStandings(g, matches).rows.map((r) => ({ groupId: g.id, teamId: r.teamId, finalRank: r.rank })))
  const res = entrantsFromLinks({ link: { ranks }, groups, groupTeams })
  return { groups, matches, groupTeams, ...res }
}

test('cỡ bảng: lệch nhau tối đa 1 đội, khớp đúng chia con rắn', () => {
  assert.deepEqual(groupSizes(5, 2), [3, 2])
  assert.deepEqual(groupSizes(8, 3), [3, 3, 2])
  assert.deepEqual(groupSizes(10, 4), [3, 3, 2, 2])
  assert.deepEqual(groupSizes(7, 2), [3, 4], 'đội thứ 7 rơi vào lượt ngược → bảng B')
  for (const [n, G] of [[5, 2], [8, 3], [10, 4], [7, 2]]) {
    assert.deepEqual(snakeGroups(teams(n), G).map((g) => g.teams.length), groupSizes(n, G), `${n} đội / ${G} bảng`)
  }
})

test('Đôi nam 5 đội: loại trực tiếp 3 bye · vòng tròn 1 bảng 10 trận, mỗi lượt 1 đội nghỉ · 2 bảng 3+2', () => {
  const ko = koPreview(5, { config: { thirdPlace: true }, matchRule: R21, ruleOverrides: {} })
  assert.equal(ko.byes, 3)

  const one = rrPreview(5, rrStage(1))
  assert.equal(one.total, 10)
  assert.equal(one.rounds, 5)
  const ms = buildRoundRobin({ stage: rrStage(1), groups: [{ id: 'g', teams: teams(5).map((t) => t.id) }], newId })
  for (let r = 0; r < 5; r++) {
    const ids = ms.filter((m) => m.round === r).flatMap((m) => [m.teamAId, m.teamBId])
    assert.equal(ids.length, 4, 'lượt nào cũng 2 trận, 1 đội nghỉ')
    assert.equal(new Set(ids).size, 4, 'không đội nào đánh 2 trận một lượt')
  }

  assert.equal(rrPreview(5, rrStage(2)).total, 3 + 1)
  // Lấy nhất nhì mỗi bảng: bảng 2 đội thì cả bảng đi tiếp — vẫn ra đủ 4 đội cho bán kết.
  assert.deepEqual(advanceCounts(5, 2, 2), { main: 4, plate: 0 })
  const { entrants, error } = runGroups(5, 2, [1, 2])
  assert.equal(error, null)
  assert.equal(entrants.length, 4)
})

test('Đôi nam nữ 8 đội, 3 bảng (3+3+2): nhánh chính 6 đội, nhánh phụ "mọi đội còn lại" 2 đội', () => {
  assert.deepEqual(advanceCounts(8, 3, 2, 'all'), { main: 6, plate: 2 })
  assert.deepEqual(advanceCounts(8, 3, 2, 1), { main: 6, plate: 2 })
  assert.deepEqual(advanceCounts(8, 3, 1, 2), { main: 3, plate: 5 })

  const main = runGroups(8, 3, [1, 2])
  assert.equal(main.error, null)
  assert.equal(main.entrants.length, 6)
  const groupOf = new Map(main.groups.flatMap((g) => g.teams.map((t) => [t.teamId, g.label])))
  const ko = buildKnockout({ stage: { id: 's2', config: { seeding: 'seed' }, matchRule: R21, ruleOverrides: {} }, entrants: main.entrants, newId })
  ko.filter((m) => m.round === 0 && m.teamAId && m.teamBId).forEach((m) => {
    assert.notEqual(groupOf.get(m.teamAId), groupOf.get(m.teamBId), 'không gặp đội cùng bảng ngay vòng đầu')
  })

  // Nhánh phụ lấy "mọi đội còn lại" (hạng 3..18): bảng 2 đội không có hạng 3 → bỏ qua, không lỗi.
  const plate = runGroups(8, 3, Array.from({ length: 16 }, (_, i) => i + 3))
  assert.equal(plate.error, null)
  assert.equal(plate.entrants.length, 2)
})

test('Đôi nữ 4 đội, 2 bảng 2+2, nhất vào nhánh chính, nhì vào nhánh phụ: mỗi nhánh 1 trận', () => {
  assert.deepEqual(advanceCounts(4, 2, 1, 1), { main: 2, plate: 2 })
  assert.equal(runGroups(4, 2, [1]).entrants.length, 2)
  assert.equal(runGroups(4, 2, [2]).entrants.length, 2)
})
