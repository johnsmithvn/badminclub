// node --test — Cảnh báo sai im lặng ở Trang chủ (TASKS Phase 9 · P7).
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  homeAlerts,
} from '#lib/money.js'

const db = seed()
/* ---------- cảnh báo sai im lặng: homeAlerts (P7 · B1 · B5 · B7) ---------- */

const keysOf = (x) => homeAlerts(x).map((w) => w.key)
const warnOf = (x, k) => homeAlerts(x).find((w) => w.key === k)

// Fixture: hôm nay 19/08, hoá đơn sân tháng 8 đã nhập, B6–B9 đều CHƯA tới ngày → sạch.
assert.deepEqual(keysOf(db), [], 'dữ liệu đúng thì không cảnh báo gì')

// B1 · trả tiền sân theo tháng, tháng đã có buổi chốt mà không có hoá đơn nào.
const noBill = { ...db, courtBills: [] }
assert.deepEqual(keysOf(noBill), ['noBill'])
assert.equal(warnOf(noBill, 'noBill').n, 5, 'B1–B5 đã chốt')
assert.equal(warnOf(noBill, 'noBill').tone, 'danger')

// Trả theo BUỔI thì tiền sân vào sổ ngay lúc chốt buổi — nhắc hoá đơn tháng là nhắc sai.
const bySession = { ...noBill, club: { ...db.club, courtPayMode: 'session' } }
assert.deepEqual(keysOf(bySession), [])

// Chưa chốt buổi nào trong tháng thì chưa có gì để đối chiếu với hoá đơn.
const noClosed = { ...noBill, sessions: db.sessions.map((s) => ({ ...s, status: 'draft' })) }
assert.equal(keysOf(noClosed).indexOf('noBill'), -1)

// B5 + B7 · sang tháng 9 mà vẫn để nguyên: B6/B7 `open` quá hạn, B8/B9 `draft` quá ngày.
// Tháng đang XEM vẫn là 08 — hai thứ này không phụ thuộc tháng ở header, đúng như thiết kế.
const late = { ...db, today: '2026-09-01' }
assert.deepEqual(keysOf(late), ['staleDraft', 'openOverdue'])
assert.deepEqual(warnOf(late, 'staleDraft').ids, ['B8', 'B9'])
assert.deepEqual(warnOf(late, 'openOverdue').ids, ['B6', 'B7'])
assert.equal(warnOf(late, 'staleDraft').n, 2)

// Buổi huỷ hoặc đã chốt thì không nhắc nữa — nhắc tiếp là dạy người dùng bỏ qua cảnh báo.
const fixed = {
  ...late,
  sessions: db.sessions.map((s) => (
    s.id === 'B8' || s.id === 'B9' ? { ...s, status: 'cancelled' } : { ...s, status: 'closed' }
  )),
}
assert.deepEqual(keysOf(fixed), [])

console.log('money/alerts check: OK')
