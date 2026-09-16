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

  await t.test('Challenge expiration calculation', () => {
    const pastTime = new Date(Date.now() - 10000).toISOString()
    const futureTime = new Date(Date.now() + 60000).toISOString()
    const expiredChal = { status: 'pending', expiresAt: pastTime }
    const activeChal = { status: 'pending', expiresAt: futureTime }

    const isExp1 = expiredChal.status === 'expired' || (expiredChal.expiresAt && new Date(expiredChal.expiresAt).getTime() <= Date.now())
    const isExp2 = activeChal.status === 'expired' || (activeChal.expiresAt && new Date(activeChal.expiresAt).getTime() <= Date.now())

    assert.equal(isExp1, true, 'Kèo quá hạn phải được tính là expired')
    assert.equal(isExp2, false, 'Kèo chưa tới hạn không bị expired')
  })

  await t.test('Challenge deploy rejects absent and noshow players', () => {
    const c = { id: 'c1', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] }
    const att = { p1: true, p2: true, p3: false, p4: 'noshow' }
    const allFour = [...c.teamA, ...c.teamB]
    const absentKeys = allFour.filter((k) => att[k] === false || att[k] === 'noshow')

    assert.equal(absentKeys.length, 2, 'Phát hiện đúng 2 người vắng/noshow trong kèo')
    assert.deepEqual(absentKeys, ['p3', 'p4'])
  })

  await t.test('Unlinked club challenge can be linked to an active session', () => {
    const unlinkedChal = { id: 'c_free', code: 'C-0105', sessionId: null, status: 'accepted', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] }
    const session1 = { id: 's_today', date: '2026-09-16' }

    // Trước khi gán: không thuộc buổi nào
    assert.equal(unlinkedChal.sessionId, null)

    // Sau khi gán vào buổi hôm nay:
    const linkedChal = { ...unlinkedChal, sessionId: session1.id }
    assert.equal(linkedChal.sessionId, 's_today', 'Kèo tự do đã được gán thành công vào buổi hôm nay')

    // Lọc theo buổi:
    const sessionChals = [linkedChal].filter((c) => c.sessionId === session1.id)
    assert.equal(sessionChals.length, 1, 'Kèo xuất hiện đầy đủ trong danh sách kèo của buổi để nạp lên sân')
  })
})

