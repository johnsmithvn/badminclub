import test from 'node:test'
import assert from 'node:assert/strict'

import { titleOfLevel, calculateMemberXp, getMemberXpLedger, getMemberAchievements, getSeasonBountyPlayer } from '../../lib/xp.js'

test('XP & Contributions Engine Test Suite', async (t) => {
  await t.test('1. titleOfLevel maps correct friendly tiers without game cliches', () => {
    assert.equal(titleOfLevel(1), 'Tân thủ')
    assert.equal(titleOfLevel(5), 'Tập sự')
    assert.equal(titleOfLevel(10), 'Quen sân')
    assert.equal(titleOfLevel(15), 'Thực chiến')
    assert.equal(titleOfLevel(20), 'Hảo thủ')
    assert.equal(titleOfLevel(30), 'Cao thủ')
  })

  await t.test('2. calculateMemberXp correctly aggregates session, match, 3-sets, and upset bonuses', () => {
    const mockDb = {
      members: [{ id: 'm1', name: 'Minh' }],
      sessions: [
        { id: 's1', attendees: ['m1'] },
        { id: 's2', attendees: ['m1'] },
      ],
      matches: [
        // Match 1: Won in 2 sets, normal win (+10)
        { id: 'mt1', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', sets: [[21, 15], [21, 18]], initialRatingA: 1300, initialRatingB: 1200 },
        // Match 2: Won in 3 sets, upset win (+10 + 20 + 30 = +60)
        { id: 'mt2', teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A', sets: [[21, 19], [18, 21], [22, 20]], initialRatingA: 1300, initialRatingB: 1500 },
        // Match 3: Lost in 2 sets (+10)
        { id: 'mt3', teamA: ['m1'], teamB: ['m4'], winnerTeam: 'B', sets: [[15, 21], [18, 21]], initialRatingA: 1300, initialRatingB: 1400 },
      ],
    }

    const xpData = calculateMemberXp('m1', mockDb)
    // Sessions: 2 * 50 = 100 XP
    // Matches:
    //   mt1: 10
    //   mt2: 10 + 20 + 30 = 60
    //   mt3: 10
    // Total match XP: 80
    // Total XP: 180
    assert.equal(xpData.totalXp, 180)
    assert.equal(xpData.level, 1) // 180 / 600 + 1 = 1
    assert.equal(xpData.title, 'Tân thủ')
    assert.equal(xpData.levelProgressPct, Math.round((180 / 600) * 100))
    assert.equal(xpData.matchCount, 3)
    assert.equal(xpData.sessionCount, 2)
  })

  await t.test('3. getMemberXpLedger produces transparent audit lines', () => {
    const mockDb = {
      matches: [
        {
          id: 'mt1',
          code: 'M-0184',
          createdAt: '2026-09-03T21:04:00Z',
          teamA: ['m1'],
          teamB: ['m2'],
          winnerTeam: 'A',
          sets: [[21, 18], [19, 21], [21, 19]],
          initialRatingA: 1200,
          initialRatingB: 1400,
        },
      ],
    }

    const ledger = getMemberXpLedger('m1', mockDb)
    assert.ok(ledger.length >= 3)
    const titles = ledger.map((l) => l.titleKey)
    assert.ok(titles.includes('xpPlayedMatch'))
    assert.ok(titles.includes('xpThreeSets'))
    assert.ok(titles.includes('xpBeatStronger'))
  })

  await t.test('4. getMemberAchievements computes 4 progress milestones', () => {
    const mockDb = {
      matches: Array.from({ length: 105 }, (_, i) => ({
        id: `mt_${i}`,
        createdAt: new Date(1700000000000 + i * 1000).toISOString(),
        teamA: ['m1'],
        teamB: ['m2'],
        winnerTeam: i < 6 ? 'A' : 'B', // 6 consecutive wins
      })),
    }

    const achieves = getMemberAchievements('m1', mockDb)
    assert.equal(achieves.length, 4)
    assert.equal(achieves[0].achieved, true) // >= 100 matches
    assert.equal(achieves[1].achieved, true) // >= 5 streak
    assert.equal(achieves[2].achieved, false) // 6/10
    assert.equal(achieves[3].achieved, false) // 105/200
  })

  await t.test('5. getSeasonBountyPlayer identifies active winning streak', () => {
    const mockDb = {
      members: [
        { id: 'm1', name: 'Minh' },
        { id: 'm2', name: 'Hùng' },
      ],
      matches: [
        { id: 'mt1', createdAt: '2026-09-03', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
        { id: 'mt2', createdAt: '2026-09-02', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
        { id: 'mt3', createdAt: '2026-09-01', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
        { id: 'mt4', createdAt: '2026-08-31', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      ],
    }

    const bounty = getSeasonBountyPlayer(mockDb)
    assert.ok(bounty)
    assert.equal(bounty.member.id, 'm1')
    assert.equal(bounty.streak, 4)
  })
})

/* ==========================================================================
 * Trận lấy từ Supabase KHÔNG có `createdAt` / `playedAt` — dbmap chỉ map
 * `matches.ended_at` -> `at` (dbmap.js:141). Mọi chỗ sort/format theo createdAt
 * đều là lệnh rỗng và âm thầm trả kết quả sai. Nhóm test này khoá lại mốc `at`.
 * ========================================================================== */
test('XP Engine — Mốc thời gian trận phải đọc từ `at`', async (t) => {
  const mk = (id, at, winner) => ({
    id, at, sessionId: 's1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'],
    winnerTeam: winner, sets: [[21, 15]], initialRatingA: 500, initialRatingB: 500,
  })
  // dbmap luôn trả db.matches theo thứ tự TĂNG DẦN của `at` (dbmap.js:176)
  const db = {
    members: [{ id: 'm1', name: 'Kiên' }, { id: 'm2', name: 'B' }, { id: 'm3', name: 'C' }, { id: 'm4', name: 'D' }],
    sessions: [{ id: 's1', date: '2026-07-05' }],
    matches: [
      mk('t1', 1000, 'A'), mk('t2', 2000, 'A'), mk('t3', 3000, 'A'), mk('t4', 4000, 'A'),
      mk('t5', 5000, 'B'), mk('t6', 6000, 'B'), mk('t7', 7000, 'B'),
    ],
  }

  await t.test('A. getSeasonBountyPlayer đếm chuỗi thắng ĐANG chạy, không phải chuỗi cũ nhất', () => {
    // m1 thắng 4 trận đầu rồi THUA 3 trận gần nhất -> không còn chuỗi.
    // m3 thắng 3 trận gần nhất -> đây mới là người đáng treo thưởng.
    const bounty = getSeasonBountyPlayer(db)
    assert.ok(bounty, 'Phải tìm ra người đang có chuỗi >= 3')
    assert.equal(bounty.member.id, 'm3', 'Treo thưởng nhầm người đang thua 3 trận liền là mất uy tín giải')
    assert.equal(bounty.streak, 3)
  })

  await t.test('B. getMemberXpLedger trả 8 dòng MỚI NHẤT, không phải 8 dòng cũ nhất', () => {
    const ledger = getMemberXpLedger('m1', db)
    assert.ok(ledger.length > 0)
    assert.ok(
      ledger[0].id.startsWith('t7'),
      'Dòng đầu phải là trận mới nhất (t7); sort theo createdAt rỗng sẽ trả t1'
    )
    // date phải là số epoch để so sánh được, và giảm dần
    for (let i = 1; i < ledger.length; i++) {
      assert.ok(ledger[i - 1].date >= ledger[i].date, 'Sổ XP phải giảm dần theo thời gian')
    }
    assert.ok(ledger[0].source.includes('1970-01-01'), 'Ngày trong dòng sổ phải suy từ `at`, không để trống')
  })

  await t.test('C. getMemberAchievements dò chuỗi dài nhất theo đúng trục thời gian', () => {
    // Theo trục `at`: W W L W W  -> chuỗi dài nhất = 2.
    // Nhưng mảng truyền vào bị xáo, trận thua nằm CUỐI: W W W W L -> nếu không sort
    // theo `at` thì ra chuỗi 4, thổi phồng thành tựu. (Đảo ngược mảng không bắt được
    // lỗi này vì phép đảo giữ nguyên độ dài mọi chuỗi — phải xáo thật.)
    const scrambled = {
      ...db,
      matches: [
        mk('s1_w', 1000, 'A'), mk('s2_w', 2000, 'A'),
        mk('s4_w', 4000, 'A'), mk('s5_w', 5000, 'A'),
        mk('s3_l', 3000, 'B'),
      ],
    }
    const streak5 = getMemberAchievements('m1', scrambled).find((x) => x.id === 'streak_5')
    assert.equal(streak5.progressText, '2/5', 'Chuỗi dài nhất theo thời gian thật là 2, không phải 4')
  })
})
