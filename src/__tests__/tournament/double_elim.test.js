import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDoubleElim, deChampion, deView, lbIndexOf } from '#lib/tournament/doubleElim.js'
import { applyCommit, applyUndo, canUndo } from '#lib/tournament/advance.js'

const R30 = { sets: 1, points: 30, winBy2: false, cap: 30 }
const R3x15 = { sets: 3, points: 15, winBy2: false, cap: 15 }
const stage = { id: 'de', type: 'knockout', matchRule: R30, ruleOverrides: { final: R3x15, third: R3x15 }, config: { bracket: 'double', seeding: 'seed' } }
const seeded = (n) => Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, seed: i + 1 }))
let k = 0
const newId = () => `m${++k}`
const build = (n) => buildDoubleElim({ stage, entrants: seeded(n), newId })
// Nguồn ngẫu nhiên cố định — test lặp lại được.
const rng = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647 }

function commit(ms, m, winner) {
  const one = winner === 'A' ? [m.rule.points, 0] : [0, m.rule.points]
  const res = applyCommit(ms, { matchId: m.id, sets: Array.from({ length: Math.ceil(m.rule.sets / 2) }, () => one), winner })
  assert.equal(res.error, null, `chốt ${m.roundKind} r${m.round}#${m.slot}: ${res.error}`)
  return res.matches
}
function playOut(ms, pick) {
  for (let m = ms.find((x) => x.status === 'ready'); m; m = ms.find((x) => x.status === 'ready')) ms = commit(ms, m, pick(m))
  return ms
}

test('8 đội: nhánh thắng 7 trận, nhánh thua 6, chung kết tổng 1; luật chung kết chỉ áp chung kết tổng', () => {
  const ms = build(8)
  const count = (kind) => ms.filter((m) => m.roundKind === kind).length
  assert.equal(ms.filter((m) => !['lb', 'gf'].includes(m.roundKind)).length, 7)
  assert.equal(count('lb'), 6)
  assert.equal(count('gf'), 1)
  assert.equal(count('wf'), 1)
  assert.equal(count('final'), 0, 'không còn "final" để chỗ khác tưởng là chung kết giải')
  assert.deepEqual(ms.find((m) => m.roundKind === 'wf').rule, R30)
  assert.deepEqual(ms.find((m) => m.roundKind === 'gf').rule, R3x15)
})

test('con trỏ luôn trỏ tới vòng sau; (round, slot) không trùng', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 11, 16]) {
    const ms = build(n)
    const byId = new Map(ms.map((m) => [m.id, m]))
    ms.forEach((m) => {
      if (m.nextMatchId) assert.ok(byId.get(m.nextMatchId).round > m.round, `n=${n} next lùi vòng`)
      if (m.loserNextMatchId) assert.ok(byId.get(m.loserNextMatchId).round > m.round, `n=${n} loserNext lùi vòng`)
    })
    const slots = ms.map((m) => `${m.round}:${m.slot}`)
    assert.equal(new Set(slots).size, slots.length, `n=${n} trùng (round, slot)`)
  }
})

test('đánh trọn với kết quả ngẫu nhiên: không kẹt, ai bị loại cũng đúng 2 trận thua, 2n−2 hoặc 2n−1 trận', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 12, 16]) {
    for (const seed of [1, 7, 42]) {
      const rand = rng(seed * 31 + n)
      const ms = playOut(build(n), () => (rand() < 0.5 ? 'A' : 'B'))
      assert.equal(ms.filter((m) => m.status === 'pending').length, 0, `n=${n} seed=${seed}: còn trận kẹt`)
      const real = ms.filter((m) => m.status === 'done')
      const champ = deChampion(ms)
      assert.ok(champ, `n=${n} seed=${seed}: chưa có vô địch`)
      const losses = new Map()
      real.forEach((m) => { const l = m.winner === 'A' ? m.teamBId : m.teamAId; losses.set(l, (losses.get(l) || 0) + 1) })
      seeded(n).forEach(({ id }) => {
        const l = losses.get(id) || 0
        if (id === champ) assert.ok(l <= 1, `n=${n} vô địch thua ${l}`)
        else assert.equal(l, 2, `n=${n} seed=${seed}: ${id} thua ${l} trận`)
      })
      const hasGf2 = ms.some((m) => m.roundKind === 'gf2')
      assert.equal(real.length, 2 * n - 2 + (hasGf2 ? 1 : 0))
    }
  }
})

test('xếp tự do (miễn đấu ở ô bất kỳ): con trỏ tiến, đánh trọn không kẹt, ai bị loại cũng đúng 2 trận thua', () => {
  const free = { ...stage, config: { bracket: 'double', seeding: 'slot', free: true } }
  for (const n of [3, 5, 6, 7, 9, 11, 12, 13]) {
    for (const seed of [3, 11, 99]) {
      const rand = rng(seed * 17 + n)
      const size = 2 ** Math.ceil(Math.log2(n))
      // Chọn ngẫu nhiên cặp ô nào được miễn (mỗi cặp tối đa 1 ô trống), rồi rải đội vào các ô còn lại.
      const pairs = Array.from({ length: size / 2 }, (_, i) => i).sort(() => rand() - 0.5)
      const empty = new Set(pairs.slice(0, size - n).map((p) => 2 * p + (rand() < 0.5 ? 0 : 1)))
      const ids = seeded(n).map((x) => x.id).sort(() => rand() - 0.5)
      const entrants = []
      for (let p = 0; p < size; p++) if (!empty.has(p)) entrants.push({ id: ids[entrants.length], drawNo: p + 1 })
      const built = buildDoubleElim({ stage: free, entrants, newId })
      const byId = new Map(built.map((m) => [m.id, m]))
      built.forEach((m) => {
        if (m.nextMatchId) assert.ok(byId.get(m.nextMatchId).round > m.round, `n=${n} seed=${seed} next lùi vòng`)
        if (m.loserNextMatchId) assert.ok(byId.get(m.loserNextMatchId).round > m.round, `n=${n} seed=${seed} loserNext lùi vòng`)
      })
      const ms = playOut(built, () => (rand() < 0.5 ? 'A' : 'B'))
      assert.equal(ms.filter((m) => m.status === 'pending').length, 0, `n=${n} seed=${seed}: còn trận kẹt`)
      const champ = deChampion(ms)
      assert.ok(champ)
      const losses = new Map()
      ms.filter((m) => m.status === 'done').forEach((m) => { const l = m.winner === 'A' ? m.teamBId : m.teamAId; losses.set(l, (losses.get(l) || 0) + 1) })
      ids.forEach((id) => { if (id !== champ) assert.equal(losses.get(id) || 0, 2, `n=${n} seed=${seed}: ${id}`) })
    }
  }
})

test('miễn đấu: nhánh thua không sinh trận miễn, đội đi thẳng tới trận sau; vòng nhánh thua đánh số từ 1', () => {
  const ms = build(5)
  assert.equal(ms.filter((m) => m.roundKind === 'lb').length, 3)
  assert.ok(ms.filter((m) => m.roundKind === 'lb').every((m) => m.status === 'pending'))
  assert.ok(ms.filter((m) => m.status === 'bye').every((m) => !m.loserNextMatchId), 'trận bye không có đội thua')
  for (const n of [5, 8, 9]) {
    const first = Math.min(...build(n).filter((m) => m.roundKind === 'lb').map((m) => m.round))
    assert.equal(lbIndexOf(first), 0, `n=${n}: mã trận nhánh thua phải bắt đầu NT1`)
  }
})

test('chung kết tổng: A thắng là xong; B thắng → trận 2; hoàn tác trận 1 gỡ trận 2, trận 2 đã đánh thì chặn', () => {
  const ms = playOut(build(4), (m) => (m.roundKind === 'gf' ? 'B' : 'A'))
  const gf = ms.find((m) => m.roundKind === 'gf')
  const gf2 = ms.find((m) => m.roundKind === 'gf2')
  assert.ok(gf2, 'đội nhánh thua thắng trận 1 phải có trận 2')
  assert.equal(deChampion(ms), gf2.winner === 'A' ? gf2.teamAId : gf2.teamBId)
  assert.equal(canUndo(ms, gf.id).reasonKey, 'tournament.err.downstreamHasResult')

  // playOut đã đánh cả trận 2 → đưa trận 2 về "chờ đánh" rồi hoàn tác trận 1.
  const open = ms.map((m) => (m.roundKind === 'gf2' ? { ...m, status: 'ready', sets: [], winner: null } : m))
  const undone = applyUndo(open, { matchId: gf.id, reason: 'nhầm' })
  assert.equal(undone.error, null)
  assert.equal(undone.matches.some((m) => m.roundKind === 'gf2'), false)

  const aWins = playOut(build(4), () => 'A')
  assert.equal(aWins.some((m) => m.roundKind === 'gf2'), false)
  assert.equal(deChampion(aWins), 'T1')
})

test('deView: tách nhánh thắng / thua / chung kết tổng, hạng 3 = đội thua trận cuối nhánh thua', () => {
  const ms = playOut(build(8), () => 'A')
  const v = deView(ms, 'de')
  assert.deepEqual(v.wb.map((r) => r.matches.length), [4, 2, 1])
  assert.deepEqual(v.lb.map((r) => r.matches.length), [2, 2, 1, 1])
  assert.equal(v.champion, 'T1')
  const lbFinal = v.lb[3].matches[0]
  assert.equal(v.third, lbFinal.teamBId)
})
