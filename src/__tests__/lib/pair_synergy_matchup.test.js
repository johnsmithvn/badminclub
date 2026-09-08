import test from 'node:test'
import assert from 'node:assert/strict'
import {
  confidenceLevelOf,
  normalizeSynergyScore,
  calcPairImpact,
  calcSynergyTrend,
  calcMatchupEdge,
  rankPairs,
  getPlayerFormatRatings,
  getPlayerPartnersAndMatchups,
  marginMultiplierVNext,
  expectedScore,
} from '../../lib/rating.js'
import {
  detailedCourtBalance,
  simulateWhatIfSwap,
} from '../../lib/assign.js'

test('Pair Synergy, Opponent Matchup & What-if Core Logic Suite (vNext)', async (t) => {

  await t.test('1. confidenceLevelOf R1 -> R4 boundaries', () => {
    // R1: 0 - 4 trận
    const r1 = confidenceLevelOf(3)
    assert.equal(r1.tier, 'R1')
    assert.equal(r1.dots, '●○○○')
    assert.equal(r1.weight, 0.0)
    assert.equal(r1.isProvisional, true)

    // R2: 5 - 11 trận
    const r2 = confidenceLevelOf(8)
    assert.equal(r2.tier, 'R2')
    assert.equal(r2.dots, '●●○○')
    assert.equal(r2.weight, 0.5)
    assert.equal(r2.isProvisional, false)

    // R3: 12 - 29 trận
    const r3 = confidenceLevelOf(18)
    assert.equal(r3.tier, 'R3')
    assert.equal(r3.dots, '●●●○')
    assert.equal(r3.weight, 1.0)
    assert.equal(r3.isProvisional, false)

    // R4: >= 30 trận
    const r4 = confidenceLevelOf(42)
    assert.equal(r4.tier, 'R4')
    assert.equal(r4.dots, '●●●●')
    assert.equal(r4.weight, 1.0)
    assert.equal(r4.isProvisional, false)
  })

  await t.test('2. calcPairImpact & normalizeSynergyScore (Design AY1/AY2 alignment)', () => {
    // Trường hợp rỗng
    const emptyPair = calcPairImpact([], 'p1', 'p2')
    assert.equal(emptyPair.gamesCount, 0)
    assert.equal(emptyPair.synergyScore, 50)
    assert.equal(emptyPair.pairImpact, 0)

    // Mock 18 trận của cặp Minh - Nam (pMinh + pNam): Thắng 13, Thua 5 (72%), kỳ vọng TB = 55%
    const matchesMinhNam = []
    for (let i = 0; i < 18; i++) {
      const isWin = i < 13 // 13 thắng, 5 thua
      matchesMinhNam.push({
        id: `m_mn_${i}`,
        at: 1700000000000 + i * 86400000,
        teamA: ['pMinh', 'pNam'],
        teamB: ['pOpp1', 'pOpp2'],
        winnerTeam: isWin ? 'A' : 'B',
        initialRatingA: 1752,
        initialRatingB: 1717, // initial expected ~ 55%
        sets: [[21, 18], [21, 19]],
      })
    }

    const resMN = calcPairImpact(matchesMinhNam, 'pMinh', 'pNam')
    assert.equal(resMN.gamesCount, 18)
    assert.equal(resMN.winsCount, 13)
    assert.equal(resMN.lossesCount, 5)
    assert.equal(resMN.actualWinPct, 72)
    assert.equal(resMN.expectedWinPct, 55)
    assert.equal(resMN.pairImpact, 17) // +17pp
    assert.equal(resMN.synergyScore, 91, 'Minh + Nam synergy should be exactly 91 as specified in design AY1/AY2')
    assert.equal(resMN.confidence.tier, 'R3')

    // Mock 15 trận của cặp Minh - Thảo (pMinh + pThao): Thắng 7, Thua 8 (47%), kỳ vọng TB = 64%
    const matchesMinhThao = []
    for (let i = 0; i < 15; i++) {
      const isWin = i < 7 // 7 thắng, 8 thua
      matchesMinhThao.push({
        id: `m_mt_${i}`,
        at: 1700000000000 + i * 86400000,
        teamA: ['pMinh', 'pThao'],
        teamB: ['pOpp1', 'pOpp2'],
        winnerTeam: isWin ? 'A' : 'B',
        initialRatingA: 1795,
        initialRatingB: 1695, // expected ~ 64%
        sets: [[21, 16]],
      })
    }

    const resMT = calcPairImpact(matchesMinhThao, 'pMinh', 'pThao')
    assert.equal(resMT.gamesCount, 15)
    assert.equal(resMT.winsCount, 7)
    assert.equal(resMT.lossesCount, 8)
    assert.equal(resMT.actualWinPct, 47)
    assert.equal(resMT.expectedWinPct, 64)
    assert.equal(resMT.pairImpact, -17) // -17pp
    assert.equal(resMT.synergyScore, 38, 'Minh + Thao synergy should be exactly 38 as specified in design AY1')
  })

  await t.test('3. calcSynergyTrend detection (up, down, steady)', () => {
    // 10 trận: 5 trận đầu thua hết (0/5), 5 trận sau thắng hết (5/5) -> Trend phải là 'up'
    const matchesTrendingUp = []
    for (let i = 0; i < 10; i++) {
      matchesTrendingUp.push({
        id: `m_trend_${i}`,
        at: 1000 + i * 100,
        teamA: ['pA', 'pB'],
        teamB: ['pC', 'pD'],
        winnerTeam: i >= 5 ? 'A' : 'B',
      })
    }

    const trendUp = calcSynergyTrend(matchesTrendingUp, 'pA', 'pB')
    assert.equal(trendUp, 'up')

    // 10 trận: 5 trận đầu thắng hết (5/5), 5 trận sau thua hết (0/5) -> Trend phải là 'down'
    const matchesTrendingDown = []
    for (let i = 0; i < 10; i++) {
      matchesTrendingDown.push({
        id: `m_trend_d_${i}`,
        at: 1000 + i * 100,
        teamA: ['pA', 'pB'],
        teamB: ['pC', 'pD'],
        winnerTeam: i < 5 ? 'A' : 'B',
      })
    }

    const trendDown = calcSynergyTrend(matchesTrendingDown, 'pA', 'pB')
    assert.equal(trendDown, 'down')

    // Trận ít hơn 5 -> 'steady'
    assert.equal(calcSynergyTrend(matchesTrendingUp.slice(0, 3), 'pA', 'pB'), 'steady')
  })

  await t.test('4. calcMatchupEdge directional asymmetry (A->B != B->A)', () => {
    // Minh+Nam vs Kien+Dat: 8 trận, Minh+Nam thắng 7, thua 1 (88%), kỳ vọng 55%
    const h2hMatches = []
    for (let i = 0; i < 8; i++) {
      h2hMatches.push({
        id: `h2h_${i}`,
        at: 2000 + i * 10,
        teamA: ['pMinh', 'pNam'],
        teamB: ['pKien', 'pDat'],
        winnerTeam: i < 7 ? 'A' : 'B', // MN won 7/8
        initialRatingA: 1750,
        initialRatingB: 1715, // exp ~ 55%
        sets: [[21, 18]],
      })
    }

    // Chiều Minh+Nam -> Kien+Dat
    const edgeMNtoKD = calcMatchupEdge(h2hMatches, ['pMinh', 'pNam'], ['pKien', 'pDat'])
    assert.equal(edgeMNtoKD.gamesCount, 8)
    assert.equal(edgeMNtoKD.winsCount, 7)
    assert.equal(edgeMNtoKD.actualWinPct, 88)
    assert.equal(edgeMNtoKD.expectedWinPct, 55)
    assert.ok(edgeMNtoKD.matchupImpact > 30) // +33pp
    assert.equal(edgeMNtoKD.advantageScore, 82, 'Minh+Nam should have decisive advantage')

    // Chiều ngược lại Kien+Dat -> Minh+Nam
    const edgeKDtoMN = calcMatchupEdge(h2hMatches, ['pKien', 'pDat'], ['pMinh', 'pNam'])
    assert.equal(edgeKDtoMN.gamesCount, 8)
    assert.equal(edgeKDtoMN.winsCount, 1)
    assert.equal(edgeKDtoMN.actualWinPct, 13) // 1/8
    assert.ok(edgeKDtoMN.matchupImpact < -30) // -32pp
    assert.ok(edgeKDtoMN.advantageScore < 30, 'Kien+Dat should have deep disadvantage')
    assert.notEqual(edgeMNtoKD.advantageScore, edgeKDtoMN.advantageScore, 'H2H edge must be directional and asymmetric')
  })

  await t.test('5. rankPairs correctly identifies Top Pair and Underperforming Pair', () => {
    const membersMap = {
      pMinh: { id: 'pMinh', name: 'Trần Minh', gender: 'nam' },
      pNam: { id: 'pNam', name: 'Lê Nam', gender: 'nam' },
      pThao: { id: 'pThao', name: 'Nguyễn Thảo', gender: 'nu' },
      pKien: { id: 'pKien', name: 'Hoàng Kiên', gender: 'nam' },
      pDat: { id: 'pDat', name: 'Phạm Đạt', gender: 'nam' },
    }
    const ratingsMap = {
      pMinh: 1795,
      pNam: 1710,
      pThao: 1240,
      pKien: 1802,
      pDat: 1668,
    }

    const allMatches = []
    // 18 trận Minh - Nam (+17pp -> 91)
    for (let i = 0; i < 18; i++) {
      allMatches.push({
        id: `mn_${i}`,
        teamA: ['pMinh', 'pNam'],
        teamB: ['pKien', 'pDat'],
        winnerTeam: i < 13 ? 'A' : 'B',
        initialRatingA: 1752,
        initialRatingB: 1717, // 55% expected win rate
        at: 1000 + i,
      })
    }
    // 15 trận Minh - Thảo (-17pp -> 38)
    for (let i = 0; i < 15; i++) {
      allMatches.push({
        id: `mt_${i}`,
        teamA: ['pMinh', 'pThao'],
        teamB: ['pKien', 'pDat'],
        winnerTeam: i < 7 ? 'A' : 'B',
        initialRatingA: 1795,
        initialRatingB: 1695,
        at: 2000 + i,
      })
    }

    const res = rankPairs(allMatches, membersMap, ratingsMap)
    assert.ok(res.rankedPairs.length >= 2)
    assert.equal(res.topPair.playerA, 'pMinh')
    assert.equal(res.topPair.playerB, 'pNam')
    assert.equal(res.topPair.synergyScore, 91)

    assert.equal(res.underperformingPair.playerA, 'pMinh')
    assert.equal(res.underperformingPair.playerB, 'pThao')
    assert.equal(res.underperformingPair.synergyScore, 38)
  })

  await t.test('6. getPlayerFormatRatings handles doubles, mixed and singles with Bayesian shrinkage', () => {
    const membersMap = {
      pMale1: { id: 'pMale1', gender: 'nam' },
      pMale2: { id: 'pMale2', gender: 'nam' },
      pFemale1: { id: 'pFemale1', gender: 'nu' },
      pFemale2: { id: 'pFemale2', gender: 'nu' },
    }
    const ratingsMap = { pMale1: 1795, pMale2: 1700, pFemale1: 1500, pFemale2: 1500 }

    const matches = [
      // 1 trận đơn: pMale1 thắng
      { id: 's1', teamA: ['pMale1'], teamB: ['pMale2'], winnerTeam: 'A' },
      // 1 trận đôi nam: pMale1 thắng
      { id: 'd1', teamA: ['pMale1', 'pMale2'], teamB: ['pOpp1', 'pOpp2'], winnerTeam: 'A' },
      // 1 trận đôi nam-nữ: pMale1 + pFemale1 thua
      { id: 'x1', teamA: ['pMale1', 'pFemale1'], teamB: ['pMale2', 'pFemale2'], winnerTeam: 'B' },
    ]

    const formats = getPlayerFormatRatings(matches, 'pMale1', ratingsMap, membersMap)
    assert.equal(formats.career.rating, 1795)
    assert.equal(formats.singles.gamesCount, 1)
    assert.equal(formats.doubles.gamesCount, 2)
    assert.equal(formats.mixed.gamesCount, 1)
    assert.equal(formats.singles.isProvisional, true)
    // Co về career rating khi ít trận (< 30)
    assert.ok(Math.abs(formats.singles.rating - 1795) < 30)
  })

  await t.test('7. detailedCourtBalance integrates synergy into team effective rating and returns expectedGapPp', () => {
    // Tạo 15 trận để cặp A1 + A2 có synergy cao (+17pp)
    const matches = []
    for (let i = 0; i < 15; i++) {
      matches.push({
        id: `m_synergy_${i}`,
        teamA: ['pA1', 'pA2'],
        teamB: ['pB1', 'pB2'],
        winnerTeam: i < 12 ? 'A' : 'B', // 80% thắng, expected ~50%
        initialRatingA: 1600,
        initialRatingB: 1600,
      })
    }

    const lineup = {
      c0t0s0: 'pA1',
      c0t0s1: 'pA2',
      c0t1s0: 'pB1',
      c0t1s1: 'pB2',
    }
    const ratingsMap = {
      pA1: 1600,
      pA2: 1600,
      pB1: 1600,
      pB2: 1600,
    }
    const players = [
      { key: 'pA1', name: 'A1' },
      { key: 'pA2', name: 'A2' },
      { key: 'pB1', name: 'B1' },
      { key: 'pB2', name: 'B2' },
    ]

    const balance = detailedCourtBalance({ lineup, ci: 0, ratingsMap, matches, players, stats: {} })
    assert.ok(balance)
    assert.ok(balance.synergyBonusA > 0, 'Team A should receive positive synergy bonus')
    assert.ok(balance.ra > balance.rawRa, 'Effective rating should be higher than raw rating due to positive synergy')
    assert.ok(balance.expectedA > 0.50, 'Team A expected win rate should be higher than 50%')
    assert.ok(typeof balance.expectedGapPp === 'number')
    assert.ok(Array.isArray(balance.quickWhy))
    assert.ok(balance.breakdown)
    assert.equal(typeof balance.breakdown.total, 'number')
  })

  await t.test('8. simulateWhatIfSwap calculates before -> after improvement in pp', () => {
    const lineup = {
      c0t0s0: 'pStrong', // 1800
      c0t0s1: 'pWeak',   // 1400  -> team A = 1600
      c0t1s0: 'pOpp1',   // 1650
      c0t1s1: 'pOpp2',   // 1650  -> team B = 1650 (chênh 50)
    }
    const ratingsMap = {
      pStrong: 1800,
      pWeak: 1400,
      pOpp1: 1650,
      pOpp2: 1650,
      pBetter: 1500, // Thay pWeak bằng pBetter (1500) -> team A = 1650 (cân 50/50!)
    }
    const players = [
      { key: 'pStrong', name: 'Strong' },
      { key: 'pWeak', name: 'Weak' },
      { key: 'pOpp1', name: 'Opp1' },
      { key: 'pOpp2', name: 'Opp2' },
      { key: 'pBetter', name: 'Better' },
    ]

    const swapRes = simulateWhatIfSwap({
      lineup,
      ci: 0,
      slotFrom: 'c0t0s1',
      playerToKey: 'pBetter',
      ratingsMap,
      matches: [],
      players,
      stats: {},
    })

    assert.ok(swapRes)
    assert.equal(swapRes.slotFrom, 'c0t0s1')
    assert.equal(swapRes.playerToKey, 'pBetter')
    assert.ok(swapRes.improvementPp > 0, `Swapping to pBetter should improve balance, got ${swapRes.improvementPp}pp`)
    assert.equal(swapRes.isBetter, true)
    assert.ok(swapRes.balanceScoreAfter >= swapRes.balanceScoreBefore)
  })

  await t.test('9. marginMultiplierVNext soft gradient with Divisor 75', () => {
    // 21-19 (diff 2): 1 + 2/75 = 1.0266 -> 1.03
    assert.equal(marginMultiplierVNext([[21, 19]]), 1.03)

    // 21-15 (diff 6): 1 + 6/75 = 1.08
    assert.equal(marginMultiplierVNext([[21, 15]]), 1.08)

    // 21-10 (diff 11): 1 + 11/75 = 1.1466 -> 1.15 (KHÔNG bị chạm kịch trần sớm như divisor 50!)
    assert.equal(marginMultiplierVNext([[21, 10]]), 1.15)

    // 21-6 (diff 15): 1 + 15/75 = 1.20 (Chạm trần 1.20 êm ái)
    assert.equal(marginMultiplierVNext([[21, 6]]), 1.20)

    // 21-2 (diff 19): Giữ trần 1.20 an toàn
    assert.equal(marginMultiplierVNext([[21, 2]]), 1.20)
  })
})
