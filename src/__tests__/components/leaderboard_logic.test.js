import test from 'node:test'
import assert from 'node:assert/strict'
import { computeClubCalibration, confidenceOf } from '../../lib/rating.js'
import { headToHeadMatrix, searchMatches, neverMetPairs } from '../../lib/matchSearch.js'

test('Phase 3 Leaderboard Logic Verification', async (t) => {
  const members = [
    { id: 'm1', name: 'Minh', gender: 'nam' },
    { id: 'm2', name: 'Lan', gender: 'nu' },
    { id: 'm3', name: 'Hải', gender: 'nam' },
  ]
  const memberMap = { m1: members[0], m2: members[1], m3: members[2] }

  const matches = [
    {
      id: 'mat-1',
      code: 'M-01',
      teamA: ['m1'],
      teamB: ['m2'],
      sets: [[21, 19], [21, 15]],
      winnerTeam: 'A',
      createdAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'mat-2',
      code: 'M-02',
      teamA: ['m2'],
      teamB: ['m1'],
      sets: [[19, 21], [21, 18], [21, 19]],
      winnerTeam: 'A',
      createdAt: '2026-09-02T10:00:00Z',
    },
  ]

  await t.test('Confidence label derivation', () => {
    assert.equal(confidenceOf(2), 'low')
    assert.equal(confidenceOf(10), 'medium')
    assert.equal(confidenceOf(25), 'high')
    assert.equal(confidenceOf(40), 'very_high')
  })

  await t.test('H2H matrix computes correct win-loss', () => {
    const mat = headToHeadMatrix(members, matches)
    assert.equal(mat['m1']['m2'].wins, 1)
    assert.equal(mat['m1']['m2'].losses, 1)
    assert.equal(mat['m2']['m1'].wins, 1)
    assert.equal(mat['m2']['m1'].losses, 1)
    assert.equal(mat['m1']['m3'].wins, 0)
  })

  await t.test('Search matches finds H2H matches between A and B', () => {
    const res = searchMatches(matches, { playerA: 'm1', playerB: 'm2', mode: 'vs' })
    assert.equal(res.length, 2)
  })

  await t.test('Cross-gender calibration calculates correctly', () => {
    const calib = computeClubCalibration(matches, memberMap)
    assert.ok(calib.buckets)
    assert.equal(typeof calib.topCrossGenderPlayers, 'object')
    assert.equal(Array.isArray(calib), true)
  })
})
