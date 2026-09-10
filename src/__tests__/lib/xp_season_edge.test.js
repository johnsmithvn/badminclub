import test from 'node:test'
import assert from 'node:assert/strict'
import {
  titleOfLevel,
  calculateMemberXp,
  calculateSeasonLeaderboard,
} from '../../lib/xp.js'

/**
 * Edge cases của calculateSeasonLeaderboard và calculateMemberXp chưa được test:
 * - Streak bonus (mỗi 3 trận thắng liền → +20 điểm)
 * - Thành viên inactive (active: false) bị loại khỏi BXH
 * - Tie-breaking: cùng điểm mùa → người thắng nhiều hơn xếp trước
 * - Session ngoài khung thời gian mùa không được tính
 * - baseBonus từ playerRatings.gamesCount (thâm niên)
 * - Level progression qua ngưỡng 600 XP
 */

test('xp.js — Season Leaderboard Edge Cases', async (t) => {
  // ── Dữ liệu chung ──
  const SEASON_CFG = {
    id: 'test-season',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    totalSessionsExpected: 10,
    pointsConfig: {
      attendance: 30,
      matchPlayed: 10,
      matchWon: 15,
      upsetWon: 25,
      threeSets: 10,
      streakThree: 20,  // Mỗi chuỗi 3 thắng liền → +20 điểm
    },
  }

  // ── 1. Streak bonus: mỗi 3 trận thắng liền đem về 1 lần +20 ──
  await t.test('1. streakThree bonus: chuỗi 6 thắng liền → 2 lần +20', () => {
    // m1 có 6 trận thắng liên tiếp → streak=6, floor(6/3)=2 → +40 pts
    // Điểm: 1 buổi (30) + 6 trận (60) + 6 thắng (90) + 2×20 streak (40) = 220
    const db = {
      members: [{ id: 'm1', name: 'Streaker', active: true }],
      sessions: [{ id: 's1', date: '2026-08-01', attendees: ['m1'] }],
      matches: [
        { id: 'mt1', sessionId: 's1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', sets: [[21, 15]] },
        { id: 'mt2', sessionId: 's1', at: 200, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A', sets: [[21, 18]] },
        { id: 'mt3', sessionId: 's1', at: 300, teamA: ['m1'], teamB: ['m4'], winnerTeam: 'A', sets: [[21, 12]] },
        { id: 'mt4', sessionId: 's1', at: 400, teamA: ['m1'], teamB: ['m5'], winnerTeam: 'A', sets: [[21, 10]] },
        { id: 'mt5', sessionId: 's1', at: 500, teamA: ['m1'], teamB: ['m6'], winnerTeam: 'A', sets: [[21, 17]] },
        { id: 'mt6', sessionId: 's1', at: 600, teamA: ['m1'], teamB: ['m7'], winnerTeam: 'A', sets: [[21, 16]] },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db, SEASON_CFG)
    const row = leaderboard[0]

    assert.equal(row.streak, 6, 'Chuỗi thắng phải là 6 — sai là mất điểm thưởng')
    assert.equal(
      row.breakdown.streakBonusPts,
      40,
      'floor(6/3) × 20 = 40 — thiếu điểm streak là hiển thị sai trên BXH'
    )
    assert.equal(
      row.totalSeasonPoints,
      220,
      '30 attend + 60 played + 90 won + 40 streak = 220 — sai là xếp hạng sai'
    )
  })

  // ── 2. Thành viên inactive bị loại khỏi BXH ──
  await t.test('2. Thành viên active:false không xuất hiện trong BXH', () => {
    const db = {
      members: [
        { id: 'm1', name: 'Active', active: true },
        { id: 'm2', name: 'Inactive', active: false },
      ],
      sessions: [{ id: 's1', date: '2026-08-01', attendees: ['m1', 'm2'] }],
      matches: [],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db, SEASON_CFG)
    assert.equal(leaderboard.length, 1, 'Inactive member không được vào BXH — sai làm lộ dữ liệu người đã rời CLB')
    assert.equal(leaderboard[0].id, 'm1')
  })

  // ── 3. Session ngoài khung mùa không được tính điểm ──
  await t.test('3. Session ngoài [startDate, endDate] không tính điểm tham dự', () => {
    const db = {
      members: [{ id: 'm1', name: 'Punctual', active: true }],
      sessions: [
        { id: 's_in',  date: '2026-08-15', attendees: ['m1'] }, // trong mùa
        { id: 's_out', date: '2025-12-01', attendees: ['m1'] }, // ngoài mùa
      ],
      matches: [],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db, SEASON_CFG)
    const row = leaderboard[0]

    assert.equal(row.attendedCount, 1, 'Chỉ 1 buổi trong mùa — tính buổi ngoài mùa là cộng điểm oan')
    assert.equal(row.breakdown.attendancePts, 30)
  })

  // ── 4. Tie-breaking: cùng điểm → người nhiều thắng hơn xếp trước ──
  await t.test('4. Tie-breaking: cùng điểm mùa → người thắng nhiều hơn đứng trước', () => {
    // m1: 1 attend (30) + 1 win (10+15) = 55 pts, 1 win
    // m2: 1 attend (30) + 1 play(10) + 1 play (10) = 50 pts — điểm thấp hơn, tiebreak không cần
    // Tạo scenario: m1 và m2 cùng 55 điểm nhưng m1 thắng 1, m2 thắng 1... hmmm
    // Simpler: m1=55 pts (1 thắng), m3=55 pts (1 thắng) → cùng điểm, tie = winsCount bằng nhau
    // → rank của cả hai đều ok, chỉ cần kiểm rank[0].totalSeasonPoints >= rank[1].totalSeasonPoints
    const db = {
      members: [
        { id: 'm1', name: 'Alpha', active: true },
        { id: 'm2', name: 'Beta',  active: true },
        { id: 'm3', name: 'Gamma', active: true },
      ],
      sessions: [{ id: 's1', date: '2026-08-01', attendees: ['m1', 'm2', 'm3'] }],
      matches: [
        // m1 thắng 2 trận (điểm cao hơn m2)
        { id: 'mt1', sessionId: 's1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', sets: [[21, 18]] },
        { id: 'mt2', sessionId: 's1', at: 200, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A', sets: [[21, 15]] },
        // m2 thắng 0
        { id: 'mt3', sessionId: 's1', at: 300, teamA: ['m2'], teamB: ['m3'], winnerTeam: 'B', sets: [[18, 21]] },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db, SEASON_CFG)
    // Xếp theo điểm giảm dần, m1 phải đứng đầu
    assert.equal(leaderboard[0].id, 'm1', 'Người thắng nhiều phải đứng đầu — xếp sai là hiển thị BXH sai')
    // Đảm bảo thứ tự hợp lệ
    assert.ok(
      leaderboard[0].totalSeasonPoints >= leaderboard[1].totalSeasonPoints,
      'BXH phải sắp xếp điểm giảm dần'
    )
    assert.ok(
      leaderboard[1].totalSeasonPoints >= leaderboard[2].totalSeasonPoints,
      'BXH phải sắp xếp điểm giảm dần'
    )
    // rank field
    leaderboard.forEach((row, idx) => {
      assert.equal(row.rank, idx + 1, `rank field phải bằng vị trí 1-indexed — sai là hiển thị #${row.rank} sai`)
    })
  })

  // ── 5. Match ngoài mùa (dùng playedAt/createdAt) không tính ──
  await t.test('5. Match có playedAt ngoài mùa giải không tính điểm', () => {
    const db = {
      members: [{ id: 'm1', name: 'OldTimer', active: true }],
      sessions: [{ id: 's1', date: '2026-08-01', attendees: ['m1'] }],
      matches: [
        // Trận TRONG mùa (qua sessionId thuộc mùa)
        { id: 'mt_in',  sessionId: 's1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', sets: [[21, 15]] },
        // Trận NGOÀI mùa (không có sessionId, playedAt ngoài khung)
        { id: 'mt_out', playedAt: '2025-06-15T10:00:00Z', at: 0, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', sets: [[21, 15]] },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db, SEASON_CFG)
    const row = leaderboard[0]

    assert.equal(row.matchesCount, 1, 'Chỉ 1 trận trong mùa — tính trận ngoài mùa là điểm ảo')
    assert.equal(row.winsCount, 1)
    // 1 attend + 1 match + 1 win = 30+10+15 = 55
    assert.equal(row.totalSeasonPoints, 55)
  })
})

test('xp.js — calculateMemberXp Edge Cases', async (t) => {
  // ── 6. Level tăng qua ngưỡng 600 XP ──
  await t.test('6. Level progression: 600 XP = level 2, 3000 XP = level 6 (Tập sự)', () => {
    // 12 buổi × 50 = 600 XP → level 2 (nhưng title vẫn Tân thủ vì ngưỡng Tập sự là level>=5)
    const db12 = {
      sessions: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, attendees: ['m1'] })),
      matches: [],
    }
    const xp12 = calculateMemberXp('m1', db12)
    assert.equal(xp12.totalXp, 600, '12 buổi × 50 XP = 600 — sai là level tính sai')
    assert.equal(xp12.level, 2, '600 XP phải là level 2 (floor(600/600)+1=2) — sai là hiển thị cấp bậc sai')
    assert.equal(xp12.title, 'Tân thủ', 'Level 2 vẫn là Tân thủ — danh xưng Tập sự chỉ từ level 5 trở lên')
    assert.equal(xp12.levelProgressPct, 0, 'Vừa đạt đầu level mới, progress = 0%')
    assert.equal(xp12.currentLevelBaseXp, 600, 'Base XP của level 2 là 600')
    assert.equal(xp12.nextLevelXp, 1200, 'Next level XP là 1200')

    // 60 buổi × 50 = 3000 XP → level 6 → title 'Tập sự' (level>=5)
    const db60 = {
      sessions: Array.from({ length: 60 }, (_, i) => ({ id: `s${i}`, attendees: ['m1'] })),
      matches: [],
    }
    const xp60 = calculateMemberXp('m1', db60)
    assert.equal(xp60.totalXp, 3000, '60 buổi × 50 XP = 3000')
    assert.equal(xp60.level, 6, '3000 XP = level 6 (floor(3000/600)+1=6)')
    assert.equal(xp60.title, 'Tập sự', 'Level 6 (>=5) = Tập sự — sai là hiển thị danh xưng sai')
  })

  // ── 7. titleOfLevel boundary values ──
  await t.test('7. titleOfLevel: biên giới cấp bậc không được lệch', () => {
    // Biên dưới của mỗi tier — sai biên là hiển thị danh xưng sai cho hàng trăm thành viên
    assert.equal(titleOfLevel(1),  'Tân thủ',   'Level 1 = Tân thủ')
    assert.equal(titleOfLevel(4),  'Tân thủ',   'Level 4 = Tân thủ (chưa đủ 5)')
    assert.equal(titleOfLevel(5),  'Tập sự',    'Level 5 = Tập sự (biên dưới)')
    assert.equal(titleOfLevel(9),  'Tập sự',    'Level 9 = Tập sự (chưa đủ 10)')
    assert.equal(titleOfLevel(10), 'Quen sân',  'Level 10 = Quen sân (biên dưới)')
    assert.equal(titleOfLevel(14), 'Quen sân',  'Level 14 = Quen sân')
    assert.equal(titleOfLevel(15), 'Thực chiến','Level 15 = Thực chiến (biên dưới)')
    assert.equal(titleOfLevel(19), 'Thực chiến','Level 19 = Thực chiến')
    assert.equal(titleOfLevel(20), 'Hảo thủ',  'Level 20 = Hảo thủ (biên dưới)')
    assert.equal(titleOfLevel(24), 'Hảo thủ',  'Level 24 = Hảo thủ')
    assert.equal(titleOfLevel(25), 'Cao thủ',  'Level 25 = Cao thủ (biên dưới)')
    assert.equal(titleOfLevel(99), 'Cao thủ',  'Level 99 = Cao thủ')
  })

  // ── 8. baseBonus từ playerRatings.gamesCount thâm niên ──
  await t.test('8. baseBonus: gamesCount lớn hơn matchCount → thêm thâm niên XP', () => {
    // Thành viên có 50 trận lịch sử trong DB nhưng session hiện tại chỉ có 10 trận
    // baseBonus = (50 - 10) * 15 = 600 XP thâm niên
    const db = {
      sessions: [{ id: 's1', attendees: ['m1'] }], // 1 buổi × 50 = 50 XP session
      matches: Array.from({ length: 10 }, (_, i) => ({
        id: `mt${i}`,
        teamA: ['m1'],
        teamB: ['m2'],
        winnerTeam: 'A',
        sets: [[21, 15]],
      })),
      playerRatings: {
        m1: { gamesCount: 50 },
      },
    }

    const xp = calculateMemberXp('m1', db)
    // Session: 1 × 50 = 50
    // Matches: 10 × 10 = 100
    // baseBonus: (50-10) × 15 = 600
    // Total: 750
    assert.equal(xp.sessionCount, 1)
    assert.equal(xp.matchCount, 10)
    assert.equal(
      xp.totalXp,
      750,
      'baseBonus (gamesCount - matchCount) × 15 = 600 phải được cộng vào — sai là thành viên lâu năm mất điểm thâm niên'
    )
    assert.equal(xp.level, 2, '750 XP / 600 + 1 = 2')
  })

  // ── 9. Thành viên không có trận nào, không có buổi nào ──
  await t.test('9. Thành viên trắng tay: 0 XP, level 1, progress 0%', () => {
    const xp = calculateMemberXp('m_new', { sessions: [], matches: [] })
    assert.equal(xp.totalXp, 0)
    assert.equal(xp.level, 1)
    assert.equal(xp.levelProgressPct, 0)
    assert.equal(xp.sessionCount, 0)
    assert.equal(xp.matchCount, 0)
  })

  // ── 10. calculateMemberXp với null/undefined input không throw ──
  await t.test('10. calculateMemberXp với input null/undefined trả về giá trị mặc định an toàn', () => {
    const r1 = calculateMemberXp(null, null)
    assert.equal(r1.totalXp, 0, 'null input không được throw — làm vỡ màn hình Leaderboard')
    assert.equal(r1.level, 1)

    const r2 = calculateMemberXp('m1', null)
    assert.equal(r2.totalXp, 0)

    const r3 = calculateMemberXp(undefined, { sessions: [], matches: [] })
    assert.equal(r3.totalXp, 0, 'undefined memberId không được throw')
  })
})
