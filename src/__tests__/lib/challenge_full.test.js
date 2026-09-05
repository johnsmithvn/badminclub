import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nextChallengeCode,
  challengeDirection,
  evalChallengeBalance,
  isWaitingCourt,
  canCancelChallenge,
  pickableMembersForChallenge,
} from '../../lib/challenge.js'

test('Comprehensive Challenge Logic & Lifecycle Tests', async (t) => {
  await t.test('nextChallengeCode auto-increment', () => {
    assert.equal(nextChallengeCode([]), 'C-0101')
    assert.equal(nextChallengeCode([{ code: 'C-0101' }]), 'C-0102')
    assert.equal(nextChallengeCode([{ code: 'C-0109' }]), 'C-0110')
    assert.equal(nextChallengeCode([{ code: 'C-0199' }]), 'C-0200')
    // Bỏ qua mã không đúng định dạng
    assert.equal(nextChallengeCode([{ code: 'CUSTOM' }]), 'C-0101')
  })

  await t.test('challengeDirection for creator, teamA, teamB and spectators', () => {
    const c = {
      id: 'c-1',
      createdBy: 'm1',
      teamA: ['m1', 'm2'],
      teamB: ['m3', 'm4'],
      status: 'pending',
    }
    assert.equal(challengeDirection(c, 'm1'), 'out', 'Creator sees out')
    assert.equal(challengeDirection(c, 'm2'), 'out', 'Team A member sees out')
    assert.equal(challengeDirection(c, 'm3'), 'in', 'Team B member sees in')
    assert.equal(challengeDirection(c, 'm4'), 'in', 'Team B member sees in')
    assert.equal(challengeDirection(c, 'spectator'), 'none', 'Unrelated member sees none')
    assert.equal(challengeDirection(null, 'm1'), 'none')
  })

  await t.test('evalChallengeBalance calculations and tone', () => {
    const ratings = { a1: 1600, a2: 1600, b1: 1650, b2: 1650 }
    const even = evalChallengeBalance(['a1', 'a2'], ['b1', 'b2'], ratings)
    assert.equal(even.ra, 1600)
    assert.equal(even.rb, 1650)
    assert.equal(even.gap, 50)
    assert.equal(even.tone, 'even')

    // Lệch vừa
    const ratingsSlight = { a1: 1500, a2: 1500, b1: 1650, b2: 1650 }
    const slight = evalChallengeBalance(['a1', 'a2'], ['b1', 'b2'], ratingsSlight)
    assert.equal(slight.gap, 150)
    assert.equal(slight.tone, 'slight')

    // Lệch nhiều > 250
    const ratingsImbalanced = { a1: 1400, a2: 1400, b1: 1700, b2: 1700 }
    const imbalanced = evalChallengeBalance(['a1', 'a2'], ['b1', 'b2'], ratingsImbalanced)
    assert.equal(imbalanced.gap, 300)
    assert.equal(imbalanced.tone, 'imbalanced')
    assert.ok(imbalanced.pctB > 80)
  })

  await t.test('canCancelChallenge permissions', () => {
    const pendingC = { createdBy: 'm1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], status: 'pending' }
    const acceptedC = { createdBy: 'm1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], status: 'accepted' }
    const playedC = { createdBy: 'm1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], status: 'played' }

    assert.ok(canCancelChallenge(pendingC, 'm1'), 'Creator can cancel pending')
    assert.ok(canCancelChallenge(pendingC, 'm2'), 'Team A partner can cancel pending')
    assert.ok(!canCancelChallenge(pendingC, 'm3'), 'Opponent cannot cancel (must decline instead)')
    assert.ok(!canCancelChallenge(acceptedC, 'm1'), 'Cannot cancel once accepted')
    assert.ok(!canCancelChallenge(playedC, 'm1'), 'Cannot cancel once played')
  })

  await t.test('isWaitingCourt helper', () => {
    assert.ok(isWaitingCourt({ status: 'accepted' }))
    assert.ok(!isWaitingCourt({ status: 'pending' }))
    assert.ok(!isWaitingCourt({ status: 'played' }))
    assert.ok(!isWaitingCourt(null))
  })

  await t.test('pickableMembersForChallenge excludes guests and absent members', () => {
    const members = [
      { id: 'm1', name: 'Member 1', active: true },
      { id: 'm2', name: 'Member 2', active: false }, // Inactive
      { id: 'm3', name: 'Member 3', active: true },
      { id: 'm4', name: 'Member 4', active: true },
    ]
    const attendance = {
      'sess-1': {
        m1: true,
        m2: true,
        m3: false, // Vắng
        // m4 chưa điểm danh
      },
    }

    const pickable = pickableMembersForChallenge(members, attendance, 'sess-1')
    assert.equal(pickable.length, 1)
    assert.equal(pickable[0].id, 'm1')
  })
})
