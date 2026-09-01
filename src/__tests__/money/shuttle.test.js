// node --test — Cầu: định mức · giá bình quân toàn kho · tồn kho · kiểm kho cuối tháng.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  checkOf,
  checkDue, checkPreview, estSessions, quotaFor, sessionOf, shuttleUnit,
  spreadDiff, stock,
} from '#lib/money.js'
import cfg from '#config/app.json' with { type: 'json' }

const db = seed()
const S = (id) => sessionOf(db, id)
/* ---------- định mức cầu ---------- */
// Nhóm CN quota 34 cho 2 sân; buổi đủ 2 sân thì đúng 34
assert.equal(quotaFor(db, S('B5')), 34)
// B3 bán 1 sân → định mức giảm theo số sân còn chơi: 34 × 1/2 = 17
assert.equal(quotaFor(db, S('B3')), 17)
// Nhóm T6 quota 23 cho 1 sân
assert.equal(quotaFor(db, S('B6')), 23)
// Sàn 6 quả: quota nhỏ vẫn không xuống dưới 6
const tiny = { ...S('B6'), groupId: 'G2', courts: S('B6').courts }
const dbTiny = { ...db, groups: db.groups.map((g) => (g.id === 'G2' ? { ...g, quota: 2 } : g)) }
assert.equal(quotaFor(dbTiny, tiny), 6, 'định mức không bao giờ dưới 6 quả')

/* ---------- giá cầu bình quân toàn kho ---------- */
// P1 29 quả giá 0 (không tính) · P2 120 quả 3.200.000 · P3 120 quả 3.300.000
// → (3.200.000 + 3.300.000) / 240 = 27.083,33…
const unit = shuttleUnit(db)
assert.ok(Math.abs(unit - 6500000 / 240) < 1e-9, 'giá bình quân tính trên các đợt có tiền')
assert.ok(unit > 27000 && unit < 27100)
assert.equal(shuttleUnit({ ...db, purchases: [] }), 26667, 'chưa mua đợt nào thì dùng fallback')
assert.equal(
  shuttleUnit({ ...db, purchases: [{ qty: 10, total: 0 }] }),
  26667,
  'đợt total = 0 không được kéo giá bình quân xuống'
)

/* ---------- kho ---------- */
const st = stock(db)
assert.equal(st.bought, 29 + 120 + 120)
assert.equal(st.left, st.bought - st.used)
assert.equal(
  st.used,
  db.sessions.filter((s) => s.status === 'closed').reduce((t, s) => t + s.shuttleUsed, 0),
  'chỉ buổi đã chốt mới trừ kho'
)

/* ---------- kiểm kho: tháng lấy từ NGÀY KIỂM, không phải tháng đang xem ---------- */
assert.equal(db.month, '2026-08', 'fixture đang xem tháng 8')
const ck8 = checkPreview(db, '2026-08-31', 40)
assert.equal(ck8.month, '2026-08')
assert.equal(ck8.systemLeft, stock(db).left)
assert.equal(ck8.diff, stock(db).left - 40)
assert.equal(ck8.n, estSessions(db, '2026-08').length, 'chia vào đúng số buổi ước lượng của tháng 8')
assert.ok(ck8.n > 0, 'tháng 8 phải còn buổi ước lượng, không thì test này vô nghĩa')
assert.equal(ck8.share, Math.round(ck8.diff / ck8.n))

// REGRESSION Issue 6: header vẫn ở tháng 8 nhưng kiểm ngày 05/09 → phải chia vào buổi tháng 9,
// không được mượn buổi tháng 8. Bug cũ lấy d0.month nên hai tháng sai cùng lúc.
const ck9 = checkPreview(db, '2026-09-05', 40)
assert.equal(ck9.month, '2026-09', 'tháng lấy từ ngày kiểm, không lấy tháng đang xem')
assert.equal(ck9.n, estSessions(db, '2026-09').length)
assert.equal(ck9.share, 0, 'không có buổi ước lượng thì không chia được')

// Bỏ trống ngày thì rơi về hôm nay, vẫn không đọc db.month
assert.equal(checkPreview(db, '', 40).month, db.today.slice(0, 7))
// Chưa gõ số đếm: coi như 0, không NaN
assert.ok(Number.isFinite(checkPreview(db, '2026-08-31', '').diff))

/* ---------- chia phần lệch kiểm kho: tổng phải khớp TUYỆT ĐỐI ---------- */

const est3 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const sum = (o) => Object.keys(o).reduce((x, k) => x + o[k], 0)
// 16 ÷ 3 không chia hết — phần dư dồn vào buổi cuối, tổng vẫn đúng 16.
assert.equal(sum(spreadDiff(est3, 16)), 16)
assert.equal(sum(spreadDiff(est3, -5)), -5, 'lệch âm cũng phải khớp')
assert.equal(sum(spreadDiff(est3, 0)), 0)
assert.equal(sum(spreadDiff([{ id: 'a' }], 7)), 7)
assert.deepEqual(spreadDiff([], 9), {}, 'không có buổi ước lượng thì không chia đi đâu cả')

/* ---------- nhắc kiểm kho ---------- */

const ck = (month) => ({ id: 'X' + month, date: month + '-28', month, counted: 0, systemLeft: 0, diff: 0, spread: 0 })
assert.equal(checkDue({ ...db, purchases: [], stockChecks: [] }), '', 'chưa mua cầu thì không có gì để đếm')
assert.equal(checkDue({ ...db, stockChecks: [] }), 'never', 'đã mua cầu mà chưa kiểm lần nào')
assert.equal(checkDue({ ...db, stockChecks: [ck('2026-08')] }), '', 'tháng này kiểm rồi thì im')
assert.equal(checkDue({ ...db, stockChecks: [ck('2026-01')] }), 'stale', 'quá lâu không kiểm')
const dbLow = {
  ...db,
  purchases: [{ id: 'P0', date: '2026-08-01', typeId: 'S1', tubes: 0, extra: 10, qty: 10, pricePerTube: 0, total: 300000, payer: '', note: '' }],
  stockChecks: [ck('2026-07')],
}
assert.ok(stock(dbLow).left < cfg.shuttle.checkLowStock, 'dựng đúng cảnh tồn kho thấp')
assert.equal(checkDue(dbLow), 'low')

/* ---------- tra lần kiểm kho của một tháng ---------- */
// Mỗi tháng đúng MỘT lần (uq_check_month). checkOf là chỗ duy nhất biết tháng đó đã kiểm chưa —
// dialog dùng nó để ẩn ô "còn lại trong tủ", action dùng nó để chặn kiểm lần hai.
assert.ok(checkOf(db, db.stockChecks[0].month), 'tháng đã kiểm phải tra ra bản ghi')
assert.equal(checkOf(db, '2030-01'), null, 'tháng chưa kiểm trả null, không undefined')
assert.equal(checkOf({ ...db, stockChecks: undefined }, '2026-08'), null, 'CLB chưa có bảng nào cũng không throw')

console.log('money/shuttle check: OK')
