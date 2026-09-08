import test from 'node:test'
import assert from 'node:assert/strict'
import { effectiveStrengthOf, isProvisional, getPlayerRating } from '../../lib/rating.js'
import { calculateSeasonLeaderboard, getMemberSeasonLedger } from '../../lib/xp.js'
import { arrangeBestOfN, detailedCourtBalance } from '../../lib/assign.js'
import { t as translate } from '../../i18n/index.js'

test('Season 3-Tier Core Engine Tests', async (t) => {
  await t.test('1. effectiveStrengthOf and isProvisional', () => {
    // Under 5 games (< 5): 60% Seed + 40% Elo
    // Example from design: Seed 1580, Elo 1655, 3 games
    // 1580 * 0.6 + 1655 * 0.4 = 948 + 662 = 1610
    const eff = effectiveStrengthOf(1655, 1580, 3)
    assert.equal(eff, 1610, 'Vy effective strength should be exactly 1610')
    assert.equal(isProvisional(3), true, '3 games is provisional')
    assert.equal(isProvisional(5), false, '5 games is official')

    // 5-14 games: 35% Seed + 65% Elo
    // Seed 1500, Elo 1600, 10 games -> 1500*0.35 + 1600*0.65 = 525 + 1040 = 1565
    assert.equal(effectiveStrengthOf(1600, 1500, 10), 1565)

    // 15-29 games: 15% Seed + 85% Elo
    // Seed 1500, Elo 1600, 20 games -> 1500*0.15 + 1600*0.85 = 225 + 1360 = 1585
    assert.equal(effectiveStrengthOf(1600, 1500, 20), 1585)

    // >= 30 games: 100% Elo
    assert.equal(effectiveStrengthOf(1600, 1500, 35), 1600)
  })

  await t.test('2. getPlayerRating includes effectiveStrength and isProvisional flag', () => {
    const prMap = {
      m1: { rating: 1655, gamesCount: 3 },
      m2: { rating: 1842, gamesCount: 86 },
    }
    const r1 = getPlayerRating(prMap, 'm1', { level: 'tbk' })
    assert.equal(r1.isProvisional, true)
    assert.equal(r1.provisionalRemaining, 2)
    assert.ok(r1.effectiveStrength > 0)

    const r2 = getPlayerRating(prMap, 'm2', { level: 'tot' })
    assert.equal(r2.isProvisional, false)
    assert.equal(r2.provisionalRemaining, 0)
    assert.equal(r2.effectiveStrength, 1842)
  })

  await t.test('3. calculateSeasonLeaderboard points and rankings', () => {
    const mockDb = {
      members: [
        { id: 'm1', name: 'Kiên', active: true },
        { id: 'm2', name: 'Hằng', active: true },
        { id: 'm3', name: 'Vy', active: true },
      ],
      sessions: [
        { id: 's1', date: '2026-07-05', attendees: ['m1', 'm2', 'm3'] },
        { id: 's2', date: '2026-07-12', attendees: ['m1', 'm2'] },
      ],
      matches: [
        {
          id: 'mt1',
          sessionId: 's1',
          teamA: ['m1'],
          teamB: ['m2'],
          winnerTeam: 'A',
          sets: [[21, 19]],
          initialRatingA: 1500,
          initialRatingB: 1600, // m1 upset won!
        },
      ],
    }

    const { season, leaderboard, topStats } = calculateSeasonLeaderboard(mockDb)
    assert.equal(season.id, '2026-Q3')
    assert.equal(leaderboard.length, 3)

    const kien = leaderboard.find((r) => r.name === 'Kiên')
    // 2 sessions * 30 = 60
    // 1 match played * 10 = 10
    // 1 win * 15 = 15
    // 1 upset * 25 = 25
    // Total = 110
    assert.equal(kien.totalSeasonPoints, 110)
    assert.equal(kien.breakdown.attendancePts, 60)
    assert.equal(kien.breakdown.matchPlayPts, 10)
    assert.equal(kien.breakdown.winPts, 15)
    assert.equal(kien.breakdown.upsetPts, 25)
    assert.equal(topStats.leaderPlayer.name, 'Kiên')
  })

  await t.test('3b. calculateSeasonLeaderboard with db.attendance map and playedInSession', () => {
    const mockDb = {
      members: [
        { id: 'm1', name: 'Kuro', active: true },
        { id: 'm2', name: 'Mai', active: true },
      ],
      sessions: [
        { id: 's1', date: '2026-07-05' }, // không có s.attendees
        { id: 's2', date: '2026-07-12' },
        { id: 's3', date: '2026-07-19' },
      ],
      attendance: {
        s1: { m1: true, m2: false },
        s2: { m1: 'extra', m2: true },
      },
      matches: [
        // Trận ở s3: m1 không có trong attendance map, nhưng có đánh trận ở s3
        {
          id: 'mt1',
          sessionId: 's3',
          playerKeys: ['m1', 'm2'],
          winnerTeam: 'A',
          sets: [[21, 15]],
        },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(mockDb)
    const kuro = leaderboard.find((r) => r.id === 'm1')
    const mai = leaderboard.find((r) => r.id === 'm2')

    // Kuro: s1 (true) + s2 ('extra') + s3 (đánh trận) = 3 buổi -> 3 * 30 = 90 CC
    assert.equal(kuro.attendedCount, 3)
    assert.equal(kuro.breakdown.attendancePts, 90)

    // Mai: s1 (false) + s2 (true) + s3 (đánh trận) = 2 buổi -> 2 * 30 = 60 CC
    assert.equal(mai.attendedCount, 2)
    assert.equal(mai.breakdown.attendancePts, 60)

    // Kiểm tra các chuỗi i18n không còn bị dính template tag {{...}}
    const strTotal = translate('season.tableTotal', { total: leaderboard.length, count: leaderboard.length })
    assert.equal(strTotal.includes('{{total}}'), false)
    assert.equal(strTotal, 'BXH Điểm mùa · 2 người')

    const strLead = translate('season.leadSurgeDesc', { name: 'Kuro', chaser: 'Mai' })
    assert.equal(strLead.includes('{{name}}'), false)
    assert.equal(strLead.includes('{{chaser}}'), false)
    assert.equal(strLead, 'Kuro bứt phá với chuỗi thắng; Mai bám đuổi sát nút.')
  })

  await t.test('4. arrangeBestOfN produces candidate plans and criteria scores', () => {
    const players = [
      { key: 'p1', name: 'Long', level: 'tot' },
      { key: 'p2', name: 'Linh', level: 'tb' },
      { key: 'p3', name: 'Kiên', level: 'kha' },
      { key: 'p4', name: 'Mai', level: 'tb' },
      { key: 'p5', name: 'Huy', level: 'tot' },
      { key: 'p6', name: 'Thắng', level: 'kha' },
    ]
    const session = {
      courts: [{}, { sold: true }],
    }
    const ratingsMap = {
      p1: 1842,
      p2: 1508,
      p3: 1795,
      p4: 1547,
      p5: 1710,
      p6: 1588,
    }
    const res = arrangeBestOfN({
      players,
      session,
      candidatesCount: 20,
      ratingsMap,
      matches: [],
      stats: {},
    })

    assert.ok(res.planA)
    assert.equal(res.planA.title, 'Phương án A')
    assert.ok(res.planA.score > 0)
    assert.ok(res.waitingPlayers.length >= 2)
    assert.equal(res.scatterPoints.length, 20)
  })

  await t.test('5. getMemberSeasonLedger generates full data for Screen SS3 modal', () => {
    const mockDb = {
      members: [
        { id: 'm1', name: 'Phạm Anh Tú', active: true },
        { id: 'm2', name: 'Đặng Tuấn', active: true },
      ],
      sessions: [
        { id: 's1', date: '2026-07-05', attendees: ['m1', 'm2'] },
      ],
      matches: [
        {
          id: 'mt1',
          sessionId: 's1',
          teamA: ['m1'],
          teamB: ['m2'],
          winnerTeam: 'A',
          sets: [[21, 15]],
        },
      ],
    }

    const ledger = getMemberSeasonLedger('m1', mockDb)
    assert.ok(ledger)
    assert.equal(ledger.member.name, 'Phạm Anh Tú')
    assert.equal(ledger.totalPoints, 55) // 30 attend + 10 match + 15 win
    assert.equal(ledger.breakdown.attendancePts, 30)
    assert.equal(ledger.breakdown.matchPlayPts, 10)
    assert.equal(ledger.breakdown.winPts, 15)
    assert.ok(Array.isArray(ledger.recentEvents))
    assert.ok(ledger.recentEvents.length > 0)
  })

  await t.test('6. courtDetails mapping preserves player names and effectiveStrength without empty fallback', () => {
    const rawCourt = {
      ci: 0,
      teamA: ['p1', 'p2'],
      teamB: ['p3', 'p4'],
      canRating: { delta: 12 },
    }
    const players = [
      { key: 'p1', name: 'Nguyễn Văn A' },
      { key: 'p2', name: 'Trần Thị B' },
      { key: 'p3', name: 'Lê Văn C' },
      { key: 'p4', name: 'Phạm Thị D' },
    ]
    const playerRatings = {
      p1: { rating: 1620, gamesCount: 40 },
      p2: { rating: 1510, gamesCount: 20 },
      p3: { rating: 1580, gamesCount: 10 },
      p4: { rating: 1540, gamesCount: 50 },
    }

    const getP = (k) => {
      const base = players.find((x) => x.key === k) || { key: k, name: k }
      const pr = getPlayerRating(playerRatings, k, base, {})
      return {
        ...base,
        ...pr,
        name: base.name || k,
        effectiveStrength: pr.effectiveStrength || pr.rating || 1500,
      }
    }

    const { teamA: _ta, teamB: _tb, ...restCd } = rawCourt
    const mapped = {
      ...restCd,
      teamA: rawCourt.teamA.map(getP),
      teamB: rawCourt.teamB.map(getP),
    }

    assert.equal(mapped.teamA[0].name, 'Nguyễn Văn A')
    assert.equal(mapped.teamA[0].rating, 1620)
    assert.equal(mapped.teamB[0].name, 'Lê Văn C')
    assert.ok(mapped.teamA[0].name.length > 0)
    assert.ok(mapped.teamB[0].name.length > 0)
  })
})

