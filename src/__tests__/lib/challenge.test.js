import assert from 'node:assert/strict'
import {
  canCancelChallenge,
  challengeDirection,
  evalChallengeBalance,
  nextChallengeCode,
  pickableMembersForChallenge,
} from '#lib/challenge.js'

// 1. Sinh mã kèo
assert.equal(nextChallengeCode([]), 'C-0101', 'Danh sách rỗng sinh mã khởi tạo C-0101')
assert.equal(nextChallengeCode([{ code: 'C-0125' }]), 'C-0126', 'Sinh mã tự tăng kế tiếp')

// 2. Hướng kèo
const c1 = { createdBy: 'm1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], status: 'pending' }
assert.equal(challengeDirection(c1, 'm1'), 'out', 'Người tạo kèo thấy hướng là out')
assert.equal(challengeDirection(c1, 'm3'), 'in', 'Người đội B thấy hướng là in')
assert.equal(challengeDirection(c1, 'm99'), 'none', 'Người ngoài thấy hướng là none')

// 3. Đánh giá độ cân kèo
const bal = evalChallengeBalance(['m1', 'm2'], ['m3', 'm4'], { m1: 100, m2: 100, m3: 400, m4: 400 })
assert.equal(bal.tone, 'imbalanced', 'Chênh lệch 300 điểm phải báo imbalanced (lệch trình)')

// 4. Quyền hủy kèo
assert.ok(canCancelChallenge(c1, 'm1'), 'Người tạo có quyền hủy kèo khi pending')
assert.ok(!canCancelChallenge(c1, 'm3'), 'Người nhận không được hủy kèo mà chỉ được từ chối')

// 5. Lọc người có mặt
const members = [{ id: 'm1', active: true }, { id: 'm2', active: false }, { id: 'm3', active: true }]
const att = { s1: { m1: true, m3: false } }
const pickable = pickableMembersForChallenge(members, att, 's1')
assert.equal(pickable.length, 1, 'Chỉ người active và có mặt mới vào danh sách kèo')
assert.equal(pickable[0].id, 'm1')

console.log('challenge check: OK')
