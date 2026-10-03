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
  parseScoreWinningLosing,
  getPlayerInitials,
  getAvatarBg,
  getPlayerProfile,
  resolveTeamProfiles,
  resolveActivityRow2a,
  groupActivities2a,
  activityLinkOf,
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

console.log('--- Testing Option 2a helper functions ---')

// 1. parseScoreWinningLosing
assert.deepEqual(
  parseScoreWinningLosing('21-19'),
  { ws: '21', ls: '19', diff: 2 },
  '21-19 should parse to ws: 21, ls: 19, diff: 2'
)
assert.deepEqual(
  parseScoreWinningLosing('21-15, 18-21, 22-20'),
  { ws: '22', ls: '20', diff: 2 },
  'deciding set 22-20 should be parsed'
)
assert.deepEqual(
  parseScoreWinningLosing('15-21'),
  { ws: '21', ls: '15', diff: 6 },
  'inverted 15-21 should still place higher score as ws'
)
assert.deepEqual(
  parseScoreWinningLosing('1-0'),
  { ws: '1', ls: '0', diff: 1 },
  '1-0 series score should parse'
)

// 2. getPlayerInitials & getAvatarBg
assert.equal(getPlayerInitials('Kuro'), 'K')
assert.equal(getPlayerInitials('Vân Anh'), 'VA')
assert.equal(getPlayerInitials('Nguyễn Thị Thúy'), 'NT')
assert.ok(typeof getAvatarBg('m1', 'Quân') === 'string')

// 3. resolveActivityRow2a & groupActivities2a
const sampleEvents = [
  {
    id: 'ev-1',
    type: 'match_recorded',
    created_at: '2026-09-29T14:48:00.000Z',
    payload: {
      matchId: 'm-101',
      winnerIds: ['m1', 'm2'],
      loserIds: ['m3', 'g1'],
      score: '22-20',
      narrativeType: 'clutch',
    },
  },
  {
    id: 'ev-2',
    type: 'bounty_broken',
    created_at: '2026-09-29T14:48:00.000Z',
    payload: {
      matchId: 'm-101',
      streak: 5,
      victimIds: ['m3'],
      breakerIds: ['m1', 'm2'],
    },
  },
  {
    id: 'ev-3',
    type: 'challenge_completed',
    created_at: '2026-09-29T10:00:00.000Z',
    payload: {
      code: 'C-0121',
      winnerIds: ['m1'],
      loserIds: ['m2'],
      seriesScore: '1-0',
    },
  },
]

const grouped = groupActivities2a(sampleEvents, mockDb)
assert.equal(grouped.length, 1, 'Both events are on same day 2026-09-29')
assert.equal(grouped[0].items.length, 2, 'bounty_broken should be absorbed into match_recorded')

const rowMatch = grouped[0].items[0]
assert.equal(rowMatch.isMatch, true)
assert.equal(rowMatch.ws, '22')
assert.equal(rowMatch.ls, '20')
assert.equal(rowMatch.hasLeadAv, true)
assert.equal(rowMatch.hasStreak, true, 'Streak should be attached from bounty event')
assert.ok(rowMatch.streakText.includes('5'), 'Streak text should mention 5')

const rowResolved = grouped[0].items[1]
assert.equal(rowResolved.isResolved, true)
assert.equal(rowResolved.code, 'C-0121')
assert.equal(rowResolved.ws, '1')
assert.equal(rowResolved.ls, '0')

// 4. Trận nhiều set: `scoreText` là SỐ SET ("2 – 1", gạch ngang dài như appActions ghi), còn
// "cách N điểm" phải lấy điểm thật từ set của trận — không được ra "hơn đúng 1 điểm".
assert.deepEqual(parseScoreWinningLosing('2 – 1'), { ws: '2', ls: '1', diff: 1 })
const multiSetDb = {
  members: mockMembers,
  matches: [
    { id: 'bo3-clutch', sets: [[21, 15], [18, 21], [22, 20]], winnerTeam: 'A' },
    { id: 'bo3-blowout', sets: [[21, 8], [21, 17]], winnerTeam: 'A' },
  ],
}
const matchRow = (matchId, score, narrativeType) => resolveActivityRow2a({
  id: matchId, type: 'match_recorded', created_at: '2026-09-29T10:00:00.000Z',
  payload: { matchId, score, narrativeType, winnerIds: ['m1'], loserIds: ['m2'] },
}, multiSetDb)

const clutchRow = matchRow('bo3-clutch', '2 – 1', 'clutch')
assert.equal(clutchRow.ws, '2', 'cột phải vẫn hiện số set')
assert.equal(clutchRow.ls, '1')
assert.ok(clutchRow.caption.includes('2 điểm'), 'nghẹt thở lấy chênh lệch set cuối 22-20: ' + clutchRow.caption)

const blowoutRow = matchRow('bo3-blowout', '2 – 0', 'blowout')
assert.ok(blowoutRow.caption.includes('13 điểm'), 'áp đảo lấy set chênh nhất 21-8: ' + blowoutRow.caption)

const unknownRow = matchRow('da-xoa', '2 – 0', 'normal')
assert.ok(!/\d/.test(unknownRow.caption), 'không có set thì không in con số: ' + unknownRow.caption)

// 5. Trạng thái kèo theo đúng `status` mà appActions ghi — không phải cái gì cũng "Chờ nhận".
const keoRow = (status, extra = {}) => resolveActivityRow2a({
  id: 'k', type: 'challenge_created', ref_id: 'c1', created_at: '2026-09-29T10:00:00.000Z',
  payload: { chalId: 'c1', code: 'C-01', challengerIds: ['m1', 'm3'], opponentIds: ['m2', 'm4'] },
}, status ? { members: mockMembers, challenges: [{ id: 'c1', code: 'C-01', status, ...extra }] } : { members: mockMembers })
const inOneHour = new Date(Date.now() + 3600000).toISOString()
assert.equal(keoRow('pending', { expiresAt: inOneHour }).keoStatus, 'Chờ nhận')
assert.equal(keoRow('accepted').keoStatus, 'Đã nhận · chờ đấu')
assert.equal(keoRow('oncourt').keoStatus, 'Đang trên sân')
assert.equal(keoRow('played').keoStatus, 'Đã đấu')
assert.equal(keoRow('cancelled').keoStatus, 'Đã hủy')
assert.equal(keoRow(null).keoStatus, '', 'không còn thấy kèo thì để trống, không đoán')

// Từ chối là âm thầm: Bảng tin cả CLB đọc, nên "bị từ chối" và "hết hạn" phải KHÔNG phân biệt
// được — tách nhãn là lộ ra đội B đã từ chối.
assert.equal(keoRow('declined').keoStatus, 'Không thành')
assert.equal(keoRow('expired').keoStatus, 'Không thành')
assert.equal(
  keoRow('pending', { expiresAt: '2026-01-01T00:00:00.000Z' }).keoStatus,
  'Không thành',
  'pending đã quá hạn nhận mà chưa ai quét sang expired cũng là kèo không thành'
)

// 7. Bấm dòng: kèo → Sàn kèo, buổi → trang buổi; thứ không còn / kèo "Không thành" thì không bấm
const linkDb = {
  challenges: [
    { id: 'c-live', status: 'accepted' },
    { id: 'c-dec', status: 'declined' },
    { id: 'c-exp', status: 'expired' },
  ],
  sessions: [{ id: 's1', status: 'open' }, { id: 's2', status: 'closed' }],
}
const linkOfRef = (ref_type, ref_id) => activityLinkOf({ ref_type, ref_id }, linkDb)
assert.equal(linkOfRef('challenge', 'c-live'), '/tran-dau?tab=challenges&challengeId=c-live')
assert.equal(linkOfRef('session', 's1'), '/buoi-tap/s1')
assert.equal(linkOfRef('challenge', 'c-gone'), null, 'kèo không còn thì không đưa tới màn trống')
assert.equal(linkOfRef('challenge', 'c-dec'), null, 'kèo từ chối: mở ra là thẻ kèo ghi "Từ chối"')
assert.equal(linkOfRef('challenge', 'c-exp'), null, 'hết hạn khoá cùng từ chối để không đoán được')

// Trận → Lịch sử lọc đúng hai cặp; đội thắng đứng A; thành viên đứng đầu cặp (ô chọn không có khách)
const matchLinkDb = {
  members: [{ id: 'kuro' }, { id: 'hoa' }, { id: 'hang' }],
  matches: [{ id: 'mt-x', teamA: ['g-khach', 'hang'], teamB: ['kuro', 'hoa'], winnerTeam: 'B' }],
}
const mLink = new URL(activityLinkOf({ ref_type: 'match', ref_id: 'mt-x' }, matchLinkDb), 'http://x')
assert.equal(mLink.pathname, '/tran-dau')
assert.equal(mLink.searchParams.get('tab'), 'search')
assert.equal(mLink.searchParams.get('pairA'), 'kuro,hoa', 'đội thắng đứng A')
assert.equal(mLink.searchParams.get('pairB'), 'hang,g-khach', 'thành viên lên đầu cặp')
assert.equal(mLink.searchParams.get('playerA'), 'kuro')
assert.equal(mLink.searchParams.get('playerB'), 'hang')
assert.equal(mLink.searchParams.get('matchId'), null, 'không mở modal chi tiết trận')
assert.equal(activityLinkOf({ ref_type: 'match', ref_id: 'da-huy' }, matchLinkDb), null, 'trận đã huỷ không bấm được')

const sessionRow = (sessionId) => resolveActivityRow2a({
  id: 'so', type: 'session_opened', ref_id: sessionId, created_at: '2026-09-29T10:00:00.000Z',
  payload: { sessionId, date: '2026-10-02' },
}, linkDb)
assert.equal(sessionRow('s1').canRsvp, true)
assert.equal(sessionRow('s2').canRsvp, false, 'buổi đã chốt thì không mời điểm danh nữa')

// 8. Sửa / huỷ trận: dòng gốc kể kết quả HIỆN TẠI + nhãn + lịch sử; dòng báo riêng ở đầu Bảng tin
{
  const recorded = {
    id: 'r1', type: 'match_recorded', ref_type: 'match', ref_id: 'mx', created_at: '2026-09-27T12:20:00.000Z',
    payload: { matchId: 'mx', matchCode: 'M-12', score: '21 – 16', winnerTeam: 'A', narrativeType: 'normal', winnerIds: ['m1', 'm2'], loserIds: ['m3', 'm4'] },
  }
  const bounty = {
    id: 'b1', type: 'bounty_broken', ref_type: 'match', ref_id: 'mx', created_at: '2026-09-27T12:20:01.000Z',
    payload: { matchId: 'mx', streak: 5, breakerIds: ['m1', 'm2'], victimIds: ['m3'] },
  }
  // Sửa lật kết quả: đội B thắng 21-19 (newScore ghi điểm đội A trước)
  const edited = {
    id: 'e1', type: 'match_edited', ref_type: 'match', ref_id: 'mx', actor_id: 'm5', created_at: '2026-09-27T12:40:00.000Z',
    payload: { matchId: 'mx', matchCode: 'M-12', newScore: '19-21', reason: 'nhập nhầm đội' },
  }
  const cancelled = {
    id: 'c1', type: 'match_cancelled', ref_type: 'match', ref_id: 'mx', actor_id: 'm5', created_at: '2026-09-27T13:05:00.000Z',
    payload: { matchId: 'mx', matchCode: 'M-12', reason: 'Xóa' },
  }
  const dbEdited = {
    members: mockMembers,
    matches: [{ id: 'mx', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], sets: [[19, 21]], winnerTeam: 'B', scoreText: '21 – 16' }],
  }
  const rowsOf = (events, db) => groupActivities2a(events, db).flatMap((d) => d.items)

  // Đã sửa: Bảng tin mới → cũ = [edited, bounty, recorded]
  const rows = rowsOf([edited, bounty, recorded], dbEdited)
  assert.equal(rows.length, 2, 'dòng báo sửa vẫn hiện riêng, chặn chuỗi gộp vào trận')
  const [announce, matchRow] = rows
  assert.equal(announce.isMatchChange, true)
  assert.equal(announce.actor, 'Minh')
  assert.equal(announce.before, 'Quân & Kuro thắng 21–16')
  assert.equal(announce.after, 'Vân & Mai thắng 21–19')
  assert.equal(announce.reason, 'nhập nhầm đội')
  assert.ok(announce.link?.includes('pairA=m3%2Cm4'), 'bấm dòng báo sửa → Lịch sử, đội thắng MỚI đứng A')

  assert.equal(matchRow.badge?.text, 'Đã sửa')
  assert.equal(matchRow.W.names, 'Vân & Mai', 'dòng gốc kể kết quả hiện tại')
  assert.equal(matchRow.ws, '21')
  assert.equal(matchRow.ls, '19', '`scoreText` không đổi khi sửa — phải đọc từ set')
  assert.equal(matchRow.hasStreak, false, 'lật kết quả thì chặn chuỗi không còn đúng')
  assert.deepEqual(matchRow.history.map((h) => h.kind), ['recorded', 'edited'])
  assert.equal(matchRow.history[1].by, 'Minh')

  // Đã huỷ: trận không còn trong db, log sửa đã bị CASCADE xoá — lịch sử vẫn dựng được từ Bảng tin
  const rows2 = rowsOf([cancelled, edited, bounty, recorded], { members: mockMembers, matches: [] })
  const cancelRow = rows2.find((r) => r.isMatchChange && r.isCancelChange)
  assert.equal(cancelRow.before, 'Vân & Mai thắng 21–19', 'bản bị huỷ là bản sau lần sửa')
  assert.equal(cancelRow.reason, '', 'chữ "Xóa" mặc định không phải lý do')
  assert.equal(cancelRow.link, null, 'trận đã huỷ không bấm được')
  const cancelledMatch = rows2.find((r) => r.isMatch)
  assert.equal(cancelledMatch.isCancelled, true)
  assert.equal(cancelledMatch.badge?.text, 'Đã huỷ')
  assert.equal(cancelledMatch.hasStreak, false)
  assert.deepEqual(cancelledMatch.history.map((h) => h.kind), ['recorded', 'edited', 'cancelled'])

  // Chưa ai sửa: không nhãn, không lịch sử
  const plain = rowsOf([recorded], { members: mockMembers, matches: [] })[0]
  assert.equal(plain.badge, null)
  assert.deepEqual(plain.history, [])
}

// 9. Kèo ngã ngũ lại / bị lật / bị huỷ kết quả — đọc kết quả hiện tại từ kèo
{
  const done = (id, at, winnerIds, loserIds, seriesScore) => ({
    id, type: 'challenge_completed', ref_type: 'challenge', ref_id: 'ck', created_at: at,
    payload: { chalId: 'ck', code: 'C-0121', winnerIds, loserIds, seriesScore },
  })
  const first = done('d1', '2026-09-27T13:01:00.000Z', ['m1', 'm2'], ['m3', 'm4'], '1-0')
  const again = done('d2', '2026-09-27T13:30:00.000Z', ['m3', 'm4'], ['m1', 'm2'], '1-0')
  const chal = (extra) => ({ id: 'ck', code: 'C-0121', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], ...extra })

  // Huỷ ván rồi đánh lại → 2 sự kiện ngã ngũ, chỉ 1 dòng sống, dòng cũ thành lịch sử
  const rows = groupActivities2a([again, first], { members: mockMembers, challenges: [chal({ status: 'played', winnerTeam: 'B' })] })
    .flatMap((d) => d.items)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'd2')
  assert.equal(rows[0].badge?.text, 'Đã sửa')
  assert.deepEqual(rows[0].history.map((h) => h.winners), ['Quân & Kuro', 'Vân & Mai'])

  // Sửa ván lật đội thắng, không có sự kiện mới → dòng cũ tự kể kết quả mới
  const flipped = resolveActivityRow2a(first, { members: mockMembers, challenges: [chal({ status: 'played', winnerTeam: 'B' })] })
  assert.equal(flipped.W.names, 'Vân & Mai')
  assert.deepEqual(flipped.history.map((h) => h.kind), ['resolved', 'current'])

  // Huỷ ván quyết định → kèo quay về 'accepted': kết quả bị huỷ
  const voided = resolveActivityRow2a(first, { members: mockMembers, challenges: [chal({ status: 'accepted' })] })
  assert.equal(voided.isVoid, true)
  assert.equal(voided.badge?.text, 'Đã huỷ')

  // Không đổi gì → không nhãn
  const same = resolveActivityRow2a(first, { members: mockMembers, challenges: [chal({ status: 'played', winnerTeam: 'A' })] })
  assert.equal(same.badge, null)
}

// 10. Huỷ kèo: dòng gạ kèo đã hiện "Đã hủy" thì bỏ dòng huỷ riêng; gạ kèo ở trang chưa tải thì giữ
{
  const created = {
    id: 'g1', type: 'challenge_created', ref_type: 'challenge', ref_id: 'c129', created_at: '2026-10-02T06:10:00.000Z',
    payload: { chalId: 'c129', code: 'C-0129', challengerIds: ['m1', 'm2'], opponentIds: ['m3', 'm4'] },
  }
  const cancelled = {
    id: 'x1', type: 'challenge_cancelled', ref_type: 'challenge', ref_id: 'c129', created_at: '2026-10-02T06:18:00.000Z',
    payload: { code: 'C-0129' },
  }
  const db = { members: mockMembers, challenges: [{ id: 'c129', code: 'C-0129', status: 'cancelled' }] }
  const both = groupActivities2a([cancelled, created], db).flatMap((d) => d.items)
  assert.deepEqual(both.map((r) => r.id), ['g1'], 'chỉ còn dòng gạ kèo')
  assert.equal(both[0].keoStatus, 'Đã hủy')

  const onlyCancel = groupActivities2a([cancelled], db).flatMap((d) => d.items)
  assert.deepEqual(onlyCancel.map((r) => r.id), ['x1'], 'gạ kèo chưa tải thì dòng huỷ là tin duy nhất')
}

// 6. Tên bắt đầu bằng emoji không bị cắt đôi cặp surrogate
assert.equal(getPlayerInitials('🐔 Gà'), '🐔G')

console.log('Option 2a helpers: OK')
