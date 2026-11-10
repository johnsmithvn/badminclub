// Tranh sảnh của từng game phải dựng được. Sảnh Trò chơi vẽ GameArt cho MỌI game trong GAME_IDS, nên một tranh
// hỏng là cả màn sảnh sập (React #130) — không ai tạo được phòng nào, kể cả game không liên quan.
// Chạy: node src/__tests__/games/art.test.js

import assert from 'node:assert/strict'
import { html, load } from '../tournament/_render.js'
import { GAME_IDS } from '#lib/games/registry.js'
import { SYMS } from '#lib/games/baucua.js'

const { GameArt } = await load('#components/games/GameInfo.jsx')
const { BauCuaIcon } = await load('#components/games/BauCuaIcons.jsx')

for (const id of GAME_IDS) {
  let out
  assert.doesNotThrow(() => { out = html(GameArt, { id }) }, `tranh sảnh của "${id}" không dựng được — cả sảnh Trò chơi sẽ sập`)
  assert.ok(out.includes('<svg'), `"${id}" chưa có tranh sảnh (thiếu trong ART của GameInfo.jsx)`)
}

// Linh vật Bầu cua tra theo SỐ THỨ TỰ trong SYMS (0..5), không theo tên — bàn chơi truyền mặt xúc xắc là số.
SYMS.forEach((_, k) => assert.ok(html(BauCuaIcon, { sym: k }).includes('<svg'), 'thiếu linh vật Bầu cua thứ ' + k))

// Bàn Ô ăn quan lúc đứng yên không được gắn hiệu ứng lên sỏi: trước đây viên nào cũng mang gamePop nên mỗi nước
// mới cả bàn ~50 viên cùng nảy, người chơi không theo được sỏi nào vừa rơi. Chỉ viên vừa rơi mới được hiện dần.
{
  globalThis.window ||= {} // OAnQuanBoard hỏi window.matchMedia lúc dựng
  const { default: oq } = await import('#lib/games/oanquan.js')
  const { default: OAnQuanBoard } = await load('#components/games/OAnQuanBoard.jsx')
  const s = oq.apply(oq.setup(), 0, { cell: 1, dir: 1 })
  const out = html(OAnQuanBoard, { state: s, mySeat: 1, canMove: true, onMove() {} })
  assert.ok(!out.includes('gamePop'), 'bàn đứng yên mà sỏi vẫn mang gamePop — mỗi nước mới cả bàn sẽ nảy')
  assert.equal((out.match(/translate\(/g) || []).length, s.stones.reduce((a, n) => a + n, 0), 'mỗi viên sỏi trên bàn phải được vẽ đúng một lần')
}

console.log('games art check: OK')
