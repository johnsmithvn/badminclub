import assert from 'node:assert/strict'
import {
  canMemberPredict,
  getPredictionStats,
  getMemberPrediction,
  isChallengeDead,
  pendingStakeOf,
  availableSeasonPoints,
  settlePredictionsLocal,
} from '#lib/challenge.js'
import {
  calculateSeasonLeaderboard,
  getMemberSeasonLedger,
} from '#lib/season.js'

// ==========================================
// 1. canMemberPredict: Kiểm tra điều kiện dự đoán
// ==========================================
const chalValid = {
  id: 'c1',
  status: 'accepted',
  teamA: ['p1', 'p2'],
  teamB: ['p3', 'p4'],
  predictionsEnabled: true,
  predictionsLocked: false,
}

const mockDb = {
  members: [
    { id: 'p1', name: 'Player 1', active: true },
    { id: 'p2', name: 'Player 2', active: true },
    { id: 'p3', name: 'Player 3', active: true },
    { id: 'p4', name: 'Player 4', active: true },
    { id: 'v1', name: 'Viewer 1', active: true },
    { id: 'v2', name: 'Viewer 2', active: false },
  ],
  challengePredictions: [
    { id: 'pred1', challengeId: 'c1', memberId: 'v1', team: 'A', stakePoints: 2, status: 'pending' },
  ],
}

// 1.1 Đấu thủ trong trận KHÔNG được tham gia dự đoán
const rConflictA = canMemberPredict(chalValid, 'p1', mockDb, 10)
assert.equal(rConflictA.ok, false)
assert.equal(rConflictA.reason, 'player_conflict', 'Đấu thủ team A không được cược chính trận của mình')

const rConflictB = canMemberPredict(chalValid, 'p3', mockDb, 10)
assert.equal(rConflictB.ok, false)
assert.equal(rConflictB.reason, 'player_conflict', 'Đấu thủ team B không được cược chính trận của mình')

// 1.2 Thành viên ngoài trận được phép dự đoán nếu chưa cược
const rViewerValid = canMemberPredict(chalValid, 'v_new', { members: [{ id: 'v_new', active: true }] }, 5)
assert.equal(rViewerValid.ok, true, 'Khán giả ngoài trận có điểm khả dụng được phép cược')

// 1.3 Thành viên inactive bị chặn
const rInactive = canMemberPredict(chalValid, 'v2', mockDb, 10)
assert.equal(rInactive.ok, false)
assert.equal(rInactive.reason, 'member_inactive', 'Thành viên inactive bị chặn dự đoán')

// 1.4 Kèo đã khoá hoặc đang oncourt bị chặn
const chalLocked = { ...chalValid, predictionsLocked: true }
assert.equal(canMemberPredict(chalLocked, 'v1', mockDb, 10).reason, 'locked', 'Kèo đã bật cờ predictionsLocked bị chặn')

const chalOnCourt = { ...chalValid, status: 'oncourt' }
assert.equal(canMemberPredict(chalOnCourt, 'v1', mockDb, 10).reason, 'locked', 'Kèo đã lên sân oncourt bị chặn')

// 1.5 Kèo bị tắt tính năng dự đoán
const chalDisabled = { ...chalValid, predictionsEnabled: false }
assert.equal(canMemberPredict(chalDisabled, 'v1', mockDb, 10).reason, 'disabled', 'Kèo tắt predictionsEnabled bị chặn')

// 1.6 Đã có phiếu dự đoán pending
const rAlready = canMemberPredict(chalValid, 'v1', mockDb, 10)
assert.equal(rAlready.ok, false)
assert.equal(rAlready.reason, 'already_predicted', 'Đã cược cho kèo này thì không cược đè lần nữa')

// ==========================================
// 2. getPredictionStats: Tính toán tỉ lệ và tổng điểm
// ==========================================
const emptyStats = getPredictionStats([], 'c1')
assert.equal(emptyStats.totalCount, 0)
assert.equal(emptyStats.pctA, 50, 'Chưa có cược thì tỉ lệ mặc định 50/50')
assert.equal(emptyStats.pctB, 50)

const samplePredictions = [
  { challengeId: 'c1', memberId: 'm1', team: 'A', stakePoints: 2, status: 'pending' },
  { challengeId: 'c1', memberId: 'm2', team: 'A', stakePoints: 1, status: 'pending' },
  { challengeId: 'c1', memberId: 'm3', team: 'B', stakePoints: 3, status: 'pending' },
  { challengeId: 'c1', memberId: 'm4', team: 'B', stakePoints: 1, status: 'cancelled' }, // Huỷ không tính vào stats
  { challengeId: 'c2', memberId: 'm5', team: 'A', stakePoints: 5, status: 'pending' }, // Khác kèo
]

const statsC1 = getPredictionStats(samplePredictions, 'c1')
assert.equal(statsC1.countA, 2, 'Team A có 2 phiếu')
assert.equal(statsC1.countB, 1, 'Team B có 1 phiếu (loại phiếu cancelled)')
assert.equal(statsC1.pointsA, 3, 'Team A tổng 3 SP')
assert.equal(statsC1.pointsB, 3, 'Team B tổng 3 SP')
assert.equal(statsC1.totalCount, 3)
assert.equal(statsC1.totalPoints, 6)
assert.equal(statsC1.pctA, 50, '3/6 = 50%')
assert.equal(statsC1.pctB, 50)

// ==========================================
// 3. getMemberPrediction: Truy vấn phiếu dự đoán
// ==========================================
const foundPred = getMemberPrediction(samplePredictions, 'c1', 'm1')
assert.ok(foundPred)
assert.equal(foundPred.team, 'A')
assert.equal(foundPred.stakePoints, 2)

const cancelledPred = getMemberPrediction(samplePredictions, 'c1', 'm4')
assert.equal(cancelledPred, null, 'Phiếu đã cancelled bị bỏ qua để user có thể cược lại nếu muốn')

// ==========================================
// 4. Season Points Integration & Ledger Tests
// ==========================================
// Giả định 1 thành viên m1 tham gia 2 trận đấu chính thức (ví dụ được 20 SP từ match)
const mockMembers = [
  { id: 'm1', name: 'Member 1', level: 'trung_binh', active: true, joined: '2026-01-01' },
]

// 4.1 Thắng dự đoán: net +stake (+2 SP)
const predsWon = [
  { id: 'p1', challengeId: 'c1', memberId: 'm1', team: 'A', stakePoints: 2, payoutPoints: 4, status: 'won', settledAt: '2026-09-17T10:00:00Z' },
]
const resWon = calculateSeasonLeaderboard({ members: mockMembers, matches: [], challengePredictions: predsWon })
const rowWon = resWon.leaderboard[0]
assert.equal(rowWon.breakdown.predictionWonPoints, 2, 'Thắng nhận net 2 SP (payout 4 - stake 2)')
assert.equal(rowWon.breakdown.predictionLostPoints, 0)
assert.equal(rowWon.breakdown.predictionNetPoints, 2)
assert.equal(rowWon.totalSeasonPoints, 2, 'Tổng điểm mùa = matchPoints + predictionNet')

// 4.2 Thua dự đoán: net -stake (-3 SP), sàn Floor = 0
const predsLost = [
  { id: 'p2', challengeId: 'c2', memberId: 'm1', team: 'B', stakePoints: 3, payoutPoints: 0, status: 'lost', settledAt: '2026-09-17T11:00:00Z' },
]
const resLost = calculateSeasonLeaderboard({ members: mockMembers, matches: [], challengePredictions: predsLost })
const rowLost = resLost.leaderboard[0]
assert.equal(rowLost.breakdown.predictionWonPoints, 0)
assert.equal(rowLost.breakdown.predictionLostPoints, 3)
assert.equal(rowLost.breakdown.predictionNetPoints, -3)
assert.equal(rowLost.totalSeasonPoints, 0, 'Sàn Floor 0 giữ tổng điểm mùa không âm (Math.max(0, 0 - 3) = 0)')

// 4.3 Refunded / Cancelled: net 0 SP
const predsRefunded = [
  { id: 'p3', challengeId: 'c3', memberId: 'm1', team: 'A', stakePoints: 2, payoutPoints: 2, status: 'refunded', settledAt: '2026-09-17T12:00:00Z' },
  { id: 'p4', challengeId: 'c4', memberId: 'm1', team: 'B', stakePoints: 3, payoutPoints: 3, status: 'cancelled', settledAt: '2026-09-17T12:00:00Z' },
]
const resRefunded = calculateSeasonLeaderboard({ members: mockMembers, matches: [], challengePredictions: predsRefunded })
const rowRefunded = resRefunded.leaderboard[0]
assert.equal(rowRefunded.breakdown.predictionNetPoints, 0, 'Phiếu hoàn / huỷ có net delta = 0')

// 4.4 Trần Season Cap: chỉ kẹp CHIỀU THẮNG ở +15 SP, chiều thua trừ thật
// Giả sử thắng liên tiếp 10 kèo x 3 SP = 30 SP thắng
const predsHugeWin = Array.from({ length: 10 }, (_, i) => ({
  id: `pw_${i}`,
  challengeId: `c_${i}`,
  memberId: 'm1',
  team: 'A',
  stakePoints: 3,
  payoutPoints: 6,
  status: 'won',
  settledAt: '2026-09-17T10:00:00Z',
}))
const resHugeWin = calculateSeasonLeaderboard({ members: mockMembers, matches: [], challengePredictions: predsHugeWin })
const rowHugeWin = resHugeWin.leaderboard[0]
assert.equal(rowHugeWin.breakdown.predictionWonPoints, 30, 'Tổng thắng danh nghĩa là 30 SP')
assert.equal(rowHugeWin.breakdown.predictionNetPoints, 15, 'Nhưng net points bị kẹp tối đa +15 SP')
assert.equal(rowHugeWin.totalSeasonPoints, 15)

// Giả sử thua liên tiếp 10 kèo x 3 SP = -30 SP
const predsHugeLoss = Array.from({ length: 10 }, (_, i) => ({
  id: `pl_${i}`,
  challengeId: `c_${i}`,
  memberId: 'm1',
  team: 'A',
  stakePoints: 3,
  payoutPoints: 0,
  status: 'lost',
  settledAt: '2026-09-17T10:00:00Z',
}))
const resHugeLoss = calculateSeasonLeaderboard({ members: mockMembers, matches: [], challengePredictions: predsHugeLoss })
const rowHugeLoss = resHugeLoss.leaderboard[0]
assert.equal(rowHugeLoss.breakdown.predictionLostPoints, 30, 'Tổng thua danh nghĩa là 30 SP')
// TRẦN CHỈ CHẶN CHIỀU THẮNG. Sàn -15 cũ là một lỗ hổng cược miễn phí: chạm -15 rồi thì thua
// thêm không mất gì nữa trong khi thắng vẫn được cộng.
assert.equal(rowHugeLoss.breakdown.predictionNetPoints, -30, 'Thua là trừ thật, không còn sàn -15')
assert.equal(rowHugeLoss.totalSeasonPoints, 0, 'Sàn 0 của TỔNG vẫn giữ — điểm mùa không âm')

// 4.5 Ledger: Kiểm tra hiển thị sự kiện trong sổ cái mùa giải getMemberSeasonLedger
const ledgerData = getMemberSeasonLedger('m1', {
  members: mockMembers,
  matches: [],
  challengePredictions: [
    { id: 'p1', challengeId: 'c1', memberId: 'm1', team: 'A', stakePoints: 2, payoutPoints: 4, status: 'won', settledAt: '2026-09-17T10:00:00Z' },
    { id: 'p2', challengeId: 'c2', memberId: 'm1', team: 'B', stakePoints: 1, payoutPoints: 0, status: 'lost', settledAt: '2026-09-17T11:00:00Z' },
  ],
})

assert.equal(ledgerData.recentEvents.length, 2, 'Có 2 sự kiện cược xuất hiện trong recentEvents')
assert.equal(ledgerData.recentEvents[0].numPts, -1, 'Sự kiện mới hơn (thua 1 SP)')
assert.equal(ledgerData.recentEvents[1].numPts, 2, 'Sự kiện cũ hơn (thắng net +2 SP)')
assert.equal(ledgerData.recentEvents[0].pts, '-1')
assert.equal(ledgerData.recentEvents[1].pts, '+2')

console.log('season_prediction check: OK')

// ==========================================
// 5. Lọc theo mùa: phiếu ngoài khung mùa không được cộng vào điểm mùa này
// ==========================================
const seasonQ3 = { id: 's-q3', code: 'Q3', name: 'Q3', startDate: '2026-07-01', endDate: '2026-09-30' }
const predsCrossSeason = [
  // Trong mùa
  { id: 'in1', challengeId: 'ci', memberId: 'm1', team: 'A', stakePoints: 2, payoutPoints: 4, status: 'won', settledAt: '2026-08-15T10:00:00Z' },
  // Mùa trước — trước đây vẫn bị cộng vào vì khối tính điểm không lọc gì
  { id: 'out1', challengeId: 'co', memberId: 'm1', team: 'A', stakePoints: 3, payoutPoints: 6, status: 'won', settledAt: '2026-05-01T10:00:00Z' },
  // Chưa quyết toán thì không tính, dù nằm trong mùa
  { id: 'pend', challengeId: 'cp', memberId: 'm1', team: 'B', stakePoints: 3, payoutPoints: 0, status: 'pending', settledAt: null },
]
const resSeasonScoped = calculateSeasonLeaderboard(
  { members: mockMembers, matches: [], challengePredictions: predsCrossSeason },
  seasonQ3,
)
assert.equal(
  resSeasonScoped.leaderboard[0].breakdown.predictionNetPoints, 2,
  'Chỉ phiếu quyết toán TRONG mùa được tính (2 SP), phiếu mùa trước bị loại',
)

// ==========================================
// 6. SP khả dụng: phiếu trên kèo đã chết không được giam điểm
// ==========================================
const nowTs = Date.parse('2026-09-17T12:00:00Z')
const chalsForStake = [
  { id: 'c_live', status: 'accepted', expiresAt: '2026-09-17T23:00:00Z' },
  { id: 'c_cancelled', status: 'cancelled' },
  { id: 'c_declined', status: 'declined' },
  // Quá hạn mà cột status CHƯA đổi — không có tiến trình nào quét kèo hết hạn,
  // status chỉ đổi khi có người bấm vào nó.
  { id: 'c_stale', status: 'pending', expiresAt: '2026-09-17T09:00:00Z' },
]
assert.equal(isChallengeDead(chalsForStake[0], nowTs), false, 'Kèo còn hạn là kèo sống')
assert.equal(isChallengeDead(chalsForStake[1], nowTs), true)
assert.equal(isChallengeDead(chalsForStake[2], nowTs), true)
assert.equal(isChallengeDead(chalsForStake[3], nowTs), true, 'Quá giờ hết hạn là chết, kể cả khi status còn pending')

const stakePreds = [
  { memberId: 'm1', challengeId: 'c_live', stakePoints: 2, status: 'pending' },
  { memberId: 'm1', challengeId: 'c_cancelled', stakePoints: 3, status: 'pending' },
  { memberId: 'm1', challengeId: 'c_stale', stakePoints: 3, status: 'pending' },
  { memberId: 'm1', challengeId: 'c_live', stakePoints: 3, status: 'won' }, // đã quyết toán, không giam
  { memberId: 'm2', challengeId: 'c_live', stakePoints: 3, status: 'pending' }, // người khác
]
assert.equal(
  pendingStakeOf(stakePreds, chalsForStake, 'm1', nowTs), 2,
  'Chỉ 2 SP trên kèo còn sống bị giam; phiếu trên kèo huỷ / quá hạn được thả',
)
assert.equal(availableSeasonPoints(10, stakePreds, chalsForStake, 'm1', nowTs), 8)
// Hết điểm là 0, không âm — và 0 nghĩa là không được cược.
assert.equal(availableSeasonPoints(1, stakePreds, chalsForStake, 'm1', nowTs), 0)
assert.equal(
  canMemberPredict(chalValid, 'v_new', { members: [{ id: 'v_new', active: true }] }, 0).reason,
  'insufficient_points',
  'Khả dụng = 0 thì KHÔNG được cược',
)

// Kèo quá hạn phải chặn theo mốc giờ, không chờ cột status đổi
assert.equal(
  canMemberPredict(
    { ...chalValid, status: 'pending', expiresAt: '2026-01-01T00:00:00Z' },
    'v_new', { members: [{ id: 'v_new', active: true }] }, 10,
  ).reason,
  'locked',
  'Kèo đã quá giờ hết hạn thì không nhận cược nữa',
)

// ==========================================
// 7. settlePredictionsLocal phải khớp từng dòng với RPC settle_challenge_predictions (0042)
// ==========================================
const toSettle = [
  { id: 'a', challengeId: 'cx', team: 'A', stakePoints: 2, status: 'pending', payoutPoints: 0 },
  { id: 'b', challengeId: 'cx', team: 'B', stakePoints: 3, status: 'pending', payoutPoints: 0 },
  { id: 'c', challengeId: 'cx', team: 'A', stakePoints: 1, status: 'cancelled', payoutPoints: 1 },
  { id: 'd', challengeId: 'other', team: 'A', stakePoints: 2, status: 'pending', payoutPoints: 0 },
]
const settled = settlePredictionsLocal(toSettle, 'cx', 'A', '2026-09-17T12:00:00Z')
assert.equal(settled[0].status, 'won')
assert.equal(settled[0].payoutPoints, 4, 'Thắng nhận payout = stake x 2')
assert.equal(settled[1].status, 'lost')
assert.equal(settled[1].payoutPoints, 0)
assert.equal(settled[2].status, 'cancelled', 'Phiếu đã huỷ không bị lôi vào quyết toán')
assert.equal(settled[3].status, 'pending', 'Kèo khác không bị đụng tới')

// Sửa tỷ số lật đội thắng -> phiếu ĐÃ quyết toán phải chạy lại theo kết quả mới
const reSettled = settlePredictionsLocal(settled, 'cx', 'B', '2026-09-17T13:00:00Z')
assert.equal(reSettled[0].status, 'lost', 'Lật kèo thì phiếu đang thắng chuyển thành thua')
assert.equal(reSettled[1].status, 'won')
assert.equal(reSettled[1].payoutPoints, 6)

// Hoàn phiếu: chỉ đụng phiếu đang chờ, không gỡ kết quả đã ăn/thua
const refunded = settlePredictionsLocal(toSettle, 'cx', null, '2026-09-17T14:00:00Z')
assert.equal(refunded[0].status, 'refunded')
assert.equal(refunded[0].payoutPoints, 2, 'Hoàn trả đúng số đã đặt, net = 0')
assert.equal(refunded[2].status, 'cancelled')

console.log('prediction rules check: OK')
