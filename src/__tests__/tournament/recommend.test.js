import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateMatchScore, validateSets, matchWinner } from '#lib/tournament/scoring.js'
import { candidatesFor, costOf, recommend } from '#lib/tournament/recommend.js'

test('Module Giải đấu - simulateMatchScore', async (t) => {
  await t.test('1. simulateMatchScore: sinh tỉ số ngẫu nhiên luôn hợp lệ với mọi luật', () => {
    const rules = [
      { sets: 1, points: 21, winBy2: true, cap: 30 },
      { sets: 1, points: 30, winBy2: false, cap: 30 },
      { sets: 3, points: 15, winBy2: false, cap: 15 },
      { sets: 3, points: 21, winBy2: true, cap: 30 },
      { sets: 1, points: 15, winBy2: false, cap: 15 },
    ]

    for (const rule of rules) {
      for (let i = 0; i < 20; i++) {
        const sim = simulateMatchScore(rule)
        assert.ok(sim.winner === 'A' || sim.winner === 'B', 'Phải có người thắng A hoặc B')
        assert.equal(validateSets(sim.sets, rule), null, `Tỉ số ${JSON.stringify(sim.sets)} phải hợp lệ theo luật ${JSON.stringify(rule)}`)
        assert.equal(matchWinner(sim.sets, rule), sim.winner, 'matchWinner phải khớp với sim.winner')
      }
    }
  })

  await t.test('2. simulateMatchScore: hỗ trợ deterministic random injection', () => {
    const rule = { sets: 1, points: 21, winBy2: true, cap: 30 }
    let seed = 0.1
    const pseudoRand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const sim = simulateMatchScore(rule, pseudoRand)
    assert.ok(sim.winner === 'A' || sim.winner === 'B')
    assert.equal(validateSets(sim.sets, rule), null)
  })
})

// Giải dựng sẵn: mỗi nội dung `n` đội đủ người (đôi = 2 người/đội, nam nữ = 1 nam + 1 nữ).
function tourWith(counts, { start = '07:30', end = '12:00', courts = 2 } = {}) {
  const kinds = { md: ['male', 2], wd: ['female', 2], xd: ['mixed', 2], ms: ['male', 1] }
  const events = []
  const registrations = []
  const teams = []
  const teamPlayers = []
  Object.entries(counts).forEach(([kind, n]) => {
    const [genderRule, teamSize] = kinds[kind]
    const ev = { id: 'e-' + kind, kind, genderRule, teamSize, status: 'drawn', templateKey: null }
    events.push(ev)
    for (let i = 0; i < n; i++) {
      const tid = `${kind}-t${i}`
      teams.push({ id: tid, eventId: ev.id, drawNo: i + 1 })
      for (let k = 0; k < teamSize; k++) {
        const rid = `${tid}-p${k}`
        const gender = genderRule === 'female' || (genderRule === 'mixed' && k === 1) ? 'nu' : 'nam'
        registrations.push({ id: rid, playerId: rid, gender, status: 'registered', ratingSnapshot: 500 })
        teamPlayers.push({ teamId: tid, eventId: ev.id, registrationId: rid })
      }
    }
  })
  return {
    events, registrations, teams, teamPlayers, entries: [], stages: [], stageLinks: [],
    startTime: start, endTime: end, courtLabels: Array.from({ length: courts }, (_, i) => 'Sân ' + (i + 1)),
  }
}
const pickOf = (res, kind) => res.events.find((e) => e.eventId === 'e-' + kind).pick

test('phương án: chỉ những mẫu tab Thể thức làm được, bảng 3–6 đội', () => {
  assert.deepEqual(candidatesFor(1), [])
  assert.deepEqual(candidatesFor(2).map((c) => c.tpl), ['ko'])
  assert.ok(candidatesFor(5).some((c) => c.tpl === 'rr'))
  assert.ok(!candidatesFor(8).some((c) => c.tpl === 'rr'), 'vòng tròn 1 bảng chỉ tới 7 đội')
  candidatesFor(16).filter((c) => c.tpl !== 'ko').forEach((c) => {
    const per = Math.ceil(16 / c.numGroups)
    assert.ok(per >= 3 && per <= 6, `${c.tpl} ${c.numGroups} bảng: ${per} đội/bảng`)
  })
  // Loại trực tiếp 8 đội có tranh 3-4: 6 trận vòng loại + chung kết + 3-4 = 8 trận.
  const ko8 = costOf({ tpl: 'ko', numGroups: 1, advance: 0 }, 8, { dq: 18, df: 22 })
  assert.equal(ko8.matches, 8)
  assert.equal(ko8.minutes, 6 * (18 + 3) + 2 * (22 + 3))
})

test('nghiệm thu mùa 1: 3 nội dung × 8 đội, 2 sân, 07:30–12:00 → loại trực tiếp vừa giờ, ưu tiên nào cũng vậy', () => {
  for (const p of ['balanced', 'games', 'fast']) {
    const res = recommend(tourWith({ md: 8, wd: 8, xd: 8 }), p)
    ;['md', 'wd', 'xd'].forEach((k) => assert.equal(pickOf(res, k).tpl, 'ko', `${p}: ${k}`))
    assert.equal(res.fits, true, `${p}: ${res.totalMinutes} phút sân / ${res.capacity}`)
    assert.ok(res.finish <= '12:00')
  }
})

test('nội dung chưa đủ 2 đội: không gợi ý', () => {
  assert.equal(pickOf(recommend(tourWith({ md: 1 })), 'md'), null)
})

test('4 đội, dư giờ, ưu tiên nhiều trận → vòng tròn 1 bảng', () => {
  const pick = pickOf(recommend(tourWith({ md: 4 }, { start: '08:00', end: '11:00' }), 'games'), 'md')
  assert.equal(pick.tpl, 'rr')
  assert.equal(pick.minG, 3)
})

test('8 đội, 3 sân 5 tiếng, cân bằng → có vòng bảng rồi mới loại', () => {
  const pick = pickOf(recommend(tourWith({ md: 8 }, { start: '07:00', end: '12:00', courts: 3 }), 'balanced'), 'md')
  assert.ok(pick.multi, pick.tpl)
})

test('8 đội, 1 sân 90 phút → loại trực tiếp, báo không vừa giờ', () => {
  const res = recommend(tourWith({ md: 8 }, { start: '08:00', end: '09:30', courts: 1 }), 'balanced')
  assert.equal(pickOf(res, 'md').tpl, 'ko')
  assert.equal(res.fits, false)
})

test('16 đội, dư giờ, cân bằng → vòng bảng 4 bảng', () => {
  const pick = pickOf(recommend(tourWith({ md: 16 }, { start: '07:00', end: '17:00', courts: 4 }), 'balanced'), 'md')
  assert.equal(pick.tpl.startsWith('rr_ko'), true)
  assert.equal(pick.numGroups, 4)
})

test('giải chưa khai báo giờ / sân: vẫn gợi ý, không ước tính giờ xong', () => {
  const res = recommend(tourWith({ md: 6 }, { start: null, courts: 0 }))
  assert.ok(pickOf(res, 'md'))
  assert.equal(res.capacity, null)
  assert.equal(res.finish, null)
})

test('chưa ghép cặp: ước số đội từ số người đã vào nội dung', () => {
  const tr = tourWith({ xd: 0 })
  tr.registrations = [
    ...['a', 'b', 'c'].map((id) => ({ id, playerId: id, gender: 'nam', status: 'registered' })),
    ...['d', 'e'].map((id) => ({ id, playerId: id, gender: 'nu', status: 'registered' })),
  ]
  tr.entries = tr.registrations.map((r) => ({ eventId: 'e-xd', registrationId: r.id }))
  const ev = recommend(tr).events[0]
  assert.equal(ev.n, 2, 'nam nữ: min(3 nam, 2 nữ)')
  assert.equal(ev.estimated, true)
})
