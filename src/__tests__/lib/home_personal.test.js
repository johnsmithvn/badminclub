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
} from '../../lib/homePersonal.js'

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
})

