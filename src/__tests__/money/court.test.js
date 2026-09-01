// node --test — Tiền sân của một buổi: tổng · phần CLB gánh · sân bán · sân thuê thêm.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  rowCost,
  courtBase, courtCost, courtExtraCost, courtNet, playedCourts, sessionOf,
  soldTotal,
} from '#lib/money.js'

const db = seed()
const S = (id) => sessionOf(db, id)
/* ---------- tiền sân ---------- */
// B1: nhóm CN, 2 sân × 2 giờ × 120.000 = 480.000, không bán, không thuê thêm
assert.equal(courtCost(db, S('B1')), 480000)
assert.equal(courtNet(db, S('B1')), 480000)
assert.equal(courtBase(db, S('B1')), 480000)
assert.equal(courtExtraCost(db, S('B1')), 0)
assert.equal(playedCourts(S('B1')), 2)

// B3 bán 1 sân cho CLB khác: chi phí thực chỉ còn 1 sân, tiền bán ghi thu riêng
assert.equal(courtCost(db, S('B3')), 480000, 'courtCost vẫn là tổng mọi dòng sân')
assert.equal(courtNet(db, S('B3')), 240000, 'sân đã bán KHÔNG tính vào chi phí buổi')
assert.equal(soldTotal(S('B3')), 240000)
assert.equal(playedCourts(S('B3')), 1)

// B2: nhóm T6, 1 sân Yên Phong × 2 giờ × 130.000
assert.equal(courtCost(db, S('B2')), 260000)

/* ---------- tiền một dòng sân ---------- */
// Nền của mọi con số tiền sân: số giờ × giá giờ của đúng sân đó.
const r0 = S('B1').courts[0]
assert.equal(rowCost(db, r0), 2 * 120000, '18:00→20:00 × 120.000/giờ')
assert.equal(rowCost(db, { ...r0, from: '18:00', to: '19:30' }), 1.5 * 120000, 'nửa giờ tính đúng nửa')
assert.equal(rowCost(db, { ...r0, courtId: 'không-có' }), 0, 'sân không tồn tại thì 0, không NaN')

console.log('money/court check: OK')
