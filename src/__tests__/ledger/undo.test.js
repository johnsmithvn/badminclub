// node src/__tests__/ledger/undo.test.js
//
// HOÀN TÁC một dòng sổ quỹ (`ledger.js: undoTarget`). Sổ quỹ là bảng SUY RA — không có dòng nào
// để xoá, phải lật đúng cờ ở NGUỒN. Ba chỗ sai tốn tiền:
//   1. gỡ nhầm nguồn (id của dòng ghi tay là uuid trần, mà uuid là hex nên bắt đầu bằng "cb"
//      hay "aj" là chuyện bình thường) → bấm hoàn một dòng chi tay lại gỡ một hoá đơn sân;
//   2. cho hoàn dòng suy từ buổi ĐÃ CHỐT → sổ quỹ và buổi nói hai số khác nhau;
//   3. cho hoàn khoản QUỸ tự trả → tưởng đã gỡ mà thật ra hoá đơn vẫn nằm đó.

import assert from 'node:assert/strict'
import { editTarget, undoTarget } from '#lib/ledger.js'

// Két = payerId rỗng (money.js: isVault). 'M1' là một thành viên đã ứng tiền.
const db = {
  club: { openingDate: '2026-09-01', opening: 0 },
  members: [{ id: 'M1', name: 'Tiến Đạt' }],
  dues: [
    { id: 'D1', memberId: 'M1', amount: 250000, paidAmount: 250000 },
    { id: 'D2', memberId: 'M1', amount: 250000, paidAmount: 0 },
  ],
  sessionGuests: [
    { id: 'SG1', paid: true },
    { id: 'SG2', paid: false },
  ],
  adjustments: [
    { id: 'AJ1', key: '2026-09:G6:M1:absent_back', paid: true, settle: 'cash' },
    { id: 'AJ2', key: '2026-09:G6:M1:extra_session', paid: false, settle: 'cash' },
    { id: 'AJ3', key: '2026-09:G6:M1:x', paid: true, settle: 'offset_next_dues' },
  ],
  courtBills: [
    { id: 'CB1', payerId: 'M1', repaidAt: '2026-09-05' }, // thành viên ứng, CLB đã trả lại
    { id: 'CB2', payerId: 'M1', repaidAt: '' },           // ứng nhưng CLB chưa trả
    { id: 'CB3', payerId: '', repaidAt: '' },             // két tự trả
  ],
  // Dòng ghi tay: id là uuid TRẦN. Cố tình cho một cái bắt đầu bằng "cb" và một cái "aj".
  manual: [
    { id: 'cb7f1e20-0000-4000-8000-000000000001', dir: 'out', amount: 1000 },
    { id: 'aj3c9d41-0000-4000-8000-000000000002', dir: 'in', amount: 2000 },
  ],
}

const row = (id) => ({ id })

/* ---------- bẫy chính: uuid của dòng ghi tay trùng tiền tố ---------- */

assert.deepEqual(
  undoTarget(db, row('cb7f1e20-0000-4000-8000-000000000001')),
  { kind: 'manual', id: 'cb7f1e20-0000-4000-8000-000000000001' },
  'dòng ghi tay có uuid bắt đầu bằng "cb" bị nhận nhầm thành hoá đơn sân → bấm hoàn một dòng chi tay lại đi gỡ tiền sân của người khác'
)
assert.deepEqual(
  undoTarget(db, row('aj3c9d41-0000-4000-8000-000000000002')),
  { kind: 'manual', id: 'aj3c9d41-0000-4000-8000-000000000002' },
  'uuid bắt đầu bằng "aj" bị nhận nhầm thành dòng đối chiếu'
)

/* ---------- quỹ tháng ---------- */

assert.deepEqual(undoTarget(db, row('duD1')), { kind: 'due', id: 'D1' })
assert.equal(undoTarget(db, row('duD2')), null,
  'khoản chưa thu đồng nào mà vẫn cho hoàn → gỡ một khoản không có trong sổ')
assert.equal(undoTarget(db, row('duKHONGCO')), null, 'id không có thật phải trả null, không được throw giữa lúc render bảng')

/* ---------- khách giao lưu ---------- */

assert.deepEqual(undoTarget(db, row('sgSG1')), { kind: 'guest', id: 'SG1' })
assert.equal(undoTarget(db, row('sgSG2')), null, 'khách chưa trả thì không có gì để hoàn')

/* ---------- đối chiếu buổi ---------- */

assert.deepEqual(undoTarget(db, row('ajAJ1')), { kind: 'adjust', key: '2026-09:G6:M1:absent_back' },
  'settleAdjust nhận KEY chứ không nhận id — trả id là gỡ nhầm hoặc không gỡ được gì')
assert.equal(undoTarget(db, row('ajAJ2')), null, 'khoản chưa trả thì chưa có dòng nào trong sổ để hoàn')
assert.equal(undoTarget(db, row('ajAJ3')), null,
  'khoản trừ vào quỹ tháng sau KHÔNG sinh dòng sổ quỹ — cho hoàn ở đây là bịa ra một thao tác không có thật')

/* ---------- ứng tiền ---------- */

assert.deepEqual(undoTarget(db, row('cbCB1')), { kind: 'advance', id: 'CB1' })
assert.equal(undoTarget(db, row('cbCB2')), null,
  'CLB chưa trả lại người ứng thì chưa có dòng chi nào trong sổ — không có gì để hoàn')
assert.equal(undoTarget(db, row('cbCB3')), null,
  'khoản QUỸ tự trả: dòng chi chính là hoá đơn đó, "hoàn" ở đây là xoá hoá đơn — phải đi qua nút xoá riêng')

/* ---------- không hoàn được ---------- */

;['open', 'ctS1', 'csS1', 'ceS1'].forEach((id) => {
  assert.equal(undoTarget(db, row(id)), null,
    id + ' suy từ buổi đã chốt hoặc từ Cài đặt — hoàn ở sổ quỹ là để sổ và buổi nói hai số khác nhau')
})
assert.equal(undoTarget(db, null), null)

console.log('ledger undo check: OK')

/* ---------- editTarget: SỬA khác HOÀN TÁC ---------- */

assert.deepEqual(editTarget(db, row('cbCB3')), { kind: 'bill', id: 'CB3' },
  'hoá đơn QUỸ tự trả không hoàn tác được nhưng PHẢI sửa được — không thì gõ nhầm số tiền chỉ còn cách xoá rồi ghi lại, mất luôn dấu vết đã trả lại người ứng')
assert.deepEqual(editTarget(db, row('cbCB1')), { kind: 'bill', id: 'CB1' })
assert.deepEqual(
  editTarget(db, row('cb7f1e20-0000-4000-8000-000000000001')),
  { kind: 'manual', id: 'cb7f1e20-0000-4000-8000-000000000001' },
  'dòng ghi tay có uuid bắt đầu bằng "cb" bị nhận nhầm thành hoá đơn sân → bấm Sửa mở nhầm hoá đơn của người khác')
;['duD1', 'sgSG1', 'ajAJ1', 'puPU1', 'open', 'ctS1', 'csS1', 'ceS1'].forEach((id) => {
  assert.equal(editTarget(db, row(id)), null,
    id + ' không phải dòng ghi tay — sửa ở sổ quỹ là để sổ và nguồn nói hai số khác nhau')
})
assert.equal(editTarget(db, row('cbKHONGCO')), null)

console.log('ledger edit target check: OK')

/* ---------- BUG: dòng "Chi hộ" không sửa được ---------- */
// `ledgerGrouped` tự sinh dòng ứng chưa hoàn với id 'cb_adv_<id>' / 'pu_adv_<id>' (chúng KHÔNG
// nằm trong ledger()). Cắt hai ký tự đầu ra 'cb' rồi slice(2) thì được '_adv_CB2' — tra không
// thấy nên trả null, tức là hoá đơn sân do thành viên ứng KHÔNG có nút Sửa. Mà đó đúng là
// hoá đơn ghi tay: gõ nhầm số tiền thì chỉ còn cách xoá rồi ghi lại, mất luôn người ứng.
assert.deepEqual(editTarget(db, row('cb_adv_CB2')), { kind: 'bill', id: 'CB2' },
  'dòng "Chi hộ" phải sửa được — nó chính là hoá đơn sân ghi tay, chỉ khác là quỹ chưa hoàn tiền')
assert.equal(undoTarget(db, row('cb_adv_CB2')), null,
  'nhưng KHÔNG hoàn tác được: quỹ chưa trả lại người ứng nên trong sổ chưa có dòng chi nào')
assert.equal(editTarget(db, row('cb_adv_KHONGCO')), null)
// Đợt mua cầu ứng chưa hoàn: chưa có form sửa nên phải trả null. Fixture cố tình có MỘT hoá đơn
// sân trùng id với đợt mua, để bắt đúng lỗi "bóc tiền tố xong tra bừa vào courtBills" — không có
// dòng này thì mọi cách bóc sai đều trả null vì tra không thấy, và test không bắt được gì.
const dbCollide = { ...db, courtBills: db.courtBills.concat([{ id: 'PU1', payerId: 'M1', repaidAt: '' }]) }
assert.equal(editTarget(dbCollide, row('pu_adv_PU1')), null,
  'dòng ứng MUA CẦU bị hiểu thành hoá đơn sân → bấm Sửa mở hộp thoại hoá đơn sân với dữ liệu của đợt mua cầu')
assert.deepEqual(editTarget(dbCollide, row('cb_adv_PU1')), { kind: 'bill', id: 'PU1' },
  'nhưng dòng ứng TIỀN SÂN cùng id đó thì vẫn phải sửa được — chứng minh guard chặn theo tiền tố, không phải chặn bừa')
