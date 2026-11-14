// Bàn Cờ gánh · Ruộng làng (CoGanhBoard): dựng được ở cả hai ghế, đủ 16 người lúc đầu ván, và nước gánh được tách đúng
// thành "gánh" (đòn gánh + chữ Gánh) chứ không lẫn sang "vây" — UI tự tách từ last.flipped, luật không ghi riêng.
// Chạy: node src/__tests__/games/coganhBoard.test.js

import assert from 'node:assert/strict'
import { html, load } from '../tournament/_render.js'

globalThis.window ||= {}
const { default: cg } = await import('#lib/games/coganh.js')
const { default: Board } = await load('#components/games/CoGanhBoard.jsx')
const { VILLAGERS } = await import('#components/games/characters.js')

const s0 = cg.setup({ options: cg.defaultOptions, seats: [0, 1] })
for (const mySeat of [0, 1]) {
  const out = html(Board, { state: s0, mySeat, canMove: mySeat === s0.turn, onMove() {} })
  const people = VILLAGERS.reduce((n, src) => n + out.split(src).length - 1, 0)
  // 16 người trên bàn + 2 ảnh đại diện trên hai thanh người chơi.
  assert.equal(people, 18, 'ghế ' + mySeat + ': phải vẽ đủ 16 người + 2 ảnh đại diện')
  assert.ok(!out.includes('cgPole'), 'chưa ai đi mà đã có đòn gánh')
}

// Dựng một thế gánh: ghế 0 đi vào điểm 12, hai bên (11, 13) là người ghế 1 thẳng hàng.
const board = Array(25).fill(null)
board[7] = 0; board[11] = 1; board[13] = 1; board[0] = 1; board[24] = 0
const s = { ...s0, board, turn: 0, open: null, last: null }
assert.equal(cg.validate(s, 0, { from: 7, to: 12 }), null, 'nước mẫu phải hợp lệ')
const s1 = cg.apply(s, 0, { from: 7, to: 12 })
assert.deepEqual([...s1.last.flipped].sort((a, b) => a - b), [11, 13], 'luật phải gánh đúng 11 và 13')
const out = html(Board, { state: s1, mySeat: 1, canMove: true, onMove() {} })
assert.equal((out.match(/cgPole/g) || []).length, 1, 'gánh một đường → đúng một đòn gánh')
assert.ok(out.includes('Gánh'), 'thiếu chữ Gánh')
assert.ok(!out.includes('Vây ·'), 'nước gánh bị nhận nhầm là vây')
assert.ok(out.includes('cgHop'), 'người vừa đi phải nhảy tới')

console.log('CoGanhBoard check: OK')
