// D11: ghi kết quả TỰ DO về điểm — số set quyết định. Luật điểm chỉ để bảng ghi điểm tự chuyển set.
import test from 'node:test'
import assert from 'node:assert/strict'
import { freeSetWinner, inspectResult, offRule } from '#lib/tournament/scoring.js'

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

