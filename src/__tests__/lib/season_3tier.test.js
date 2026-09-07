import test from 'node:test'
import assert from 'node:assert/strict'
import { effectiveStrengthOf, isProvisional, getPlayerRating } from '../../lib/rating.js'
import { calculateSeasonLeaderboard, getMemberSeasonLedger } from '../../lib/xp.js'
import { arrangeBestOfN, detailedCourtBalance } from '../../lib/assign.js'

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
})
