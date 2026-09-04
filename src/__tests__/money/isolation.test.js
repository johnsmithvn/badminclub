import test from 'node:test'
import assert from 'node:assert/strict'
import { costRow, duesOf } from '../../lib/money.js'
import { seed } from '../fixture.js'

test('Financial Isolation Verification (Tách biệt tuyệt đối với luồng tiền)', async (t) => {
  const db = seed()
  const s = db.sessions[0]
  assert.ok(s, 'Phải có ít nhất 1 session mẫu')

  await t.test('costRow is strictly unaffected by matches and challenges', () => {
    // 1. Tính giá thành buổi tập lúc ban đầu
    const costBefore = costRow(db, s)
    assert.ok(costBefore.cost > 0)
    assert.ok(costBefore.per > 0)

    // 2. Thêm giả lập nhiều challenges và matches vào db
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

    // 3. Tính lại giá thành buổi tập sau khi có matches & challenges
    const costAfter = costRow(dbWithCompetitions, s)

    // 4. Khẳng định: Các con số tài chính phải trùng khớp chính xác 100%
    assert.equal(costAfter.court, costBefore.court, 'Tiền sân không đổi')
    assert.equal(costAfter.shuttle, costBefore.shuttle, 'Tiền cầu không đổi')
    assert.equal(costAfter.cost, costBefore.cost, 'Tổng chi phí buổi không đổi')
    assert.equal(costAfter.rev, costBefore.rev, 'Tiền thu khách không đổi')
    assert.equal(costAfter.subsidy, costBefore.subsidy, 'Quỹ bù không đổi')
    assert.equal(costAfter.per, costBefore.per, 'Mỗi đầu người không đổi')
    assert.equal(costAfter.people, costBefore.people, 'Số người có mặt không đổi')
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
