import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcSeasonWeek,
  getClubEloLeaderboard,
  getRecentEloDelta,
  getMyHeroStats,
  getPlayerForm5,
  getRivalAnalysis,
  calcSeasonRaceHistory,
  getRecentPlayerMatches,
  getSurroundingStandings,
  getSurroundingSeasonStandings,
  getPersonalGreeting,
  getClubTodayHighlights,
  calcSessionAttendanceHistory,
} from '../../lib/homePersonal.js'
import { isFemalePlayer } from '../../lib/rating.js'

test('Home Personal Dashboard Logic Suite', async (t) => {
  const mockDb = {
    today: '2026-09-19',
    month: '2026-09',
    levels: ['Yếu', 'Trung bình', 'Khá'],
    members: [
      { id: 'm1', name: 'Minh', active: true, level: 'Khá' },
      { id: 'm2', name: 'Nam', active: true, level: 'Khá' },
      { id: 'm3', name: 'Linh', active: true, level: 'Trung bình' },
      { id: 'm4', name: 'Khoa', active: true, level: 'Khá' },
    ],
    playerRatings: {
      m4: { rating: 1341, displayRating: 1341, gamesCount: 20 },
      m2: { rating: 1326, displayRating: 1326, gamesCount: 18 },
      m1: { rating: 1284, displayRating: 1284, gamesCount: 18 },
      m3: { rating: 1251, displayRating: 1251, gamesCount: 14 },
    },
    matches: [
      {
        id: 'mt-1',
        at: Date.now() - 3600000,
        teamA: ['m1', 'm4'],
        teamB: ['m2', 'm3'],
        winnerTeam: 'A',
        eloDelta: 12,
        ratingEnabled: true,
        sets: [[21, 18]],
      },
      {
        id: 'mt-2',
        at: Date.now() - 86400000,
        teamA: ['m1'],
        teamB: ['m2'],
        winnerTeam: 'A',
        eloDelta: 12,
        ratingEnabled: true,
        sets: [[21, 19]],
      },
      {
        id: 'mt-3',
        at: Date.now() - 2 * 86400000,
        teamA: ['m1'],
        teamB: ['m3'],
        winnerTeam: 'B',
        eloDelta: 9,
        ratingEnabled: true,
        sets: [[17, 21]],
      },
    ],
    challenges: [],
    sessions: [],
    attendance: {},
  }

  await t.test('1. calcSeasonWeek computes week index correctly', () => {
    assert.equal(calcSeasonWeek('2026-07-01', '2026-07-03'), 1)
    assert.equal(calcSeasonWeek('2026-07-01', '2026-07-15'), 3)
    assert.equal(calcSeasonWeek('2026-07-01', '2026-08-12'), 7)
  })

  await t.test('2. getClubEloLeaderboard ranks members by Elo descending', () => {
    const list = getClubEloLeaderboard(mockDb)
    assert.equal(list.length, 4)
    assert.equal(list[0].name, 'Khoa')
    assert.equal(list[0].rank, 1)
    assert.equal(list[1].name, 'Nam')
    assert.equal(list[1].rank, 2)
    assert.equal(list[2].name, 'Minh')
    assert.equal(list[2].rank, 3)
    assert.equal(list[3].name, 'Linh')
    assert.equal(list[3].rank, 4)
  })

  await t.test('3. getMyHeroStats calculates rank, elo and gap to rival above', () => {
    const hero = getMyHeroStats(mockDb, 'm1')
    assert.equal(hero.rank, 3)
    assert.equal(hero.elo, 1284)
    assert.equal(hero.totalMembers, 4)
    assert.equal(hero.targetRival.name, 'Nam')
    assert.equal(hero.targetRival.rank, 2)
    assert.equal(hero.pointsToNextRank, 42) // 1326 - 1284 = 42
    assert.equal(hero.isLeader, false)
  })

  await t.test('4. getPlayerForm5 extracts outcome array and streak', () => {
    const form = getPlayerForm5(mockDb, 'm1')
    assert.equal(form.matches.length, 3)
    // Oldest is loss (B), then 2 wins (T, T)
    assert.equal(form.matches[0].label, 'B')
    assert.equal(form.matches[1].label, 'T')
    assert.equal(form.matches[2].label, 'T')
    assert.equal(form.winsCount, 2)
  })

  await t.test('5. getRivalAnalysis returns H2H and points gap', () => {
    const analysis = getRivalAnalysis(mockDb, 'm1', 'm2')
    assert.ok(analysis)
    assert.equal(analysis.rival.name, 'Nam')
    assert.equal(analysis.rival.gapPoints, 42)
    // 2 matches against Nam, both won by Minh
    assert.equal(analysis.rival.h2h.myWins, 2)
    assert.equal(analysis.rival.h2h.rivalWins, 0)
    assert.equal(analysis.chaser.name, 'Linh')
  })

  await t.test('6. calcSeasonRaceHistory generates svg coordinate points', () => {
    const race = calcSeasonRaceHistory(mockDb, 'm1', 'm2', 6)
    assert.equal(race.weeks, 6)
    assert.equal(race.currentElo, 1284)
    assert.ok(race.svgPointsMy.length > 0)
    assert.ok(race.svgPointsRival.length > 0)
  })

  await t.test('7. getRecentPlayerMatches formats matches list', () => {
    const recents = getRecentPlayerMatches(mockDb, 'm1', 2)
    assert.equal(recents.length, 2)
    assert.equal(recents[0].won, true)
    assert.equal(recents[0].score, '21-18')
    assert.ok(recents[0].eloChange.includes('+12'))
  })

  await t.test('8. getSurroundingStandings extracts window centered on user', () => {
    const surrounding = getSurroundingStandings(mockDb, 'm1', 3)
    assert.equal(surrounding.length, 3)
    const meRow = surrounding.find((x) => x.isMe)
    assert.ok(meRow)
    assert.equal(meRow.name, 'Minh')
  })

  await t.test('9. calcSeasonRaceHistory handles activeSeason with startDate correctly', () => {
    const dbWithSeason = {
      ...mockDb,
      settings: {
        season: {
          id: 's-2026',
          name: 'Mùa 2026',
          startDate: '2026-06-01',
        },
      },
    }
    const race = calcSeasonRaceHistory(dbWithSeason, 'm1', 'm2', 6)
    assert.equal(race.empty, false)
    assert.equal(race.weeks, 6)
    assert.equal(race.currentElo, 1284)
    assert.equal(typeof race.startElo, 'number')
    assert.equal(race.deltaElo, race.currentElo - race.startElo)

    // Toạ độ chấm mới nhất (latestMyX, latestMyY) phải trùng khớp 100% với điểm cuối của đường vẽ svgPointsMy
    const myPoints = race.svgPointsMy.split(' ')
    assert.equal(myPoints.length, 6)
    const lastPoint = myPoints[myPoints.length - 1]
    assert.equal(lastPoint, `${race.latestMyX},${race.latestMyY}`)

    // Kiểm tra mùa mới bắt đầu ngắn hơn 6 tuần (ví dụ bắt đầu 10 ngày trước: tuần 2)
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)
    const dbShortSeason = {
      ...mockDb,
      settings: {
        season: {
          id: 's-short',
          name: 'Mùa ngắn',
          startDate: tenDaysAgo,
        },
      },
    }
    const shortRace = calcSeasonRaceHistory(dbShortSeason, 'm1', 'm2', 6)
    assert.equal(shortRace.empty, false)
    assert.equal(shortRace.weeks, 2)
    const shortPoints = shortRace.svgPointsMy.split(' ')
    assert.equal(shortPoints.length, 2)
    const shortLastPoint = shortPoints[shortPoints.length - 1]
    assert.equal(shortLastPoint, `${shortRace.latestMyX},${shortRace.latestMyY}`)
  })

  await t.test('10. getSurroundingSeasonStandings and getMyHeroStats season rank', () => {
    const seasonStandings = getSurroundingSeasonStandings(mockDb, 'm1', 3)
    assert.ok(Array.isArray(seasonStandings))
    assert.ok(seasonStandings.length > 0)
    const meRow = seasonStandings.find((x) => x.isMe)
    assert.ok(meRow)
    assert.equal(meRow.name, 'Minh')
    assert.equal(typeof meRow.points, 'number')

    const hero = getMyHeroStats(mockDb, 'm1')
    assert.equal(typeof hero.seasonRank, 'number')
    assert.equal(typeof hero.seasonProgressPct, 'number')
  })

  await t.test('11. calcSeasonRaceHistory supports multiple rivals with distinct colors', () => {
    const race = calcSeasonRaceHistory(mockDb, 'm1', ['m2', 'm3'], 6)
    assert.equal(race.empty, false)
    assert.ok(Array.isArray(race.rivals))
    assert.equal(race.rivals.length, 2)

    const [r1, r2] = race.rivals
    assert.equal(r1.id, 'm2')
    assert.equal(r2.id, 'm3')
    assert.ok(r1.color)
    assert.ok(r2.color)
    assert.notEqual(r1.color, r2.color) // Mỗi người thể hiện màu khác nhau
    assert.ok(r1.svgPoints)
    assert.ok(r2.svgPoints)

    // Backward compatibility
    assert.equal(race.rivalName, r1.name)
    assert.equal(race.svgPointsRival, r1.svgPoints)
  })

  await t.test('12. isFemalePlayer handles all gender variants and edge cases correctly', () => {
    // 4 biến thể nữ hợp lệ
    assert.equal(isFemalePlayer({ gender: 'nữ' }), true)
    assert.equal(isFemalePlayer({ gender: 'NỮ' }), true)
    assert.equal(isFemalePlayer({ gender: 'nu' }), true)
    assert.equal(isFemalePlayer({ gender: 'NU' }), true)
    assert.equal(isFemalePlayer({ gender: 'female' }), true)
    assert.equal(isFemalePlayer({ gender: 'FEMALE' }), true)
    assert.equal(isFemalePlayer({ gender: 'f' }), true)
    assert.equal(isFemalePlayer({ gender: ' F ' }), true)
    assert.equal(isFemalePlayer({ profile: { gender: 'nữ' } }), true)
    assert.equal(isFemalePlayer({ sex: 'female' }), true)

    // Nam và các trường hợp không phải nữ
    assert.equal(isFemalePlayer({ gender: 'nam' }), false)
    assert.equal(isFemalePlayer({ gender: 'male' }), false)
    assert.equal(isFemalePlayer({ gender: 'm' }), false)
    assert.equal(isFemalePlayer({ gender: '' }), false)
    assert.equal(isFemalePlayer({}), false)
    assert.equal(isFemalePlayer(null), false)
  })

  await t.test('13. getPersonalGreeting generates gendered greeting and contextual subtitle', () => {
    // Nam - Top 1 (dùng shape chuẩn rank / seasonRank)
    const maleMem = { id: 'm1', name: 'Tiến Đạt', gender: 'nam' }
    const heroStats1 = { rank: 1, seasonRank: 1, totalMembers: 12, seasonTotalMembers: 12 }
    const g1 = getPersonalGreeting(maleMem, heroStats1, { streak: 1 }, [], null, mockDb)
    assert.ok(g1.greetingKey.startsWith('home.personal.greetingMale'))
    assert.ok(g1.subKey.startsWith('home.personal.subRank1'))

    // Nữ với chuỗi thắng >= 3 (seasonRank 6 để cô lập trạng thái chuỗi thắng, không lẫn với top 2-4)
    const femaleMem = { id: 'm2', name: 'Vân Anh', gender: 'nu' }
    const heroStatsStreak = { rank: 6, seasonRank: 6, totalMembers: 12, seasonTotalMembers: 12 }
    const g2 = getPersonalGreeting(femaleMem, heroStatsStreak, { streak: 4 }, [], null, mockDb)
    assert.ok(g2.greetingKey.startsWith('home.personal.greetingFemale'))
    assert.ok(g2.subKey.startsWith('home.personal.subWinStreakFemale'))
    assert.equal(g2.subParams.streak, 4)

    // Đáy bảng mùa ALL (thuộc 4-5 người cuối bảng ALL, ví dụ hạng 9 trên 12 người)
    const bottomMem = { id: 'm3', name: 'Linh', gender: 'nam' }
    const heroStatsBottom = { rank: 9, seasonRank: 9, totalMembers: 12, seasonTotalMembers: 12 }
    const g3 = getPersonalGreeting(bottomMem, heroStatsBottom, { streak: 0 }, [], null, mockDb)
    assert.ok(g3.subKey.startsWith('home.personal.subRankBottom'))

    // Đáy bảng mùa riêng NỮ (ví dụ rank all là 11/20 không phải đáy all, nhưng rank nữ là 5/6 nữ)
    const bottomFemale = { id: 'm_fem', name: 'Thu', gender: 'nu' }
    const heroStatsBottomFem = { rank: 11, seasonRank: 11, totalMembers: 20, seasonTotalMembers: 20, genderSeasonRank: 5, genderSeasonTotal: 6 }
    const g4 = getPersonalGreeting(bottomFemale, heroStatsBottomFem, { streak: 0 }, [], null, null)
    assert.ok(g4.subKey.startsWith('home.personal.subRankBottom'))

    // Đáy bảng mùa riêng NAM (ví dụ rank all là 11/25 không phải đáy all, nhưng rank nam là 9/12 nam)
    const bottomMale = { id: 'm_male', name: 'Huy', gender: 'nam' }
    const heroStatsBottomMale = { rank: 11, seasonRank: 11, totalMembers: 25, seasonTotalMembers: 25, genderSeasonRank: 9, genderSeasonTotal: 12 }
    const g5 = getPersonalGreeting(bottomMale, heroStatsBottomMale, { streak: 0 }, [], null, null)
    assert.ok(g5.subKey.startsWith('home.personal.subRankBottom'))

    // Top 2-4 bảng mùa
    const top3Mem = { id: 'm_top', name: 'Tú', gender: 'nam' }
    const heroStatsTop3 = { rank: 3, seasonRank: 3, totalMembers: 12, seasonTotalMembers: 12 }
    const g6 = getPersonalGreeting(top3Mem, heroStatsTop3, { streak: 0 }, [], null, null)
    assert.ok(g6.subKey.startsWith('home.personal.subRankTop'))
    assert.equal(g6.subParams.rank, 3)

    // Nữ hạng #2 toàn CLB nhưng #1 bảng nữ: KHÔNG BAO GIỜ hô "số 1 CLB" (subRank1)
    const top2FemMem = { id: 'm_top2f', name: 'Hà', gender: 'nu' }
    const heroStatsTop2Fem = { rank: 2, seasonRank: 2, totalMembers: 12, seasonTotalMembers: 12, genderSeasonRank: 1, genderSeasonTotal: 5 }
    const gTop2Fem = getPersonalGreeting(top2FemMem, heroStatsTop2Fem, { streak: 0 }, [], null, null)
    assert.ok(gTop2Fem.subKey.startsWith('home.personal.subGenderTop1Female') || gTop2Fem.subKey.startsWith('home.personal.subRankTop'))
    assert.ok(!gTop2Fem.subKey.startsWith('home.personal.subRank1'))

    // Thành viên chưa có trận mùa nào (seasonRank = 0) -> không nhận top1 hay top_chaser
    const noSeasonMem = { id: 'm_zero', name: 'Bình', gender: 'nam' }
    const heroStatsZero = { rank: 1, seasonRank: 0, totalMembers: 12, seasonTotalMembers: 12 }
    const gZero = getPersonalGreeting(noSeasonMem, heroStatsZero, { streak: 0 }, [], null, null)
    assert.ok(!gZero.subKey.startsWith('home.personal.subRank1'))
    assert.ok(!gZero.subKey.startsWith('home.personal.subRankTop'))

    // Chuỗi thua (2 trận gần nhất đều thua trong formStats.matches)
    const loseMem = { id: 'm_lose', name: 'Dũng', gender: 'nam' }
    const heroStatsMid = { rank: 5, seasonRank: 5, totalMembers: 12, seasonTotalMembers: 12 }
    const formStatsLose = {
      matches: [{ id: 'mt-a', won: false }, { id: 'mt-b', won: false }],
      streak: 0,
    }
    const g7 = getPersonalGreeting(loseMem, heroStatsMid, formStatsLose, [], null, null)
    assert.ok(g7.subKey.startsWith('home.personal.subLoseStreak'))

    // Tối nay có lịch
    const todaySession = { dateKey: 'today' }
    const g8 = getPersonalGreeting(loseMem, heroStatsMid, { streak: 0 }, [], todaySession, null)
    assert.ok(g8.subKey.startsWith('home.personal.subSessionToday'))
  })

  await t.test('14. getClubTodayHighlights returns only sports feeds (matches, challenges, streaks, top 1)', () => {
    const highlights = getClubTodayHighlights(mockDb, 'm1')
    assert.ok(Array.isArray(highlights))
    assert.ok(highlights.length > 0)
    // Không bao giờ chứa tin hành chính session_locked
    assert.ok(highlights.every((h) => h.type !== 'session_locked'))
    // Chứa tin trận đấu hoặc top 1
    const types = highlights.map((h) => h.type)
    assert.ok(types.includes('match_finished') || types.includes('rank_top1'))
  })

  await t.test('15. calcSessionAttendanceHistory correctly tracks missed sessions, comeback state, and caps at 5', () => {
    const sessionDb = {
      today: '2026-09-20',
      sessions: [
        { id: 's_unclosed_empty', date: '2026-09-19', status: 'open' }, // Buổi hôm qua chưa chốt và không có dữ liệu -> phải bị bỏ qua
        { id: 's3', date: '2026-09-18', status: 'closed' },
        { id: 's2', date: '2026-09-15', status: 'closed' },
        { id: 's1', date: '2026-09-12', status: 'closed' },
      ],
      attendance: {
        s3: { memA: false, memB: true },
        s2: { memA: false, memB: false },
        s1: { memA: true, memB: false },
      },
    }

    // Thành viên mới chưa từng tham gia buổi nào -> missedSessions = 0 (không bị báo vắng 87 buổi)
    const histNew = calcSessionAttendanceHistory(sessionDb, 'memNew')
    assert.equal(histNew.missedSessions, 0)
    assert.equal(histNew.isComeback, false)

    // memA vắng 2 buổi gần nhất (s3, s2)
    const histA = calcSessionAttendanceHistory(sessionDb, 'memA')
    assert.equal(histA.missedSessions, 2)
    assert.equal(histA.isComeback, false)

    const memAObj = { id: 'memA', name: 'Hoàng', gender: 'nam' }
    const heroStatsA = { seasonRank: 6, seasonTotalMembers: 12 }
    const gA = getPersonalGreeting(memAObj, heroStatsA, { streak: 0 }, [], null, sessionDb)
    assert.ok(gA.subKey.startsWith('home.personal.subInactive'))
    assert.equal(gA.subParams.n, 2)

    // memB có mặt ở s3 (buổi gần nhất), nhưng trước đó vắng s2 và s1 (2 buổi liên tiếp)
    const histB = calcSessionAttendanceHistory(sessionDb, 'memB')
    assert.equal(histB.missedSessions, 0)
    assert.equal(histB.isComeback, true)

    const memBObj = { id: 'memB', name: 'Quân', gender: 'nam' }
    const heroStatsB = { seasonRank: 6, seasonTotalMembers: 12 }
    const gB = getPersonalGreeting(memBObj, heroStatsB, { streak: 0 }, [], null, sessionDb)
    assert.ok(gB.subKey.startsWith('home.personal.subComeback'))

    // Kiểm tra chặn trần tối đa 5 buổi vắng
    const longAbsentDb = {
      today: '2026-09-20',
      sessions: Array.from({ length: 20 }, (_, i) => ({
        id: `s_old_${i}`,
        date: `2026-08-${String(i + 1).padStart(2, '0')}`,
        status: 'closed',
      })),
      attendance: {
        s_old_0: { memOld: true }, // Có từng đi 1 buổi xa xưa
      },
    }
    const histOld = calcSessionAttendanceHistory(longAbsentDb, 'memOld')
    assert.equal(histOld.missedSessions, 5) // Chặn trần tại 5, không vọt lên 19 hay 87
  })
})

