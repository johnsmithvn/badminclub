import test from 'node:test'
import assert from 'node:assert/strict'
import { calcEloDelta, expectedScore } from '../../lib/rating.js'

test('Phase 1 Modals Logic Verification', async (t) => {
  await t.test('Elo win% calculation for CreateChallengeModal', () => {
    const avgA = 1680
    const avgB = 1600
    const pA = expectedScore(avgA, avgB)
    const pctA = Math.round(pA * 100)
    const pctB = 100 - pctA
    assert.equal(pctA, 61)
    assert.equal(pctB, 39)
  })

  await t.test('ScoreModal winner and Elo delta preview', () => {
    const avgA = 1680
    const avgB = 1600
    const sets = [[21, 19], [18, 21], [21, 15]]
    let wonA = 0
    let wonB = 0
    sets.forEach(([a, b]) => {
      if (a > b) wonA++
      else if (b > a) wonB++
    })
    assert.equal(wonA, 2)
    assert.equal(wonB, 1)
    const winnerTeam = wonA > wonB ? 'A' : 'B'
    assert.equal(winnerTeam, 'A')

    const delta = calcEloDelta(avgA, avgB, true)
    assert.ok(delta.deltaA > 0)
    assert.ok(delta.deltaB < 0)
    assert.equal(delta.deltaA + delta.deltaB, 0)
  })

  await t.test('EditScoreModal logic checks', () => {
    const newSets = [[19, 21], [17, 21]]
    let newWonA = 0
    let newWonB = 0
    newSets.forEach(([a, b]) => {
      if (a > b) newWonA++
      else if (b > a) newWonB++
    })
    const newWinner = newWonA > newWonB ? 'A' : 'B'
    assert.equal(newWinner, 'B')

    // Timestamp assembly from dateStr and timeStr
    const dateStr = '2026-09-07'
    const timeStr = '20:15'
    const [y, m, d] = dateStr.split('-').map(Number)
    const [hh, mm] = timeStr.split(':').map(Number)
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0)
    assert.equal(dt.getFullYear(), 2026)
    assert.equal(dt.getMonth(), 8)
    assert.equal(dt.getDate(), 7)
    assert.equal(dt.getHours(), 20)
    assert.equal(dt.getMinutes(), 15)

    // Test ratingsMap calculation with Object Map (standard client db format)
    const dbPlayerRatingsMap = {
      'm1': { rating: 1650, gamesCount: 12 },
      'm2': { rating: 1550, gamesCount: 8 },
    }
    const teamA = ['m1']
    const teamB = ['m2']
    const getRatingsMap = (playerRatings) => {
      const map = {}
      if (Array.isArray(playerRatings)) {
        playerRatings.forEach((r) => {
          const mid = r.memberId || r.playerId || r.id
          if (mid) map[mid] = r.rating
        })
      } else if (playerRatings && typeof playerRatings === 'object') {
        Object.entries(playerRatings).forEach(([mid, r]) => {
          map[mid] = typeof r === 'object' && r !== null ? r.rating : r
        })
      }
      ;[...teamA, ...teamB].forEach((id) => {
        if (map[id] == null) map[id] = 1500
      })
      return map
    }

    const mapFromObj = getRatingsMap(dbPlayerRatingsMap)
    assert.equal(mapFromObj['m1'], 1650)
    assert.equal(mapFromObj['m2'], 1550)

    // Test with Array format (raw Postgres / legacy)
    const dbPlayerRatingsArray = [
      { memberId: 'm1', rating: 1650 },
      { memberId: 'm2', rating: 1550 },
    ]
    const mapFromArr = getRatingsMap(dbPlayerRatingsArray)
    assert.equal(mapFromArr['m1'], 1650)
    assert.equal(mapFromArr['m2'], 1550)

    // Test with undefined / null / empty
    const mapFromEmpty = getRatingsMap(null)
    assert.equal(mapFromEmpty['m1'], 1500)
    assert.equal(mapFromEmpty['m2'], 1500)
  })
})
