// Unit tests cho Personal Bot Scenario Engine (v2.2)
//
// Kiểm tra độc lập 5 bước:
// 1. inspectMemberState()
// 2. detectRecentEvents() (Toán học Elo pre/post, freshness window, chasing threshold)
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

console.log('--- Test 1: inspectMemberState ---')
{
  const db = makeMockDb({ myElo: 1550, botElo: 1500, rivalElo: 1540 })
  const state = inspectMemberState(db, 'u1', NOW)

  assert.ok(state, 'Phải inspect được state hợp lệ')
  assert.equal(state.memberId, 'u1')
  assert.equal(state.currentElo, 1550)
  assert.equal(state.currentRank, 1, 'u1 điểm cao nhất phải rank 1')
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

console.log('--- Test 3: Chuỗi thắng / Chuỗi thua (Streak) ---')
{
  // 3 trận thắng liên tiếp trong 24h
  const m1 = { id: 'm1', at: NOW - 5 * ONE_HOUR, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const m2 = { id: 'm2', at: NOW - 3 * ONE_HOUR, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }
  const m3 = { id: 'm3', at: NOW - 1 * ONE_HOUR, winnerTeam: 'A', teamA: ['u1'], teamB: ['u3'], playerKeys: ['u1', 'u3'] }

  const db = makeMockDb({ matches: [m3, m2, m1] })
  const state = inspectMemberState(db, 'u1', NOW)
  const events = detectRecentEvents(db, 'u1', state, NOW)

  const streakEvent = events.find((e) => e.type === 'streak_win_3' || e.type === 'streak_win_5')
  assert.ok(streakEvent, 'Phải phát hiện sự kiện chuỗi thắng')
  assert.equal(streakEvent.eventKey, 'match:m3', 'EventKey phải gắn với trận mới nhất')
  assert.equal(streakEvent.data.n, 3)
}

console.log('--- Test 4: Synergy CHỈ gom các kịch bản CÙNG eventKey ---')
{
  // Cùng 1 trận m_epic: vừa chuỗi thắng, vừa vượt rival u2, vừa vượt bot!
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

  // u1: trước trận = 1490 (thấp hơn bot 1500 và rival 1495)
  // sau trận = 1510 (vượt cả bot và rival)
  const db = makeMockDb({
    myElo: 1510,
    botElo: 1500,
    rivalElo: 1475,
    matches: [epicMatch, prevMatch2, prevMatch1],
  })

  const state = inspectMemberState(db, 'u1', NOW)
  const events = detectRecentEvents(db, 'u1', state, NOW)
  const candidates = detectScenarios(events, state)

  // Tất cả candidates từ m_epic phải cùng eventKey 'match:m_epic'
  const epicCandidates = candidates.filter((c) => c.eventKey === 'match:m_epic')
  assert.ok(epicCandidates.length >= 2, 'Có ít nhất 2 sự kiện xảy ra trong cùng trận m_epic')

  const synergized = applySynergy(candidates, state)
  // console.log('DEBUG TEST 4:', { candidates, synergized })
  const synergyCombo = synergized.find((s) => s.scenarioKey === 'synergy_streak_overtake_both' || s.category === 'synergy')
  assert.ok(synergyCombo, 'Phải tạo ra Synergy kịch bản gộp')
  assert.equal(synergyCombo.eventKey, 'match:m_epic', 'Synergy bắt buộc mang eventKey của trận đó')

  // Thử nghiệm case 2 sự kiện KHÁC eventKey -> KHÔNG được gộp
  const separateCandidates = [
    { eventKey: 'match:m1', scenarioKey: 'streak_win', baseScore: 60, occurredAt: NOW - 2000 },
    { eventKey: 'match:m2', scenarioKey: 'overtake_rival', baseScore: 70, occurredAt: NOW - 1000 },
  ]
  const noCombo = applySynergy(separateCandidates, state)
  assert.equal(noCombo.length, 2, 'Khác eventKey thì giữ nguyên 2 candidates riêng biệt, không gom bừa')
}

console.log('--- Test 5: evaluateEncounter & Daily Modal Cap ---')
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

console.log('--- Test 6: getPersonalBotEncounter Pipeline E2E ---')
{
  const db = makeMockDb({
    myElo: 1510,
    botElo: 1500,
    rivalElo: 1475,
    matches: [
      {
        id: 'm_e2e',
        at: NOW - 30 * 60 * 1000, // 30 phút trước
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
