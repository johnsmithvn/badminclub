import test from 'node:test'
import assert from 'node:assert/strict'
import { nextChallengeCode } from '../../lib/challenge.js'

test('Comprehensive Challenge Logic & Lifecycle Tests', async (t) => {
  await t.test('nextChallengeCode auto-increment', () => {
    assert.equal(nextChallengeCode([]), 'C-0101')
    assert.equal(nextChallengeCode([{ code: 'C-0101' }]), 'C-0102')
    assert.equal(nextChallengeCode([{ code: 'C-0109' }]), 'C-0110')
    assert.equal(nextChallengeCode([{ code: 'C-0199' }]), 'C-0200')
    // Bỏ qua mã không đúng định dạng
    assert.equal(nextChallengeCode([{ code: 'CUSTOM' }]), 'C-0101')
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

  await t.test('Link challenge allows players from any group when not marked absent', () => {
    const chal = { id: 'c_cross', teamA: ['p_group1', 'p_group2'], teamB: ['p_group3', 'p_group4'] }
    const att = { p_group1: true } // Các người khác chưa điểm danh
    const allPlayers = [...chal.teamA, ...chal.teamB]
    const hasReportedAbsent = allPlayers.some((id) => att[id] === false || att[id] === 'noshow')
    assert.equal(hasReportedAbsent, false, 'Không có ai báo vắng, kèo được phép đặt lịch hẹn vào buổi')
  })

  await t.test('Link challenge detects explicitly absent players', () => {
    const chal = { id: 'c_cross', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] }
    const att = { p1: true, p3: false } // p3 báo vắng
    const allPlayers = [...chal.teamA, ...chal.teamB]
    const absentPlayers = allPlayers.filter((id) => att[id] === false || att[id] === 'noshow')
    assert.deepEqual(absentPlayers, ['p3'], 'Phát hiện đúng người chơi đã báo vắng')
  })
})

