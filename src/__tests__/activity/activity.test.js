// src/__tests__/activity/activity.test.js
// Kiểm thử các hàm thuần trong src/lib/activity.js

import assert from 'node:assert/strict'
import { t } from '#i18n'
import {
  detectMatchNarrative,
  getPersonalHighlights,
  formatScoreString,
  getEntityName,
  formatTeamNames,
  formatWinnerSeriesScore,
  resolveBountyVictimIds,
  resolveActivityPayload,
  resolveNotificationPayload,
  notifyRecipients,
  notifiableMemberIds,
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
assert.equal(notifChal.creator, 'Quân')

const notifClaim = resolveNotificationPayload(
  { type: 'claim_approved', payload: { kind: 'dues' } },
  mockDb
)
assert.equal(notifClaim.kind, 'quỹ tháng')

// 6b. resolveNotificationPayload — các loại vừa vá chỗ thủng thông báo
//
// Trước đây báo đã chuyển tiền / xin đổi hồ sơ / huỷ trận KHÔNG sinh thông báo nào; người phải
// xử lý chỉ biết khi tình cờ mở đúng màn. Giờ có dòng rồi thì nó phải đọc được ra tên và nhãn,
// không thì người nhận thấy "{{name}} báo đã chuyển tiền" nguyên văn.
const notifClaimSubmitted = resolveNotificationPayload(
  { type: 'claim_submitted', payload: { memberId: 'm1', n: 3 } },
  mockDb
)
assert.equal(notifClaimSubmitted.name, 'Quân', 'payload ghi ID, tên giải lúc render — RULES §3.3')
const msgClaimSubmitted = t('notification.claim_submitted', notifClaimSubmitted)
assert.ok(
  msgClaimSubmitted.includes('Quân') && msgClaimSubmitted.includes('3'),
  'thủ quỹ phải thấy AI khai và BAO NHIÊU khoản, không thì vẫn phải tự đi dò'
)

const notifChangeAsk = resolveNotificationPayload(
  { type: 'member_change_requested', payload: { memberId: 'm1', field: 'level' } },
  mockDb
)
assert.equal(notifChangeAsk.name, 'Quân')
assert.equal(notifChangeAsk.field, 'trình độ', "field lưu KEY 'level', nhãn tiếng Việt dựng lúc render")

const notifChangeOk = resolveNotificationPayload(
  { type: 'member_change_approved', payload: { field: 'phone', to: '0900' } },
  mockDb
)
assert.equal(notifChangeOk.field, 'số điện thoại')

const notifMatchCancelled = resolveNotificationPayload(
  { type: 'match_cancelled', payload: { matchId: 'mt1' } },
  { ...mockDb, matches: [{ id: 'mt1', code: 'M-12' }] }
)
assert.equal(
  notifMatchCancelled.matchCode, 'M-12',
  'dòng cũ chỉ ghi matchId — không dò ra code thì người nhận không biết trận nào bị huỷ'
)

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

// 9. resolveNotificationPayload refund_session & refund_bulk
const notifRefundSession = resolveNotificationPayload(
  { type: 'refund_session', payload: { amount: '50.000', date: '2026-09-02' } },
  mockDb
)
assert.equal(notifRefundSession.date, '02/09')
const msgSession = t('notification.refund_session', notifRefundSession)
assert.ok(msgSession.includes('50.000') && msgSession.includes('02/09'), 'refund_session message must contain amount and date')

const notifRefundBulk = resolveNotificationPayload(
  { type: 'refund_bulk', payload: { amount: '100.000', n: 2, month: '2026-09' } },
  mockDb
)
const msgBulk = t('notification.refund_bulk', notifRefundBulk)
// 10. formatWinnerSeriesScore & challenge_completed normalization
assert.equal(formatWinnerSeriesScore('0-1'), '1-0', '0-1 must be normalized to 1-0 for winner')
assert.equal(formatWinnerSeriesScore('1-2'), '2-1', '1-2 must be normalized to 2-1 for winner')
assert.equal(formatWinnerSeriesScore('2-0'), '2-0')
assert.equal(formatWinnerSeriesScore({ winsA: 0, winsB: 1 }), '1-0')
assert.equal(formatWinnerSeriesScore({ winsA: 2, winsB: 1 }), '2-1')

const notifChalCompleted = resolveNotificationPayload(
  {
    type: 'challenge_completed',
    payload: {
      code: 'C-0103',
      winnerIds: ['m2'],
      seriesScore: '0-1',
      winnerTeam: 'B',
    },
  },
  mockDb
)
assert.equal(notifChalCompleted.seriesScore, '1-0', 'seriesScore for winner in notification must be 1-0 not 0-1')
const msgChalComp = t('notification.challenge_completed', notifChalCompleted)
assert.ok(msgChalComp.includes('thắng chung cuộc 1-0'), 'Thông báo phải ghi thắng chung cuộc 1-0 thay vì 0-1')

// 11. resolveBountyVictimIds: chỉ lấy người thực sự có chuỗi khi payload gom cả đội thua
const mockBountyDb = {
  ...mockDb,
  matches: [
    // m1 thắng 5 trận liên tiếp trước mt-streak-break
    { id: 'sb1', at: 100, teamA: ['m1'], teamB: ['m4'], winnerTeam: 'A', ratingEnabled: true },
    { id: 'sb2', at: 200, teamA: ['m1'], teamB: ['m4'], winnerTeam: 'A', ratingEnabled: true },
    { id: 'sb3', at: 300, teamA: ['m1'], teamB: ['m4'], winnerTeam: 'A', ratingEnabled: true },
    { id: 'sb4', at: 400, teamA: ['m1'], teamB: ['m4'], winnerTeam: 'A', ratingEnabled: true },
    { id: 'sb5', at: 500, teamA: ['m1'], teamB: ['m4'], winnerTeam: 'A', ratingEnabled: true },
    // Trận làm đứt chuỗi: m1 cặp với m2 và thua
    { id: 'mt-streak-break', at: 600, teamA: ['m3', 'm4'], teamB: ['m1', 'm2'], winnerTeam: 'A', ratingEnabled: true },
  ],
}
const notifBountyBroken = resolveNotificationPayload(
  {
    type: 'bounty_broken',
    refId: 'mt-streak-break',
    payload: {
      matchId: 'mt-streak-break',
      streak: 5,
      breakerIds: ['m3', 'm4'],
      victimIds: ['m1', 'm2'], // m1 có chuỗi 5, m2 không có chuỗi
    },
  },
  mockBountyDb
)
assert.equal(notifBountyBroken.victims, 'Quân', 'Chỉ Quân có chuỗi 5, không được gom cả Kuro')
const msgBountyBroken = t('notification.bounty_broken', notifBountyBroken)
assert.ok(msgBountyBroken.includes('chuỗi thắng 5 trận của Quân vừa bị chặn đứng') || msgBountyBroken.includes('Chuỗi thắng 5 trận của Quân vừa bị chặn đứng'), 'Thông báo phá chuỗi chỉ ghi tên người có chuỗi')

console.log('payload resolvers: OK')

console.log('--- Testing notifyRecipients ---')

const clubMembers = new Set(['m1', 'm2', 'm3'])

// Khach giao luu lot vao danh sach nguoi nhan la ca lo insert bi Postgres tu choi
// (notifications.member_id -> club_members) => khong ai trong tran nhan duoc gi.
assert.deepEqual(
  notifyRecipients(['m1', 'guest-uuid', 'm2'], null, clubMembers),
  ['m1', 'm2'],
  'ID khach phai bi loai truoc khi insert'
)

// Khong tu ban thong bao cho chinh minh
assert.deepEqual(
  notifyRecipients(['m1', 'm2'], 'm1', clubMembers),
  ['m2'],
  'actor phai bi loai khoi nguoi nhan'
)

// Trung ID (vd vua o teamA vua la nguoi tao keo) chi nhan MOT dong
assert.deepEqual(
  notifyRecipients(['m2', 'm2', 'm3'], null, clubMembers),
  ['m2', 'm3'],
  'ID trung phai gop lai mot dong'
)

// Cac gia tri rong khong duoc bien thanh dong rac
assert.deepEqual(notifyRecipients([null, undefined, ''], null, clubMembers), [])
assert.deepEqual(notifyRecipients(undefined, 'm1', clubMembers), [])

// Ca tran toan khach -> khong con ai, emitEvent bo qua buoc insert
assert.deepEqual(notifyRecipients(['g1', 'g2'], 'm1', clubMembers), [])

/* ---------- notifiableMemberIds: ai THẬT SỰ đọc được thông báo ---------- */
//
// Vì sao đáng khoá bằng test: RLS của `notifications` (0038) lọc theo
// `member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())`. Thành viên chưa
// liên kết tài khoản thì KHÔNG AI đọc nổi dòng gửi cho họ — kể cả chính họ. Mỗi dòng như vậy
// chiếm một suất trong cửa sổ 100 dòng và kéo theo một lượt gọi push-send trả về sentCount 0.
// CLB thật có phần lớn thành viên chưa có tài khoản, nên sót ở đây là ngập hộp thông báo.
const roster = [
  { id: 'm1', name: 'Quân', userId: 'u1' },
  { id: 'm2', name: 'Trường', userId: null },   // thành viên do chủ CLB tạo, chưa có tài khoản
  { id: 'm3', name: 'Kuro', userId: 'u3' },
]

assert.deepEqual(
  [...notifiableMemberIds(roster)], ['m1', 'm3'],
  'Người chưa có tài khoản bị loại: dòng gửi cho họ không ai đọc được'
)
assert.deepEqual([...notifiableMemberIds([])], [], 'CLB rỗng không được throw')
assert.deepEqual([...notifiableMemberIds(null)], [], 'Đầu vào null không được throw')
assert.deepEqual(
  [...notifiableMemberIds([{ id: 'm9', userId: 'u9', active: false }])], ['m9'],
  'CỐ Ý không lọc theo active: người đã ngưng vẫn đọc được thông báo của mình, RLS không kiểm cờ đó'
)

// Ghép với notifyRecipients: đây là cách `emitEvent` dùng hai hàm này
assert.deepEqual(
  notifyRecipients(['m1', 'm2', 'm3'], 'm3', notifiableMemberIds(roster)),
  ['m1'],
  'Loại người gửi (m3) và người chưa có tài khoản (m2), còn đúng m1'
)

console.log('notifyRecipients: OK')

console.log('--- Testing resolveActivityPayload match_recorded ---')

// Dong MOI: doc thang ID tu payload, khong can do db.matches
const actNew = resolveActivityPayload(
  {
    type: 'match_recorded',
    payload: { winnerIds: ['m1'], loserIds: ['m2'], score: '21-15', matchCode: 'M-01' },
  },
  mockDb
)
assert.equal(actNew.winners, 'Quân')
assert.equal(actNew.losers, 'Kuro')
assert.equal(actNew.score, '21-15')

// Dong CU (truoc khi payload co winnerIds): van phai do ra duoc tu db.matches
const actOld = resolveActivityPayload(
  { type: 'match_recorded', payload: { matchId: 'mt-legacy', winnerTeam: 'A' } },
  {
    ...mockDb,
    matches: [
      { id: 'mt-legacy', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', scoreText: '21-10', code: 'M-09' },
    ],
  }
)
assert.equal(actOld.winners, 'Quân')
assert.equal(actOld.losers, 'Kuro')
assert.equal(actOld.matchCode, 'M-09')

console.log('match_recorded payload: OK')
