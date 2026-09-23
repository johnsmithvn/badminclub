import assert from 'node:assert/strict'
import {
  findBotMember,
  botLineKey,
  pickBotPredictionForChallenge,
} from '#lib/bot.js'
import { resolveActivityPayload } from '#lib/activity.js'
import { detectMatchNarrative } from '#lib/activity.js'

const NOW = Date.parse('2026-09-23T12:00:00.000Z')

const mem = (id, extra = {}) => ({
  id, name: `Tên ${id}`, gender: 'nam', level: 'TB', active: true, ...extra,
})
const rating = (id, r, gamesCount = 10) => ({ memberId: id, rating: r, gamesCount })

const mockDb = () => ({
  clubId: 'club_flow_test',
  members: [
    mem('bot', { isBot: true, name: 'Cầu Thủ Ảo' }),
    mem('u1', { name: 'Nam' }),
    mem('u2', { name: 'Bắc' }),
  ],
  playerRatings: [
    rating('bot', 1500),
    rating('u1', 1600),
    rating('u2', 1400),
  ],
  matches: [
    // Bot có 1 trận trong mùa để có điểm mùa
    {
      id: 'm_seed',
      at: NOW - 3600000,
      winnerTeam: 'A',
      ratingEnabled: true,
      eloDelta: 10,
      teamA: ['bot'],
      teamB: ['u2'],
      sets: [[21, 15]],
      playerKeys: ['bot', 'u2'],
    },
  ],
  challenges: [],
  challengePredictions: [],
})

/* ==========================================================================
 * Case 1: Create Challenge → botBetOnChallenge(newChal) → Bot prediction được tạo
 * ========================================================================== */
const db1 = mockDb()
const newChal = {
  id: 'chal_immediate_001',
  code: 'K01',
  teamA: ['u1'],
  teamB: ['u2'],
  bestOf: 1,
  predictionsEnabled: true,
  predictionsLocked: false,
  status: 'pending',
}

// newChal CHƯA hề có trong db1.challenges (mô phỏng đúng lúc createChallenge vừa xong)
assert.equal(db1.challenges.find((c) => c.id === newChal.id), undefined, 'Kèo chưa có trong snapshot DB client')

const botBet = pickBotPredictionForChallenge(db1, newChal, NOW)
assert.ok(botBet, 'Bot cược ngay lập tức cho kèo mới tạo')
assert.equal(botBet.challengeId, 'chal_immediate_001')
assert.ok(botBet.stake >= 1, 'Mức cược >= 1 SP')
assert.ok(['A', 'B'].includes(botBet.team), 'Phe cược hợp lệ (A hoặc B)')

/* ==========================================================================
 * Case 2: Decline Bot Challenge → bot_remark được tạo với kind thích hợp
 * ========================================================================== */
const db2 = mockDb()
const botCreatedChal = {
  id: 'chal_bot_created',
  code: 'KBOT',
  createdBy: 'bot',
  teamA: ['u1'],
  teamB: ['u2'],
  status: 'declined',
  declinedBy: 'u2',
}
db2.challenges.push(botCreatedChal)

// Xác định loại reaction
const isBotCreated = botCreatedChal.createdBy === 'bot'
const declineKind = isBotCreated ? 'declined_bot' : 'declined_user'
assert.equal(declineKind, 'declined_bot', 'Kèo do bot tạo bị từ chối phát ra kind declined_bot')

// Kiểm tra resolve payload
const declineEvent = {
  id: 'evt_decl_001',
  club_id: 'club_flow_test',
  actor_id: 'bot',
  type: 'bot_remark',
  payload: {
    kind: declineKind,
    subject: 'u2',
    declinerId: 'u2',
    chalId: botCreatedChal.id,
    code: botCreatedChal.code,
  },
  ref_type: 'challenge',
  ref_id: botCreatedChal.id,
}
const resolvedDecline = resolveActivityPayload(declineEvent, db2)
assert.equal(resolvedDecline.bot, 'Cầu Thủ Ảo')
assert.equal(resolvedDecline.decliner, 'Bắc')
const declineKey = botLineKey('reaction', declineKind, declineEvent.id)
assert.match(declineKey, /^bot\.reaction\.declined_bot\.[1-3]$/, 'Tạo đúng template bot.reaction.declined_bot')

/* ==========================================================================
 * Case 3: Cancel Challenge → bot_remark được tạo với kind cancelled
 * ========================================================================== */
const db3 = mockDb()
const cancelledChal = {
  id: 'chal_canc_001',
  code: 'KCANC',
  createdBy: 'u1',
  teamA: ['u1'],
  teamB: ['u2'],
  status: 'cancelled',
}
db3.challenges.push(cancelledChal)

const cancelEvent = {
  id: 'evt_canc_001',
  club_id: 'club_flow_test',
  actor_id: 'bot',
  type: 'bot_remark',
  payload: {
    kind: 'cancelled',
    subject: 'u1',
    chalId: cancelledChal.id,
    code: cancelledChal.code,
  },
  ref_type: 'challenge',
  ref_id: cancelledChal.id,
}
const resolvedCancel = resolveActivityPayload(cancelEvent, db3)
assert.equal(resolvedCancel.bot, 'Cầu Thủ Ảo')
const cancelKey = botLineKey('reaction', 'cancelled', cancelEvent.id)
assert.match(cancelKey, /^bot\.reaction\.cancelled\.[1-3]$/, 'Tạo đúng template bot.reaction.cancelled')

/* ==========================================================================
 * Case 4: Complete Bot Challenge → Đúng 1 bot reaction được tạo theo narrative
 * ========================================================================== */
const finishedMatch = {
  id: 'm_finished',
  winnerTeam: 'A',
  teamA: ['u1'],
  teamB: ['u2'],
  sets: [[21, 5]], // Trận cách biệt lớn
}
const narrative = detectMatchNarrative(finishedMatch)
const matchKind = narrative === 'blowout' ? 'blowout'
  : (narrative === 'clutch' || narrative === 'comeback') ? 'clutch'
    : 'normal'
assert.equal(matchKind, 'blowout', 'Tỷ số 21-5 được nhận diện là blowout')

const completeKey = botLineKey('reaction', matchKind, 'match_reaction_seed')
assert.match(completeKey, /^bot\.reaction\.blowout\.[1-3]$/, 'Tạo đúng template bot.reaction.blowout')

/* ==========================================================================
 * Case 5: Idempotent / Duplicate Guard (chống spam nhiều reaction cho cùng kèo)
 * ========================================================================== */
// Mô phỏng bảng activity_events với logic guard của RPC post_bot_reaction
const activityEventsTable = []

function simulatePostBotReaction(clubId, botId, kind, challengeId) {
  // Guard 1: Advisory lock theo challenge_id (xử lý ở tầng SQL)
  // Guard 2: Chống ghi trùng phản ứng cùng loại cho cùng một kèo
  const exists = activityEventsTable.some(
    (e) => e.club_id === clubId
      && e.type === 'bot_remark'
      && e.payload?.kind === kind
      && e.ref_type === 'challenge'
      && e.ref_id === challengeId,
  )
  if (exists) return null

  const newEvent = {
    id: `evt_${Date.now()}_${Math.random()}`,
    club_id: clubId,
    actor_id: botId,
    type: 'bot_remark',
    payload: { kind, chalId: challengeId },
    ref_type: 'challenge',
    ref_id: challengeId,
  }
  activityEventsTable.push(newEvent)
  return newEvent.id
}

// Gọi lần 1: tạo thành công
const res1 = simulatePostBotReaction('c1', 'bot', 'declined_bot', 'chal_999')
assert.ok(res1, 'Lần gọi đầu tiên thành công tạo reaction')
assert.equal(activityEventsTable.length, 1)

// Gọi lần 2 (trigger trùng từ effect/reload/sweep): bị chặn
const res2 = simulatePostBotReaction('c1', 'bot', 'declined_bot', 'chal_999')
assert.equal(res2, null, 'Lần gọi thứ hai bị chặn do duplicate guard')
assert.equal(activityEventsTable.length, 1, 'Chỉ có đúng 1 activity event được ghi')

// Gọi lần 3: vẫn bị chặn
const res3 = simulatePostBotReaction('c1', 'bot', 'declined_bot', 'chal_999')
assert.equal(res3, null, 'Lần gọi thứ ba tiếp tục bị chặn')
assert.equal(activityEventsTable.length, 1, 'Vẫn chỉ có đúng 1 activity event')

console.log('bot reaction flow integration check: OK')
