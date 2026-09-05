import test from 'node:test'
import assert from 'node:assert/strict'
import { calcEloDelta } from '../../lib/rating.js'
import { nextChallengeCode } from '../../lib/challenge.js'

test('AppActions Competition Lifecycle Integration Tests', async (t) => {
  // Giả lập state ban đầu của club
  let state = {
    clubId: 'CL1',
    currentUserId: 'U1',
    members: [
      { id: 'm1', name: 'Minh', userId: 'U1' },
      { id: 'm2', name: 'Hùng', userId: 'U2' },
      { id: 'm3', name: 'Tuấn', userId: 'U3' },
      { id: 'm4', name: 'Vũ', userId: 'U4' },
    ],
    sessions: [{ id: 'S1', date: '2026-09-04' }],
    challenges: [],
    matches: [],
    playerRatings: {},
    matchEdits: [],
    lineups: {},
  }

  await t.test('1. Create Challenge action logic', () => {
    const code = nextChallengeCode(state.challenges)
    const newChallenge = {
      id: 'ch-01',
      code,
      clubId: state.clubId,
      sessionId: 'S1',
      createdBy: 'm1',
      teamA: ['m1', 'm2'],
      teamB: ['m3', 'm4'],
      bestOf: 3,
      ratingEnabled: true,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    state.challenges.push(newChallenge)

    assert.equal(state.challenges.length, 1)
    assert.equal(state.challenges[0].code, 'C-0101')
    assert.equal(state.challenges[0].status, 'pending')
  })

  await t.test('2. Respond Challenge action (Accept)', () => {
    const ch = state.challenges.find((c) => c.id === 'ch-01')
    ch.status = 'accepted'
    assert.equal(ch.status, 'accepted')
  })

  await t.test('3. Deploy Challenge to Court action', () => {
    const ch = state.challenges.find((c) => c.id === 'ch-01')
    ch.status = 'oncourt'
    ch.courtIndex = 0

    // Điền 4 người vào lineup của sân 0
    state.lineups['S1'] = {
      c0_0: ch.teamA[0],
      c0_1: ch.teamA[1],
      c0_2: ch.teamB[0],
      c0_3: ch.teamB[1],
    }

    assert.equal(state.lineups['S1']['c0_0'], 'm1')
    assert.equal(state.lineups['S1']['c0_2'], 'm3')
  })

  await t.test('4. Save Match Score action completes challenge and awards Elo', () => {
    const ch = state.challenges.find((c) => c.id === 'ch-01')
    const matchId = 'mat-101'
    const newMatch = {
      id: matchId,
      code: 'M-01',
      sessionId: 'S1',
      challengeId: ch.id,
      sourceType: 'challenge',
      teamA: ch.teamA,
      teamB: ch.teamB,
      sets: [[21, 19], [21, 17]],
      winnerTeam: 'A',
      ratingEnabled: true,
    }
    state.matches.push(newMatch)

    // Đổi trạng thái kèo sang played
    ch.status = 'played'
    ch.matchId = matchId

    // Cập nhật rating Elo
    const delta = calcEloDelta(0, 0, true) // m1, m2 thắng
    state.playerRatings['m1'] = { rating: delta.deltaA, gamesCount: 1 }
    state.playerRatings['m2'] = { rating: delta.deltaA, gamesCount: 1 }
    state.playerRatings['m3'] = { rating: delta.deltaB, gamesCount: 1 }
    state.playerRatings['m4'] = { rating: delta.deltaB, gamesCount: 1 }

    // Xóa sân sau khi xong
    delete state.lineups['S1']

    assert.equal(ch.status, 'played')
    assert.equal(state.matches.length, 1)
    assert.equal(state.matches[0].sourceType, 'challenge')
    assert.ok(state.playerRatings['m1'].rating > 0)
    assert.ok(state.playerRatings['m3'].rating < 0)
    assert.equal(state.lineups['S1'], undefined)
  })

  await t.test('5. Edit Match Score audit log and reason tracking', () => {
    const match = state.matches[0]
    const editReason = 'Trọng tài nhập nhầm set 2'
    const editLog = {
      id: 'edit-1',
      matchId: match.id,
      editedBy: 'm1',
      reason: editReason,
      oldValue: JSON.stringify(match.sets),
      newValue: JSON.stringify([[19, 21], [17, 21]]),
    }
    state.matchEdits.push(editLog)

    assert.equal(state.matchEdits.length, 1)
    assert.equal(state.matchEdits[0].reason, editReason)
    assert.equal(state.matchEdits[0].matchId, match.id)
  })
})
