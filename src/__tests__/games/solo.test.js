// node src/__tests__/games/solo.test.js
// Hai game chơi một mình (lib/games/timso.js, keobuabao.js). Sai ở đây là ăn nhầm số, tính sai người thắng, hay máy Kéo
// búa bao ra tay sai luật.

import assert from 'node:assert/strict'
import { claim, layout, N, outcome, start as tsStart, tap } from '#lib/games/timso.js'
import { BEATS, botPick, judge, needOf, PICKS, play, start as kbStart } from '#lib/games/keobuabao.js'

const fixed = (xs) => { let k = 0; return () => xs[k++ % xs.length] }

// Tìm số: 40 số khác nhau, nằm trong bàn; chạm đúng thứ tự mới ăn; máy chỉ đua ở chế độ race.
{
  const nums = layout()
  assert.equal(nums.length, N)
  assert.deepEqual(nums.map((o) => o.n), Array.from({ length: N }, (_, i) => i + 1))
  assert.ok(nums.every((o) => o.x > 0 && o.x < 100 && o.y > 0 && o.y < 100))
  const cells = new Set(nums.map((o) => Math.floor(o.x / 12.5) + ',' + Math.floor(o.y / (100 / 6))))
  assert.equal(cells.size, N, 'mỗi số một ô lưới, không chồng nhau')

  let s = tsStart('race')
  assert.equal(tap(s, 2).wrong, true, 'chạm số chưa tới lượt là nhầm')
  s = tap(s, 1).s
  assert.deepEqual([s.next, s.me, s.owner[1]], [2, 1, 'me'])
  assert.equal(tap(s, 1).s, s, 'số đã có chủ thì bỏ qua')
  s = claim(s, 2, 'bot')
  assert.deepEqual([s.next, s.bot], [3, 1])
  assert.equal(claim(s, 5, 'bot'), s, 'máy cũng chỉ ăn đúng số đang cần')
  for (let n = 3; n <= N; n++) s = claim(s, n, n % 2 || n === N ? 'me' : 'bot')
  assert.equal(s.over, true)
  assert.equal(outcome(s), 'win', 'bạn 21 số, máy 19 số')

  const solo = tsStart('solo')
  assert.equal(claim(solo, 1, 'bot'), solo, 'chơi một mình thì máy không ăn')
  let t = solo
  for (let n = 1; n <= N; n++) t = tap(t, n).s
  assert.deepEqual([t.over, outcome(t), t.me], [true, 'done', N])
}

// Kéo búa bao: luật thắng thua, thể thức chạm 2 / chạm 3, hoà không tính, máy luôn ra tay hợp lệ.
{
  assert.equal(judge('rock', 'sc'), 'win')
  assert.equal(judge('sc', 'paper'), 'win')
  assert.equal(judge('paper', 'rock'), 'win')
  assert.equal(judge('rock', 'paper'), 'lose')
  assert.equal(judge('sc', 'sc'), 'draw')
  assert.deepEqual([needOf(3), needOf(5)], [2, 3])

  let s = kbStart(3)
  s = play(s, 'rock', 'rock')
  assert.deepEqual([s.me, s.bot, s.over], [0, 0, false], 'hoà không tính ván')
  s = play(play(s, 'rock', 'sc'), 'paper', 'rock')
  assert.deepEqual([s.me, s.over], [2, true], 'chạm 2 là thắng trận')
  assert.equal(play(s, 'rock', 'sc'), s, 'xong trận thì thôi')

  let f = kbStart(5)
  for (const [a, b] of [['rock', 'paper'], ['sc', 'rock'], ['rock', 'sc'], ['paper', 'sc']]) f = play(f, a, b)
  assert.deepEqual([f.me, f.bot, f.over], [1, 3, true], 'chạm 3: máy đủ 3 ván trước')

  const h = play(kbStart(3), 'rock', 'rock')
  assert.equal(botPick(h, fixed([0])), 'paper', 'khắc tay bạn vừa ra (búa → bao)')
  assert.equal(BEATS[botPick(h, fixed([0]))], 'rock')
  for (let i = 0; i < 50; i++) assert.ok(PICKS.includes(botPick(h)))
}

console.log('solo games check: OK')
