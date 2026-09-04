// node src/__tests__/money/session_delete.test.js
//
// HUỶ và XOÁ một buổi tập (`money.js: sessionRefs`).
//
// `sessions` có SÁU bảng con ON DELETE CASCADE. Xoá cứng một buổi là mất điểm danh, trận, và
// TIỀN KHÁCH ĐÃ THU của buổi đó — dòng thu biến khỏi sổ quỹ mà khách thì đã trả tiền rồi.
// Nên xoá cứng chỉ dành cho buổi chưa ai chạm vào; buổi có dấu vết thì HUỶ.

import assert from 'node:assert/strict'
import { sessionRefs } from '#lib/money.js'

const base = (patch = {}) => ({
  attendance: {}, sessionGuests: [], matches: [],
  sessions: [{ id: 'S1', status: 'draft', date: '2026-09-20' }],
  ...patch,
})

assert.deepEqual(sessionRefs(base(), 'S1'), [],
  'buổi chưa ai chạm vào phải xoá được — chặn oan thì lịch sinh nhầm ngày nằm lại mãi trong lịch tháng')

assert.deepEqual(sessionRefs(base({ attendance: { S1: { M1: 'present' } } }), 'S1'), ['attend'],
  'buổi đã điểm danh mà xoá cứng → mất bảng điểm danh, không còn gì chứng minh ai đã đánh hôm đó')

assert.deepEqual(sessionRefs(base({ sessionGuests: [{ id: 'G1', sessionId: 'S1', paid: true }] }), 'S1'), ['guest'],
  'buổi có khách mà xoá cứng → dòng THU của khách biến khỏi sổ quỹ, mà khách thì đã trả tiền rồi')

assert.deepEqual(sessionRefs(base({ matches: [{ id: 'M1', sessionId: 'S1' }] }), 'S1'), ['match'],
  'buổi đã ghi trận mà xoá cứng → mất lịch sử trận và thống kê của mọi người trong buổi đó')

assert.deepEqual(sessionRefs(base({ challenges: [{ id: 'C1', sessionId: 'S1' }] }), 'S1'), ['challenge'],
  'buổi có kèo đấu mà xoá cứng → mất liên kết kèo của buổi tập')

assert.deepEqual(
  sessionRefs(base({ sessions: [{ id: 'S1', status: 'closed', date: '2026-09-01' }] }), 'S1'),
  ['closed'],
  'buổi ĐÃ CHỐT mà xoá cứng → mất giá thành đã đóng băng, con số cả nhóm đã chia tiền theo')

assert.deepEqual(
  sessionRefs(base({ sessions: [{ id: 'S1', status: 'draft', costFrozenAt: '2026-09-01' }] }), 'S1'),
  ['closed'],
  'đã đóng băng giá thành thì dù status còn draft cũng là số đã chốt — không được xoá')

// Buổi khác không được kéo theo.
assert.deepEqual(sessionRefs(base({ sessionGuests: [{ sessionId: 'S2' }], matches: [{ sessionId: 'S2' }] }), 'S1'), [])
// Ô điểm danh rỗng không tính là đã chạm.
assert.deepEqual(sessionRefs(base({ attendance: { S1: {} } }), 'S1'), [])

// Kể hết lý do, không dừng ở cái đầu.
assert.deepEqual(
  sessionRefs(base({ attendance: { S1: { M1: 'present' } }, matches: [{ sessionId: 'S1' }] }), 'S1'),
  ['attend', 'match'])

console.log('session delete check: OK')
