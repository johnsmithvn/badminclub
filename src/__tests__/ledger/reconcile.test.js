// node --test — Đối chiếu quỹ (TASKS Phase 9 · P7): so tiền thật đếm được với sổ, rồi xếp nghi vấn
// theo mức khớp. Bản đồ đầy đủ: src/__tests__/README.md
//
// Vì sao đáng test: mười một lỗi nhóm B đều IM LẶNG. Màn này là chỗ duy nhất biến chúng thành một
// câu đọc được, nên xếp sai thứ tự hoặc sai chiều là nó chỉ vào chỗ vô can và thủ quỹ đi dò nhầm.

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import { REC_KEYS, fundBalance, reconcile } from '#lib/ledger.js'
import { dueState } from '#lib/money.js'

const db = seed()
const keyOf = (r) => r.suspects.map((s) => s.key)
const find = (r, k) => r.suspects.find((s) => s.key === k)

/* ---------- khung: sổ, số đếm, độ lệch ---------- */

const even = reconcile(db, fundBalance(db))
assert.equal(even.book, fundBalance(db), 'sổ phải đúng bằng số dư luỹ kế toàn thời gian')
assert.equal(even.diff, 0, 'đếm đúng bằng sổ thì không lệch')
assert.equal(even.gap, 0)
assert.ok(even.suspects.every((s) => s.match === false), 'không lệch thì không nghi vấn nào được coi là khớp')

const less = reconcile(db, fundBalance(db) - 500000)
assert.equal(less.diff, -500000, 'đếm ít hơn sổ thì lệch ÂM')
assert.equal(less.gap, 500000, 'gap luôn dương để so với số tiền của nghi vấn')

// Chưa gõ số đếm: vẫn liệt kê nghi vấn (dùng như checklist), nhưng KHÔNG được bịa ra độ lệch.
const blank = reconcile(db, null)
assert.equal(blank.counted, null, 'chưa gõ thì counted là null, không phải 0')
assert.equal(blank.diff, 0)
assert.ok(blank.suspects.length > 0, 'chưa gõ số vẫn phải liệt kê khoản còn treo')
assert.ok(blank.suspects.every((s) => s.match === false), 'chưa gõ số thì không có gì để khớp')
// Đếm được ĐÚNG 0 đồng (quỹ rỗng) khác hẳn với chưa gõ — không được gộp làm một.
assert.equal(reconcile(db, 0).counted, 0, 'đếm được 0 đồng là một câu trả lời thật')
assert.equal(reconcile(db, 0).diff, -fundBalance(db))

/* ---------- mọi nghi vấn phải khai đủ, và i18n phải có key ---------- */

assert.ok(blank.suspects.every((s) => REC_KEYS.includes(s.key)),
  'nghi vấn nào cũng phải nằm trong REC_KEYS — i18n test đọc danh sách đó để đòi key')
assert.ok(blank.suspects.every((s) => s.n > 0), 'không có khoản nào thì đừng liệt kê dòng rỗng')
assert.ok(blank.suspects.every((s) => s.amount === null || Number.isFinite(s.amount)),
  'amount phải là số hoặc null, không được NaN — null nghĩa là không ước lượng được')
assert.equal(new Set(keyOf(blank)).size, keyOf(blank).length, 'mỗi loại nghi vấn chỉ một dòng')

/* ---------- CHIỀU: nghi vấn chỉ được xếp lên đầu khi nó giải thích được đúng chiều lệch ---------- */
// Không có chiều thì câu gợi ý đầu tiên thường vô nghĩa: báo "quên tick quỹ tháng" (tiền lẽ ra
// PHẢI NHIỀU hơn) trong khi quỹ đang THIẾU tiền. Thủ quỹ đi dò nhầm chỗ, mất buổi tối.
//
// Fixture không có back chưa trả lẫn khoản ứng, mà đó đúng là hai nghi vấn chiều 'out' — dựng
// thêm vào đây, không sửa fixture (fixture nuôi 15 file test khác).
const dbBoth = {
  ...db,
  adjustments: [{
    id: 'AJ9', month: '2026-08', groupId: 'G1', memberId: 'M2', kind: 'absent_back',
    sessions: 2, unitPrice: 40000, amount: -80000, settle: 'cash', paid: false, paidAt: null,
  }],
  // M2 là vai `member` → không phải két → đây là khoản CLB đang nợ họ (LUẬT NGƯỜI GIỮ QUỸ).
  purchases: db.purchases.map((p) => (p.id === 'P3' ? { ...p, payerId: 'M2', repaidAt: '' } : p)),
}
const both = reconcile(dbBoth, null)
const dirOf = (k) => find(both, k).dir
assert.equal(dirOf('dueUnticked'), 'in', 'đã thu mà quên tick → tiền trong két, sổ chưa thấy')
assert.equal(dirOf('guestUnpaid'), 'in')
assert.equal(dirOf('backUnpaid'), 'out', 'đã trả mà quên tick → tiền đã rời két, sổ vẫn giữ')
assert.equal(dirOf('advanceUnpaid'), 'out')
assert.equal(find(both, 'opening').dir, null, 'số dư mang sang không giải thích chiều nào')
assert.equal(find(both, 'backUnpaid').amount, 80000, 'back: đảo dấu khoản ÂM ra số quỹ phải trả')
assert.equal(find(both, 'advanceUnpaid').amount, 3300000, 'ứng tiền: đúng số người đó bỏ ra')

const dirsOf = (r) => r.suspects.filter((s) => s.dir).map((s) => s.dir)
// Lệch ÂM (thiếu tiền) → nghi vấn chiều 'out' phải đứng trước mọi nghi vấn chiều 'in'.
const outFirst = reconcile(dbBoth, fundBalance(dbBoth) - 7)
assert.ok(dirsOf(outFirst).lastIndexOf('out') < dirsOf(outFirst).indexOf('in'),
  'quỹ thiếu tiền thì phải hỏi khoản đã CHI trước, không phải khoản đã THU')

// Lệch DƯƠNG (thừa tiền) → ngược lại.
const inFirst = reconcile(dbBoth, fundBalance(dbBoth) + 7)
assert.ok(dirsOf(inFirst).lastIndexOf('in') < dirsOf(inFirst).indexOf('out'),
  'quỹ thừa tiền thì phải hỏi khoản đã THU trước')

/* ---------- MỨC KHỚP: nghi vấn khớp đúng số lệch phải lên đầu và được đánh dấu ---------- */
// Đây là thứ cả màn hình sinh ra để làm: lệch −1.920.000 thì câu đầu tiên phải là hoá đơn sân
// 1.920.000, không phải một danh sách chung chung sắp theo tiền giảm dần.
const guestOwed = find(blank, 'guestUnpaid').amount
assert.ok(guestOwed > 0, 'fixture phải có khách còn nợ, không thì phép thử dưới vô nghĩa')
const exact = reconcile(db, fundBalance(db) + guestOwed)
assert.equal(exact.suspects[0].key, 'guestUnpaid', 'nghi vấn khớp đúng số lệch phải đứng đầu')
assert.equal(exact.suspects[0].match, true, 'và phải được đánh dấu khớp')
assert.equal(exact.suspects.filter((s) => s.match).length, 1, 'chỉ dòng đúng số mới được đánh dấu')

/* ---------- số tiền của từng nghi vấn phải là số THẬT, không phải số trang trí ---------- */

assert.equal(find(blank, 'dueUnticked').amount,
  db.dues.reduce((s, d) => s + dueState(d).remain, 0), 'quỹ tháng: tổng phần CÒN THIẾU')
assert.equal(find(blank, 'guestUnpaid').amount,
  db.sessionGuests.filter((g) => !g.paid).reduce((s, g) => s + g.price, 0), 'khách: tổng lượt chưa trả')
assert.equal(find(blank, 'opening').amount, db.club.opening)

// Đóng thiếu phải tính phần còn thiếu, không phải cả khoản: đóng 150/250 thì nghi vấn là 100.
const someDue = db.dues.find((d) => dueState(d).remain === 0 && d.amount > 0)
const partial = { ...db, dues: db.dues.map((d) => (d.id === someDue.id ? { ...d, paidAmount: d.amount - 100000 } : d)) }
assert.equal(find(reconcile(partial, null), 'dueUnticked').amount,
  find(blank, 'dueUnticked').amount + 100000, 'đóng thiếu chỉ được cộng phần còn thiếu vào nghi vấn')

/* ---------- B1 · hoá đơn sân: chỉ nhắc khi trả TRỌN THÁNG ---------- */
// Mode `session` ghi tiền sân ngay lúc chốt buổi — nhắc hoá đơn tháng ở đó là nhắc sai.
const noBills = { ...db, courtBills: [] }
assert.ok(find(reconcile(noBills, null), 'noBill'), 'tháng có buổi chốt mà trống hoá đơn thì phải nhắc')
const perSession = { ...noBills, club: { ...noBills.club, courtPayMode: 'session' } }
assert.equal(find(reconcile(perSession, null), 'noBill'), undefined,
  'trả từng buổi thì không có hoá đơn tháng để mà quên')
assert.equal(find(reconcile(db, null), 'noBill'), undefined, 'đã nhập hoá đơn rồi thì im')

// Mốc ước lượng lấy hoá đơn gần nhất; chưa từng có hoá đơn nào thì để null chứ không đoán 0 —
// 0 đồng sẽ khớp với mọi thứ và đẩy dòng vô dụng này lên đầu bảng.
const oneBill = {
  ...db,
  courtBills: [
    { id: 'CB8', month: '2026-06', date: '2026-06-30', venue: 'Yên Phong', amount: 1750000, payerId: null, payer: '', note: '', repaidAt: '' },
    { id: 'CB9', month: '2026-07', date: '2026-07-31', venue: 'Yên Phong', amount: 1920000, payerId: null, payer: '', note: '', repaidAt: '' },
  ],
}
assert.equal(find(reconcile(oneBill, null), 'noBill').amount, 1920000,
  'lấy hoá đơn GẦN NHẤT làm mốc ước lượng, không phải hoá đơn đầu tiên')

const neverBilled = { ...db, courtBills: [] }
assert.equal(find(reconcile(neverBilled, null), 'noBill').amount, null,
  'chưa từng có hoá đơn nào thì không ước lượng, KHÔNG được trả 0')

/* ---------- amount = null: xếp cuối TRONG CÙNG MỘT CHIỀU, và không bao giờ "khớp" ---------- */
// Chiều vẫn là khoá sắp xếp thứ nhất — nghi vấn giải thích đúng chiều lệch thì đứng trên, kể cả
// khi chưa ước lượng được thành tiền. Nhưng trong cùng chiều thì phải nhường chỗ cho dòng có số.
// Trả 0 thay cho null là hỏng hẳn: 0 khớp với mọi độ lệch và chiếm đầu bảng vĩnh viễn.
const bothNoBill = { ...dbBoth, courtBills: [] }
const wn = reconcile(bothNoBill, fundBalance(bothNoBill) - 1)   // thiếu tiền → ưu tiên chiều 'out'
const outs = wn.suspects.filter((s) => s.dir === 'out')
assert.ok(outs.length > 1, 'phải có nhiều hơn một nghi vấn chiều out thì phép thử mới có nghĩa')
assert.equal(outs[outs.length - 1].key, 'noBill', 'trong cùng chiều, dòng không ước lượng được xếp cuối')
assert.ok(outs.slice(0, -1).every((s) => s.amount != null))
assert.ok(wn.suspects.some((s) => s.key === 'noBill'), 'vẫn phải hiện ra chứ không bị bỏ đi')
assert.ok(wn.suspects.every((s) => s.amount != null || s.match === false),
  'không có số thì không bao giờ được đánh dấu khớp')

/* ---------- số dư mang sang (B11) luôn xếp CUỐI ---------- */
// Nó là thứ kiểm khi mọi giải thích khác đã loại trừ — để lên đầu thì lần nào cũng nghi ngờ
// đúng con số không ai động vào từ lúc lập CLB.
;[blank, less, exact, inFirst, outFirst].forEach((r, i) => {
  assert.equal(r.suspects[r.suspects.length - 1].key, 'opening', 'số dư mang sang phải xếp cuối · ca ' + i)
})

/* ---------- CLB rỗng: không throw, không NaN ---------- */
const emptyDb = {
  ...db, dues: [], sessionGuests: [], adjustments: [], sessions: [], courtBills: [],
  purchases: [], manual: [], club: { ...db.club, opening: 0 },
}
const er = reconcile(emptyDb, null)
assert.ok(Number.isFinite(er.book) && Number.isFinite(er.diff) && Number.isFinite(er.gap))
// CLB rỗng chỉ còn đúng dòng số dư mang sang. CỐ Ý giữ lại dù bằng 0: bỏ trống ô đó lúc lập CLB
// chính là cảnh B11 hay gặp nhất, và 0 là giá trị sai phổ biến nhất chứ không phải giá trị trung
// tính. Nó không bao giờ bị đánh dấu "khớp" vì `match` đòi `gap > 0`.
assert.deepEqual(keyOf(er), ['opening'], 'CLB rỗng không được đẻ ra nghi vấn từ dữ liệu không tồn tại')
assert.equal(er.suspects[0].amount, 0)
assert.equal(er.suspects[0].match, false)
assert.equal(reconcile(emptyDb, 0).diff, 0, 'CLB rỗng đếm 0 đồng thì khớp, không lệch')

console.log('ledger/reconcile check: OK')
