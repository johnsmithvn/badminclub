// Khách giao lưu đánh kèo — ba luật gác tiền sân của khách (migration 0067).
import assert from 'node:assert/strict'
import { challengeGuestIds, guestsMissingFromSession, openChallengeOfGuest } from '#lib/challenge.js'

const db = {
  members: [{ id: 'M1' }, { id: 'M2' }, { id: 'M3' }],
  guests: [{ id: 'K1', name: 'Long' }, { id: 'K2', name: 'Quân' }],
  sessionGuests: [
    { id: 'SG1', sessionId: 'B1', guestId: 'K1' },
    { id: 'SG2', sessionId: 'B1', memberId: 'M3' }, // thành viên đi lẻ — không phải khách
    { id: 'SG3', sessionId: 'B2', guestId: 'K2' },
  ],
  matches: [],
  challenges: [],
}
const chal = { id: 'CH1', code: 'C-0101', sessionId: 'B1', status: 'accepted', bestOf: 1, teamA: ['M1', 'M2'], teamB: ['M3', 'K1'] }

// 1. Nhận diện khách trong kèo
assert.deepEqual(challengeGuestIds(chal, db), ['K1'],
  'Chỉ id có trong danh bạ khách mới là khách — tính nhầm thành viên là khách thì người đó khỏi phải bấm nhận kèo')

// 2. Khách phải có lượt trong buổi của kèo
assert.deepEqual(guestsMissingFromSession(chal, db, 'B1'), [],
  'K1 có lượt ở B1 thì kèo nằm ở B1 hợp lệ')
assert.deepEqual(guestsMissingFromSession(chal, db, 'B2'), ['K1'],
  'Chuyển kèo sang B2 mà K1 không đi B2 = khách đánh không ai thu tiền sân')
assert.deepEqual(guestsMissingFromSession(chal, db, null), ['K1'],
  'Gỡ kèo có khách về Tự do phải bị chặn — kèo Tự do không gắn với lượt trả tiền nào của khách')
assert.deepEqual(guestsMissingFromSession({ ...chal, teamB: ['M3'] }, db, null), [],
  'Kèo toàn thành viên không bị luật khách cản — gỡ về Tự do vẫn như cũ')

// 3. Kèo còn mở thì không bỏ khách khỏi buổi được
const withChal = (c) => ({ ...db, challenges: [c] })
assert.equal(openChallengeOfGuest(withChal(chal), 'K1', 'B1')?.id, 'CH1',
  'Kèo đã nhận chưa đánh: bỏ K1 khỏi B1 là xoá luôn khoản thu tiền sân của trận K1 sắp đánh')
assert.equal(openChallengeOfGuest(withChal(chal), 'K1', 'B2'), null,
  'Bỏ K1 khỏi buổi KHÁC thì không liên quan kèo của B1')
assert.equal(openChallengeOfGuest(withChal(chal), 'K1')?.id, 'CH1',
  'Xoá hẳn khách khỏi danh bạ (không truyền buổi) cũng phải bị kèo đang mở chặn')
assert.equal(openChallengeOfGuest(withChal({ ...chal, status: 'cancelled' }), 'K1', 'B1'), null,
  'Kèo đã huỷ không giữ khách lại')
assert.equal(openChallengeOfGuest(withChal({ ...chal, status: 'pending', expiresAt: '2000-01-01T00:00:00.000Z' }), 'K1', 'B1'), null,
  'Kèo chờ nhận đã quá hạn coi như chết, không giữ khách lại')

const bo3 = { ...chal, status: 'played', bestOf: 3 }
const oneSet = { ...withChal(bo3), matches: [{ id: 'X1', challengeId: 'CH1', winnerTeam: 'A', at: 1 }] }
assert.equal(openChallengeOfGuest(oneSet, 'K1', 'B1')?.id, 'CH1',
  'BO3 mới xong 1 hiệp vẫn là kèo đang đánh — bỏ khách lúc này là hai hiệp còn lại không thu tiền')
const done = { ...oneSet, matches: [...oneSet.matches, { id: 'X2', challengeId: 'CH1', winnerTeam: 'A', at: 2 }] }
assert.equal(openChallengeOfGuest(done, 'K1', 'B1'), null, 'BO3 đã đủ 2 hiệp thắng là xong kèo')

console.log('challenge guests check: OK')
