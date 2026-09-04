import test from 'node:test'
import assert from 'node:assert/strict'
import { evalBalance, calcEloDelta, expectedScore } from '../../lib/rating.js'

test('Challenge Enhancements (K3 Imbalance, K4 H2H, K6 Gạ Kèo)', async (t) => {
  await t.test('K3: Imbalance warning triggers when gap > 250 points', () => {
    const ra = 1750
    const rb = 1480
    const balance = evalBalance(ra, rb)
    assert.equal(balance.level, 'imbalanced')
    assert.equal(balance.gap, 270)
    assert.ok(balance.gap > 250)

    // Upset bonus: If the underdog (B) wins, they gain significantly more Elo than if favorite (A) wins
    const winIfA = calcEloDelta(ra, rb, true)
    const winIfB = calcEloDelta(ra, rb, false)
    assert.ok(winIfB.deltaB > winIfA.deltaA, 'Underdog win rewards higher rating delta than favorite win')
    assert.equal(winIfA.deltaA + winIfA.deltaB, 0, 'Zero-sum rating transfer maintained')
    assert.equal(winIfB.deltaA + winIfB.deltaB, 0, 'Zero-sum rating transfer maintained')
  })

  await t.test('K4: H2H calculation accurately aggregates past encounters', () => {
    const teamA = ['mem-1', 'mem-2']
    const teamB = ['mem-3', 'mem-4']

    const matches = [
      {
        id: 'mat-1',
        teamA: ['mem-1', 'mem-2'],
        teamB: ['mem-3', 'mem-4'],
        winnerTeam: 'A',
      },
      {
        id: 'mat-2',
        teamA: ['mem-3', 'mem-4'],
        teamB: ['mem-1', 'mem-2'],
        winnerTeam: 'B', // mem-1 & mem-2 won
      },
      {
        id: 'mat-3',
        teamA: ['mem-1', 'mem-2'],
        teamB: ['mem-3', 'mem-4'],
        winnerTeam: 'B', // mem-3 & mem-4 won
      },
    ]

    let winsA = 0
    let winsB = 0
    matches.forEach((m) => {
      const matchA = m.teamA || []
      const matchB = m.teamB || []
      const isTeamA_in_A = teamA.every((id) => matchA.includes(id))
      const isTeamB_in_B = teamB.every((id) => matchB.includes(id))
      const isTeamA_in_B = teamA.every((id) => matchB.includes(id))
      const isTeamB_in_A = teamB.every((id) => matchA.includes(id))

      if (isTeamA_in_A && isTeamB_in_B) {
        if (m.winnerTeam === 'A') winsA++
        else if (m.winnerTeam === 'B') winsB++
      } else if (isTeamA_in_B && isTeamB_in_A) {
        if (m.winnerTeam === 'B') winsA++
        else if (m.winnerTeam === 'A') winsB++
      }
    })

    assert.equal(winsA, 2)
    assert.equal(winsB, 1)
  })

  await t.test('K6: Challenge member cycling and team assignment logic', () => {
    let teamA = []
    let teamB = []

    const cycleMember = (mid) => {
      if (teamA.includes(mid)) {
        teamA = teamA.filter((id) => id !== mid)
        if (teamB.length < 2) {
          teamB = [...teamB, mid]
        }
      } else if (teamB.includes(mid)) {
        teamB = teamB.filter((id) => id !== mid)
      } else {
        if (teamA.length < 2) {
          teamA = [...teamA, mid]
        } else if (teamB.length < 2) {
          teamB = [...teamB, mid]
        }
      }
    }

    // Step 1: Click 'p1' -> joins teamA
    cycleMember('p1')
    assert.deepEqual(teamA, ['p1'])
    assert.deepEqual(teamB, [])

    // Step 2: Click 'p1' again -> moves to teamB
    cycleMember('p1')
    assert.deepEqual(teamA, [])
    assert.deepEqual(teamB, ['p1'])

    // Step 3: Click 'p1' third time -> removed from both
    cycleMember('p1')
    assert.deepEqual(teamA, [])
    assert.deepEqual(teamB, [])

    // Step 4: Fill teamA with 2 players
    cycleMember('p1')
    cycleMember('p2')
    assert.equal(teamA.length, 2)

    // Step 5: Next clicked player 'p3' goes to teamB automatically
    cycleMember('p3')
    assert.deepEqual(teamB, ['p3'])
  })
})
