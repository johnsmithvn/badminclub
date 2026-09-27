import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateMatchScore, validateSets, matchWinner } from '#lib/tournament/scoring.js'
import { candidatesFor, costOf, genderCounts, optionKey, pipelineOf, recommend, simTeamsOf, suggestRules } from '#lib/tournament/recommend.js'

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

test('chọn tay phương án khác: giữ nguyên dù vượt giờ; nhãn KHUYÊN DÙNG / NHANH NHẤT / NHIỀU TRẬN / VƯỢT GIỜ; ĐÃ CHỈNH', () => {
  const tr = tourWith({ md: 8, wd: 8, xd: 8 })
  const auto = recommend(tr, 'balanced')
  const md = auto.events.find((e) => e.eventId === 'e-md')
  assert.ok(md.options.find((o) => o.key === md.pick.key).badges.includes('recommended'))
  assert.ok(md.options.some((o) => o.badges.includes('fastest')))
  assert.ok(md.options.some((o) => o.badges.includes('mostGames')))
  const heavy = md.options.find((o) => o.tpl !== 'ko')
  assert.ok(heavy.badges.includes('over'), 'mùa 1 vừa khít giờ — đổi sang vòng bảng là vượt')
  assert.equal(md.edited, false)

  const manual = recommend(tr, 'balanced', { 'e-md': optionKey(heavy) })
  const mdM = manual.events.find((e) => e.eventId === 'e-md')
  assert.equal(mdM.pick.key, heavy.key, 'BTC chọn tay → không bị hạ về loại trực tiếp')
  assert.equal(mdM.edited, true)
  assert.equal(manual.fits, false)
})

test('luật gợi ý theo phút còn cho mỗi trận (README §5.7); không có giờ/sân thì không gợi ý', () => {
  assert.deepEqual(suggestRules(9), { qualify: 'r1x15', final: 'r3x11' })
  assert.deepEqual(suggestRules(16), { qualify: 'r1x21', final: 'r3x15' })
  assert.deepEqual(suggestRules(30), { qualify: 'r3x21', final: 'r3x21' })
  assert.ok(recommend(tourWith({ md: 8 })).rules)
  assert.equal(recommend(tourWith({ md: 8 }, { start: null })).rules, null)
})

test('simTeamsOf: công thức giả lập theo giới/số người mỗi đội', () => {
  assert.equal(simTeamsOf({ teamSize: 2, genderRule: 'male' }, 16, 8), 8, 'đôi nam: floor(16/2)')
  assert.equal(simTeamsOf({ teamSize: 2, genderRule: 'female' }, 16, 9), 4, 'đôi nữ: floor(9/2)')
  assert.equal(simTeamsOf({ teamSize: 2, genderRule: 'mixed' }, 16, 8), 8, 'đôi nam nữ: min(16,8)')
  assert.equal(simTeamsOf({ teamSize: 1, genderRule: 'male' }, 16, 8), 16, 'đơn nam: cả M')
  assert.equal(simTeamsOf({ teamSize: 1, genderRule: 'mixed' }, 16, 8), 24, 'đơn mở rộng: M+W')
})

test('genderCounts: đếm theo người (khử trùng), bỏ đội đã rút', () => {
  const tr = tourWith({ md: 2 })
  tr.registrations.push({ id: 'x', playerId: 'md-t0-p0', gender: 'nam', status: 'registered' }) // trùng người đã đếm
  tr.registrations.push({ id: 'y', playerId: 'y', gender: 'nu', status: 'withdrawn' })
  assert.deepEqual(genderCounts(tr), { M: 4, W: 0 })
})

test('sim: giả lập M/W thay số đội thật; tắt nội dung thì loại khỏi kết quả và khỏi phép tính giờ', () => {
  const tr = tourWith({ md: 8, wd: 8 }, { start: '08:00', end: '09:30', courts: 1 })
  const sim = recommend(tr, 'balanced', {}, { M: 4, W: 4 })
  assert.equal(pickOf(sim, 'md').tpl, 'ko', '2 đội giả lập (floor(4/2)) → không còn đủ dữ liệu 8 đội thật')
  assert.equal(sim.events.find((e) => e.eventId === 'e-md').n, 2)

  const off = recommend(tr, 'balanced', {}, { enabled: { 'e-wd': false } })
  assert.equal(off.events.length, 1, 'wd bị tắt thì không còn trong danh sách')
  assert.equal(off.events[0].eventId, 'e-md')
})

test('pipelineOf: các bước hiển thị đúng theo mẫu; ko không có bảng, rr dừng ở bảng, rr_ko_plate có nhánh phụ', () => {
  assert.deepEqual(pipelineOf(null, 8), [])
  assert.deepEqual(pipelineOf({ tpl: 'ko', numGroups: 1, advance: 0 }, 8), [{ key: 'ko', n: 8 }])
  const rr = pipelineOf({ tpl: 'rr', numGroups: 1, advance: 0 }, 6)
  assert.deepEqual(rr.map((s) => s.key), ['groups'], 'vòng tròn không có bước loại trực tiếp tiếp theo')
  const gko = pipelineOf({ tpl: 'rr_ko', numGroups: 2, advance: 2 }, 8)
  assert.deepEqual(gko.map((s) => s.key), ['groups', 'ko'])
  assert.equal(gko[1].n, 4, '2 bảng × 2 đội đi tiếp = 4 đội vào nhánh')
  const plate = pipelineOf({ tpl: 'rr_ko_plate', numGroups: 2, advance: 2 }, 8)
  assert.deepEqual(plate.map((s) => s.key), ['groups', 'ko', 'plate'])
})

test('sim: chỉnh sân/giờ/phút-trận giả lập độc lập với dữ liệu thật của giải', () => {
  const tr = tourWith({ md: 8 }, { start: '08:00', end: '09:30', courts: 1 })
  const real = recommend(tr, 'balanced')
  assert.equal(real.fits, false, 'thật: 1 sân 90 phút không đủ cho loại trực tiếp 8 đội')

  const wide = recommend(tr, 'balanced', {}, { courts: 4, start: 480, end: 720 })
  assert.equal(wide.fits, true, 'giả lập 4 sân, 8g-12g thì đủ giờ dù giải thật chỉ khai 1 sân')
  assert.equal(tr.startTime, '08:00', 'sim không ghi đè lại dữ liệu thật của tour')

  const short = recommend(tr, 'balanced', {}, { dq: 5, df: 5, rest: 0 })
  assert.ok(short.totalMinutes < real.totalMinutes, 'phút/trận giả lập thấp hơn → tổng phút sân giảm')
})

