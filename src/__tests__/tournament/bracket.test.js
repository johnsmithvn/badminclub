import test from 'node:test'
import assert from 'node:assert/strict'
import { bracketOrder, nextPowerOf2, roundKindOf, buildKnockout } from '#lib/tournament/bracket.js'
import { applyCommit } from '#lib/tournament/advance.js'

const R30 = { sets: 1, points: 30, winBy2: false, cap: 30 }
const R3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }

const stageOf = (config) => ({
  id: 'stage-1',
  matchRule: R30,
  ruleOverrides: { final: R3x15, third: R3x15 },
  config,
})
const seeded = (n) => Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, seed: i + 1 }))
const drawn = (n) => Array.from({ length: n }, (_, i) => ({ id: `D${i + 1}`, drawNo: i + 1 }))

let counter = 0
const newId = () => `m${++counter}`
const build = (config, entrants) => buildKnockout({ stage: stageOf(config), entrants, newId })
const pair = (m) => [m.teamAId, m.teamBId]
const firstRound = (ms) => ms.filter((m) => m.round === 0).sort((a, b) => a.slot - b.slot)

// Chốt lần lượt mọi trận `ready` (bên A thắng) cho tới khi hết. Nhánh kẹt = còn trận chưa có kết quả.
function playOut(matches) {
  let ms = matches
  for (let m = ms.find((x) => x.status === 'ready'); m; m = ms.find((x) => x.status === 'ready')) {
    const win = [m.rule.points, 0]
    const sets = Array.from({ length: Math.ceil(m.rule.sets / 2) }, () => win)
    const res = applyCommit(ms, { matchId: m.id, sets, winner: 'A' })
    assert.equal(res.error, null, `chốt ${m.roundKind}#${m.slot} phải được: ${res.error}`)
    ms = res.matches
  }
  return ms
}

test('bracketOrder · nextPowerOf2 · roundKindOf', () => {
  assert.deepEqual(bracketOrder(2), [1, 2])
  assert.deepEqual(bracketOrder(4), [1, 4, 2, 3])
  assert.deepEqual(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6])
  assert.deepEqual(bracketOrder(16), [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11])
  assert.deepEqual([2, 3, 4, 5, 8, 9].map(nextPowerOf2), [2, 4, 4, 8, 8, 16])
  assert.deepEqual([0, 1, 2].map((r) => roundKindOf(r, 3)), ['qf', 'sf', 'final'])
  assert.deepEqual([0, 1, 2, 3, 4].map((r) => roundKindOf(r, 5)), ['r32', 'r16', 'qf', 'sf', 'final'])
  assert.throws(() => roundKindOf(0, 6), /r32/, 'nhánh 64 đội: DB không có round_kind cho vòng này')
})

test('8 đội (như mùa 1): cặp đấu, con trỏ, tranh 3-4, luật chép theo vòng', () => {
  const ms = build({ seeding: 'seed', thirdPlace: true }, seeded(8))
  const qf = ms.filter((m) => m.roundKind === 'qf')
  const sf = ms.filter((m) => m.roundKind === 'sf')
  const final = ms.find((m) => m.roundKind === 'final')
  const third = ms.find((m) => m.roundKind === 'third')

  assert.equal(ms.length, 8, '4 TK + 2 BK + CK + 3-4')
  assert.deepEqual(qf.map(pair), [['T1', 'T8'], ['T4', 'T5'], ['T2', 'T7'], ['T3', 'T6']])
  assert.deepEqual(qf.map((m) => [m.nextMatchId, m.nextSide]),
    [[sf[0].id, 'A'], [sf[0].id, 'B'], [sf[1].id, 'A'], [sf[1].id, 'B']])
  assert.deepEqual(sf.map((m) => [m.nextMatchId, m.nextSide]), [[final.id, 'A'], [final.id, 'B']])
  assert.deepEqual(sf.map((m) => [m.loserNextMatchId, m.loserNextSide]), [[third.id, 'A'], [third.id, 'B']],
    'thua 2 bán kết phải vào 2 bên KHÁC nhau của trận 3-4, cùng bên là đè mất một đội')
  assert.deepEqual(third.sourceA, { kind: 'loser', match: sf[0].id })
  assert.deepEqual(sf[0].sourceA, { kind: 'winner', match: qf[0].id })
  assert.deepEqual(qf[0].sourceA, { kind: 'seed', n: 1 })

  assert.deepEqual(sf[0].rule, R30, 'quy chế mùa 1: bán kết vẫn là "vòng loại" → 1×30')
  assert.deepEqual(final.rule, R3x15)
  assert.deepEqual(third.rule, R3x15)
  final.rule.points = 21
  assert.equal(third.rule.points, 15, 'luật mỗi trận là bản sao — sửa một trận không được lây sang trận khác')
  assert.equal(R3x15.points, 15, 'và không được sửa ngược vào luật của giai đoạn')
  assert.equal(new Set(ms.map((m) => `${m.round}-${m.slot}`)).size, ms.length, 'trùng (round, slot) = vỡ UNIQUE ở DB')
})

test('5 đội: bye rơi vào hạt giống 1-2-3 và được điền sẵn vào bán kết', () => {
  const ms = build({ seeding: 'seed', thirdPlace: true }, seeded(5))
  const qf = firstRound(ms)
  const sf = ms.filter((m) => m.roundKind === 'sf')
  assert.deepEqual(qf.map(pair), [['T1', null], ['T4', 'T5'], ['T2', null], ['T3', null]])
  assert.deepEqual(qf.map((m) => m.status), ['bye', 'ready', 'bye', 'bye'])
  assert.deepEqual(qf.map((m) => m.winner), ['A', null, 'A', 'A'])
  assert.deepEqual(sf.map(pair), [['T1', null], ['T2', 'T3']])
  assert.deepEqual(sf.map((m) => m.status), ['pending', 'ready'], 'bán kết đủ 2 đội nhờ bye thì đánh được ngay')
})

test('bốc thăm (slot): giữ thứ tự 1–2, 3–4; thiếu đội thì số nhỏ được bye, KHÔNG có trận bye–bye', () => {
  assert.deepEqual(firstRound(build({ seeding: 'slot' }, drawn(4))).map(pair), [['D1', 'D2'], ['D3', 'D4']])
  assert.deepEqual(firstRound(build({ seeding: 'slot' }, drawn(8))).map(pair),
    [['D1', 'D2'], ['D3', 'D4'], ['D5', 'D6'], ['D7', 'D8']])
  assert.deepEqual(firstRound(build({ seeding: 'slot' }, drawn(6))).map(pair),
    [['D1', null], ['D2', 'D3'], ['D4', null], ['D5', 'D6']],
    'xếp tuần tự 1-2, 3-4, 5-6, bye-bye là nhánh kẹt: bán kết chờ đội thắng của trận không ai đánh')
  const shuffled = [{ id: 'X', drawNo: 3 }, { id: 'Y', drawNo: 1 }, { id: 'Z', drawNo: 2 }, { id: 'W', drawNo: 4 }]
  assert.deepEqual(firstRound(build({ seeding: 'slot' }, shuffled)).map(pair), [['Y', 'Z'], ['X', 'W']],
    'theo số bốc thăm, không theo thứ tự mảng đưa vào')
})

test('3 đội: không sinh trận 3-4 (một bán kết là bye, không có đội thua để đá)', () => {
  const ms = build({ seeding: 'seed', thirdPlace: true }, seeded(3))
  assert.equal(ms.find((m) => m.roundKind === 'third'), undefined)
  assert.ok(ms.every((m) => !m.loserNextMatchId))
})

test('mọi nhánh 2..32 đội, cả 2 chế độ xếp: đánh được tới hết, không trận nào kẹt', () => {
  for (const seeding of ['seed', 'slot']) {
    for (let n = 2; n <= 32; n++) {
      const entrants = seeding === 'slot' ? drawn(n) : seeded(n)
      const ms = build({ seeding, thirdPlace: true }, entrants)
      const size = nextPowerOf2(n)
      const tag = `${seeding} ${n} đội`
      assert.equal(ms.length, size - 1 + (n >= 4 ? 1 : 0), `${tag}: số trận`)
      assert.ok(firstRound(ms).every((m) => m.teamAId || m.teamBId), `${tag}: có trận bye–bye`)
      assert.equal(firstRound(ms).filter((m) => m.status === 'bye').length, size - n, `${tag}: số bye`)
      const done = playOut(ms)
      const stuck = done.filter((m) => !['done', 'bye'].includes(m.status))
      assert.deepEqual(stuck.map((m) => `${m.roundKind}#${m.slot}`), [], `${tag}: nhánh kẹt`)
    }
  }
})

test('đầu vào sai thì báo lỗi, không sinh nhánh lệch', () => {
  assert.throws(() => build({ seeding: 'seed' }, [{ id: 'A', seed: 1 }]), /2 đội/)
  assert.throws(() => build({ seeding: 'seed' }, [{ id: 'A', seed: 1 }, { id: 'B', seed: 1 }]), /không trùng/)
  assert.throws(() => build({ seeding: 'seed' }, [{ id: 'A', seed: 1 }, { id: 'B', seed: 5 }]), /1\.\.số đội/)
  assert.throws(() => build({ seeding: 'slot' }, [{ id: 'A', drawNo: 1 }, { id: 'B' }]), /drawNo/)
  assert.throws(() => buildKnockout({ stage: stageOf({}), entrants: seeded(4) }), /newId/)
})
