// Bàn Cờ vây · Vây sao (CoVayBoard): dựng được ở cả 3 cỡ bàn và hai ghế, mỗi quân trên bàn vẽ đúng một lần, nước ăn quân
// có quân bay đi (cvShot) đúng số quân bị ăn, hết ván thì có bảng điểm.
// Chạy: node src/__tests__/games/covayBoard.test.js

import assert from 'node:assert/strict'
import { html, load } from '../tournament/_render.js'

globalThis.window ||= {}
const { default: cv, SIZES } = await import('#lib/games/covay.js')
const { default: Board } = await load('#components/games/CoVayBoard.jsx')

const count = (out, re) => (out.match(re) || []).length

for (const size of SIZES) {
  const s0 = cv.setup({ options: { size }, seats: [0, 1] })
  for (const mySeat of [0, 1]) {
    const out = html(Board, { state: s0, mySeat, canMove: mySeat === s0.turn, onMove() {} })
    assert.ok(out.includes('<line'), size + ': thiếu lưới')
    assert.equal(count(out, /cvDrop/g), 0, size + ': bàn trống mà đã có quân rơi')
  }
}

// Ăn một quân: Trắng ở 1 bị Đen bao 0 / 2 / 10 (bàn 9 × 9), Đen đặt 10 là ăn.
let s = cv.setup({ options: { size: 9 }, seats: [0, 1] })
for (const [seat, i] of [[0, 0], [1, 1], [0, 2], [1, 40]]) s = cv.apply(s, seat, { i })
assert.equal(cv.validate(s, 0, { i: 10 }), null, 'nước mẫu phải hợp lệ')
s = cv.apply(s, 0, { i: 10 })
assert.deepEqual(s.last.captured, [1], 'luật phải ăn đúng quân ở 1')
const out = html(Board, { state: s, mySeat: 1, canMove: true, onMove() {} })
assert.equal(count(out, /cvShot/g), 1, 'ăn một quân → đúng một quân bay đi')
assert.ok(out.includes('Hút 1 quân'), 'thiếu chữ Hút')
assert.equal(count(out, /cvDrop/g), 1, 'chỉ quân vừa đặt được rơi xuống')

// Hết ván: hai bên bỏ lượt → bảng điểm.
let e = cv.apply(s, 1, { pass: true })
e = cv.apply(e, 0, { pass: true })
assert.ok(e.over && e.score, 'hai bên bỏ lượt phải hết ván và có điểm')
const end = html(Board, { state: e, mySeat: 0, canMove: false, onMove() {} })
assert.ok(end.includes('komi'), 'hết ván phải có bảng điểm')

console.log('CoVayBoard check: OK')
