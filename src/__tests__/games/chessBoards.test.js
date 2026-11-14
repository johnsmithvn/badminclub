// Bàn Cờ vua / Cờ tướng / Cờ úp với skin mặc định "Sinh động" (quân nhân vật — characters.js): dựng được ở hai ghế, đủ
// quân, phong cấp có nhãn Thăng cấp, chiếu hết có lồng úp vua (và màn kết thúc hiện trễ), Tốt qua sông có nhãn, quân úp
// của Cờ úp vẫn vẽ quân tròn. Cận cảnh (CutScene) mặc định tắt nên không render ở đây.
// Chạy: node src/__tests__/games/chessBoards.test.js

import assert from 'node:assert/strict'
import { html, load } from '../tournament/_render.js'

globalThis.window ||= {}
const { default: cv } = await import('#lib/games/covua.js')
const { default: ct } = await import('#lib/games/cotuong.js')
const { default: cu } = await import('#lib/games/coup.js')
const { default: Vua } = await load('#components/games/CoVuaBoard.jsx')
const { default: Tuong } = await load('#components/games/CoTuongBoard.jsx')
const { default: Up } = await load('#components/games/CoUpBoard.jsx')
const { CHESS_ART, XIANGQI_ART } = await import('#components/games/characters.js')

const imgs = (out, art) => art.flatMap(Object.values).reduce((n, src) => n + out.split(src).length - 1, 0)
const play = (g, s, moves) => moves.reduce((st, [from, to, promo]) => {
  const m = { from, to, ...(promo ? { promo } : {}) }
  assert.equal(g.validate(st, st.turn, m), null, `nước ${from}→${to} phải hợp lệ`)
  return g.apply(st, st.turn, m)
}, s)

// Cờ vua: 32 quân + 2 ảnh đại diện (vua) trên hai thanh.
const v0 = cv.setup({ options: cv.defaultOptions, seats: [0, 1] })
for (const mySeat of [0, 1]) {
  const out = html(Vua, { state: v0, mySeat, canMove: mySeat === 0, onMove() {} })
  assert.equal(imgs(out, CHESS_ART), 34, 'ghế ' + mySeat + ': phải vẽ đủ 32 quân nhân vật + 2 ảnh đại diện')
}
// Chiếu hết nhanh (f3 e5 g4 Qh4#) → lồng úp vua, màn kết thúc chờ lồng diễn xong.
const mate = play(cv, v0, [[53, 45], [12, 28], [54, 38], [3, 39]])
assert.equal(mate.reason, 'mate', 'thế mẫu phải là chiếu hết')
const mOut = html(Vua, { state: mate, mySeat: 0, canMove: false, onMove() {} })
assert.ok(mOut.includes('mtCage') && mOut.includes('Hậu phong ấn Vua'), 'chiếu hết phải có lồng + tên đòn')
assert.ok(mOut.includes('chOverIn'), 'màn kết thúc phải hiện trễ sau lồng')

// Phong cấp: dựng tay thế Tốt trắng ở a7 (8) lên a8 (0), vua hai bên xa nhau.
const board = Array(64).fill(null)
board[8] = 'P'; board[60] = 'K'; board[7] = 'k'
const pv = { ...v0, board, castling: '', ep: null, turn: 0 }
const promoted = play(cv, pv, [[8, 0, 'q']])
const pOut = html(Vua, { state: promoted, mySeat: 1, canMove: true, onMove() {} })
assert.ok(pOut.includes('Hồi sinh'), 'phong Hậu khi Hậu đã mất → nhãn Hồi sinh')

// Cờ tướng: 32 quân + 2 ảnh đại diện; Tốt đỏ qua sông có nhãn.
const t0 = ct.setup({ options: ct.defaultOptions, seats: [0, 1] })
for (const mySeat of [0, 1]) {
  const out = html(Tuong, { state: t0, mySeat, canMove: mySeat === 0, onMove() {} })
  assert.equal(imgs(out, XIANGQI_ART), 34, 'ghế ' + mySeat + ': phải vẽ đủ 32 quân nhân vật + 2 ảnh đại diện')
}
const crossed = play(ct, t0, [[54, 45], [29, 38], [45, 36]])
const cOut = html(Tuong, { state: crossed, mySeat: 1, canMove: true, onMove() {} })
assert.ok(cOut.includes('Tốt lội sông'), 'Tốt qua sông phải có nhãn')
assert.ok((cOut.match(/chBurst/g) || []).length >= 12, 'Tốt qua sông phải có nước bắn')

// Cờ úp: quân úp không có ảnh → vẫn quân tròn (chỉ tướng lộ mặt + 2 ảnh đại diện là ảnh).
const u0 = cu.setup({ options: cu.defaultOptions, seats: [0, 1] })
const uOut = html(Up, { state: u0, mySeat: 0, canMove: true, onMove() {} })
assert.equal(imgs(uOut, XIANGQI_ART), 4, 'Cờ úp đầu ván: 2 tướng + 2 ảnh đại diện')

// Điện thoại (dock): RoomChat chỉ còn thanh nhắn + nút Phòng + dòng tin mới nhất, không có khung tin.
const { default: RoomChat } = await load('#components/games/RoomChat.jsx')
const g = { me: 'a', chat: [{ memberId: 'b', text: 'Chào', at: 1 }, { memberId: 'a', text: ':stk:gg:', at: 2 }], say() {} }
const dock = html(RoomChat, { g, nameOf: () => 'Lan', dock: true, onRoom() {} })
assert.ok(dock.includes('Phòng') && dock.includes('Bạn: đã thả biểu cảm'), 'dock phải có nút Phòng + dòng tin mới nhất')
assert.ok(!dock.includes('Chào'), 'dock không hiện khung tin')

console.log('Chess boards check: OK')
