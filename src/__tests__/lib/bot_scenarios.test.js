// Unit tests cho Personal Bot Scenario Engine (v2.2)
//
// Kiểm tra độc lập các bước và transition detection:
// 1. inspectMemberState() (Tính preRank, currentRank, preMatchElo)
// 2. detectRecentEvents() (Overtake Elo pre/post, Revenge previous loss, Chasing threshold crossing, Top 3 entered)
// 3. detectScenarios()
// 4. applySynergy() (Chỉ gom cùng eventKey)
// 5. evaluateEncounter() & getPersonalBotEncounter() (Flat score, Daily Modal Cap)

import assert from 'node:assert/strict'
import {
  inspectMemberState,
  detectRecentEvents,
  detectScenarios,
  applySynergy,
  evaluateEncounter,
  getPersonalBotEncounter,
} from '#lib/botScenarios.js'

const NOW = Date.parse('2026-09-23T12:00:00.000Z')
const ONE_HOUR = 3600 * 1000
const ONE_DAY = 24 * 3600 * 1000

const mem = (id, extra = {}) => ({
  id, name: `Member ${id}`, gender: 'nam', level: 'TB', active: true, ...extra,
})
const rating = (id, r, gamesCount = 10) => ({ memberId: id, rating: r, gamesCount })

function makeMockDb({
  myElo = 1500,
  botElo = 1490,
  rivalElo = 1495,
  matches = [],
} = {}) {
  return {
    clubId: 'club_scenario_test',
    members: [
      mem('bot', { isBot: true, name: 'Bot AI' }),
      mem('u1', { name: 'Thành Nam' }),
      mem('u2', { name: 'Văn Bắc' }),
      mem('u3', { name: 'Hải Phòng' }),
    ],
    playerRatings: [
      rating('u1', myElo),
      rating('bot', botElo),
      rating('u2', rivalElo),
      rating('u3', 1300),
    ],
    matches,
    challenges: [],
  }
}

console.log('--- Test 1: inspectMemberState & preRank calculation ---')
{
  // u1: hiện tại 1550 (Rank 1). Trước trận thắng (delta 20) u1 = 1530
  // u2: hiện tại 1540 (Rank 2). Trước trận u2 = 1560 (Rank 1)
  // Vậy trước trận: u2 = 1560 (Rank 1), u1 = 1530 (Rank 2) -> preRank của u1 = 2
  const m = {
    id: 'm_rank',
    at: NOW - ONE_HOUR,
    winnerTeam: 'A',
    ratingEnabled: true,
    eloDelta: 20,
    teamA: ['u1'],
    teamB: ['u2'],
    playerKeys: ['u1', 'u2'],
  }
  const db = makeMockDb({ myElo: 1550, botElo: 1500, rivalElo: 1540, matches: [m] })
  const state = inspectMemberState(db, 'u1', NOW)

  assert.ok(state, 'Phải inspect được state hợp lệ')
  assert.equal(state.memberId, 'u1')
  assert.equal(state.currentElo, 1550)
  assert.equal(state.currentRank, 1, 'u1 điểm 1550 cao nhất phải rank 1')
  assert.equal(state.preRank, 2, 'Trước trận điểm 1530 phải rank 2 sau u2 (1560)')
  assert.equal(state.botElo, 1500)
  assert.equal(state.botRank, 3, 'Bot điểm 1500 phải rank 3')

  // Bot tự soi chính mình thì phải trả về null
  assert.equal(inspectMemberState(db, 'bot', NOW), null, 'Bot soi chính mình trả về null')
  // Member không tồn tại trả về null
  assert.equal(inspectMemberState(db, 'unknown', NOW), null)
}

console.log('--- Test 2: Overtake toán học từ Elo pre/post & Freshness Window ---')
{
  // Trận đấu diễn ra 2 tiếng trước: u1 thắng u2
  // Trước trận: u1 = 1490, u2 = 1500 (u1 < u2)
  // Sau trận (delta = 16): u1 = 1506, u2 = 1484 (u1 > u2 -> u1 VƯỢT u2)
  const freshMatch = {
    id: 'm_fresh_overtake',
    at: NOW - 2 * ONE_HOUR,
    winnerTeam: 'A',
    ratingEnabled: true,
    eloDelta: 16,
    teamA: ['u1'],
    teamB: ['u2'],
    playerKeys: ['u1', 'u2'],
  }

  const db = makeMockDb({
    myElo: 1506,
    rivalElo: 1484,
    matches: [freshMatch],
  })

  const state = inspectMemberState(db, 'u1', NOW)
  const events = detectRecentEvents(db, 'u1', state, NOW)

  const overtakeRival = events.find((e) => e.type === 'overtake_rival')
  assert.ok(overtakeRival, 'Phải phát hiện sự kiện overtake_rival từ biến động Elo pre/post')
  assert.equal(overtakeRival.eventKey, 'match:m_fresh_overtake')
  assert.equal(overtakeRival.data.rivalId, 'u2')

  // Nếu trận đấu diễn ra hơn 48h trước -> Không được xem là tươi mới
  const staleMatch = {
    ...freshMatch,
    id: 'm_stale_overtake',
    at: NOW - 3 * ONE_DAY,
  }
  const dbStale = makeMockDb({
    myElo: 1506,
    rivalElo: 1484,
    matches: [staleMatch],
  })
  const stateStale = inspectMemberState(dbStale, 'u1', NOW)
  const eventsStale = detectRecentEvents(dbStale, 'u1', stateStale, NOW)
  assert.ok(!eventsStale.some((e) => e.eventKey === 'match:m_stale_overtake'), 'Trận 3 ngày trước không được xem là tươi mới')
}

console.log('--- Test 3: Revenge Detection (Trận trước thua, trận này thắng) ---')
{
  // Case A: Trận m1 (3 ngày trước) u1 THUA u2. Trận m2 (1 tiếng trước) u1 THẮNG u2 -> REVENGE = TRUE
  const m1_loss = { id: 'm1', at: NOW - 3 * ONE_DAY, winnerTeam: 'B', teamA: ['u1'], teamB: ['u2'], playerKeys: ['u1', 'u2'] }
  const m2_win = { id: 'm2', at: NOW - 1 * ONE_HOUR, winnerTeam: 'A', teamA: ['u1'], teamB: ['u2'], playerKeys: ['u1', 'u2'], eloDelta: 12 }
  const dbA = makeMockDb({ myElo: 1512, rivalElo: 1488, matches: [m2_win, m1_loss] })
  const stateA = inspectMemberState(dbA, 'u1', NOW)
  const eventsA = detectRecentEvents(dbA, 'u1', stateA, NOW)
  assert.ok(eventsA.some((e) => e.type === 'revenge_complete'), 'Trận trước thua, trận này thắng -> revenge_complete = TRUE')

  // Case B: Trận m1 (3 ngày trước) u1 THẮNG u2. Trận m2 (1 tiếng trước) u1 lại THẮNG u2 -> KHÔNG PHẢI ĐÒI NỢ
  const m1_win = { id: 'm1', at: NOW - 3 * ONE_DAY, winnerTeam: 'A', teamA: ['u1'], teamB: ['u2'], playerKeys: ['u1', 'u2'] }
  const dbB = makeMockDb({ myElo: 1524, rivalElo: 1476, matches: [m2_win, m1_win] })
  const stateB = inspectMemberState(dbB, 'u1', NOW)
  const eventsB = detectRecentEvents(dbB, 'u1', stateB, NOW)
  assert.ok(!eventsB.some((e) => e.type === 'revenge_complete'), 'Trận trước đã thắng, trận này thắng tiếp -> revenge_complete = FALSE')

  // Case C: Trận thua u2 diễn ra cách đây 8 trận (đã đánh 7 trận khác xen giữa) -> Món nợ quá xa (> 6 trận) -> KHÔNG ĐÒI NỢ
  const intermediateMatches = Array.from({ length: 7 }, (_, i) => ({
    id: `m_inter_${i}`,
    at: NOW - 2 * ONE_DAY + i * 3600 * 1000,
    winnerTeam: 'A',
    teamA: ['u1'],
    teamB: ['u3'],
    playerKeys: ['u1', 'u3'],
  }))
  const dbC = makeMockDb({ myElo: 1512, rivalElo: 1488, matches: [m2_win, ...intermediateMatches, m1_loss] })
  const stateC = inspectMemberState(dbC, 'u1', NOW)
  const eventsC = detectRecentEvents(dbC, 'u1', stateC, NOW)
  assert.ok(!eventsC.some((e) => e.type === 'revenge_complete'), 'Trận thua cách hơn 6 trận của người chơi -> revenge_complete = FALSE')
}

console.log('--- Test 4: Chasing Bot (Threshold Crossing) & Near Streak Freshness ---')
{
  // Case A: Người chơi 2 tháng không đánh, đang cách Bot 10 Elo -> KHÔNG trigger chasing_bot
  const oldMatch = { id: 'm_old', at: NOW - 60 * ONE_DAY, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const dbOld = makeMockDb({ myElo: 1490, botElo: 1500, matches: [oldMatch] })
  const stateOld = inspectMemberState(dbOld, 'u1', NOW)
  const eventsOld = detectRecentEvents(dbOld, 'u1', stateOld, NOW)
  assert.ok(!eventsOld.some((e) => e.type === 'chasing_bot'), 'Người chơi 2 tháng không đánh -> KHÔNG sinh chasing_bot')

  // Case B: Trận vừa đánh (1h trước), trước trận gap là 22 (1500 - 1478), sau trận thắng +12 lên 1490 (gap = 10 <= 15) -> THRESHOLD CROSSING
  const freshThresholdMatch = {
    id: 'm_chase',
    at: NOW - 1 * ONE_HOUR,
    winnerTeam: 'A',
    eloDelta: 12,
    teamA: ['u1'],
    teamB: ['u3'],
    playerKeys: ['u1', 'u3'],
  }
  const dbChase = makeMockDb({ myElo: 1490, botElo: 1500, matches: [freshThresholdMatch] })
  const stateChase = inspectMemberState(dbChase, 'u1', NOW)
  const eventsChase = detectRecentEvents(dbChase, 'u1', stateChase, NOW)
  const chasingEvent = eventsChase.find((e) => e.type === 'chasing_bot')
  assert.ok(chasingEvent, 'Vừa bước vào ngưỡng <= 15 Elo qua trận vừa đánh -> chasing_bot = TRUE')
  assert.equal(chasingEvent.eventKey, 'match:m_chase')

  // Case C: Chuỗi thắng 4 nhưng trận thứ 4 diễn ra 3 ngày trước -> KHÔNG sinh near_streak_5
  const m1 = { id: 'm1', at: NOW - 6 * ONE_DAY, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const m2 = { id: 'm2', at: NOW - 5 * ONE_DAY, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const m3 = { id: 'm3', at: NOW - 4 * ONE_DAY, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const m4_old = { id: 'm4', at: NOW - 3 * ONE_DAY, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const dbStreakOld = makeMockDb({ matches: [m4_old, m3, m2, m1] })
  const stateStreakOld = inspectMemberState(dbStreakOld, 'u1', NOW)
  const eventsStreakOld = detectRecentEvents(dbStreakOld, 'u1', stateStreakOld, NOW)
  assert.ok(!eventsStreakOld.some((e) => e.type === 'near_streak_5'), 'Streak 4 từ 3 ngày trước -> KHÔNG sinh near_streak_5')

  // Case D: Trận thứ 4 vừa thắng trong 1 giờ -> near_streak_5 = TRUE
  const m4_fresh = { id: 'm4', at: NOW - 1 * ONE_HOUR, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const dbStreakFresh = makeMockDb({ matches: [m4_fresh, m3, m2, m1] })
  const stateStreakFresh = inspectMemberState(dbStreakFresh, 'u1', NOW)
  const eventsStreakFresh = detectRecentEvents(dbStreakFresh, 'u1', stateStreakFresh, NOW)
  assert.ok(eventsStreakFresh.some((e) => e.type === 'near_streak_5'), 'Trận thứ 4 vừa diễn ra trong 24h -> near_streak_5 = TRUE')
}

console.log('--- Test 5: Top 3 Entered Transition (preRank > 3 && currentRank <= 3) ---')
{
  // Bảng điểm: bot=1600 (rank 1), u2=1550 (rank 2), u3=1500 (rank 3)
  // u1: trước trận = 1480 (Rank 4). Thắng nhận +25 elo lên 1505 (vượt u3, leo lên Rank 3)
  const m_enter = {
    id: 'm_enter_top3',
    at: NOW - 1 * ONE_HOUR,
    winnerTeam: 'A',
    eloDelta: 25,
    teamA: ['u1'],
    teamB: ['u3'],
    playerKeys: ['u1', 'u3'],
  }
  const dbEnter = {
    clubId: 'c1',
    members: [mem('bot', { isBot: true }), mem('u1'), mem('u2'), mem('u3')],
    playerRatings: [
      rating('bot', 1600),
      rating('u2', 1550),
      rating('u1', 1505), // Rank 3
      rating('u3', 1475), // Rank 4
    ],
    matches: [m_enter],
  }
  const stateEnter = inspectMemberState(dbEnter, 'u1', NOW)
  assert.equal(stateEnter.currentRank, 3, 'Hiện tại rank 3')
  assert.equal(stateEnter.preRank, 4, 'Trước trận rank 4')
  const eventsEnter = detectRecentEvents(dbEnter, 'u1', stateEnter, NOW)
  assert.ok(eventsEnter.some((e) => e.type === 'top3_entered'), 'Rank 4 -> Rank 3: Phải sinh sự kiện top3_entered')

  // Đang Rank 3 thắng lên Rank 2 -> preRank=3, currentRank=2 -> KHÔNG sinh top3_entered (đã ở trong Top 3)
  const m_stay = {
    id: 'm_stay_top3',
    at: NOW - 1 * ONE_HOUR,
    winnerTeam: 'A',
    eloDelta: 10,
    teamA: ['u1'],
    teamB: ['u3'],
    playerKeys: ['u1', 'u3'],
  }
  const dbStay = {
    clubId: 'c1',
    members: [mem('bot', { isBot: true }), mem('u1'), mem('u2'), mem('u3')],
    playerRatings: [
      rating('bot', 1600),
      rating('u1', 1560), // Rank 2
      rating('u2', 1550), // Rank 3
      rating('u3', 1450), // Rank 4
    ],
    matches: [m_stay],
  }
  const stateStay = inspectMemberState(dbStay, 'u1', NOW)
  assert.equal(stateStay.preRank, 2, 'Trước trận đã ở Rank 2')
  const eventsStay = detectRecentEvents(dbStay, 'u1', stateStay, NOW)
  assert.ok(!eventsStay.some((e) => e.type === 'top3_entered'), 'Đã ở trong Top 3 trước trận -> KHÔNG sinh top3_entered')
}

console.log('--- Test 6: Synergy CHỈ gom các kịch bản CÙNG eventKey ---')
{
  const epicMatch = {
    id: 'm_epic',
    at: NOW - 1 * ONE_HOUR,
    winnerTeam: 'A',
    ratingEnabled: true,
    eloDelta: 20,
    teamA: ['u1'],
    teamB: ['u2'],
    playerKeys: ['u1', 'u2'],
  }
  const prevMatch1 = { id: 'p1', at: NOW - 4 * ONE_HOUR, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const prevMatch2 = { id: 'p2', at: NOW - 3 * ONE_HOUR, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }

  const db = makeMockDb({
    myElo: 1510,
    botElo: 1500,
    rivalElo: 1475,
    matches: [epicMatch, prevMatch2, prevMatch1],
  })

  const state = inspectMemberState(db, 'u1', NOW)
  const events = detectRecentEvents(db, 'u1', state, NOW)
  const candidates = detectScenarios(events, state)

  const epicCandidates = candidates.filter((c) => c.eventKey === 'match:m_epic')
  assert.ok(epicCandidates.length >= 2, 'Có ít nhất 2 sự kiện xảy ra trong cùng trận m_epic')

  const synergized = applySynergy(candidates, state)
  const synergyCombo = synergized.find((s) => s.scenarioKey === 'synergy_streak_overtake_both' || s.category === 'synergy')
  assert.ok(synergyCombo, 'Phải tạo ra Synergy kịch bản gộp')
  assert.equal(synergyCombo.eventKey, 'match:m_epic', 'Synergy bắt buộc mang eventKey của trận đó')

  // Thử nghiệm case 2 sự kiện KHÁC eventKey -> KHÔNG được gộp
  const separateCandidates = [
    { eventKey: 'match:m1', scenarioKey: 'streak_win_3', baseScore: 60, occurredAt: NOW - 2000 },
    { eventKey: 'match:m2', scenarioKey: 'overtake_rival', baseScore: 70, occurredAt: NOW - 1000 },
  ]
  const noCombo = applySynergy(separateCandidates, state)
  assert.equal(noCombo.length, 2, 'Khác eventKey thì giữ nguyên 2 candidates riêng biệt, không gom bừa')
}

console.log('--- Test 7: evaluateEncounter & Daily Modal Cap ---')
{
  const mockMemory = {
    seenModal: false,
    hasSeenModalToday(memberId, now) {
      return this.seenModal
    },
    hasShownRecently() {
      return false
    },
  }

  const highCandidates = [
    {
      scenarioKey: 'overtake_bot',
      eventKey: 'match:m1',
      baseScore: 85,
      occurredAt: NOW - 1 * ONE_HOUR,
      tone: 'competitive',
    },
  ]

  // Lần đầu trong ngày: Điểm 85 >= 75 và chưa thấy modal -> Trả về mode: 'modal'
  const dec1 = evaluateEncounter(highCandidates, 'u1', NOW, mockMemory)
  assert.equal(dec1.mode, 'modal', 'Điểm cao + chưa xem modal hôm nay -> mode: modal')
  assert.equal(dec1.scenario.scenarioKey, 'overtake_bot')

  // Giả lập đã xem Modal hôm nay
  mockMemory.seenModal = true
  const dec2 = evaluateEncounter(highCandidates, 'u1', NOW, mockMemory)
  assert.equal(dec2.mode, 'card', 'Đã xem modal hôm nay -> Hạ cấp xuống mode: card')

  // Điểm quá thấp (< 40) -> Trả về mode: 'none'
  const lowCandidates = [
    {
      scenarioKey: 'idle_warning',
      eventKey: 'time:now',
      baseScore: 20,
      occurredAt: NOW,
    },
  ]
  const decLow = evaluateEncounter(lowCandidates, 'u1', NOW, mockMemory)
  assert.equal(decLow.mode, 'none', 'Điểm dưới 40 trả về mode: none')
}

console.log('--- Test 8: getPersonalBotEncounter Pipeline E2E ---')
{
  const db = makeMockDb({
    myElo: 1510,
    botElo: 1500,
    rivalElo: 1475,
    matches: [
      {
        id: 'm_e2e',
        at: NOW - 30 * 60 * 1000,
        winnerTeam: 'A',
        ratingEnabled: true,
        eloDelta: 18,
        teamA: ['u1'],
        teamB: ['u2'],
        playerKeys: ['u1', 'u2'],
      },
    ],
  })

  const mockMemory = {
    hasSeenModalToday: () => false,
    hasShownRecently: () => false,
  }

  const result = getPersonalBotEncounter(db, 'u1', NOW, mockMemory)
  assert.ok(result, 'Result phải tồn tại')
  assert.ok(['modal', 'card'].includes(result.mode), 'Phải kích hoạt modal hoặc card')
  assert.ok(result.scenario, 'Phải có scenario')
  assert.ok(result.scenario.lineKey, 'Scenario phải có i18n lineKey')

  console.log('Bot Scenario Engine: OK')
}
