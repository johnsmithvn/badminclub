import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSwissStart, pairNextRound, swissProgress, swissRounds, swissStandings } from '#lib/tournament/swiss.js'
import { applyCommit, canUndo } from '#lib/tournament/advance.js'

const RULE = { sets: 1, points: 21, winBy2: false, cap: 21 }
const stage = { id: 'sw', type: 'swiss', matchRule: RULE, ruleOverrides: {}, config: {} }
const entrants = (n) => Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, seed: i + 1 }))
let k = 0
const newId = () => `m${++k}`
const key = (a, b) => [a, b].sort().join('|')

// Đánh hết các trận `ready`: đội mạnh hơn (số nhỏ hơn) thắng, trừ khi `upset(m)`.
function play(ms, upset = () => false) {
  let out = ms
  for (let m = out.find((x) => x.status === 'ready'); m; m = out.find((x) => x.status === 'ready')) {
    const strongA = Number(m.teamAId.slice(1)) < Number(m.teamBId.slice(1))
    const winner = strongA !== upset(m) ? 'A' : 'B'
    const res = applyCommit(out, { matchId: m.id, sets: [winner === 'A' ? [21, 12] : [12, 21]], winner })
    assert.equal(res.error, null)
    out = res.matches
  }
  return out
}

// Chạy trọn N vòng; trả trận + nhóm + các vòng có phải cho gặp lại không.
function run(n, rounds, upset) {
  const { group, matches } = buildSwissStart({ stage, entrants: entrants(n), newId })
  let ms = play(matches, upset)
  const rematches = []
  for (let r = 1; r < rounds; r++) {
    const next = pairNextRound({ stage, group, matches: ms, newId })
    rematches.push(next.rematch)
    ms = play([...ms, ...next.matches], upset)
  }
  return { group, ms, rematches }
}

test('số vòng mặc định: ⌈log₂ n⌉, tối thiểu 3, không quá số vòng ghép được mà không gặp lại', () => {
  assert.deepEqual([2, 3, 4, 5, 8, 9, 16, 17].map(swissRounds), [1, 3, 3, 3, 3, 4, 4, 5])
})

test('vòng 1: nửa trên gặp nửa dưới theo hạt giống; lẻ thì hạt giống cuối được miễn', () => {
  const eight = buildSwissStart({ stage, entrants: entrants(8), newId })
  assert.deepEqual(eight.matches.map((m) => [m.teamAId, m.teamBId]), [['T1', 'T5'], ['T2', 'T6'], ['T3', 'T7'], ['T4', 'T8']])
  assert.equal(eight.group.teams.length, 8)
  const five = buildSwissStart({ stage, entrants: entrants(5), newId })
  assert.deepEqual(five.matches.map((m) => [m.teamAId, m.teamBId, m.status]),
    [['T1', 'T3', 'ready'], ['T2', 'T4', 'ready'], ['T5', null, 'bye']])
  assert.equal(five.matches[2].winner, 'A', 'bye = thắng sẵn')
})

test('8 đội · 3 vòng: không ai gặp lại, mỗi vòng ai cũng đánh đúng 1 trận, người thắng hết đứng đầu', () => {
  const { group, ms, rematches } = run(8, 3)
  assert.deepEqual(rematches, [false, false])
  const pairs = ms.map((m) => key(m.teamAId, m.teamBId))
  assert.equal(new Set(pairs).size, pairs.length, 'có cặp gặp lại')
  for (let r = 0; r < 3; r++) {
    const teams = ms.filter((m) => m.round === r).flatMap((m) => [m.teamAId, m.teamBId])
    assert.equal(new Set(teams).size, 8)
  }
  const table = swissStandings(group, ms)
  assert.equal(table.rows[0].teamId, 'T1')
  assert.equal(table.rows[0].won, 3)
  assert.equal(table.isFinished, true)
  assert.deepEqual(swissProgress(group, ms), { played: 3, lastDone: true })
})

test('vòng 2 ghép cùng điểm: đội thắng vòng 1 gặp đội thắng', () => {
  const { group, matches } = buildSwissStart({ stage, entrants: entrants(8), newId })
  const ms = play(matches)
  const next = pairNextRound({ stage, group, matches: ms, newId }).matches
  const winners = new Set(['T1', 'T2', 'T3', 'T4'])
  next.forEach((m) => assert.equal(winners.has(m.teamAId), winners.has(m.teamBId), `${m.teamAId}-${m.teamBId} lệch điểm`))
})

test('lẻ đội: mỗi vòng đúng 1 bye, không ai được miễn 2 lần khi còn người chưa được miễn; bye tính 1 thắng', () => {
  const { group, ms } = run(5, 5)
  const byeTeams = ms.filter((m) => m.status === 'bye').map((m) => m.teamAId)
  assert.equal(byeTeams.length, 5)
  assert.equal(new Set(byeTeams).size, 5, 'có đội được miễn 2 lần')
  const row = swissStandings(group, ms).rows.find((r) => r.teamId === 'T1')
  assert.equal(row.byes, 1)
  assert.equal(row.won, row.wins + 1)
})

test('hết cặp chưa gặp → vẫn ghép được nhưng báo gặp lại', () => {
  const { rematches } = run(4, 4)
  assert.deepEqual(rematches, [false, false, true])
})

test('Buchholz tách đội cùng điểm: thắng đối thủ mạnh hơn xếp trên', () => {
  // 4 đội, 2 vòng. T1 thắng T3, thua T2; T4 thắng T2... dựng tay để T1 và T4 cùng 1 thắng.
  const g = { id: 'g', teams: ['T1', 'T2', 'T3', 'T4'].map((teamId) => ({ teamId })) }
  const m = (id, round, a, b, winner) => ({ id, groupId: 'g', stageId: 'sw', round, slot: 0, teamAId: a, teamBId: b, status: 'done', winner, sets: [winner === 'A' ? [21, 10] : [10, 21]], rule: RULE })
  const ms = [m('a', 0, 'T1', 'T3', 'A'), m('b', 0, 'T2', 'T4', 'A'), m('c', 1, 'T1', 'T2', 'B'), m('d', 1, 'T3', 'T4', 'B')]
  // Điểm: T2=2, T1=1 (gặp T3=0, T2=2 → BH 2), T4=1 (gặp T2=2, T3=0 → BH 2), T3=0. T1/T4 cùng BH → đối đầu chưa gặp → hoà.
  const t = swissStandings(g, ms)
  assert.equal(t.rows[0].teamId, 'T2')
  assert.equal(t.rows[3].teamId, 'T3')
  assert.equal(t.ties.length, 1)
  assert.deepEqual([...t.ties[0]].sort(), ['T1', 'T4'])
  const ms2 = [...ms.slice(0, 3), m('d', 1, 'T3', 'T4', 'A')]
  // T3 thắng T4: T1 (1đ, BH = T3 1 + T2 2 = 3) trên T3 (1đ, BH = T1 1 + T4 0 = 1).
  const t2 = swissStandings(g, ms2)
  assert.deepEqual(t2.rows.slice(1, 3).map((r) => r.teamId), ['T1', 'T3'])
})

test('hoàn tác: trận Thụy Sĩ đã có vòng sau thì chặn', () => {
  const { group, matches } = buildSwissStart({ stage, entrants: entrants(4), newId })
  const ms = play(matches)
  const withNext = [...ms, ...pairNextRound({ stage, group, matches: ms, newId }).matches]
  const r0 = withNext.find((m) => m.round === 0)
  assert.equal(canUndo(ms, r0.id, [stage]).ok, true)
  assert.equal(canUndo(withNext, r0.id, [stage]).reasonKey, 'tournament.err.swissLaterRound')
  assert.equal(canUndo(withNext, r0.id, [{ ...stage, type: 'round_robin' }]).ok, true, 'vòng tròn không bị chặn')
})
