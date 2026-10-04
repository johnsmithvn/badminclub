// Số liệu vẽ thẻ kèo — dùng chung cho thẻ kèo ở trang Trận đấu (ArenaChallengeCard) và khung kèo của buổi.
import assert from 'node:assert/strict'
import { challengeOdds, challengeResultOf } from '../../lib/challenge.js'
import { expectedScore } from '../../lib/rating.js'

const R = { a1: 1000, a2: 1200, b1: 900, b2: 1100 }
const rating = (id) => R[id]

// Tỉ lệ: TB đội (làm tròn), độ chênh, % thắng của A theo Elo, B là phần còn lại
const o = challengeOdds(['a1', 'a2'], ['b1', 'b2'], rating)
assert.equal(o.ratA, 1100)
assert.equal(o.ratB, 1000)
assert.equal(o.gap, 100)
assert.equal(o.pctA, Math.round(expectedScore(1100, 1000) * 100))
assert.equal(o.pctA + o.pctB, 100)
// Kèo mở (chưa có đội B): so A với chính nó → 50/50, độ chênh = TB đội A
const open = challengeOdds(['a1'], [], rating)
assert.deepEqual(open, { ratA: 1000, ratB: 0, gap: 1000, pctA: 50, pctB: 50 })
assert.deepEqual(challengeOdds([], [], rating), { ratA: 0, ratB: 0, gap: 0, pctA: 50, pctB: 50 })

// Kết quả kèo BO1 đã đánh: tỉ số ván đầu theo phía A/B, đội thắng lấy từ trận
const c1 = { id: 'c1', bestOf: 1, status: 'played', matchId: 'm1', teamA: ['a1'], teamB: ['b1'] }
const m1 = { id: 'm1', challengeId: 'c1', sets: [[17, 21]], winnerTeam: 'B', teamA: ['a1'], teamB: ['b1'], at: 1 }
const r1 = challengeResultOf(c1, [m1])
assert.equal(r1.isBoSeries, false)
assert.equal(r1.seriesProg, null)
assert.equal(r1.hasPlayedSets, null, 'BO1: không có tiến độ chuỗi (giữ đúng giá trị cũ: null)')
assert.equal(r1.winnerTeam, 'B')
assert.equal(r1.firstMatch, m1)
assert.equal(r1.singleScoreA, 17)
assert.equal(r1.singleScoreB, 21)

// Trận cũ chỉ có scoreText "21 - 15"
const r2 = challengeResultOf({ ...c1, matchId: 'm2' }, [{ id: 'm2', scoreText: '21 - 15' }])
assert.equal(r2.singleScoreA, 21)
assert.equal(r2.singleScoreB, 15)

// Chưa đánh: không có tỉ số, đội thắng theo kèo (nếu có)
const r3 = challengeResultOf({ id: 'c3', bestOf: 1, status: 'accepted', winnerTeam: null }, [])
assert.equal(r3.firstMatch, null)
assert.equal(r3.singleScoreA, null)
assert.equal(r3.singleScoreB, null)
assert.equal(r3.winnerTeam, null)

// BO3 đang dở 1-0: có tiến độ chuỗi, đã có set đánh
const c4 = { id: 'c4', bestOf: 3, status: 'accepted', teamA: ['a1'], teamB: ['b1'] }
const r4 = challengeResultOf(c4, [{ id: 'x1', challengeId: 'c4', sets: [[21, 18]], winnerTeam: 'A', teamA: ['a1'], teamB: ['b1'], at: 5 }])
assert.equal(r4.isBoSeries, true)
assert.equal(r4.hasPlayedSets, true)
assert.equal(r4.seriesProg.winsA, 1)
assert.equal(r4.chalProg, r4.seriesProg, 'BO3: chalProg chính là tiến độ chuỗi')
assert.equal(r4.playedMts.length, 1)
assert.equal(r4.singleScoreA, 21)

console.log('challenge_card.test.js: OK')
