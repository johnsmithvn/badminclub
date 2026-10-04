// Dự đoán Elo trước trận + chênh điểm nhỏ nhất — chung cho thẻ/hàng trận ở tab Trận của buổi và trang Trận đấu.
// Trước đây trang Trận đấu in số cứng (34% / 52% / 50% và "cách biệt 2 điểm") thay vì tính thật.
import assert from 'node:assert/strict'
import { matchPrediction, minSetDiff } from '../../lib/matchSearch.js'
import { expectedScore } from '../../lib/rating.js'

const noRating = () => { throw new Error('không được tra rating hiện tại khi trận đã lưu Elo lúc vào trận') }

// Có Elo lúc vào trận: dùng đúng số đó
const fav = matchPrediction({ initialRatingA: 1200, initialRatingB: 1000, winnerTeam: 'A' }, noRating)
assert.equal(fav.ra, 1200)
assert.equal(fav.rb, 1000)
assert.equal(fav.predPct, Math.round(expectedScore(1200, 1000) * 100))
assert.ok(fav.predPct > 50)
assert.equal(fav.isCorrect, true, 'cửa trên thắng → Elo đoán trúng')

// Cửa dưới thắng: % là khả năng Elo dành cho đội ĐÃ thắng (< 50) → đoán trật
const dog = matchPrediction({ initialRatingA: 1200, initialRatingB: 1000, winnerTeam: 'B' }, noRating)
assert.equal(dog.predPct, 100 - fav.predPct)
assert.equal(dog.isCorrect, false)

// Ngang nhau: 50% tính là trúng
assert.deepEqual(matchPrediction({ initialRatingA: 900, initialRatingB: 900, winnerTeam: 'B' }, noRating).isCorrect, true)

// Trận cũ chưa lưu Elo lúc vào: lấy TB rating hiện tại của từng đội
const R = { a1: 1000, a2: 1400, b1: 900, b2: 1100 }
const old = matchPrediction({ teamA: ['a1', 'a2'], teamB: ['b1', 'b2'], winnerTeam: 'A' }, (id) => R[id])
assert.equal(old.ra, 1200)
assert.equal(old.rb, 1000)
assert.equal(old.predPct, fav.predPct)

// Chênh điểm nhỏ nhất trong các set có đủ điểm
assert.equal(minSetDiff({ sets: [[21, 15], [19, 21], [22, 20]] }), 2)
assert.equal(minSetDiff({ sets: [[21, 18]] }), 3)
assert.equal(minSetDiff({ sets: [[21, null], [21, 16]] }), 5, 'bỏ qua set thiếu điểm')
assert.equal(minSetDiff({ sets: [] }), null)
assert.equal(minSetDiff({}), null)

console.log('match_prediction.test.js: OK')
