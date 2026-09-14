import assert from 'node:assert/strict'
import { buildH2HMatrix, filterMatches, topDisparatePairs, neverMetWithSessionCount, isCloseMatch, isThreeSetMatch, isUpsetMatch } from '#lib/matchSearch.js'
import cfg from '#config/app.json' with { type: 'json' }

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

// 7. Ba tiêu chí chất lượng — một nguồn sự thật cho cả bộ lọc lẫn nhãn trên thẻ trận
const maxDiff = cfg.match.closeMatchMaxDiff
const minGap = cfg.match.upsetMinGap

/* isCloseMatch: chỉ xét sát điểm, KHÔNG kéo theo 'đủ 3 set' */
assert.equal(isCloseMatch({ sets: [[21, 19]] }), true, 'lệch 2 điểm là sát điểm')
assert.equal(isCloseMatch({ sets: [[21, 21 - maxDiff]] }), true, 'đúng ngưỡng vẫn tính')
assert.equal(isCloseMatch({ sets: [[21, 21 - maxDiff - 1]] }), false, 'quá ngưỡng 1 điểm thì thôi')
assert.equal(isCloseMatch({ sets: [[21, 10], [12, 21], [21, 9]] }), false, '3 set nhưng set nào cũng cách biệt')
assert.equal(isCloseMatch({}), false, 'không có sets')
assert.equal(isCloseMatch(null), false, 'không có trận')

/* isThreeSetMatch: đếm set đã đánh, set 0-0 không tính */
assert.equal(isThreeSetMatch({ sets: [[21, 10], [12, 21], [21, 9]] }), true)
assert.equal(isThreeSetMatch({ sets: [[21, 19], [21, 18]] }), false, '2 set thì không')
assert.equal(isThreeSetMatch({ sets: [[21, 19], [21, 18], [0, 0]] }), false, 'set 0-0 chưa đánh, không được đếm')
assert.equal(isThreeSetMatch(null), false)

/* isUpsetMatch: winnerTeam phải tường minh 'A' hoặc 'B' */
const upsetA = { initialRatingA: 100, initialRatingB: 100 + minGap + 50, winnerTeam: 'A' }
const upsetB = { initialRatingA: 100 + minGap + 50, initialRatingB: 100, winnerTeam: 'B' }
assert.equal(isUpsetMatch(upsetA), true, 'kèo dưới A thắng')
assert.equal(isUpsetMatch(upsetB), true, 'kèo dưới B thắng')
assert.equal(isUpsetMatch({ ...upsetA, winnerTeam: 'B' }), false, 'kèo trên thắng thì không bất ngờ')
assert.equal(
  isUpsetMatch({ initialRatingA: 100, initialRatingB: 100 + minGap, winnerTeam: 'A' }),
  false, 'đúng bằng ngưỡng thì chưa tính, phải LỚN HƠN')

// Đây là bug đã sửa: nhánh cũ dùng !aWon nên trận chưa có kết quả bị gán cho đội B
assert.equal(isUpsetMatch({ ...upsetB, winnerTeam: null }), false, 'winnerTeam null KHÔNG được tính là B thắng')
assert.equal(isUpsetMatch({ ...upsetB, winnerTeam: undefined }), false)
assert.equal(isUpsetMatch({ winnerTeam: 'A' }), false, 'không có rating thì lệch = 0, không bất ngờ')

/* filterMatches phải dùng đúng các predicate trên */
const threeSetBlowout = { playerKeys: ['a', 'b', 'c', 'd'], sets: [[21, 10], [12, 21], [21, 9]], winnerTeam: 'A' }
const tightTwoSet = { playerKeys: ['a', 'b', 'c', 'd'], sets: [[21, 19], [21, 20]], winnerTeam: 'A' }
const pool = [threeSetBlowout, tightTwoSet]

const closeOnly = filterMatches(pool, { quality: 'close' })
assert.equal(closeOnly.length, 1, "quality 'close' chỉ lấy trận sát điểm")
assert.equal(closeOnly[0], tightTwoSet)

const threeSetOnly = filterMatches(pool, { quality: 'threeSets' })
assert.equal(threeSetOnly.length, 1, "quality 'threeSets' là bộ lọc RIÊNG")
assert.equal(threeSetOnly[0], threeSetBlowout)

const drawInPool = { playerKeys: ['a', 'b', 'c', 'd'], sets: [[21, 19]], winnerTeam: null, initialRatingA: 100 + minGap + 50, initialRatingB: 100 }
assert.equal(filterMatches([drawInPool], { quality: 'upset' }).length, 0, 'trận chưa có kết quả không lọt bộ lọc bất ngờ')

console.log('matchSearch check: OK')

