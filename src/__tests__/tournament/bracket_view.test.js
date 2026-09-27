import test from 'node:test'
import assert from 'node:assert/strict'
import { buildKnockout } from '#lib/tournament/bracket.js'
import { applyCommit } from '#lib/tournament/advance.js'
import { CHAMP_KEY, activeRoundKey, flightsOf, koRounds, progressOf, queueOf, sideScores, slotKey } from '#lib/tournament/bracketView.js'
import { boardReducer, boardView, emptyBoard, parseDraft } from '#lib/tournament/scoreboard.js'

const R30 = { sets: 1, points: 30, winBy2: false, cap: 30 }
const R21 = { sets: 1, points: 21, winBy2: true, cap: 30 }
const R3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }
let n = 0
const bracket = (teams = 5) => buildKnockout({
  stage: { id: 's1', matchRule: R30, ruleOverrides: { final: R3x15, third: R3x15 }, config: { thirdPlace: true } },
  entrants: Array.from({ length: teams }, (_, i) => ({ id: 'T' + (i + 1), seed: i + 1 })),
  newId: () => 'm' + ++n,
})
const commit = (ms, m, sets = [[30, 1]], winner = 'A') => {
  const r = applyCommit(ms, { matchId: m.id, sets, winner })
  assert.equal(r.error, null, r.error)
  return r.matches
}

test('dựng nhánh để vẽ: vòng theo thứ tự, 3-4 tách riêng, có chung kết', () => {
  const v = koRounds(bracket(8), 's1')
  assert.deepEqual(v.rounds.map((r) => [r.kind, r.matches.length]), [['qf', 4], ['sf', 2], ['final', 1]])
  assert.equal(v.third.roundKind, 'third')
  assert.equal(v.final.roundKind, 'final')
  assert.deepEqual(v.rounds[0].matches.map((m) => m.slot), [0, 1, 2, 3])
  assert.deepEqual(koRounds(bracket(8), 'other').rounds, [], 'giai đoạn khác không lẫn vào')
})

test('tiến độ không đếm trận bye; hàng chờ: đang đánh trước, rồi thứ tự BTC xếp, rồi vòng', () => {
  let ms = bracket(5)
  assert.deepEqual(progressOf(ms), { done: 0, total: 5 }, '5 đội: 1 TK + 2 BK + CK + 3-4')
  const [sf2] = ms.filter((m) => m.roundKind === 'sf' && m.status === 'ready')
  const qf = ms.find((m) => m.roundKind === 'qf' && m.status === 'ready')
  assert.deepEqual(queueOf(ms).map((m) => m.id), [qf.id, sf2.id], 'vòng trước lên trước')
  ms = ms.map((m) => (m.id === sf2.id ? { ...m, seqNo: 1 } : m))
  assert.deepEqual(queueOf(ms).map((m) => m.id), [sf2.id, qf.id], 'BTC xếp tay thì theo BTC')
  ms = ms.map((m) => (m.id === qf.id ? { ...m, status: 'live' } : m))
  assert.equal(queueOf(ms)[0].id, qf.id, 'trận đang đánh luôn đứng đầu')
  ms = commit(ms, ms.find((m) => m.id === qf.id))
  assert.deepEqual(progressOf(ms), { done: 1, total: 5 })
})

test('hiệu ứng: đội thắng bay lên ô trận sau; thua bán kết bay xuống 3-4; vô địch bay vào ô vàng', () => {
  let ms = bracket(4)
  const [sf1, sf2] = ms.filter((m) => m.roundKind === 'sf')
  const final = ms.find((m) => m.roundKind === 'final')
  const third = ms.find((m) => m.roundKind === 'third')
  let next = commit(ms, sf1, [[28, 30]], 'B')
  assert.deepEqual(flightsOf(ms, next), [
    { from: slotKey(sf1.id, 'B'), to: slotKey(final.id, 'A') },
    { from: slotKey(sf1.id, 'A'), to: slotKey(third.id, 'A') },
  ])
  assert.deepEqual(flightsOf(next, next), [], 'không có gì đổi thì không bay — poll lặp lại không chớp màn')
  ms = commit(next, sf2)
  next = commit(ms, ms.find((m) => m.id === final.id), [[15, 3], [15, 4]])
  assert.deepEqual(flightsOf(ms, next), [{ from: slotKey(final.id, 'A'), to: CHAMP_KEY, gold: true }])
  assert.deepEqual(flightsOf([], next), [], 'lần nạp đầu (chưa thấy trận nào) không bay')
})

test('điểm từng bên để hiện trên thẻ trận', () => {
  assert.deepEqual(sideScores([[21, 18], [15, 21]], 'A'), [21, 15])
  assert.deepEqual(sideScores([[21, 18], [15, 21]], 'B'), [18, 21])
  assert.deepEqual(sideScores(undefined, 'A'), [])
})

test('bảng ghi điểm: cộng quả, hết set tự chốt và đổi sân, xong trận thì khoá; hoàn tác lùi đúng một quả', () => {
  const play = (s, side, k, rule) => { for (let i = 0; i < k; i++) s = boardReducer(s, { type: 'point', side }, rule); return s }
  let s = play(emptyBoard(), 'A', 14, R3x15)
  s = play(s, 'B', 14, R3x15)
  assert.deepEqual(boardView(s, R3x15).flags.setPoint, { A: true, B: true }, '14-14 chạm 15: ai ăn quả tới là thắng set')
  s = play(s, 'A', 1, R3x15)
  assert.deepEqual(s.sets, [[15, 14]])
  assert.deepEqual(s.cur, [0, 0])
  assert.equal(s.swapped, true, 'quy chế: thắng sec, đổi sân')
  assert.equal(boardView(s, R3x15).justSwitched, true)
  assert.equal(boardView(s, R3x15).setNo, 2)

  const undone = boardReducer(s, { type: 'undo' }, R3x15)
  assert.deepEqual([undone.sets, undone.cur, undone.swapped], [[], [15 - 1, 14], false], 'hoàn tác quả chốt set → về 14-14 set 1')

  s = play(s, 'A', 15, R3x15)
  assert.equal(boardView(s, R3x15).winner, 'A')
  assert.equal(boardReducer(s, { type: 'point', side: 'B' }, R3x15), s, 'xong trận rồi thì không ghi thêm quả nào')
  assert.equal(boardView(s, R3x15).flags, null)
})

test('bảng ghi điểm: luật 21 cách 2 — 29-29 ai được 30 thắng; trừ quả; không trừ dưới 0', () => {
  let s = { ...emptyBoard(), cur: [29, 29] }
  s = boardReducer(s, { type: 'point', side: 'B' }, R21)
  assert.deepEqual(s.sets, [[29, 30]])
  assert.equal(boardView(s, R21).winner, 'B')
  const m = boardReducer({ ...emptyBoard(), cur: [3, 0] }, { type: 'minus', side: 'A' }, R21)
  assert.deepEqual(m.cur, [2, 0])
  const z = emptyBoard()
  assert.equal(boardReducer(z, { type: 'minus', side: 'B' }, R21), z)
  assert.equal(boardReducer(z, { type: 'undo' }, R21), z)
})

test('activeRoundKey: nhãn vòng/giai đoạn đang diễn ra cho thẻ nội dung', () => {
  assert.equal(activeRoundKey({ stages: [], matches: [] }, 'e1'), null, 'chưa có giai đoạn nào thì không có nhãn')

  const rr = { stages: [{ id: 's1', eventId: 'e1', seq: 1, type: 'round_robin', status: 'running' }], matches: [] }
  assert.equal(activeRoundKey(rr, 'e1'), 'group')

  const ms8 = bracket(8)
  const ko = { stages: [{ id: 's1', eventId: 'e1', seq: 1, type: 'knockout', status: 'running' }], matches: ms8 }
  assert.equal(activeRoundKey(ko, 'e1'), 'qf', 'chưa đánh trận nào → vòng đầu tiên')

  const qfDone = ms8.filter((m) => m.roundKind === 'qf').reduce((acc, m) => commit(acc, m), ms8)
  assert.equal(activeRoundKey({ ...ko, matches: qfDone }, 'e1'), 'sf', 'xong hết tứ kết → sang bán kết')

  const sfDone = ms8.filter((m) => m.roundKind === 'sf').reduce((acc, m) => commit(acc, acc.find((x) => x.id === m.id)), qfDone)
  const final = sfDone.find((m) => m.roundKind === 'final')
  const allDone = commit(sfDone, final, [[15, 3], [15, 4]], 'A')
  assert.equal(activeRoundKey({ ...ko, matches: allDone }, 'e1'), 'final', 'xong hết → giữ vòng cuối')

  const other = { stages: [{ id: 's1', eventId: 'e1', seq: 1, type: 'round_robin', status: 'pending' }], matches: [] }
  assert.equal(activeRoundKey(other, 'e1'), null, 'chưa chạy giai đoạn nào (còn pending) thì không có nhãn')
})

test('bản nháp đọc từ máy: hỏng thì bắt đầu lại, không làm sập bảng điểm', () => {
  assert.deepEqual(parseDraft('{"sets":[[15,10]],"cur":[3,4],"swapped":true}'), { sets: [[15, 10]], cur: [3, 4], swapped: true, history: [] })
  assert.deepEqual(parseDraft('rác'), emptyBoard())
  assert.deepEqual(parseDraft('{"cur":[1,"x"],"sets":[]}'), emptyBoard())
  assert.deepEqual(parseDraft(null), emptyBoard())
})
