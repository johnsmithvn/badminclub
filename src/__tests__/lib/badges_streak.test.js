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
  getActiveBounties,
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
    const badge5 = res.all.find((b) => b.id === 'bat_bai_5') // threshold = 5

    assert.ok(badge5, 'Huy hiệu 5 trận thắng tồn tại trong all badges')
    assert.equal(badge5.unlocked, false, 'Chưa mở khóa danh hiệu 5 trận thắng')
    assert.equal(badge5.currentVal, 0, 'Tiến độ hiện tại phải là 0 vì chuỗi đã bị cắt, không được lấy số 4 trong quá khứ')
    assert.equal(badge5.pct, 0, 'Phần trăm tiến độ là 0%')
    assert.ok(res.locked.some((b) => b.id === 'bat_bai_5'), 'Huy hiệu có tiến độ 0 nằm trong locked, không được nằm trong inProgress')
    assert.equal(res.inProgress.some((b) => b.id === 'bat_bai_5'), false, 'Không được nằm trong inProgress khi tiến độ = 0')
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

    const chasers = getBadgeChasers('bat_bai_5', 'me', db) // Huy hiệu chuỗi 5 trận thắng

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
    const badge5 = res.unlocked.find((b) => b.id === 'bat_bai_5')

    assert.ok(badge5, 'Huy hiệu 5 trận thắng đã mở khóa vẫn nằm trong unlocked vĩnh viễn')
    assert.equal(badge5.unlocked, true)
    assert.equal(badge5.currentVal, 5)
    assert.equal(badge5.pct, 100)
  })

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

  await t.test('Chuỗi thắng gom theo KÈO — khớp với cách điểm mùa đếm', () => {
    // Một kèo BO3 thắng 2-0 rồi một trận thường thắng.
    // Đếm theo set thì ra chuỗi 3; đếm theo kèo thì ra 2. Điểm mùa
    // (`calculateSeasonLeaderboard`) đếm theo kèo, nên chỗ này phải ra CÙNG con số — trước đây
    // hai bên lệch nhau và cùng một người mang hai số chuỗi khác nhau.
    const db = {
      matches: [
        { id: 'k1s1', challengeId: 'k1', at: Date.parse('2026-09-01T08:00:00Z'), teamA: ['userA'], teamB: ['userB'], winnerTeam: 'A' },
        { id: 'k1s2', challengeId: 'k1', at: Date.parse('2026-09-01T08:30:00Z'), teamA: ['userA'], teamB: ['userB'], winnerTeam: 'A' },
        { id: 'm3', at: Date.parse('2026-09-01T09:00:00Z'), teamA: ['userA'], teamB: ['userC'], winnerTeam: 'A' },
      ],
    }
    const { streak, maxStreak, streakMatches } = getMemberStreak('userA', db)
    assert.equal(streak, 2, 'Kèo BO3 thắng 2-0 + 1 trận thường = chuỗi 2, không phải 3')
    assert.equal(maxStreak, 2, 'Kỷ lục cũng đếm theo kèo')
    assert.equal(streakMatches.length, 3, 'Nhưng chuỗi đó vẫn gồm đủ 3 TRẬN thật')

    // Thua chuỗi kèo thì chuỗi cắt, dù thắng set lẻ bên trong
    const db2 = {
      matches: [
        { id: 'm0', at: Date.parse('2026-09-01T07:00:00Z'), teamA: ['userA'], teamB: ['userC'], winnerTeam: 'A' },
        { id: 'k2s1', challengeId: 'k2', at: Date.parse('2026-09-01T08:00:00Z'), teamA: ['userA'], teamB: ['userB'], winnerTeam: 'A' },
        { id: 'k2s2', challengeId: 'k2', at: Date.parse('2026-09-01T08:30:00Z'), teamA: ['userA'], teamB: ['userB'], winnerTeam: 'B' },
        { id: 'k2s3', challengeId: 'k2', at: Date.parse('2026-09-01T09:00:00Z'), teamA: ['userA'], teamB: ['userB'], winnerTeam: 'B' },
      ],
    }
    assert.equal(getMemberStreak('userA', db2).streak, 0, 'Thua kèo 1-2 -> chuỗi về 0, set thắng lẻ không cứu')
  })

  await t.test('getActiveBounties đếm đủ TRẬN THẬT trong chuỗi có kèo', () => {
    // Từ khi kèo đếm gộp, `streak` là số ĐƠN VỊ chứ không còn là số trận. Code cũ cắt
    // `matches.slice(0, streak)` để đếm đối thủ và tìm ngày mở chuỗi — với chuỗi có kèo BO3 thì
    // cắt hụt mất trận, làm `tries` thiếu và `streakDate` chỉ vào trận mới hơn thực tế.
    //
    // Chuỗi dựng ở đây: 1 kèo BO3 thắng 2-0 (2 trận) + 4 trận thường thắng = 5 ĐƠN VỊ, 6 TRẬN.
    const day = (d) => Date.parse(`2026-09-${String(d).padStart(2, '0')}T08:00:00Z`)
    const db = {
      members: [{ id: 'u1', name: 'Người Đang Cháy' }],
      matches: [
        { id: 'k1s1', challengeId: 'k1', at: day(1), teamA: ['u1'], teamB: ['x1'], winnerTeam: 'A' },
        { id: 'k1s2', challengeId: 'k1', at: day(2), teamA: ['u1'], teamB: ['x1'], winnerTeam: 'A' },
        { id: 'm1', at: day(3), teamA: ['u1'], teamB: ['x2'], winnerTeam: 'A' },
        { id: 'm2', at: day(4), teamA: ['u1'], teamB: ['x3'], winnerTeam: 'A' },
        { id: 'm3', at: day(5), teamA: ['u1'], teamB: ['x4'], winnerTeam: 'A' },
        { id: 'm4', at: day(6), teamA: ['u1'], teamB: ['x5'], winnerTeam: 'A' },
      ],
    }

    assert.equal(getMemberStreak('u1', db).streak, 5, 'Kèo BO3 + 4 trận thường = 5 đơn vị chuỗi')
    assert.equal(getMemberStreak('u1', db).streakMatches.length, 6, 'Nhưng gồm 6 trận thật')

    const bounties = getActiveBounties(db).filter((b) => b.type === 'single')
    assert.equal(bounties.length, 1, 'Chạm mốc 5 thì bị treo thưởng')
    assert.equal(bounties[0].streak, 5, 'Chuỗi hiển thị theo ĐƠN VỊ')
    assert.equal(
      bounties[0].tries,
      6,
      'Nhưng số đối thủ đã cố hạ phải đếm đủ 6 TRẬN — slice(0, streak) cũ chỉ ra 5',
    )
    assert.equal(bounties[0].streakDate, '01/09', 'Ngày mở chuỗi là set ĐẦU của kèo, không phải trận sau đó')
  })
})

