// Số liệu tab "Sân đấu" ở trang chủ. Trước đây nhiều ô in số cứng: điểm chia sân 84, "tháng trước 17%",
// cảnh báo "4 người trên 1650 / 2 người dưới 1500" (thang Elo cũ, CLB đang ở ~100–700), % dự đoán bịa.
import assert from 'node:assert/strict'
import { matchMonthOf, closeRate, ratingSpread, avgCourtBalance, pickWatchable } from '../../lib/homeMatch.js'
import { IMBALANCE_THRESHOLD } from '../../lib/rating.js'
import { isoOf } from '../../utils/dates.js'

// Tháng của trận theo giờ ĐỊA PHƯƠNG (toISOString là UTC → trận 0–7h sáng giờ VN bị lùi sang tháng trước)
const localMidnightOct1 = new Date(2026, 9, 1, 0, 30).getTime()
assert.equal(matchMonthOf({ at: localMidnightOct1 }), isoOf(new Date(localMidnightOct1)).slice(0, 7))
assert.equal(matchMonthOf({ at: localMidnightOct1 }), '2026-10')
assert.equal(matchMonthOf({ createdAt: '2026-09-15' }), '2026-09')
assert.equal(matchMonthOf({}), '')

// Tỉ lệ trận sát: theo isCloseMatch (chênh ≤ 3); không có trận → null (không bịa 23%)
assert.equal(closeRate([]), null)
assert.equal(closeRate([{ sets: [[21, 18]] }, { sets: [[21, 10]] }, { sets: [[22, 20]] }, { sets: [[21, 5]] }]), 50)

// Phân bố rating: 9 cột, cột đông nhất là khoảng THẬT, độ chênh mạnh–yếu, lệch trình theo IMBALANCE_THRESHOLD
assert.equal(ratingSpread([]), null)
const sp = ratingSpread([300, 310, 320, 330, 600])
assert.equal(sp.minR, 300)
assert.equal(sp.maxR, 600)
assert.equal(sp.bins.length, 9)
assert.equal(sp.bins.reduce((n, b) => n + b.count, 0), 5)
assert.equal(sp.maxBinCount, 4)
assert.deepEqual([sp.peak.min, sp.peak.max], [sp.bins[0].min, sp.bins[0].max], 'cột đông nhất là cột đầu (4 người 300–330)')
assert.equal(sp.gap, 300)
assert.equal(sp.imbalanced, 300 > IMBALANCE_THRESHOLD)
assert.equal(ratingSpread([500, 520, 540]).imbalanced, false)

// Điểm chia sân: TB điểm cân sân các trận ĐÔI (bỏ trận đơn), đếm số buổi; chưa có trận đôi → null
const R = { a: 500, b: 500, c: 500, d: 500, e: 900, f: 100 }
const bal = avgCourtBalance([
  { sessionId: 's1', teamA: ['a', 'b'], teamB: ['c', 'd'] },
  { sessionId: 's2', teamA: ['a', 'b'], teamB: ['c', 'd'] },
  { sessionId: 's2', teamA: ['a'], teamB: ['c'] },
], R)
assert.equal(bal.sessionCount, 2)
assert.ok(bal.score >= 0 && bal.score <= 100)
const lopsided = avgCourtBalance([{ sessionId: 's1', teamA: ['e', 'a'], teamB: ['f', 'b'] }], R)
assert.ok(lopsided.score < bal.score, 'sân lệch (900+500 vs 100+500) điểm thấp hơn sân đều')
assert.deepEqual(avgCourtBalance([{ sessionId: 's1', teamA: ['a'], teamB: ['c'] }], R), { score: null, sessionCount: 0 })

// Trận đáng xem: kèo dưới thắng (isUpsetMatch) + trận sát / 3 set; không có thì trận gần đây gắn 'recent'
const up = { id: 'u', initialRatingA: 300, initialRatingB: 600, winnerTeam: 'A', sets: [[21, 15]] }
const close = { id: 'c', initialRatingA: 500, initialRatingB: 500, winnerTeam: 'A', sets: [[22, 20]] }
const three = { id: 't', initialRatingA: 500, initialRatingB: 500, winnerTeam: 'B', sets: [[21, 10], [10, 21], [15, 21]] }
const dull = { id: 'd', initialRatingA: 500, initialRatingB: 520, winnerTeam: 'B', sets: [[10, 21]] }
const w = pickWatchable([dull, close, up, three])
assert.deepEqual(w.map((x) => [x.match.id, x.type]), [['u', 'upset'], ['c', 'close'], ['t', 'close']])
assert.equal(w[0].gap, 300)
assert.equal(w[1].minDiff, 2)
const fallback = pickWatchable([dull])
assert.deepEqual(fallback.map((x) => [x.match.id, x.type]), [['d', 'recent']], 'không giả làm trận sát điểm')
assert.equal(pickWatchable([]).length, 0)

console.log('home_match.test.js: OK')
