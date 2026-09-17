import assert from 'node:assert/strict'
import { getChallengeSeriesProgress } from '../../lib/challenge.js'

// 1. Kèo null / undefined
const emptyProg = getChallengeSeriesProgress(null, [])
assert.equal(emptyProg.isComplete, false)
assert.equal(emptyProg.nextSetNumber, 1)
assert.equal(emptyProg.seriesScoreText, '0 – 0')

// 2. Kèo BO1
const chalBo1 = { id: 'c1', code: 'C-0101', bestOf: 1 }
const mBo1_done = [{ id: 'm1', challengeId: 'c1', winnerTeam: 'A', at: 100 }]
const progBo1 = getChallengeSeriesProgress(chalBo1, mBo1_done)
assert.equal(progBo1.isComplete, true, 'BO1 thắng 1 ván là chốt')
assert.equal(progBo1.winnerTeam, 'A')
assert.equal(progBo1.seriesScoreText, '1 – 0')

// 3. Kèo BO3 - Vừa xong hiệp 1
const chalBo3 = { id: 'c2', code: 'C-0102', bestOf: 3 }
const mBo3_set1 = [{ id: 'm2_1', challengeId: 'c2', winnerTeam: 'A', at: 100 }]
const progBo3_1 = getChallengeSeriesProgress(chalBo3, mBo3_set1)
assert.equal(progBo3_1.isComplete, false, 'BO3 mới thắng 1 hiệp chưa chốt')
assert.equal(progBo3_1.winsA, 1)
assert.equal(progBo3_1.winsB, 0)
assert.equal(progBo3_1.nextSetNumber, 2, 'Hiệp tiếp theo là hiệp 2')
assert.equal(progBo3_1.isDecider, false)
assert.equal(progBo3_1.seriesScoreText, '1 – 0')

// 4. Kèo BO3 - Thắng trắng 2-0
const mBo3_2_0 = [
  { id: 'm2_1', challengeId: 'c2', winnerTeam: 'A', at: 100 },
  { id: 'm2_2', challengeId: 'c2', winnerTeam: 'A', at: 200 },
]
const progBo3_2_0 = getChallengeSeriesProgress(chalBo3, mBo3_2_0)
assert.equal(progBo3_2_0.isComplete, true, 'BO3 thắng 2-0 đã chốt')
assert.equal(progBo3_2_0.winnerTeam, 'A')
assert.equal(progBo3_2_0.seriesScoreText, '2 – 0')

// 5. Kèo BO3 - Hòa 1-1 (cần đánh hiệp quyết định)
const mBo3_1_1 = [
  { id: 'm2_1', challengeId: 'c2', winnerTeam: 'A', at: 100 },
  { id: 'm2_2', challengeId: 'c2', winnerTeam: 'B', at: 200 },
]
const progBo3_1_1 = getChallengeSeriesProgress(chalBo3, mBo3_1_1)
assert.equal(progBo3_1_1.isComplete, false, 'BO3 hòa 1-1 chưa chốt')
assert.equal(progBo3_1_1.nextSetNumber, 3, 'Hiệp tiếp theo là hiệp 3')
assert.equal(progBo3_1_1.isDecider, true, 'Hiệp 3 là ván quyết định')
assert.equal(progBo3_1_1.seriesScoreText, '1 – 1')

// 6. Kèo BO3 - Thắng lội ngược dòng 2-1
const mBo3_2_1 = [
  { id: 'm2_1', challengeId: 'c2', winnerTeam: 'A', at: 100 },
  { id: 'm2_2', challengeId: 'c2', winnerTeam: 'B', at: 200 },
  { id: 'm2_3', challengeId: 'c2', winnerTeam: 'B', at: 300 },
]
const progBo3_2_1 = getChallengeSeriesProgress(chalBo3, mBo3_2_1)
assert.equal(progBo3_2_1.isComplete, true, 'BO3 thắng 2-1 đã chốt')
assert.equal(progBo3_2_1.winnerTeam, 'B')
assert.equal(progBo3_2_1.seriesScoreText, '1 – 2')

// 7. Tự phục hồi kèo BO3 bị gắn nhầm status 'played' khi chưa đủ số hiệp thắng
const buggedPlayedChal = { id: 'c3', code: 'C-0103', bestOf: 3, status: 'played', sessionId: 's1' }
const mBo3_bugged = [{ id: 'm3_1', challengeId: 'c3', winnerTeam: 'A', at: 100 }]
const buggedProg = getChallengeSeriesProgress(buggedPlayedChal, mBo3_bugged)
assert.equal(buggedProg.isComplete, false, 'Kèo BO3 mới có 1 ván chưa thể kết thúc')

const isAcceptedOrUnfinishedBo = (c, matches) => {
  if (c.status === 'accepted') return true
  if (c.status === 'played' && (c.bestOf || 1) > 1) {
    const prog = getChallengeSeriesProgress(c, matches)
    return !prog.isComplete
  }
  return false
}
assert.equal(isAcceptedOrUnfinishedBo(buggedPlayedChal, mBo3_bugged), true, 'Kèo BO3 dang dở được nhận diện đúng để hiện lại chip trên sân')

console.log('challenge series progress check: OK')
