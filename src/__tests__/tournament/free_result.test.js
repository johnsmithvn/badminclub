// D11: ghi kết quả TỰ DO về điểm — số set quyết định. Luật điểm chỉ để bảng ghi điểm tự chuyển set.
import test from 'node:test'
import assert from 'node:assert/strict'
import { freeSetWinner, inspectResult, offRule } from '#lib/tournament/scoring.js'
import { boardReducer, boardView, emptyBoard } from '#lib/tournament/scoreboard.js'

const R1x30 = { sets: 1, points: 30, winBy2: false, cap: 30 }
const R3x21 = { sets: 3, points: 21, winBy2: true, cap: 30 }

test('set: bên cao điểm hơn thắng; hoà = chưa phân định; ngoài 0..99 = gõ nhầm', () => {
  assert.equal(freeSetWinner(22, 20), 'A')
  assert.equal(freeSetWinner(3, 11), 'B')
  assert.equal(freeSetWinner(20, 20), null)
  assert.equal(freeSetWinner(-1, 5), 'invalid')
  assert.equal(freeSetWinner(100, 5), 'invalid')
  assert.equal(freeSetWinner(2.5, 1), 'invalid')
})

test('trận: đủ số set thắng; không thừa set; set hoà chặn', () => {
  assert.deepEqual(inspectResult([[22, 20]], R1x30), { error: null, winner: 'A', winsA: 1, winsB: 0 })
  assert.equal(inspectResult([[15, 21], [21, 15], [11, 9]], R3x21).winner, 'A')
  assert.equal(inspectResult([[21, 15], [21, 10], [21, 3]], R3x21).error, 'tournament.err.extraSets', 'thắng 2-0 rồi còn set thứ 3')
  assert.equal(inspectResult([[21, 15], [15, 21]], R3x21).error, 'tournament.err.matchNotFinished')
  assert.equal(inspectResult([[21, 21]], R1x30).error, 'tournament.err.tiedSet')
  assert.equal(inspectResult([], R1x30).error, 'tournament.err.emptySets')
  assert.equal(offRule([[21, 15], [15, 21], [11, 9]], R3x21), 1, 'chỉ set 11–9 lệch luật 21')
})

test('bảng ghi điểm: "Kết thúc set" chốt ở tỷ số hiện tại; hoà thì chưa chốt; chốt đủ set là xong trận', () => {
  let s = emptyBoard()
  for (let i = 0; i < 12; i++) s = boardReducer(s, { type: 'point', side: 'A' }, R1x30)
  for (let i = 0; i < 10; i++) s = boardReducer(s, { type: 'point', side: 'B' }, R1x30)
  assert.equal(boardView(s, R1x30).canEndSet, true)
  s = boardReducer(s, { type: 'endSet' }, R1x30)
  assert.deepEqual(s.sets, [[12, 10]])
  assert.equal(boardView(s, R1x30).winner, 'A', 'luật 1 set: chốt set là xong trận')

  let t = emptyBoard()
  t = boardReducer(t, { type: 'point', side: 'A' }, R1x30)
  t = boardReducer(t, { type: 'point', side: 'B' }, R1x30)
  assert.equal(boardView(t, R1x30).canEndSet, false)
  assert.deepEqual(boardReducer(t, { type: 'endSet' }, R1x30), t, 'hoà 1–1: không chốt được')
  const back = boardReducer(boardReducer(s, { type: 'undo' }, R1x30), { type: 'undo' }, R1x30)
  assert.equal(back.sets.length, 0, 'hoàn tác được cả thao tác kết thúc set')
})
