import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getMatchTimestamp,
  sortMatchesDesc,
  sortMatchesAsc,
  getMemberStreak,
  getPairStreak,
  calculateMemberBadges,
  getBadgeChasers,
} from '../../lib/badges.js'

test('Badges Streak & Chasers Engine Suite', async (t) => {
  await t.test('1. getMatchTimestamp parses various timestamp formats reliably', () => {
    // Number
    assert.equal(getMatchTimestamp({ at: 1725440000000 }), 1725440000000)
    // String epoch
    assert.equal(getMatchTimestamp({ at: '1725440000000' }), 1725440000000)
    // ISO string in ended_at
    const isoStr = '2026-09-01T10:00:00.000Z'
    const parsedIso = Date.parse(isoStr)
    assert.equal(getMatchTimestamp({ ended_at: isoStr }), parsedIso)
    // playedAt
    assert.equal(getMatchTimestamp({ playedAt: '2026-08-15T08:00:00.000Z' }), Date.parse('2026-08-15T08:00:00.000Z'))
    // Fallback session date
    const db = { sessions: [{ id: 's1', date: '2026-08-01' }] }
    assert.equal(getMatchTimestamp({ sessionId: 's1' }, db), Date.parse('2026-08-01'))
  })

  await t.test('2. getMemberStreak correctly handles broken streak vs historical maxStreak', () => {
    const db = {
      matches: [
        // 4 trận thắng liên tiếp trong quá khứ (từ 1/9 đến 4/9)
        { id: 'm1', at: Date.parse('2026-09-01T08:00:00Z'), teamA: ['userA'], teamB: ['userB'], winnerTeam: 'A' },
        { id: 'm2', at: Date.parse('2026-09-02T08:00:00Z'), teamA: ['userA'], teamB: ['userC'], winnerTeam: 'A' },
        { id: 'm3', at: Date.parse('2026-09-03T08:00:00Z'), teamA: ['userA'], teamB: ['userD'], winnerTeam: 'A' },
        { id: 'm4', at: Date.parse('2026-09-04T08:00:00Z'), teamA: ['userA'], teamB: ['userE'], winnerTeam: 'A' },
        // Trận thứ 5 bị THUA -> Chuỗi thắng hiện tại bị cắt đứt về 0!
        { id: 'm5', at: Date.parse('2026-09-05T08:00:00Z'), teamA: ['userA'], teamB: ['userF'], winnerTeam: 'B' },
      ],
    }

    const { streak, maxStreak } = getMemberStreak('userA', db)
    assert.equal(streak, 0, 'Chuỗi thắng hiện tại phải bị đứt về 0 sau khi thua trận mới nhất')
    assert.equal(maxStreak, 4, 'Chuỗi thắng kỷ lục trong quá khứ đạt mốc 4')
  })

  await t.test('3. calculateMemberBadges does not count broken streak as active progress', () => {
    const db = {
      members: [{ id: 'userA', name: 'Thợ săn A' }],
      matches: [
        { id: 'm1', at: Date.parse('2026-09-01T08:00:00Z'), teamA: ['userA'], teamB: ['userB'], winnerTeam: 'A' },
        { id: 'm2', at: Date.parse('2026-09-02T08:00:00Z'), teamA: ['userA'], teamB: ['userC'], winnerTeam: 'A' },
        { id: 'm3', at: Date.parse('2026-09-03T08:00:00Z'), teamA: ['userA'], teamB: ['userD'], winnerTeam: 'A' },
        { id: 'm4', at: Date.parse('2026-09-04T08:00:00Z'), teamA: ['userA'], teamB: ['userE'], winnerTeam: 'A' },
        // Thua trận 5 -> chuỗi hiện tại = 0
        { id: 'm5', at: Date.parse('2026-09-05T08:00:00Z'), teamA: ['userA'], teamB: ['userF'], winnerTeam: 'B' },
      ],
    }

    const res = calculateMemberBadges('userA', db)
    const badge5 = res.all.find((b) => b.id === 'bat_bai_v') // threshold = 5

    assert.ok(badge5, 'Huy hiệu 5 trận thắng tồn tại trong all badges')
    assert.equal(badge5.unlocked, false, 'Chưa mở khóa danh hiệu 5 trận thắng')
    assert.equal(badge5.currentVal, 0, 'Tiến độ hiện tại phải là 0 vì chuỗi đã bị cắt, không được lấy số 4 trong quá khứ')
    assert.equal(badge5.pct, 0, 'Phần trăm tiến độ là 0%')
    assert.ok(res.locked.some((b) => b.id === 'bat_bai_v'), 'Huy hiệu có tiến độ 0 nằm trong locked, không được nằm trong inProgress')
    assert.equal(res.inProgress.some((b) => b.id === 'bat_bai_v'), false, 'Không được nằm trong inProgress khi tiến độ = 0')
  })

  await t.test('4. getBadgeChasers only includes members with ACTIVE current streak (> 0)', () => {
    const db = {
      members: [
        { id: 'userBroken', name: 'Người Bị Cắt Chuỗi' },
        { id: 'userActive', name: 'Người Đang Thắng' },
        { id: 'userZero', name: 'Người Chưa Thắng' },
      ],
      matches: [
        // userBroken: 4 trận thắng rồi 1 trận thua
        { id: 'mb1', at: 100, teamA: ['userBroken'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'mb2', at: 200, teamA: ['userBroken'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'mb3', at: 300, teamA: ['userBroken'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'mb4', at: 400, teamA: ['userBroken'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'mb5', at: 500, teamA: ['userBroken'], teamB: ['x'], winnerTeam: 'B' }, // Thua!

        // userActive: 3 trận thắng liên tiếp ĐANG CHẠY
        { id: 'ma1', at: 100, teamA: ['userActive'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'ma2', at: 200, teamA: ['userActive'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'ma3', at: 300, teamA: ['userActive'], teamB: ['x'], winnerTeam: 'A' },

        // userZero: 1 trận thua
        { id: 'mz1', at: 100, teamA: ['userZero'], teamB: ['x'], winnerTeam: 'B' },
      ],
    }

    const chasers = getBadgeChasers('bat_bai_v', 'me', db) // Huy hiệu chuỗi 5 trận thắng

    // Người bị cắt chuỗi tuyệt đối KHÔNG được xuất hiện
    const foundBroken = chasers.find((c) => c.id === 'userBroken')
    assert.equal(foundBroken, undefined, 'Người đã bị cắt chuỗi về 0 không được phép xuất hiện trong danh sách Ai đang đuổi')

    // Người chưa thắng trận nào cũng KHÔNG được xuất hiện
    const foundZero = chasers.find((c) => c.id === 'userZero')
    assert.equal(foundZero, undefined, 'Người có tiến độ 0 không được phép xuất hiện trong danh sách Ai đang đuổi')

    // Chỉ có người đang có chuỗi thắng thực tế xuất hiện
    assert.equal(chasers.length, 1, 'Chỉ có đúng 1 người đang đuổi thực tế')
    assert.equal(chasers[0].id, 'userActive')
    assert.equal(chasers[0].val, '3')
    assert.equal(chasers[0].pct, 60)
    assert.equal(chasers[0].rank, 1)
  })

  await t.test('5. Historical unlocked badge remains unlocked even after a loss', () => {
    const db = {
      members: [{ id: 'userLegend', name: 'Chiến Binh' }],
      matches: [
        // Đạt đủ 5 trận thắng liên tiếp
        { id: 'm1', at: 100, teamA: ['userLegend'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'm2', at: 200, teamA: ['userLegend'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'm3', at: 300, teamA: ['userLegend'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'm4', at: 400, teamA: ['userLegend'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'm5', at: 500, teamA: ['userLegend'], teamB: ['x'], winnerTeam: 'A' },
        // Trận thứ 6 bị thua
        { id: 'm6', at: 600, teamA: ['userLegend'], teamB: ['x'], winnerTeam: 'B' },
      ],
    }

    const res = calculateMemberBadges('userLegend', db)
    const badge5 = res.unlocked.find((b) => b.id === 'bat_bai_v')

    assert.ok(badge5, 'Huy hiệu 5 trận thắng đã mở khóa vẫn nằm trong unlocked vĩnh viễn')
    assert.equal(badge5.unlocked, true)
    assert.equal(badge5.currentVal, 5)
  await t.test('6. Matches with identical timestamp maintain insertion order (last match wins/losses correctly)', () => {
    const db = {
      matches: [
        // 3 trận cùng timestamp (ví dụ cùng 1 buổi s1)
        { id: 'm1', at: 1000, sessionId: 's1', teamA: ['userA'], teamB: ['x'], winnerTeam: 'A' },
        { id: 'm2', at: 1000, sessionId: 's1', teamA: ['userA'], teamB: ['x'], winnerTeam: 'A' },
        // Trận thứ 3 ghi sau cùng là THUA
        { id: 'm3', at: 1000, sessionId: 's1', teamA: ['userA'], teamB: ['x'], winnerTeam: 'B' },
      ],
    }

    const { streak, maxStreak } = getMemberStreak('userA', db)
    assert.equal(streak, 0, 'Trận cuối cùng ghi nhận là Thua nên chuỗi hiện tại phải bằng 0')
    assert.equal(maxStreak, 2, 'Kỷ lục trước đó trong buổi đạt 2 trận thắng')
  })
})

