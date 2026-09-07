import assert from 'node:assert/strict'
import { buildH2HMatrix, filterMatches, topDisparatePairs, neverMetWithSessionCount } from '#lib/matchSearch.js'

const m1 = {
  id: 'mt1',
  date: '2026-09-01',
  playerKeys: ['p1', 'p2', 'p3', 'p4'],
  sets: [[21, 19], [21, 18]],
  winnerTeam: 'A',
  initialRatingA: 100,
  initialRatingB: 100,
}

const m2 = {
  id: 'mt2',
  date: '2026-09-02',
  playerKeys: ['p1', 'p3', 'p2', 'p4'],
  sets: [[21, 15], [21, 12]],
  winnerTeam: 'A',
  initialRatingA: 50,
  initialRatingB: 200, // Upset: A thấp hơn B 150 điểm nhưng A thắng
}

// 1. Lọc theo đối đầu
const h2h = filterMatches([m1, m2], { playerA: 'p1', playerB: 'p3', mode: 'h2h' })
assert.equal(h2h.length, 1, 'Chỉ có m1 là p1 đối đầu p3')
assert.equal(h2h[0].id, 'mt1')

// 2. Lọc theo đồng đội
const team = filterMatches([m1, m2], { playerA: 'p1', playerB: 'p3', mode: 'teammate' })
assert.equal(team.length, 1, 'Chỉ có m2 là p1 cùng đội p3')
assert.equal(team[0].id, 'mt2')

// 3. Lọc upset
const upset = filterMatches([m1, m2], { quality: 'upset' })
assert.equal(upset.length, 1, 'Chỉ m2 là trận bất ngờ (upset)')
assert.equal(upset[0].id, 'mt2')

// 4. Ma trận đối đầu
const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }]
const { matrix, neverMet } = buildH2HMatrix(members, [m1])
assert.equal(matrix.p1.p3.wins, 1, 'p1 thắng p3 1 trận trong m1')
assert.equal(matrix.p3.p1.losses, 1, 'p3 thua p1 1 trận trong m1')

// 5. Cặp lệch nhất (topDisparatePairs)
const dispPairs = topDisparatePairs(matrix, members, 3)
assert.ok(dispPairs.length > 0, 'Có ít nhất 1 cặp lệch')
assert.equal(dispPairs[0].disparity, 1)

// 6. Cặp chưa gặp kèm số buổi cùng tham gia (neverMetWithSessionCount)
const sessions = [
  { id: 's1', participantIds: ['p1', 'p2'] },
  { id: 's2', participantIds: ['p1', 'p2'] },
]
const scoredNeverMet = neverMetWithSessionCount(neverMet, { sessions })
const p1p2 = scoredNeverMet.find((x) => (x.p1 === 'p1' && x.p2 === 'p2') || (x.p1 === 'p2' && x.p2 === 'p1'))
assert.ok(p1p2, 'Tìm thấy cặp p1-p2 chưa từng gặp đối đầu')
assert.equal(p1p2.commonSessionsCount, 2, 'Cùng đi 2 buổi')

console.log('matchSearch check: OK')

