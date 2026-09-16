import assert from 'node:assert/strict'
import {
  calcRoundTimes,
  createDefaultPlan,
  calcPlayerLoads,
  calcCourtBalanceScore,
  calcPlanHealth,
  detectPlanIssues,
  autoGeneratePlan,
  getSessionPlannerPlayers,
  getSessionTimeRange,
  updatePlanRoundMinutes,
  addPlanRound,
  removePlanRound,
} from '../../lib/planner.js'

// 1. calcRoundTimes
const times = calcRoundTimes('19:00', 18, 3)
assert.equal(times.length, 3, 'sinh đúng 3 vòng')
assert.equal(times[0].label, 'R1')
assert.equal(times[0].time, '19:00')
assert.equal(times[0].timeRange, '19:00 → 19:18')
assert.equal(times[1].time, '19:18')
assert.equal(times[2].time, '19:36')

// 2. getSessionTimeRange & createDefaultPlan theo giờ sân thật
const sessionMock = {
  id: 's1',
  courts: [
    { courtLabel: 'Sân 1', from: '18:00', to: '20:00' },
    { courtLabel: 'Sân 2', from: '18:00', to: '20:00' },
  ],
}
const sTime = getSessionTimeRange(sessionMock)
assert.equal(sTime.startTime, '18:00', 'lấy đúng giờ bắt đầu từ sân')
assert.equal(sTime.endTime, '20:00', 'lấy đúng giờ kết thúc từ sân')
assert.equal(sTime.totalMinutes, 120, 'tính đúng 120 phút')

// Khởi tạo kế hoạch tự tính số vòng theo giờ sân (120 phút / 15 phút = 8 vòng)
const plan15m = createDefaultPlan(sessionMock, [], 15)
assert.equal(plan15m.rounds.length, 8, '120 phút với 15p/trận sinh đúng 8 vòng')
assert.equal(plan15m.rounds[0].time, '18:00')
assert.equal(plan15m.rounds[1].time, '18:15')
assert.equal(plan15m.rounds[7].time, '19:45')

// Đổi thời lượng sang 20 phút (updatePlanRoundMinutes)
const plan20m = updatePlanRoundMinutes(plan15m, 20, sTime.startTime)
assert.equal(plan20m.roundMinutes, 20)
assert.equal(plan20m.rounds[0].time, '18:00')
assert.equal(plan20m.rounds[1].time, '18:20')
assert.equal(plan20m.rounds[2].time, '18:40')

// Thêm vòng (addPlanRound) và bớt vòng (removePlanRound)
const planAdded = addPlanRound(plan20m, [{ name: 'Sân 1' }, { name: 'Sân 2' }], 20, sTime.startTime)
assert.equal(planAdded.rounds.length, 9, 'đã thêm thành 9 vòng')
assert.equal(planAdded.rounds[8].label, 'R9')

const planRemoved = removePlanRound(planAdded)
assert.equal(planRemoved.rounds.length, 8, 'đã bớt về 8 vòng')

// 3. calcPlayerLoads
const players = [
  { key: 'p1', name: 'Quân' },
  { key: 'p2', name: 'Kuro' },
  { key: 'p3', name: 'Lan' },
  { key: 'p4', name: 'Mai' },
]
const testRounds = [
  {
    roundIndex: 0,
    courts: [{ teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] }],
  },
  {
    roundIndex: 1,
    courts: [{ teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] }],
  },
  {
    roundIndex: 2,
    courts: [{ teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] }],
  },
]
const loads = calcPlayerLoads(testRounds, players)
assert.equal(loads.p1.count, 3, 'p1 đánh 3 trận')
assert.equal(loads.p1.consecutiveMax, 3, 'p1 đánh 3 vòng liên tiếp')

// 4. detectPlanIssues - bắt lỗi đánh 3 vòng liên tiếp và thiếu người
const incompleteRound = [
  {
    roundIndex: 0,
    courts: [{ teamA: ['p1'], teamB: ['p2'] }], // chỉ có 2 người -> thiếu 2
  },
]
const issues = detectPlanIssues(incompleteRound, players, [], [])
const missingIssue = issues.find((i) => i.type === 'missing_players')
assert.ok(missingIssue, 'phát hiện sân thiếu người')
assert.equal(missingIssue.severity, 'danger')

const consecutiveIssues = detectPlanIssues(testRounds, players, [], [])
const consecIssue = consecutiveIssues.find((i) => i.type === 'consecutive_rounds')
assert.ok(consecIssue, 'phát hiện người đánh 3 vòng liên tiếp')

// 5. calcPlanHealth
const health = calcPlanHealth(testRounds, [{ id: 'ch1' }], [], players, {})
assert.equal(health.minLoad, 3)
assert.equal(health.maxLoad, 3)
assert.equal(health.loadGap, 0)
assert.equal(health.incompleteCourts, 0)

// 6. autoGeneratePlan
const all16 = Array.from({ length: 16 }, (_, i) => ({
  key: `p_${i + 1}`,
  name: `Người ${i + 1}`,
}))
const genRounds = autoGeneratePlan({
  players: all16,
  courts: [0, 1],
  challenges: [
    { id: 'ch1', status: 'accepted', teamA: ['p_1', 'p_2'], teamB: ['p_3', 'p_4'] },
  ],
  startTime: '19:00',
  roundMinutes: 18,
  totalRounds: 10,
})
assert.equal(genRounds.length, 10, 'sinh đủ 10 vòng')
// Kiểm tra kèo được xếp vào vòng 3 (index 2)
const r3 = genRounds[2]
const chalCourt = r3.courts.find((c) => c.challengeId === 'ch1')
assert.equal(chalCourt.tag, 'CHALLENGE')

// 7. getSessionPlannerPlayers (lên đúng tên khách và người trong kèo, không lộ UUID)
const dbMock = {
  members: [
    { id: 'm1', name: 'Kuro', gender: 'nam', level: 'TB', avatarUrl: 'https://example.com/kuro.jpg' },
    { id: 'm2', name: 'Tiến Đạt', gender: 'nam', level: 'TB' },
  ],
  groups: [{ id: 'g1', name: 'Nhóm 1' }],
  groupMemberships: [
    { memberId: 'm1', groupId: 'g1', month: '2026-09' },
    { memberId: 'm2', groupId: 'g1', month: '2026-09' },
  ],
  attendance: { s1: { m1: true } },
  guests: [
    { id: 'g_uuid_1', name: 'Khách Hoàng', gender: 'nam', level: 'TB', avatarUrl: 'https://example.com/hoang.jpg' },
    { id: 'g_uuid_2', name: 'Khách Tuấn', gender: 'nam', level: 'TB' },
  ],
  roster: {},
  sessionGuests: [
    { id: 'sg1', sessionId: 's1', guestId: 'g_uuid_1', level: 'TB', gender: 'nam' },
  ],
}
const sMock = { id: 's1', date: '2026-09-18', groupId: 'g1' }
const chalMock = [
  { id: 'c1', teamA: ['m2', 'g_uuid_1'], teamB: ['m1', 'g_uuid_2'] },
]

const plannerPlayers = getSessionPlannerPlayers(dbMock, sMock, chalMock, null)
assert.equal(plannerPlayers.length, 4, 'thu thập đủ 2 thành viên + 2 khách')
assert.ok(plannerPlayers.some((p) => p.name === 'Khách Hoàng'), 'nhận diện đúng tên khách từ sessionGuests')
assert.ok(plannerPlayers.some((p) => p.name === 'Khách Tuấn'), 'nhận diện đúng tên khách từ challenge')
assert.ok(plannerPlayers.every((p) => !p.name.includes('uuid')), 'tuyệt đối không để lộ UUID làm tên')
assert.equal(plannerPlayers.find((p) => p.key === 'm1')?.avatarUrl, 'https://example.com/kuro.jpg', 'giữ avatarUrl của thành viên')
assert.equal(plannerPlayers.find((p) => p.key === 'g_uuid_1')?.avatarUrl, 'https://example.com/hoang.jpg', 'giữ avatarUrl của khách')

console.log('planner.test.js: All checks passed OK')
