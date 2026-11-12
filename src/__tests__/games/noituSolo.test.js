// node src/__tests__/games/noituSolo.test.js
// Nối từ đấu máy (lib/games/noituSolo.js). Sai ở đây là chặn nhầm từ người chơi gõ, tính sai điểm từ lạ, máy "bí" vì
// bị lừa bằng từ bịa, máy ra từ cụt ở mức Khó, hay từ điển tĩnh lệch khỏi migration 0100.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BONUS, botTurn, dictOf, endMine, judge, needOf, parseWords, playMine, start } from '#lib/games/noituSolo.js'

const dict = dictOf(parseWords(`# chú thích bỏ qua
học sinh
sinh viên
sinh nhật
sinh động
viên chức
nhật ký
động vật
vật lý
ký túc
túc cầu
cầu lông`))
const fixed = (xs) => { let k = 0; return () => xs[k++ % xs.length] }

// Từ điển tĩnh public/words/vi.txt chép đủ từ 0100.
{
  const file = parseWords(readFileSync('public/words/vi.txt', 'utf8'))
  const sql = readFileSync('supabase/migrations/0100_games_words_vi.sql', 'utf8')
  const fromSql = new Set([...sql.slice(sql.indexOf('unnest(ARRAY[')).matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]))
  assert.equal(file.length, fromSql.size, 'vi.txt phải đủ số từ của 0100')
  assert.ok(file.includes('học sinh') && file.every((w) => fromSql.has(w)))
}

// Kiểm từ: không chặn cứng — sai luật trả lỗi để gõ lại, từ lạ vẫn nhận.
{
  let s = { ...start(dict, () => 0), chain: [{ word: 'học sinh', seat: 1 }] }
  assert.equal(needOf(s), 'sinh')
  assert.deepEqual(judge(s, dict, 'Sinh  Viên'), { word: 'sinh viên', kind: 'dict', pts: 1 }, 'chuẩn hoá chữ hoa / dấu cách')
  assert.deepEqual(judge(s, dict, 'viên'), { word: 'sinh viên', kind: 'dict', pts: 1 }, 'gõ một âm tiết thì tự ghép âm phải nối')
  assert.deepEqual(judge(s, dict, 'sinh cầu'), { word: 'sinh cầu', kind: 'strange', pts: 0.5 }, 'từ lạ: nửa điểm')
  assert.deepEqual(judge(s, dict, 'sinh xyzt'), { word: 'sinh xyzt', kind: 'unknown', pts: 0 }, 'âm tiết lạ: nhận, 0 điểm')
  assert.deepEqual(judge(s, dict, 'viên chức'), { err: 'games.err.noLink' })
  assert.deepEqual(judge(s, dict, 'sinh'), { word: 'sinh sinh', kind: 'strange', pts: 0.5 }, 'gõ đúng âm nối = từ láy, coi như từ lạ')
  assert.deepEqual(judge(s, dict, ''), { err: 'games.err.badWord' })
  assert.deepEqual(judge(s, dict, 'sinh viên chức'), { err: 'games.err.badWord' }, 'quá 2 âm tiết')
  s = playMine(s, judge(s, dict, 'sinh viên'))
  assert.deepEqual([s.score, s.mine, s.turn], [1, 1, 1])
  s = { ...s, turn: 0, chain: [...s.chain, { word: 'viên sinh', seat: 1 }] }
  assert.deepEqual(judge(s, dict, 'sinh viên'), { err: 'games.err.usedWord' }, 'từ đã dùng trong ván')
}

// Máy: hết từ sau từ có trong từ điển = máy bí (bạn thắng + thưởng); sau từ lạ thì ra từ mới tự do, không thua.
{
  let s = { ...start(dict, () => 0), chain: [{ word: 'vật lý', seat: 1 }] }
  s = playMine(s, judge(s, dict, 'lý tưởng')) // từ lạ? "tưởng" không có trong từ điển nhỏ → âm tiết lạ
  assert.equal(s.chain.at(-1).kind, 'unknown')
  const after = botTurn(s, dict, 'hard', fixed([0.5]))
  assert.equal(after.over, null, 'từ bịa không làm máy thua')
  assert.equal(after.chain.at(-1).fresh, true)
  assert.equal(after.turn, 0)

  let t = { ...start(dict, () => 0), chain: [{ word: 'túc cầu', seat: 1 }] }
  t = playMine(t, judge(t, dict, 'cầu lông'))
  const won = botTurn(t, dict, 'hard', fixed([0.5]))
  assert.deepEqual(won.over, { why: 'botStuck', win: true })
  assert.equal(won.score, 1 + BONUS)
}

// Khó: chọn từ ít đường nối nhất nhưng không ra từ cụt hẳn. "sinh" → viên (1: chức) · nhật (1: ký) · động (1: vật).
{
  const s = playMine({ ...start(dict, () => 0), chain: [{ word: 'nhật ký', seat: 1 }, { word: 'ký túc', seat: 0 }, { word: 'túc cầu', seat: 1 }] },
    { word: 'học sinh', kind: 'dict', pts: 1 })
  for (const r of [0.1, 0.5, 0.9]) {
    const w = botTurn(s, dict, 'hard', fixed([r])).chain.at(-1).word
    assert.ok(['sinh viên', 'sinh động'].includes(w), 'khó ra ' + w + ' (sinh nhật → ký đã dùng → cụt)')
  }
  // Dễ / Vừa có lúc tự chịu.
  assert.equal(botTurn(s, dict, 'easy', fixed([0])).over?.why, 'botStuck')
  assert.equal(botTurn(s, dict, 'hard', fixed([0])).over, null, 'Khó không tự chịu')
}

// Bạn chịu / hết giờ: giữ điểm.
{
  const s = endMine({ ...start(dict, () => 0), score: 4.5 }, 'timeout')
  assert.deepEqual([s.over, s.score, s.turn], [{ why: 'timeout', win: false }, 4.5, null])
}

console.log('noituSolo check: OK')
