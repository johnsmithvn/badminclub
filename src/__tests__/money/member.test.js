// node --test — Thành viên: điểm danh · danh sách cố định · vào giữa tháng · ngưng / xoá.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  adjustKey, adjustRows, groupMembers, joinDues, memberRefs, offBackSuggest,
  presentCount, remainSessions, sessionOf, unitPrice,
} from '#lib/money.js'

const db = seed()
const S = (id) => sessionOf(db, id)
/* ---------- điểm danh và nhóm cố định ---------- */
// B1 nhóm CN: 15 người cố định, 2 người vắng (M5, M15)
const g1Members = groupMembers(db, 'G1', '2026-08')
assert.equal(g1Members.length, 15)
assert.equal(presentCount(db, S('B1')), 13)
assert.equal(presentCount(db, S('B4')), groupMembers(db, 'G2', '2026-08').length, 'B4 không ai vắng')
// Tháng 09 có bản ghi roster riêng: M5 và M15 nghỉ, M17 chờ duyệt → chỉ còn fixed
assert.equal(groupMembers(db, 'G1', '2026-09').length, 13, 'off và pending không tính là cố định')

/* ---------- chuyển cố định → vãng lai: KHÔNG được đánh mất khoản, KHÔNG được thu hai lần ---------- */

// Dựng cảnh: M5 (nữ nhóm CN) vắng 2 buổi đã chốt, đã được back 80.000.
const savedBack = {
  id: 'AJZ', key: adjustKey('2026-08', 'G1', 'M5', 'absent_back'), month: '2026-08',
  groupId: 'G1', memberId: 'M5', kind: 'absent_back', sessions: 2, unit: 40000,
  amount: -80000, settle: 'cash', paid: true, paidAt: '2026-08-28',
}
// Gỡ M5 khỏi danh sách cố định nhóm CN tháng 8 = chuyển sang vãng lai.
const dbVanglai = {
  ...db,
  adjustments: [savedBack],
  roster: { ...db.roster, '2026-08': { ...(db.roster['2026-08'] || {}), G1: { M5: 'off' } } },
}
assert.ok(!groupMembers(dbVanglai, 'G1', '2026-08').some((m) => m.id === 'M5'), 'M5 không còn cố định')

const kept = adjustRows(dbVanglai, '2026-08').find((r) => r.key === savedBack.key)
assert.ok(kept, 'khoản ĐÃ TRẢ không được biến mất — sổ quỹ còn dòng chi thì phải còn dòng giải thích')
assert.equal(kept.amount, -80000)
assert.equal(kept.paid, true)
assert.equal(kept.orphan, true, 'phải đánh dấu là không còn khớp danh sách cố định hiện tại')

// Thu hai lần: M5 đã đóng quỹ tháng 8 cho nhóm CN. Giờ là vãng lai, bị chấm 'extra' một buổi.
const dueM5 = db.dues.find((d) => d.month === '2026-08' && d.groupId === 'G1' && d.memberId === 'M5')
assert.ok(dueM5, 'M5 có khoản quỹ tháng 8 nhóm CN')
const dbTwice = {
  ...dbVanglai,
  attendance: { ...db.attendance, B1: { ...(db.attendance.B1 || {}), M5: 'extra' } },
}
assert.equal(
  adjustRows(dbTwice, '2026-08').filter((r) => r.kind === 'extra_session' && r.memberId === 'M5').length,
  0, 'đã đóng quỹ tháng cho nhóm này rồi thì không tính thêm tiền đi lẻ — thu hai lần cùng một buổi'
)
// Còn người CHƯA có quỹ tháng nhóm đó thì vẫn phải thu bình thường.
const dbNoDue = { ...dbTwice, dues: db.dues.filter((d) => d.id !== dueM5.id) }
assert.equal(
  adjustRows(dbNoDue, '2026-08').filter((r) => r.kind === 'extra_session' && r.memberId === 'M5').length,
  1, 'chưa đóng quỹ nhóm đó thì đi lẻ vẫn phải trả'
)

/* ---------- xoá cứng thành viên: chỉ khi chưa dính gì ---------- */

assert.ok(memberRefs(db, 'M5').length > 0, 'người đã điểm danh và đóng quỹ thì không xoá cứng được')
assert.ok(memberRefs(db, 'M5').indexOf('dues') >= 0)
assert.ok(memberRefs(db, 'M5').indexOf('attend') >= 0)
const bare = { ...db, members: db.members.concat([{ id: 'MZZ', name: 'Mới toanh', gender: 'nam', active: true }]) }
assert.deepEqual(memberRefs(bare, 'MZZ'), [], 'người vừa thêm, chưa dính gì thì xoá được')
assert.deepEqual(memberRefs(db, 'không-có-ai'), [], 'id lạ thì không crash')

/* ---------- người vào GIỮA THÁNG: phải sinh được khoản để thu ---------- */

const gCN = db.groups.find((g) => g.id === 'G1')
const joiner = { id: 'MX', gender: 'nam' }

// Nhóm đã có buổi trong tháng → thu theo số buổi CÒN LẠI tính từ hôm nay.
const dbMid = { ...db, today: '2026-08-19' }
const jd = joinDues(dbMid, joiner, gCN, '2026-08')
assert.equal(jd.full, false)
assert.equal(jd.sessions, remainSessions(dbMid, 'G1', '2026-08'))
assert.ok(jd.sessions > 0, 'ngày 19/08 nhóm CN còn buổi')
assert.equal(jd.amount, unitPrice(dbMid, joiner, gCN, '2026-08').unit * jd.sessions)
assert.ok(jd.amount < gCN.feeNam, 'vào giữa tháng thì thu ít hơn trọn gói')

// Nhóm CHƯA có buổi nào trong tháng — CLB vừa dựng giữa tháng, lịch chưa tạo.
// Trước đây rơi vào nhánh "0 buổi còn lại" nên KHÔNG sinh khoản nào: thêm người xong không có
// gì để thu. Giờ thu trọn gói vì họ sẽ đánh đủ số buổi của tháng.
const jdFull = joinDues(db, joiner, gCN, '2030-01')
assert.equal(jdFull.full, true)
assert.equal(jdFull.sessions, 0)
assert.equal(jdFull.amount, gCN.feeNam, 'chưa có buổi nào thì thu trọn gói')
assert.equal(joinDues(db, { id: 'MY', gender: 'nu' }, gCN, '2030-01').amount, gCN.feeNu)

// Buổi của tháng đã đánh hết (hôm nay sau buổi cuối) → không còn gì để thu.
assert.equal(joinDues({ ...db, today: '2026-08-31' }, joiner, gCN, '2026-08').amount, 0)

/* ---------- số buổi còn lại trong tháng ---------- */
const dbToday = { ...db, today: '2026-08-19' }
assert.equal(remainSessions(dbToday, 'G1', '2026-08'), 2, 'B7 (23/08) và B9 (30/08)')
assert.equal(remainSessions(dbToday, 'G2', '2026-08'), 2, 'B6 (21/08) và B8 (28/08)')

/* ---------- gợi ý back tiền khi ngưng hoạt động: offBackSuggest ---------- */

const sug1 = offBackSuggest(db, 'M1')
assert.ok(sug1, 'M1 đang cố định G1 và đã đóng quỹ tháng 8 → phải hỏi')
assert.equal(sug1.name, 'Thúy')
assert.equal(sug1.sessions, remainSessions(db, 'G1', '2026-08'))
assert.equal(sug1.amount, unitPrice(db, db.members[0], db.groups[0], '2026-08').unit * sug1.sessions)

// Chưa đóng đồng nào thì không có gì để trả lại — hiện hộp thoại là hỏi thừa.
assert.equal(offBackSuggest(db, 'M5'), null, 'M5 chưa đóng quỹ tháng 8 → ngưng thẳng, không hỏi')
assert.equal(offBackSuggest(db, 'M17'), null, 'không cố định nhóm nào → không hỏi')
assert.equal(offBackSuggest(db, 'ZZZ'), null, 'id không tồn tại → null, không throw')

// Cố định hai nhóm thì cộng cả hai, và nói rõ là hai nhóm nào.
const sug2 = offBackSuggest(db, 'M2')
assert.ok(sug2.groups.includes(db.groups[0].name) && sug2.groups.includes(db.groups[1].name))
assert.equal(sug2.sessions, remainSessions(db, 'G1', '2026-08') + remainSessions(db, 'G2', '2026-08'))

console.log('money/member check: OK')
