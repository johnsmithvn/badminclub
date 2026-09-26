import assert from 'node:assert/strict'
import {
  canMemberPredict,
  getPredictionStats,
  getMemberPrediction,
  isChallengeDead,
  isChallengeExpired,
  expiredChallenges,
  orphanedChallenges,
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

// 1.1b MỌI trạng thái kèo đã chết đều đóng cổng cược.
//
// Bug thật ở giao diện: `ChallengeDetailModal` dựng lại điều kiện khoá bằng tay và THIẾU
// 'declined', nên kèo đã bị từ chối vẫn hiện form mời cược, bấm xong mới ăn lỗi từ RPC. Giao diện
// giờ hỏi thẳng `canMemberPredict`, còn đây là chỗ khoá danh sách trạng thái đó lại.
const deadStatusDb = { members: [{ id: 'viewer', active: true }] }
for (const dead of ['declined', 'cancelled', 'expired', 'played', 'oncourt']) {
  const r = canMemberPredict({ ...chalValid, status: dead }, 'viewer', deadStatusDb, 10)
  assert.equal(r.ok, false, `Kèo ${dead} phải đóng cổng cược`)
  assert.equal(r.reason, 'locked', `Kèo ${dead} trả đúng lý do 'locked'`)
}
// Ngược lại, hai trạng thái còn sống vẫn nhận cược
for (const alive of ['pending', 'accepted']) {
  assert.equal(
    canMemberPredict({ ...chalValid, status: alive }, 'viewer', deadStatusDb, 10).ok,
    true,
    `Kèo ${alive} vẫn nhận cược`,
  )
}

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
const sessionsForStake = [
  { id: 's_open', status: 'open' },
  { id: 's_closed', status: 'closed' },
]
const chalsForStake = [
  { id: 'c_live', status: 'accepted', sessionId: 's_open', expiresAt: '2026-09-17T23:00:00Z' },
  { id: 'c_cancelled', status: 'cancelled' },
  { id: 'c_declined', status: 'declined' },
  // Quá hạn mà cột status CHƯA đổi — không có tiến trình nào quét kèo hết hạn,
  // status chỉ đổi khi có người bấm vào nó.
  { id: 'c_stale', status: 'pending', expiresAt: '2026-09-17T09:00:00Z' },
  // Bốn người đã nhận kèo rồi bỏ đó, buổi đã chốt sổ -> trận không bao giờ đánh nữa.
  { id: 'c_abandoned', status: 'accepted', sessionId: 's_closed', expiresAt: '2026-09-17T23:00:00Z' },
  // Đã đẩy lên sân rồi cả nhóm về, không ai nhập tỷ số, buổi chốt sổ.
  { id: 'c_oncourt_dead', status: 'oncourt', sessionId: 's_closed' },
  // Đang đánh thật trong buổi còn mở -> SỐNG, không được thả cọc.
  { id: 'c_oncourt_live', status: 'oncourt', sessionId: 's_open' },
]
const sessOf = (c) => sessionsForStake.find((x) => x.id === c.sessionId) || null

assert.equal(isChallengeDead(chalsForStake[0], sessOf(chalsForStake[0]), nowTs), false, 'Kèo còn hạn, buổi còn mở là kèo sống')
assert.equal(isChallengeDead(chalsForStake[1], null, nowTs), true)
assert.equal(isChallengeDead(chalsForStake[2], null, nowTs), true)
assert.equal(isChallengeDead(chalsForStake[3], null, nowTs), true, 'Quá giờ hết hạn là chết, kể cả khi status còn pending')
assert.equal(
  isChallengeDead(chalsForStake[4], sessOf(chalsForStake[4]), nowTs), true,
  'Kèo đã nhận nhưng buổi đã chốt sổ thì chết — đây là đường duy nhất giết kèo accepted bị bỏ rơi',
)

// `expiresAt` là hạn NHẬN KÈO, chỉ có nghĩa khi còn 'pending'. Kèo đã nhận thì đang chờ sân và vẫn sẽ
// được đánh — coi nó là chết là thả cọc ra cho người đặt tiêu lại đúng số điểm đang treo trên một
// trận sắp quyết toán (tiêu hai lần một đồng điểm).
assert.equal(
  isChallengeDead({ id: 'c_acc', status: 'accepted', expiresAt: '2026-09-17T09:00:00Z' }, null, nowTs),
  false,
  'Kèo ĐÃ NHẬN thì quá hạn nhận kèo không làm nó chết — cọc phải giữ',
)
assert.equal(isChallengeExpired({ status: 'accepted', expiresAt: '2026-09-17T09:00:00Z' }, nowTs), false)
assert.equal(isChallengeExpired({ status: 'pending', expiresAt: '2026-09-17T09:00:00Z' }, nowTs), true)
assert.equal(isChallengeExpired({ status: 'expired' }, nowTs), true)
assert.equal(isChallengeExpired({ status: 'oncourt', expiresAt: '2026-09-17T09:00:00Z' }, nowTs), false, 'Kèo đang trên sân không bao giờ là hết hạn')
// Dòng cũ chưa có cột expiresAt: suy từ createdAt + defaultExpireMins của config
assert.equal(isChallengeExpired({ status: 'pending', createdAt: '2026-09-17T08:00:00Z' }, nowTs), true)
assert.equal(isChallengeExpired({ status: 'pending', createdAt: '2026-09-17T11:45:00Z' }, nowTs), false)

// HAI NGUYÊN NHÂN PHẢI TÁCH: hết hạn nhận kèo thì kèo chết thật; buổi chốt sổ thì kèo chỉ mất
// chỗ đánh. Gộp làm một rồi đánh dấu tất cả 'expired' là giết kèo người ta chưa kịp đánh, và
// card hiện "Hết hạn" trong khi kèo chưa hề quá giờ.
const dbSweep = { challenges: chalsForStake, sessions: sessionsForStake }
assert.deepEqual(
  expiredChallenges(dbSweep, nowTs).map((c) => c.id).sort(), ['c_stale'],
  'Chỉ kèo quá giờ NHẬN mới là hết hạn',
)
assert.deepEqual(
  orphanedChallenges(dbSweep, nowTs).map((c) => c.id).sort(), ['c_abandoned', 'c_oncourt_dead'],
  'Kèo gắn vào buổi đã chốt sổ thì mồ côi buổi, KHÔNG phải hết hạn',
)
// Kèo còn sống ở buổi còn mở không được đụng tới
assert.equal(orphanedChallenges(dbSweep, nowTs).some((c) => c.id === 'c_live'), false)
assert.equal(expiredChallenges(dbSweep, nowTs).some((c) => c.id === 'c_live'), false)
assert.equal(
  isChallengeDead(chalsForStake[5], sessionsForStake[1], nowTs), true,
  'Kèo đẩy lên sân rồi bỏ dở, buổi đã chốt sổ -> chết',
)
assert.equal(
  isChallengeDead(chalsForStake[6], sessionsForStake[0], nowTs), false,
  'Kèo đang trên sân của buổi còn mở thì SỐNG — đang đánh thật, cọc phải giữ',
)
assert.equal(
  isChallengeDead({ id: 'p1', status: 'played', sessionId: 's_closed' }, sessionsForStake[1], nowTs), false,
  'Kèo đã có kết quả thì không chết, phiếu của nó đã quyết toán theo kết quả',
)

// Buổi đã chốt nhưng ở tương lai (chưa diễn ra, nowTs = 2026-09-17) -> kèo vẫn sống, KHÔNG mồ côi
const sFutureClosed = { id: 's_future_closed', status: 'closed', date: '2026-09-27' }
const cFuture = { id: 'c_future', status: 'accepted', sessionId: 's_future_closed', expiresAt: '2026-09-27T23:00:00Z' }
const dbFuture = { challenges: [cFuture], sessions: [sFutureClosed] }
assert.equal(orphanedChallenges(dbFuture, nowTs).length, 0, 'Buổi chốt nhưng ở tương lai chưa diễn ra thì kèo không mồ côi')
assert.equal(isChallengeDead(cFuture, sFutureClosed, nowTs), false, 'Buổi chốt ở tương lai chưa diễn ra thì kèo vẫn sống')

const stakePreds = [
  { memberId: 'm1', challengeId: 'c_live', stakePoints: 2, status: 'pending' },
  { memberId: 'm1', challengeId: 'c_cancelled', stakePoints: 3, status: 'pending' },
  { memberId: 'm1', challengeId: 'c_stale', stakePoints: 3, status: 'pending' },
  { memberId: 'm1', challengeId: 'c_abandoned', stakePoints: 3, status: 'pending' },
  { memberId: 'm1', challengeId: 'c_live', stakePoints: 3, status: 'won' }, // đã quyết toán, không giam
  { memberId: 'm2', challengeId: 'c_live', stakePoints: 3, status: 'pending' }, // người khác
]
assert.equal(
  pendingStakeOf(stakePreds, chalsForStake, sessionsForStake, 'm1', nowTs), 2,
  'Chỉ 2 SP trên kèo còn sống bị giam; phiếu trên kèo huỷ / quá hạn / bị bỏ rơi được thả',
)
assert.equal(availableSeasonPoints(10, stakePreds, chalsForStake, sessionsForStake, 'm1', nowTs), 8)
// Hết điểm là 0, không âm — và 0 nghĩa là không được cược.
assert.equal(availableSeasonPoints(1, stakePreds, chalsForStake, sessionsForStake, 'm1', nowTs), 0)
assert.equal(
  canMemberPredict(chalValid, 'v_new', { members: [{ id: 'v_new', active: true }] }, 0).reason,
  'insufficient_points',
  'Khả dụng = 0 thì KHÔNG được cược',
)

// Kèo quá hạn NHẬN phải chặn theo mốc giờ, không chờ cột status đổi
assert.equal(
  canMemberPredict(
    { ...chalValid, status: 'pending', expiresAt: '2026-01-01T00:00:00Z' },
    'v_new', { members: [{ id: 'v_new', active: true }] }, 10,
  ).reason,
  'locked',
  'Kèo chưa ai nhận mà quá giờ thì không nhận cược nữa',
)
// ...nhưng kèo ĐÃ NHẬN thì vẫn cược được cho tới lúc lên sân
assert.equal(
  canMemberPredict(
    { ...chalValid, status: 'accepted', expiresAt: '2026-01-01T00:00:00Z' },
    'v_new', { members: [{ id: 'v_new', active: true }] }, 10,
  ).ok,
  true,
  'Kèo đã nhận: quá hạn-nhận-kèo không khoá cổng cược',
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

// Ghi hiệp nào là đóng cổng cược — SUY TỪ TRẬN, không đợi cờ `predictionsLocked`.
// `predictionsLocked` là cờ chỉ có đường bật (không chỗ nào ghi false ngoài undoMatch), nên tin
// mỗi nó là kèo bị gỡ trận vẫn câm vĩnh viễn.
const chalBo3 = { id: 'cbo3', status: 'accepted', bestOf: 3, teamA: ['p1'], teamB: ['p3'], predictionsEnabled: true, predictionsLocked: false }
const viewerDb = { members: [{ id: 'v_new', active: true }] }
assert.equal(
  canMemberPredict(chalBo3, 'v_new', { ...viewerDb, matches: [] }, 10).ok, true,
  'Chưa đánh hiệp nào thì còn nhận cược',
)
assert.equal(
  canMemberPredict(chalBo3, 'v_new', {
    ...viewerDb,
    matches: [{ id: 'm1', challengeId: 'cbo3', winnerTeam: 'A', at: 1 }],
  }, 10).reason,
  'locked',
  'Ghi xong hiệp 1 là đóng cổng, dù cờ predictionsLocked vẫn false',
)

console.log('prediction rules check: OK')

// ==========================================
// 8. Cột "điểm sau" của sổ cái phải cộng ra tổng
// ==========================================
// Trước đây vòng lặp trận chỉ cộng điểm TRẬN còn điểm dự đoán cộng một phát ở cuối, nên dòng cuối
// sổ cái không bao giờ khớp `totalSeasonPoints`.
const ledgerMembers = [{ id: 'L1', name: 'Ledger', level: 'trung_binh', active: true, joined: '2026-01-01' }]
const ledgerMatches = [
  {
    id: 'lm1', sessionId: 'ls1', at: Date.parse('2026-08-10T10:00:00Z'),
    teamA: ['L1'], teamB: ['X1'], winnerTeam: 'A', sets: [[21, 15]],
    initialRatingA: 1000, initialRatingB: 1000, ratingEnabled: true,
  },
  {
    id: 'lm2', sessionId: 'ls1', at: Date.parse('2026-08-20T10:00:00Z'),
    teamA: ['L1'], teamB: ['X1'], winnerTeam: 'A', sets: [[21, 17]],
    initialRatingA: 1000, initialRatingB: 1000, ratingEnabled: true,
  },
]
const ledgerPreds = [
  // Giữa hai trận
  { id: 'lp1', challengeId: 'lc1', memberId: 'L1', team: 'A', stakePoints: 2, payoutPoints: 4, status: 'won', settledAt: '2026-08-15T10:00:00Z' },
  // Sau trận cuối
  { id: 'lp2', challengeId: 'lc2', memberId: 'L1', team: 'B', stakePoints: 1, payoutPoints: 0, status: 'lost', settledAt: '2026-08-25T10:00:00Z' },
]
const ledgerDb = { members: ledgerMembers, matches: ledgerMatches, challengePredictions: ledgerPreds }
const ledgerRow = calculateSeasonLeaderboard(ledgerDb, seasonQ3).leaderboard[0]

assert.equal(ledgerRow.predictionLogs.length, 2, 'Hai phiếu đều có dòng trong sổ')
// Phiếu 1 quyết toán SAU trận 1 -> điểm sau của nó = điểm sau trận 1 cộng +2
assert.equal(
  ledgerRow.predictionLogs[0].pointsAfter,
  ledgerRow.matchLogs[0].pointsAfter + 2,
  'Phiếu thắng giữa hai trận cộng thẳng vào điểm đang có lúc đó',
)
// Trận 2 diễn ra sau phiếu 1 -> điểm sau của nó đã gồm +2 của phiếu
assert.equal(
  ledgerRow.matchLogs[1].pointsAfter,
  ledgerRow.matchLogs[0].pointsAfter + ledgerRow.matchLogs[1].effectiveChange + 2,
  'Điểm sau của trận sau phải gồm cả phiếu đã quyết toán trước nó',
)
// Dòng CUỐI CÙNG của sổ phải bằng đúng tổng điểm mùa — đây là cái vênh cũ
assert.equal(
  ledgerRow.predictionLogs[1].pointsAfter,
  ledgerRow.totalSeasonPoints,
  'Dòng cuối sổ cái phải cộng ra đúng tổng điểm mùa',
)

// Không đụng gì tới TỔNG: điểm trận vẫn nguyên, phiếu vẫn net +2-1 = +1
assert.equal(ledgerRow.breakdown.predictionNetPoints, 1)

// Người chỉ đoán kèo, không đánh trận nào: vẫn phải có dòng và điểm sau đúng
const onlyPredRow = calculateSeasonLeaderboard(
  { members: ledgerMembers, matches: [], challengePredictions: ledgerPreds }, seasonQ3,
).leaderboard[0]
assert.equal(onlyPredRow.matchLogs.length, 0)
assert.equal(onlyPredRow.predictionLogs.length, 2)
assert.equal(onlyPredRow.predictionLogs[1].pointsAfter, onlyPredRow.totalSeasonPoints)

// Sổ cái đọc thẳng predictionLogs, không dựng lại công thức thứ hai
const ledgerOut = getMemberSeasonLedger('L1', ledgerDb, seasonQ3)
const predRows = ledgerOut.recentEvents.filter((e) => e.isPrediction)
assert.equal(predRows.length, 2)
assert.equal(predRows[0].pointsAfter, ledgerRow.totalSeasonPoints, 'Dòng phiếu mới nhất mang điểm sau khớp tổng')

console.log('ledger pointsAfter check: OK')
