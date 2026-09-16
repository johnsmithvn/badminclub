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
  isPlayerAbsent,
  validateChallengeAttendance,
  validateWishAttendance,
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

// 8. autoGeneratePlan với mode = 'fill' (giữ nguyên các ô đã xếp tay)
const baseRounds = [
  {
    roundIndex: 0,
    label: 'R1',
    time: '19:00',
    courts: [
      { courtIndex: 0, name: 'Sân 1', teamA: ['p_1', 'p_2'], teamB: ['p_3', 'p_4'], tag: 'MANUAL' },
      { courtIndex: 1, name: 'Sân 2', teamA: [], teamB: [] },
    ],
  },
]
const filledRounds = autoGeneratePlan({
  existingRounds: baseRounds,
  mode: 'fill',
  players: all16,
  courts: [{ courtIndex: 0, name: 'Sân 1' }, { courtIndex: 1, name: 'Sân 2' }],
  totalRounds: 1,
})
assert.equal(filledRounds[0].courts[0].teamA[0], 'p_1', 'giữ nguyên đội A sân 1')
assert.equal(filledRounds[0].courts[0].teamA[1], 'p_2', 'giữ nguyên đội A sân 1')
assert.equal(filledRounds[0].courts[0].tag, 'MANUAL', 'giữ nguyên tag MANUAL đã xếp tay')
assert.equal(filledRounds[0].courts[1].teamA.length + filledRounds[0].courts[1].teamB.length, 4, 'sân 2 được điền đủ 4 người')

// 9. autoGeneratePlan với strategy = 'gender' (ghép đôi nam nữ)
const genderPlayers = [
  { key: 'm1', name: 'Nam 1', gender: 'nam' },
  { key: 'm2', name: 'Nam 2', gender: 'nam' },
  { key: 'f1', name: 'Nữ 1', gender: 'nu' },
  { key: 'f2', name: 'Nữ 2', gender: 'nu' },
]
const genderRounds = autoGeneratePlan({
  players: genderPlayers,
  courts: [{ courtIndex: 0, name: 'Sân 1' }],
  strategy: 'gender',
  totalRounds: 1,
})
const gCourt = genderRounds[0].courts[0]
const gA = gCourt.teamA.map((k) => genderPlayers.find((p) => p.key === k)?.gender)
const gB = gCourt.teamB.map((k) => genderPlayers.find((p) => p.key === k)?.gender)
assert.ok(gA.includes('nam') && gA.includes('nu'), 'đội A có 1 nam và 1 nữ')
assert.ok(gB.includes('nam') && gB.includes('nu'), 'đội B có 1 nam và 1 nữ')

// 10. autoGeneratePlan tự động ưu tiên xếp NGUYỆN VỌNG THÀNH VIÊN
const wishRounds = autoGeneratePlan({
  players: all16,
  courts: [{ courtIndex: 0, name: 'Sân 1' }, { courtIndex: 1, name: 'Sân 2' }],
  wishes: [
    { id: 'w_test', memberId: 'p_5', targetId: 'p_6', type: 'partner', text: 'p_5 muốn cặp p_6' },
  ],
  totalRounds: 4,
})
// Tìm sân có gắn tag WISH
let foundWishCourt = null
wishRounds.forEach((r) => {
  r.courts.forEach((c) => {
    if (c.wishId === 'w_test') foundWishCourt = c
  })
})
assert.ok(foundWishCourt, 'tìm thấy sân được xếp nguyện vọng')
assert.equal(foundWishCourt.tag, 'WISH', 'sân có tag WISH')
assert.ok(foundWishCourt.teamA.includes('p_5') && foundWishCourt.teamA.includes('p_6'), 'p_5 và p_6 được ghép chung đội A theo đúng nguyện vọng')

// 11. isPlayerAbsent, validateChallengeAttendance, validateWishAttendance
assert.equal(isPlayerAbsent('p_absent', { p_absent: false }), true, 'false là vắng mặt')
assert.equal(isPlayerAbsent('p_noshow', { p_noshow: 'noshow' }), true, 'noshow là vắng mặt')
assert.equal(isPlayerAbsent('p_present', { p_present: true }), false, 'true là có mặt')
assert.equal(isPlayerAbsent('p_extra', { p_extra: 'extra' }), false, 'extra là có mặt')
assert.equal(isPlayerAbsent('p_none', {}), false, 'chưa điểm danh không coi là vắng mặt')

const sampleChal = { id: 'c_test', teamA: ['p_1', 'p_2'], teamB: ['p_3', 'p_4'] }
const chalValid = validateChallengeAttendance(sampleChal, { p_1: true, p_2: true, p_3: true, p_4: true }, all16)
assert.equal(chalValid.valid, true, 'tất cả có mặt -> kèo hợp lệ')
assert.equal(chalValid.hasAbsent, false)

const chalAbsent = validateChallengeAttendance(sampleChal, { p_1: true, p_2: false, p_3: true, p_4: 'noshow' }, all16)
assert.equal(chalAbsent.valid, false, 'có người vắng mặt -> kèo không hợp lệ')
assert.equal(chalAbsent.hasAbsent, true)
assert.deepEqual(chalAbsent.absentKeys, ['p_2', 'p_4'], 'chỉ ra đúng người vắng')

const sampleWish = { id: 'w_test', memberId: 'p_1', targetId: 'p_2' }
const wishValid = validateWishAttendance(sampleWish, { p_1: true, p_2: true }, all16)
assert.equal(wishValid.valid, true, '2 người đều có mặt -> nguyện vọng hợp lệ')

const wishAbsent = validateWishAttendance(sampleWish, { p_1: true, p_2: false }, all16)
assert.equal(wishAbsent.valid, false, 'người được ghép vắng mặt -> nguyện vọng không hợp lệ')
assert.deepEqual(wishAbsent.absentKeys, ['p_2'])

// 12. autoGeneratePlan tự động huỷ/bỏ qua Kèo & Nguyện vọng có người vắng mặt
const attWithAbsents = {
  p_3: false, // vắng mặt
  p_6: 'noshow', // nghỉ không báo
}
const autoAbsenceRounds = autoGeneratePlan({
  players: all16,
  courts: [{ courtIndex: 0, name: 'Sân 1' }, { courtIndex: 1, name: 'Sân 2' }],
  challenges: [
    { id: 'ch_has_absent', status: 'accepted', teamA: ['p_1', 'p_2'], teamB: ['p_3', 'p_4'] }, // có p_3 vắng
    { id: 'ch_all_present', status: 'accepted', teamA: ['p_7', 'p_8'], teamB: ['p_9', 'p_10'] }, // tất cả có mặt
  ],
  wishes: [
    { id: 'wish_has_absent', memberId: 'p_5', targetId: 'p_6', type: 'partner' }, // có p_6 vắng
    { id: 'wish_all_present', memberId: 'p_11', targetId: 'p_12', type: 'partner' }, // có mặt
  ],
  attendance: attWithAbsents,
  totalRounds: 6,
})

// Kiểm tra: Kèo và nguyện vọng có người vắng TUYỆT ĐỐI không được lên sân
let placedChalAbsent = false
let placedWishAbsent = false
let placedChalValid = false
let placedWishValid = false

autoAbsenceRounds.forEach((r) => {
  r.courts.forEach((c) => {
    if (c.challengeId === 'ch_has_absent') placedChalAbsent = true
    if (c.challengeId === 'ch_all_present') placedChalValid = true
    if (c.wishId === 'wish_has_absent') placedWishAbsent = true
    if (c.wishId === 'wish_all_present') placedWishValid = true
  })
})

assert.equal(placedChalAbsent, false, 'kèo có người vắng TUYỆT ĐỐI không được xếp lên sân')
assert.equal(placedWishAbsent, false, 'nguyện vọng có người vắng TUYỆT ĐỐI không được xếp lên sân')
assert.equal(placedChalValid, true, 'kèo hợp lệ được xếp thành công')
assert.equal(placedWishValid, true, 'nguyện vọng hợp lệ được xếp thành công')
assert.ok(autoAbsenceRounds.report, 'có gắn report vào kết quả')
assert.equal(autoAbsenceRounds.report.invalidChallengesCount, 1, 'báo cáo đúng 1 kèo không hợp lệ do vắng')
assert.equal(autoAbsenceRounds.report.invalidWishesCount, 1, 'báo cáo đúng 1 nguyện vọng không hợp lệ do vắng')
assert.equal(autoAbsenceRounds.report.scheduledChallengesCount, 1, 'báo cáo 1 kèo đã xếp')
assert.equal(autoAbsenceRounds.report.scheduledWishesCount, 1, 'báo cáo 1 nguyện vọng đã xếp')

// Xác nhận người vắng mặt hoặc nghỉ không báo TUYỆT ĐỐI không bị bốc vào sân tự do ở bất kỳ vòng nào
let absentPlayerFoundOnCourt = false
autoAbsenceRounds.forEach((r) => {
  r.courts.forEach((c) => {
    const onCourt = [...(c.teamA || []), ...(c.teamB || [])]
    if (onCourt.includes('p_3') || onCourt.includes('p_6')) {
      absentPlayerFoundOnCourt = true
    }
  })
})
assert.equal(absentPlayerFoundOnCourt, false, 'người vắng hoặc noshow tuyệt đối không được xếp vào bất kỳ sân nào kể cả bốc tự do')

// 13. autoGeneratePlan với bộ lọc selectedChallengeIds & selectedWishIds
const selectedFilterRounds = autoGeneratePlan({
  players: all16,
  courts: [{ courtIndex: 0, name: 'Sân 1' }, { courtIndex: 1, name: 'Sân 2' }],
  challenges: [
    { id: 'ch_pick_1', status: 'accepted', teamA: ['p_1', 'p_2'], teamB: ['p_7', 'p_8'] },
    { id: 'ch_unpicked', status: 'accepted', teamA: ['p_9', 'p_10'], teamB: ['p_11', 'p_12'] },
  ],
  selectedChallengeIds: ['ch_pick_1'], // Host chỉ chọn ch_pick_1
  totalRounds: 4,
})
let placedPick1 = false
let placedUnpicked = false
selectedFilterRounds.forEach((r) => {
  r.courts.forEach((c) => {
    if (c.challengeId === 'ch_pick_1') placedPick1 = true
    if (c.challengeId === 'ch_unpicked') placedUnpicked = true
  })
})
assert.equal(placedPick1, true, 'kèo được host tick chọn được xếp')
assert.equal(placedUnpicked, false, 'kèo không được host chọn bị bỏ qua')

// 14. autoGeneratePlan với mode: 'fill' điền thêm Kèo mới vào ô trống mà không đè trận cũ
const existingBoard = [
  {
    roundIndex: 0,
    courts: [
      { courtIndex: 0, teamA: ['p_1', 'p_2'], teamB: ['p_3', 'p_4'], challengeId: null, wishId: null },
      { courtIndex: 1, teamA: ['p_5', 'p_6'], teamB: ['p_7', 'p_8'], challengeId: null, wishId: null },
    ],
  },
  {
    roundIndex: 1,
    courts: [
      { courtIndex: 0, teamA: ['p_9', 'p_10'], teamB: ['p_11', 'p_12'], challengeId: null, wishId: null },
      { courtIndex: 1, teamA: [], teamB: [], challengeId: null, wishId: null }, // Trống
    ],
  },
  {
    roundIndex: 2,
    courts: [
      { courtIndex: 0, teamA: [], teamB: [], challengeId: null, wishId: null }, // Trống
      { courtIndex: 1, teamA: [], teamB: [], challengeId: null, wishId: null }, // Trống
    ],
  },
]

const filledPlan = autoGeneratePlan({
  existingRounds: existingBoard,
  mode: 'fill',
  players: all16,
  courts: [{ courtIndex: 0, name: 'Sân 1' }, { courtIndex: 1, name: 'Sân 2' }],
  challenges: [
    { id: 'ch_fill_new', status: 'accepted', teamA: ['p_13', 'p_14'], teamB: ['p_15', 'p_16'] },
  ],
  totalRounds: 3,
})

// Kiểm tra vòng 0 giữ nguyên
assert.deepEqual(filledPlan[0].courts[0].teamA, ['p_1', 'p_2'], 'vòng 0 giữ nguyên teamA')
assert.deepEqual(filledPlan[0].courts[1].teamA, ['p_5', 'p_6'], 'vòng 0 giữ nguyên teamA sân 2')

// Kèo mới ch_fill_new được xếp vào ô trống
let placedFillChallenge = false
filledPlan.forEach((r) => {
  r.courts.forEach((c) => {
    if (c.challengeId === 'ch_fill_new') placedFillChallenge = true
  })
})
assert.equal(placedFillChallenge, true, 'mode fill xếp thành công kèo mới vào ô trống')
assert.equal(filledPlan.report.scheduledChallengesCount, 1, 'báo cáo đã xếp kèo mới ở mode fill')

// 9. Nguyện vọng đối đầu (type: 'opponent') được xếp vào hai đội khác nhau
const wishOpponentPlan = autoGeneratePlan({
  players: all16,
  courts: [{ courtIndex: 0, name: 'Sân 1' }, { courtIndex: 1, name: 'Sân 2' }],
  wishes: [
    { id: 'w_opp', memberId: 'p_1', targetId: 'p_2', type: 'opponent' },
  ],
  totalRounds: 2,
})
let placedOpponentWish = false
wishOpponentPlan.forEach((r) => {
  r.courts.forEach((c) => {
    if (c.wishId === 'w_opp') {
      placedOpponentWish = true
      assert.ok(c.teamA.includes('p_1'), 'p_1 ở teamA')
      assert.ok(c.teamB.includes('p_2'), 'p_2 ở teamB')
    }
  })
})
assert.equal(placedOpponentWish, true, 'xếp thành công nguyện vọng đối đầu')

// 10. Kèo BO3 chiếm 2 vòng liên tiếp trên cùng 1 sân
const bo3Plan = autoGeneratePlan({
  players: all16,
  courts: [{ courtIndex: 0, name: 'Sân 1' }, { courtIndex: 1, name: 'Sân 2' }],
  challenges: [
    { id: 'c_bo3', teamA: ['p_1', 'p_2'], teamB: ['p_3', 'p_4'], bestOf: 3, status: 'accepted' },
  ],
  totalRounds: 4,
})
let bo3RoundIndices = []
bo3Plan.forEach((r) => {
  r.courts.forEach((c) => {
    if (c.challengeId === 'c_bo3') {
      bo3RoundIndices.push(r.roundIndex)
    }
  })
})
assert.equal(bo3RoundIndices.length, 2, 'Kèo BO3 phải chiếm đúng 2 vòng')
assert.equal(bo3RoundIndices[1], bo3RoundIndices[0] + 1, 'Kèo BO3 phải chiếm 2 vòng liên tiếp nhau')

console.log('planner.test.js: All checks passed OK')

