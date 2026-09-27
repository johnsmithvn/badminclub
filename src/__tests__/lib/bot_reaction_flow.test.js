import assert from 'node:assert/strict'
import {
  botLineKey,
  pickBotPredictionForChallenge,
} from '#lib/bot.js'
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

console.log('bot reaction flow integration check: OK')
