// node --test — Hiển thị và tra cứu: làm tròn tiền · đọc ô nhập · thang trình độ · tên người trả.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  SHUTTLE_UNIT_FALLBACK, genderTxt,
  fmt, fmtK, intOf, levelIdx, levelOf, levelStyle,
  payerName,
} from '#lib/money.js'
import cfg from '#config/app.json' with { type: 'json' }

const db = seed()
/* ---------- hiển thị: làm tròn nghìn, giữ dấu âm ---------- */
assert.equal(fmtK(1234567), '1.235.000')
assert.equal(fmtK(1234000), '1.234.000')
// Math.round làm tròn .5 về phía +∞, nên -2500 ra -2.000 (KHÔNG phải -3.000).
// Đây là hành vi của prototype, giữ nguyên có ý — đừng "sửa" thành round-half-away-from-zero.
assert.equal(fmtK(-2500), '-2.000')
assert.equal(fmtK(-3500), '-3.000') // cùng quirk: -3.5 → -3
assert.equal(fmtK(-2400), '-2.000')
assert.equal(fmtK(0), '0')
assert.equal(fmtK(499), '0', 'dưới 500 làm tròn về 0')
assert.equal(fmtK(500), '1.000')
assert.equal(fmt(120000), '120.000 đ')

/* ---------- trình độ ---------- */
// Khoá THỨ TỰ chứ không khoá vị trí cụ thể: thang mặc định là cấu hình, thêm bậc là chuyện
// bình thường; cái không được sai là thứ tự yếu → mạnh, vì thuật toán cân sân dùng đúng nó.
assert.equal(levelIdx('Newbie'), 0, 'bậc đầu thang luôn là yếu nhất')
assert.ok(
  cfg.levelsDefault.every((l, i) => i === 0 || levelIdx(l) > levelIdx(cfg.levelsDefault[i - 1])),
  'levelIdx phải tăng dần đúng theo thứ tự khai trong app.json'
)
assert.ok(levelIdx('TB') > levelIdx('TB-') && levelIdx('TB-') > levelIdx('TBY'), 'TBY < TB- < TB')
assert.ok(levelIdx('TBY') > levelIdx('Y'), 'Y < TBY')
assert.equal(levelIdx('không có'), 0, 'trình độ lạ về 0, không crash')

// Màu chia theo VỊ TRÍ trong thang của CLB, không theo tên bậc.
const scale = ['a', 'b', 'c', 'd', 'e', 'f']
assert.notDeepEqual(levelStyle('a', scale), levelStyle('f', scale), 'yếu nhất và mạnh nhất phải khác màu')
assert.deepEqual(levelStyle('a', scale), levelStyle('Newbie'), 'bậc đầu thang nào cũng cùng một màu')
assert.deepEqual(levelStyle('lạ hoắc', scale), levelStyle('a', scale), 'bậc không có trong thang thì về màu đầu')

// levelOf tôn trọng thay đổi đang chờ áp dụng
const m = { level: 'TBY', pendingLevel: 'TB-', pendingLevelFrom: '2026-09' }
assert.equal(levelOf(m, '2026-08'), 'TBY', 'tháng trước mốc thì giữ trình độ cũ')
assert.equal(levelOf(m, '2026-09'), 'TB-', 'đúng tháng mốc thì đổi')
assert.equal(levelOf(m, '2026-10'), 'TB-')
assert.equal(levelOf({ level: 'TB' }, '2026-09'), 'TB', 'không có pending thì dùng level')

/* ---------- đọc số từ ô nhập: dấu phân cách nghìn KHÔNG được ăn mất tiền ---------- */

// parseInt trần cắt ở dấu chấm: parseInt('1.650.000') = 1. Người Việt gõ tiền có dấu chấm là
// chuyện đương nhiên, nên mọi ô nhập tiền phải đi qua intOf.
assert.equal(intOf('1.650.000'), 1650000)
assert.equal(intOf('100.000'), 100000)
assert.equal(intOf('1,650,000'), 1650000, 'dấu phẩy cũng phải đọc được')
assert.equal(intOf('250 000'), 250000, 'dấu cách cũng vậy')
assert.equal(intOf('250000'), 250000)
assert.equal(intOf(250000), 250000, 'nhận cả số, không chỉ chuỗi')
assert.equal(intOf(''), 0)
assert.equal(intOf(null), 0)
assert.equal(intOf(undefined), 0)
assert.equal(intOf('abc'), 0, 'gõ bậy thì về 0, không NaN')
assert.equal(intOf('-5000'), 5000, 'ô nhập tiền không nhận số âm')
assert.ok(Number.isFinite(intOf('...')), 'không bao giờ ra NaN')

/* ---------- tên người trả một khoản chi ---------- */

const someone = db.members[0]
assert.equal(payerName(db, someone.id, 'gõ tay lệch'), someone.name, 'ưu tiên bản ghi thành viên')
assert.equal(payerName(db, null, 'Thúy'), 'Thúy', 'dữ liệu cũ nhập tay vẫn đọc được')
assert.equal(payerName(db, 'không-có-ai', 'Thúy'), 'Thúy', 'id chết thì rơi về chuỗi cũ')
assert.ok(payerName(db, null, '').length > 0, 'không có gì thì vẫn phải ra chữ, không ra rỗng')

/* ---------- nhãn giới tính ---------- */
// Đừng viết lại 'Nam'/'Nữ' trong màn hình — mọi chỗ đi qua đây.
assert.equal(genderTxt('nu'), 'Nữ')
assert.equal(genderTxt('nam'), 'Nam')
assert.equal(genderTxt(''), 'Nam', 'giá trị lạ rơi về Nam, không ra chuỗi rỗng')
assert.equal(genderTxt(undefined), 'Nam')

/* ---------- giá cầu khi chưa mua đợt nào ---------- */
assert.ok(SHUTTLE_UNIT_FALLBACK > 0, 'phải có giá đỡ, không thì CLB mới tính giá thành ra 0')

console.log('money/format check: OK')
