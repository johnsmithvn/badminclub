import test from 'node:test'
import assert from 'node:assert/strict'
import { courtCost, duesOf, guestRev } from '../../lib/money.js'
import { seed } from '../fixture.js'

test('Financial Isolation Verification (Tách biệt tuyệt đối với luồng tiền)', async (t) => {
  const db = seed()
  const s = db.sessions[0]
  assert.ok(s, 'Phải có ít nhất 1 session mẫu')

  await t.test('courtCost and guestRev are strictly unaffected by matches and challenges', () => {
    const courtBefore = courtCost(db, s)
    const revBefore = guestRev(db, s.id)
    assert.ok(courtBefore > 0)

    // Thêm giả lập nhiều challenges và matches vào db
    const dbWithCompetitions = {
      ...db,
      challenges: [
        { id: 'ch-1', code: 'C-0101', sessionId: s.id, status: 'played', ratingEnabled: true },
        { id: 'ch-2', code: 'C-0102', sessionId: s.id, status: 'accepted', ratingEnabled: false },
      ],
      matches: [
        { id: 'mat-1', sessionId: s.id, sets: [[21, 19], [21, 15]], winnerTeam: 'A', challengeId: 'ch-1' },
        { id: 'mat-2', sessionId: s.id, sets: [[15, 21], [21, 18], [21, 19]], winnerTeam: 'B' },
      ],
      playerRatings: [
        { playerId: 'm1', rating: 1650 },
        { playerId: 'm2', rating: 1520 },
      ],
      matchEdits: [
        { id: 'me-1', matchId: 'mat-1', reason: 'Nhập nhầm điểm' },
      ],
    }

    const courtAfter = courtCost(dbWithCompetitions, s)
    const revAfter = guestRev(dbWithCompetitions, s.id)

    assert.equal(courtAfter, courtBefore, 'Tiền sân không đổi')
    assert.equal(revAfter, revBefore, 'Tiền thu khách không đổi')
  })

  await t.test('Member dues are strictly unaffected by matches and challenges', () => {
    const month = s.date.slice(0, 7)
    const duesBefore = duesOf(db, month)

    const dbWithMatches = {
      ...db,
      matches: [{ id: 'm-x', sessionId: s.id, sets: [[21, 0]], winnerTeam: 'A' }],
      challenges: [{ id: 'c-x', status: 'played' }],
    }
    const duesAfter = duesOf(dbWithMatches, month)

    assert.equal(duesAfter.length, duesBefore.length)
    for (let i = 0; i < duesBefore.length; i++) {
      assert.equal(duesAfter[i].amount, duesBefore[i].amount)
      assert.equal(duesAfter[i].paid, duesBefore[i].paid)
    }
  })
})
