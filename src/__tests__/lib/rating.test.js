import assert from 'node:assert/strict'
import {
  calcEloDelta,
  confidenceOf,
  DEFAULT_RATING,
  expectedScore,
  replayRatingCascade,
  teamRating,
} from '#lib/rating.js'

// 1. Mức khởi điểm mặc định
assert.equal(DEFAULT_RATING, 0, 'Mức rating khởi điểm phải là 0 theo cấu hình yêu cầu')

// 2. Dự đoán xác suất thắng Elo
const evenWin = expectedScore(1000, 1000)
assert.equal(evenWin, 0.5, 'Hai bên bằng điểm nhau thì xác suất thắng mỗi bên phải là 50%')

const higherWin = expectedScore(1400, 1000)
assert.ok(higherWin > 0.9, 'Bên cao hơn 400 điểm Elo phải có tỷ lệ thắng áp đảo > 90%')

// 3. Team rating
const tRat = teamRating(['p1', 'p2'], { p1: 100, p2: 200 })
assert.equal(tRat, 150, 'Rating của đội phải là trung bình cộng của các thành viên')

// 4. Biến thiên Elo khi thắng/thua
const { deltaA, deltaB } = calcEloDelta(1000, 1000, true, 32)
assert.equal(deltaA, 16, 'Thắng khi cân trình phải được cộng 16 điểm (32 * 0.5)')
assert.equal(deltaB, -16, 'Thua khi cân trình phải bị trừ 16 điểm')
assert.equal(deltaA + deltaB, 0, 'Tổng delta Elo của hai đội phải bằng 0 (bảo toàn tổng điểm)')

// 5. Độ tin cậy (Confidence)
assert.equal(confidenceOf(2), 'low', 'Dưới 5 trận độ tin cậy phải là thấp')
assert.equal(confidenceOf(10, 120), 'medium', 'Từ 5 đến 14 trận độ tin cậy là trung bình')
assert.equal(confidenceOf(20, 80), 'high', 'Từ 15 đến 29 trận độ tin cậy là cao')
assert.equal(confidenceOf(35, 50), 'very_high', 'Trên 30 trận độ tin cậy là rất cao')

// 6. Replay rating cascade khi sửa kết quả trận
const members = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }]
const matches = [
  {
    id: 'match1',
    at: 1000,
    playerKeys: ['m1', 'm2', 'm3', 'm4'],
    sets: [[21, 19], [21, 18]],
    winnerTeam: 'A',
    ratingEnabled: true,
  },
]

const { finalRatings, updatedMatches } = replayRatingCascade(matches, 'match1', members)
assert.ok(finalRatings.m1.rating > 0, 'Người thắng trận phải có điểm rating > 0')
assert.ok(finalRatings.m3.rating < 0, 'Người thua trận phải có điểm rating < 0 (khi bắt đầu từ 0)')
assert.equal(updatedMatches.length, 1, 'Danh sách trận cập nhật phải khớp')

console.log('rating check: OK')
