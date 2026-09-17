// src/__tests__/activity/activity.test.js
// Kiểm thử các hàm thuần trong src/lib/activity.js

import assert from 'node:assert/strict'
import {
  detectMatchNarrative,
  getPersonalHighlights,
  formatScoreString,
  getEntityName,
  formatTeamNames,
  resolveActivityPayload,
  resolveNotificationPayload,
} from '#lib/activity.js'

console.log('--- Testing detectMatchNarrative ---')

// 1. Clutch (Sít sao nghẹt thở)
assert.equal(
  detectMatchNarrative({ sets: [[22, 20]], winnerTeam: 'A' }),
  'clutch',
  '22-20 should be clutch'
)
assert.equal(
  detectMatchNarrative({ sets: [[21, 15], [19, 21], [24, 22]], winnerTeam: 'A' }),
  'clutch',
  '24-22 in deciding set should be clutch'
)
assert.equal(
  detectMatchNarrative({ scoreText: '29-30', winnerTeam: 'B' }),
  'clutch',
  '29-30 scoreText should be clutch'
)

// 2. Blowout (Thắng áp đảo huỷ diệt)
assert.equal(
  detectMatchNarrative({ sets: [[21, 8]], winnerTeam: 'A' }),
  'blowout',
  '21-8 should be blowout'
)
assert.equal(
  detectMatchNarrative({ sets: [[21, 11]], winnerTeam: 'A' }),
  'blowout',
  '21-11 should be blowout'
)
assert.equal(
  detectMatchNarrative({ scoreText: '21-7', winnerTeam: 'A' }),
  'blowout',
  '21-7 should be blowout'
)

// 3. Comeback (Lội ngược dòng)
assert.equal(
  detectMatchNarrative({
    sets: [[18, 21], [21, 15], [21, 17]],
    winnerTeam: 'A',
  }),
  'comeback',
  'Lost set 1 (18-21), won sets 2 & 3 -> comeback'
)
assert.equal(
  detectMatchNarrative({
    sets: [[21, 15], [17, 21], [19, 21]],
    winnerTeam: 'B',
  }),
  'comeback',
  'Team B lost set 1, won sets 2 & 3 -> comeback'
)

// 4. Normal (Chiến thắng tiêu chuẩn)
assert.equal(
  detectMatchNarrative({ sets: [[21, 16]], winnerTeam: 'A' }),
  'normal',
  '21-16 should be normal'
)

console.log('detectMatchNarrative: OK')

console.log('--- Testing getPersonalHighlights ---')

const mockMembers = [
  { id: 'm1', name: 'Quân' },
  { id: 'm2', name: 'Kuro' },
  { id: 'm3', name: 'Vân' },
  { id: 'm4', name: 'Mai' },
  { id: 'm5', name: 'Minh' },
]

// Mock matches:
// 1. Quân + Kuro đánh cùng nhau 6 trận: thắng 5, thua 1 (đủ >= 5 trận -> best partner)
// 2. Quân + Minh đánh 3 trận gần nhất: thắng cả 3 (-> reliable partner)
// 3. Quân vs Vân: đối đầu 4 trận: Quân thắng 2, Vân thắng 2 (-> arch rival)
// 4. Quân vs Mai: Quân thua Mai 2 trận liên tiếp, rồi trận gần nhất Quân thắng Mai (-> nemesis beaten)
const mockMatches = [
  // Cặp Quân + Kuro (6 trận)
  { id: 'mt1', at: '2026-09-01T10:00:00Z', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A', sets: [[21, 15]] },
  { id: 'mt2', at: '2026-09-02T10:00:00Z', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A', sets: [[21, 16]] },
  { id: 'mt3', at: '2026-09-03T10:00:00Z', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'B', sets: [[18, 21]] },
  { id: 'mt4', at: '2026-09-04T10:00:00Z', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A', sets: [[21, 17]] },
  { id: 'mt5', at: '2026-09-05T10:00:00Z', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A', sets: [[21, 14]] },
  { id: 'mt6', at: '2026-09-06T10:00:00Z', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A', sets: [[21, 18]] },

  // Quân vs Mai (Nemesis Beaten: thua 2 trận, trận thứ 3 thắng)
  { id: 'mt7', at: '2026-09-07T10:00:00Z', teamA: ['m1'], teamB: ['m4'], winnerTeam: 'B', sets: [[19, 21]] },
  { id: 'mt8', at: '2026-09-08T10:00:00Z', teamA: ['m1'], teamB: ['m4'], winnerTeam: 'B', sets: [[18, 21]] },
  { id: 'mt9', at: '2026-09-09T10:00:00Z', teamA: ['m1'], teamB: ['m4'], winnerTeam: 'A', sets: [[21, 19]] },

  // Cặp Quân + Minh (3 trận gần nhất bất bại)
  { id: 'mt10', at: '2026-09-10T10:00:00Z', teamA: ['m1', 'm5'], teamB: ['m3'], winnerTeam: 'A', sets: [[21, 12]] },
  { id: 'mt11', at: '2026-09-11T10:00:00Z', teamA: ['m1', 'm5'], teamB: ['m3'], winnerTeam: 'A', sets: [[21, 13]] },
  { id: 'mt12', at: '2026-09-12T10:00:00Z', teamA: ['m1', 'm5'], teamB: ['m3'], winnerTeam: 'A', sets: [[21, 14]] },
]

const mockDb = {
  members: mockMembers,
  matches: mockMatches,
  playerRatings: {},
}

const highlights = getPersonalHighlights('m1', mockDb)
console.log('Generated highlights for m1:', highlights)

// 1. Kiểm tra best_partner
const bestPartner = highlights.find((h) => h.type === 'best_partner')
assert.ok(bestPartner, 'Should detect best_partner')
assert.equal(bestPartner.partnerId, 'm2', 'Best partner should be Kuro (m2)')
assert.equal(bestPartner.games, 6, 'Should have 6 games together')
assert.equal(bestPartner.wins, 5, 'Should have 5 wins')

// 2. Kiểm tra reliable_partner
const reliablePartner = highlights.find((h) => h.type === 'reliable_partner')
assert.ok(reliablePartner, 'Should detect reliable_partner')
assert.equal(reliablePartner.partnerId, 'm5', 'Reliable partner should be Minh (m5)')
assert.equal(reliablePartner.streak, 3, 'Should have 3 consecutive wins together')

// 3. Kiểm tra nemesis_beaten
const nemesisBeaten = highlights.find((h) => h.type === 'nemesis_beaten')
assert.ok(nemesisBeaten, 'Should detect nemesis_beaten for Mai')
assert.equal(nemesisBeaten.rivalId, 'm4', 'Nemesis beaten should be Mai (m4)')

// 4. Kiểm tra hot_streak
const hotStreak = highlights.find((h) => h.type === 'hot_streak')
assert.ok(hotStreak, 'Should detect hot_streak since m1 won mt9, mt10, mt11, mt12')
assert.ok(hotStreak.streak >= 3, 'Streak should be >= 3')

console.log('getPersonalHighlights: OK')

console.log('--- Testing format helpers ---')
assert.equal(getEntityName(mockDb, 'm1'), 'Quân')
assert.equal(formatTeamNames(mockDb, ['m1', 'm2']), 'Quân & Kuro')
assert.equal(formatScoreString({ sets: [[21, 19], [22, 20]] }), '21-19, 22-20')
console.log('format helpers: OK')

console.log('--- Testing payload resolvers ---')
// 1. resolveActivityPayload match_recorded
const resolvedMatch = resolveActivityPayload(
  { type: 'match_recorded', payload: { matchId: 'mt1' } },
  mockDb
)
assert.equal(resolvedMatch.winners, 'Quân & Kuro')
assert.equal(resolvedMatch.losers, 'Vân & Mai')

// 2. resolveActivityPayload bounty_broken
const resolvedBounty = resolveActivityPayload(
  { type: 'bounty_broken', payload: { breakerIds: ['m1'], victimIds: ['m3'], streak: 5 } },
  mockDb
)
assert.equal(resolvedBounty.breakers, 'Quân')
assert.equal(resolvedBounty.victims, 'Vân')
assert.equal(resolvedBounty.streak, 5)

// 3. resolveActivityPayload challenge_created
const resolvedChalCreated = resolveActivityPayload(
  { type: 'challenge_created', payload: { code: 'K01', challengerIds: ['m1', 'm2'], opponentIds: ['m3', 'm4'] } },
  mockDb
)
assert.equal(resolvedChalCreated.challengers, 'Quân & Kuro')
assert.equal(resolvedChalCreated.opponents, 'Vân & Mai')

// 4. resolveActivityPayload member_joined
const resolvedJoined = resolveActivityPayload(
  { type: 'member_joined', payload: { memberId: 'm1' } },
  mockDb
)
assert.equal(resolvedJoined.name, 'Quân')

// 5. resolveActivityPayload session_opened
const resolvedSession = resolveActivityPayload(
  { type: 'session_opened', payload: { date: '2026-09-17' } },
  mockDb
)
assert.equal(resolvedSession.date, '17/09')

// 6. resolveNotificationPayload
const notifChal = resolveNotificationPayload(
  { type: 'challenge_created', payload: { code: 'K02', challengerIds: ['m1'] } },
  mockDb
)
assert.equal(notifChal.challengers, 'Quân')

const notifClaim = resolveNotificationPayload(
  { type: 'claim_approved', payload: { kind: 'dues' } },
  mockDb
)
assert.equal(notifClaim.kind, 'quỹ tháng')

// 7. resolveNotificationPayload attendance_reported
const notifAtt = resolveNotificationPayload(
  { type: 'attendance_reported', payload: { memberId: 'm1', date: '2026-09-17', status: 'present' } },
  mockDb
)
assert.equal(notifAtt.name, 'Quân')
assert.equal(notifAtt.date, '17/09')
assert.equal(notifAtt.status, 'present')

// 8. resolveNotificationPayload session_rsvp_invite
const notifRsvp = resolveNotificationPayload(
  { type: 'session_rsvp_invite', payload: { date: '2026-09-17' } },
  mockDb
)
assert.equal(notifRsvp.date, '17/09')

console.log('payload resolvers: OK')


