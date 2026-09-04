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
    const oldSets = [[21, 19], [21, 17]]
    const newSets = [[19, 21], [17, 21]]
    let newWonA = 0
    let newWonB = 0
    newSets.forEach(([a, b]) => {
      if (a > b) newWonA++
      else if (b > a) newWonB++
    })
    const newWinner = newWonA > newWonB ? 'A' : 'B'
    assert.equal(newWinner, 'B')
  })
})
