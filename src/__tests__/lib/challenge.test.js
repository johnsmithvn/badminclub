import assert from 'node:assert/strict'
import { nextChallengeCode } from '#lib/challenge.js'

// 1. Sinh mã kèo
assert.equal(nextChallengeCode([]), 'C-0101', 'Danh sách rỗng sinh mã khởi tạo C-0101')
assert.equal(nextChallengeCode([{ code: 'C-0125' }]), 'C-0126', 'Sinh mã tự tăng kế tiếp')

// `challengeDirection`, `evalChallengeBalance`, `canCancelChallenge` và
// `pickableMembersForChallenge` đã được gỡ khỏi `lib/challenge.js`: không màn hình nào gọi chúng,
// chỉ còn đúng mấy dòng test này giữ chúng sống. Luật huỷ kèo giờ nằm trong chính
// `a.cancelChallenge` (xem chốt trạng thái ở đó) thay vì một hàm rời không ai gọi.

// 2. Cơ chế đa xác nhận kèo đấu
import {
  getChallengeAcceptanceProgress,
  isChallengeFullyAccepted,
  canMemberAcceptChallenge,
} from '#lib/challenge.js'

// Kèo đơn 1v1: Người tạo m1 đã chấp nhận, m2 chưa chấp nhận
const cSingle = {
  createdBy: 'm1',
  teamA: ['m1'],
  teamB: ['m2'],
  acceptedPlayers: ['m1'],
  status: 'pending',
}
const pSingle1 = getChallengeAcceptanceProgress(cSingle)
assert.equal(pSingle1.acceptedCount, 1, 'Kèo đơn: 1 người đã nhận')
assert.equal(pSingle1.totalCount, 2, 'Kèo đơn: cần 2 người')
assert.equal(pSingle1.isFullyAccepted, false, 'Chưa đủ 2 người nên chưa fully accepted')
assert.ok(canMemberAcceptChallenge(cSingle, 'm2'), 'm2 có quyền bấm nhận')
assert.ok(!canMemberAcceptChallenge(cSingle, 'm1'), 'm1 đã nhận rồi thì không bấm nhận lại')
assert.ok(!canMemberAcceptChallenge(cSingle, 'm1', true), 'm1 dù là Admin nhưng đã nhận rồi thì không hiện nút nhận lại')
assert.ok(canMemberAcceptChallenge(cSingle, 'admin_id', true), 'Admin ngoài trận có quyền duyệt khi kèo đã đủ 2 người')

const cOpen = {
  createdBy: 'm1',
  teamA: ['m1'],
  teamB: [],
  acceptedPlayers: ['m1'],
  status: 'pending',
}
assert.ok(!canMemberAcceptChallenge(cOpen, 'admin_id', true), 'Admin không thể duyệt khi kèo mở chưa có Team B')

// m2 bấm nhận -> đủ 2/2
const cSingleAccepted = {
  ...cSingle,
  acceptedPlayers: ['m1', 'm2'],
}
assert.ok(isChallengeFullyAccepted(cSingleAccepted), 'Kèo đơn: cả 2 người đồng ý -> fully accepted')

// Kèo đôi 2v2: cần 4 người
const cDouble = {
  createdBy: 'm1',
  teamA: ['m1', 'm2'],
  teamB: ['m3', 'm4'],
  acceptedPlayers: ['m1', 'm3'],
  status: 'pending',
}
const pDouble = getChallengeAcceptanceProgress(cDouble)
assert.equal(pDouble.acceptedCount, 2, 'Kèo đôi: 2 người đã nhận')
assert.equal(pDouble.totalCount, 4, 'Kèo đôi: cần 4 người')
assert.equal(pDouble.isFullyAccepted, false, 'Chưa đủ 4 người')
assert.deepEqual(pDouble.pendingPlayerIds, ['m2', 'm4'], 'm2 và m4 chưa nhận')

const cDoubleFull = {
  ...cDouble,
  acceptedPlayers: ['m1', 'm2', 'm3', 'm4'],
}
assert.ok(isChallengeFullyAccepted(cDoubleFull), 'Kèo đôi: đủ 4/4 người -> fully accepted')

console.log('challenge check: OK')

