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

const empty = { today: '2026-09-10', sessions: [], schedules: [], dues: [], adjustments: [], roster: {} }

assert.deepEqual(groupRefs(empty, 'G1'), [],
  'nhóm sạch trơn phải xoá được — chặn oan là user kẹt với một nhóm rác vĩnh viễn')

assert.deepEqual(groupRefs({ ...empty, sessions: [{ groupId: 'G1', date: '2026-09-20', status: 'draft' }] }, 'G1'), ['session'])
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
  groupRefs({ ...empty, sessions: [{ groupId: 'G1', date: '2026-09-20', status: 'draft' }], dues: [{ groupId: 'G1' }] }, 'G1'),
  ['session', 'dues'],
  'chỉ báo một lý do thì user gỡ xong cái đó lại bị chặn tiếp, không biết còn bao nhiêu vòng nữa')

console.log('group delete check: OK')

/* ---------- chặn TẠM khác chặn VĨNH VIỄN ---------- */
// Buổi chưa mở còn ở tương lai thì gỡ được (xoá lịch + buổi rồi xoá nhóm). Buổi đã mở, đã chốt
// hoặc đã qua ngày thì KHÔNG BAO GIỜ gỡ được: xoá nhóm là mọi dòng tiền lịch sử mất nhãn nhóm
// trong sổ quỹ, và khoá ngoại trần của sessions.group_id nổ 23503. Gộp hai cái làm một lý do
// thì người dùng ngồi gỡ mãi một thứ vô vọng mà app không nói.
const TODAY = empty.today
const withSessions = (list) => ({ ...empty, sessions: list })
const S = (date, status = 'draft') => ({ groupId: 'G1', date, status })

assert.deepEqual(groupRefs(withSessions([S('2026-09-20')]), 'G1'), ['session'],
  'buổi chưa mở ở tương lai là chặn TẠM — báo là "history" thì người ta tưởng vô vọng và bỏ cuộc')
assert.deepEqual(groupRefs(withSessions([S('2026-09-20', 'closed')]), 'G1'), ['history'],
  'buổi ĐÃ CHỐT là chặn vĩnh viễn — báo là "session" thì người ta ngồi gỡ mãi một thứ không gỡ nổi')
assert.deepEqual(groupRefs(withSessions([S('2026-09-20', 'open')]), 'G1'), ['history'],
  'buổi đang điểm danh dở cũng là lịch sử')
assert.deepEqual(groupRefs(withSessions([S('2026-09-01')]), 'G1'), ['history'],
  'buổi draft nhưng ĐÃ QUA NGÀY vẫn là lịch sử — ngày đó có thể đã đánh rồi')
assert.deepEqual(groupRefs(withSessions([S(TODAY)]), 'G1'), ['history'],
  'buổi của CHÍNH HÔM NAY tính là lịch sử — có thể đang đánh')

// Có cả hai thì phải kể cả hai, và `history` đứng trước để người đọc thấy ngay là vô vọng.
assert.deepEqual(groupRefs(withSessions([S('2026-09-01', 'closed'), S('2026-09-20')]), 'G1'),
  ['history', 'session'])

console.log('group delete: chặn tạm vs chặn vĩnh viễn OK')
