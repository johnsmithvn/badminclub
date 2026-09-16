import assert from 'node:assert/strict'
import {
  calcRoundTimes,
  createDefaultPlan,
  calcPlayerLoads,
  calcCourtBalanceScore,
  calcPlanHealth,
  detectPlanIssues,
  autoGeneratePlan,
} from '../../lib/planner.js'

// 1. calcRoundTimes
const times = calcRoundTimes('19:00', 18, 3)
assert.equal(times.length, 3, 'sinh đúng 3 vòng')
assert.equal(times[0].label, 'R1')
assert.equal(times[0].time, '19:00')
assert.equal(times[0].timeRange, '19:00 → 19:18')
assert.equal(times[1].time, '19:18')
assert.equal(times[2].time, '19:36')

// 2. createDefaultPlan
const sessionMock = {
  id: 's1',
  courts: [{ courtLabel: 'Sân 1' }, { courtLabel: 'Sân 2' }],
}
const defaultPlan = createDefaultPlan(sessionMock, [], 18, 10)
assert.equal(defaultPlan.rounds.length, 10, 'mặc định 10 vòng')
assert.equal(defaultPlan.rounds[0].courts.length, 2, 'mỗi vòng có 2 sân')
assert.equal(defaultPlan.rounds[0].courts[0].name, 'Sân 1')

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

console.log('planner.test.js: All checks passed OK')
