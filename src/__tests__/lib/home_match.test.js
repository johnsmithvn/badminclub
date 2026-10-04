// Số liệu tab "Sân đấu" ở trang chủ. Trước đây nhiều ô in số cứng: điểm chia sân 84, "tháng trước 17%",
// cảnh báo "4 người trên 1650 / 2 người dưới 1500" (thang Elo cũ, CLB đang ở ~100–700), % dự đoán bịa.
import assert from 'node:assert/strict'
import { matchMonthOf, closeRate, ratingSpread, avgCourtBalance, pickWatchable, neverMetForViewer, monthRivals } from '../../lib/homeMatch.js'
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

// Trận đáng xem: CHỈ trận có video; kèo dưới thắng (isUpsetMatch) + trận sát / 3 set; không có thì trận gần đây gắn 'recent'
const v = 'https://youtu.be/x'
const up = { id: 'u', videoUrl: v, initialRatingA: 300, initialRatingB: 600, winnerTeam: 'A', sets: [[21, 15]] }
const close = { id: 'c', videoUrl: v, initialRatingA: 500, initialRatingB: 500, winnerTeam: 'A', sets: [[22, 20]] }
const three = { id: 't', videoUrl: v, initialRatingA: 500, initialRatingB: 500, winnerTeam: 'B', sets: [[21, 10], [10, 21], [15, 21]] }
const dull = { id: 'd', videoUrl: v, initialRatingA: 500, initialRatingB: 520, winnerTeam: 'B', sets: [[10, 21]] }
const closeNoVideo = { ...close, id: 'cn', videoUrl: '' }
const w = pickWatchable([dull, close, closeNoVideo, up, three])
assert.deepEqual(w.map((x) => [x.match.id, x.type]), [['u', 'upset'], ['c', 'close'], ['t', 'close']])
assert.equal(w[0].gap, 300)
assert.equal(w[1].minDiff, 2)
const fallback = pickWatchable([dull])
assert.deepEqual(fallback.map((x) => [x.match.id, x.type]), [['d', 'recent']], 'không giả làm trận sát điểm')
assert.equal(pickWatchable([]).length, 0)
assert.equal(pickWatchable([closeNoVideo, { ...up, videoUrl: null }]).length, 0, 'trận không video không lên, kể cả bất ngờ / sát')

// Cặp chưa gặp: cặp của người xem lên trước (giữ thứ tự số buổi), thiếu mới bù cặp khác
const scored = [
  { p1: 'a', p2: 'b', commonSessionsCount: 9 },
  { p1: 'me', p2: 'c', commonSessionsCount: 5 },
  { p1: 'd', p2: 'e', commonSessionsCount: 4 },
  { p1: 'f', p2: 'me', commonSessionsCount: 1 },
]
assert.deepEqual(neverMetForViewer(scored, 'me', 3).map((p) => [p.p1, p.p2, p.isMine]),
  [['me', 'c', true], ['f', 'me', true], ['a', 'b', false]])
assert.deepEqual(neverMetForViewer(scored, null, 2).map((p) => p.p1), ['a', 'me'], 'không đăng nhập → giữ thứ tự cả CLB')
assert.ok(neverMetForViewer(scored, null, 9).every((p) => p.isMine === false))

// Kình địch: đếm 4 cặp chéo mỗi trận đôi, tối thiểu minMeetings; gặp nhiều trước, cùng số lần thì sát hơn trước
const M = (teamA, teamB, winnerTeam) => ({ teamA, teamB, winnerTeam })
const rivals = monthRivals([
  M(['a', 'b'], ['c', 'd'], 'A'),
  M(['a', 'b'], ['c', 'd'], 'B'),
  M(['a', 'x'], ['c', 'y'], 'B'),
  M(['e'], ['f'], 'A'),
  M(['e'], ['f'], 'A'),
  M(['a'], ['c'], null),
], { minMeetings: 2, limit: 9 })
assert.deepEqual(rivals[0], { p1: 'c', p2: 'a', total: 3, w1: 2, w2: 1 }, 'a–c gặp 3 lần, c thắng 2 → c đứng trước')
assert.deepEqual(rivals.slice(1, 5).map((r) => [r.p1, r.p2, r.w1, r.w2]).sort(),
  [['a', 'd', 1, 1], ['b', 'c', 1, 1], ['b', 'd', 1, 1], ['e', 'f', 2, 0]].sort())
assert.deepEqual(rivals.slice(1, 4).map((r) => r.w1 - r.w2), [0, 0, 0], '2 lần gặp: 1–1 xếp trên 2–0')
assert.equal(rivals.length, 5, 'cặp gặp 1 lần (a–y, x–c, x–y) và trận chưa có kết quả bị bỏ')
assert.equal(monthRivals([], { minMeetings: 2, limit: 6 }).length, 0)

console.log('home_match.test.js: OK')
