// node src/__tests__/money/group_delete.test.js
//
// XOÁ một nhóm cố định (`money.js: groupRefs`).
//
// Luật cũ chặn theo VỊ TRÍ: `groups[0]` là "nhóm mặc định, không xoá". Sai ở hai đầu:
//   - chặn OAN nhóm đầu danh sách dù nó sạch trơn (đúng ca user gặp: nhập cài đặt xong không
//     xoá nổi nhóm "Cố định" mặc dù nó không dính lịch nào);
//   - và BỎ LỌT: chỉ kiểm sessions + schedules, không kiểm quỹ tháng / đối chiếu / danh sách
//     cố định. Mọi khoá ngoại trỏ về `member_groups` đều TRẦN, nên xoá nhóm còn dòng quỹ tháng
//     là 23503 — hàng đợi đồng bộ kẹt vĩnh viễn mà màn hình vẫn báo đã lưu.

import assert from 'node:assert/strict'
import { groupRefs } from '#lib/money.js'

const empty = { sessions: [], schedules: [], dues: [], adjustments: [], roster: {} }

assert.deepEqual(groupRefs(empty, 'G1'), [],
  'nhóm sạch trơn phải xoá được — chặn oan là user kẹt với một nhóm rác vĩnh viễn')

assert.deepEqual(groupRefs({ ...empty, sessions: [{ groupId: 'G1' }] }, 'G1'), ['session'])
assert.deepEqual(groupRefs({ ...empty, schedules: [{ groupId: 'G1' }] }, 'G1'), ['schedule'])

// Ba cái dưới đây là phần luật cũ BỎ LỌT — mỗi cái đều làm kẹt hàng đợi đồng bộ.
assert.deepEqual(groupRefs({ ...empty, dues: [{ groupId: 'G1' }] }, 'G1'), ['dues'],
  'nhóm còn dòng quỹ tháng mà cho xoá → 23503, hàng đợi đồng bộ kẹt và mất luôn khoản đã thu khỏi sổ')
assert.deepEqual(groupRefs({ ...empty, adjustments: [{ groupId: 'G1' }] }, 'G1'), ['adjust'],
  'nhóm còn dòng đối chiếu (back tiền) mà cho xoá → quỹ đang nợ người ta mà không còn chỗ nào nhắc')
assert.deepEqual(groupRefs({ ...empty, roster: { '2026-09': { G1: { M1: 'fixed' } } } }, 'G1'), ['roster'],
  'nhóm còn danh sách cố định của tháng nào đó mà cho xoá → group_memberships mồ côi, 23503')

// Ô roster rỗng thì không tính là còn dùng.
assert.deepEqual(groupRefs({ ...empty, roster: { '2026-09': { G1: {} } } }, 'G1'), [])
// Nhóm khác không được kéo theo.
assert.deepEqual(groupRefs({ ...empty, dues: [{ groupId: 'G2' }] }, 'G1'), [])

// Nhiều lý do thì phải kể hết, không dừng ở cái đầu tiên.
assert.deepEqual(
  groupRefs({ ...empty, sessions: [{ groupId: 'G1' }], dues: [{ groupId: 'G1' }] }, 'G1'),
  ['session', 'dues'],
  'chỉ báo một lý do thì user gỡ xong cái đó lại bị chặn tiếp, không biết còn bao nhiêu vòng nữa')

console.log('group delete check: OK')
