import test from 'node:test'
import assert from 'node:assert/strict'
import {
  kFactorOf,
  marginMultiplier,
  rankTierOf,
  applyInactivityDecay,
  calcPlayerDeltas,
  calcEloDelta,
  getPlayerRating,
  initialRatingOf,
} from '../../lib/rating.js'
import cfg from '../../config/app.json' with { type: 'json' }

test('Rating Upgrades Suite', async (t) => {
  await t.test('1. Dynamic K-Factor (kFactorOf)', () => {
    // R1: 0 - 4 trận -> K = 48
    assert.equal(kFactorOf(0), 48)
    assert.equal(kFactorOf(4), 48)

    // R2: 5 - 14 trận -> K = 36
    assert.equal(kFactorOf(5), 36)
    assert.equal(kFactorOf(14), 36)

    // R3: 15 - 29 trận -> K = 28
    assert.equal(kFactorOf(15), 28)
    assert.equal(kFactorOf(29), 28)

    // R4: 30 - 49 trận -> K = 20
    assert.equal(kFactorOf(30), 20)
    assert.equal(kFactorOf(49), 20)

    // R5: >= 50 trận -> K = 16
    assert.equal(kFactorOf(50), 16)
    assert.equal(kFactorOf(150), 16)

    // Edge cases
    assert.equal(kFactorOf(undefined), 48)
    assert.equal(kFactorOf(-5), 48)
  })

  await t.test('2. Margin of Victory Multiplier (marginMultiplier)', () => {
    // Null / rỗng -> fallback 1.0
    assert.equal(marginMultiplier(null), 1.0)
    assert.equal(marginMultiplier([]), 1.0)

    // Thắng sát nút 21-19: diff = 2 -> 1 + 2/40 = 1.05
    const tightMult = marginMultiplier([[21, 19]])
    assert.equal(tightMult, 1.05)

    // Thắng áp đảo 21-5: diff = 16 -> 1 + 16/40 = 1.40 (max cap)
    const blowoutMult = marginMultiplier([[21, 5]])
    assert.equal(blowoutMult, 1.4)

    // Thắng cực kỳ áp đảo 21-0: diff = 21 -> capped at 1.4
    const extremeMult = marginMultiplier([[21, 0]])
    assert.equal(extremeMult, 1.4)

    // Nhiều set: 21-19 (diff 2) và 21-9 (diff 12) -> avg diff = 7 -> 1 + 7/40 = 1.175 -> round to 2 decimals: 1.18
    const multiSetMult = marginMultiplier([[21, 19], [21, 9]])
    assert.equal(multiSetMult, 1.18)

    // calcEloDelta tích hợp margin multiplier
    const tightDelta = calcEloDelta(500, 500, true, 32, [[21, 19]])
    const blowoutDelta = calcEloDelta(500, 500, true, 32, [[21, 5]])
    assert.ok(blowoutDelta.deltaA > tightDelta.deltaA, 'Blowout should yield higher Elo delta than tight win')
  })

  await t.test('3. 8 Badminton Slang Tiers & Level Seed Ratings', () => {
    // 1. Mới Cầm Vợt: 0 - 199
    const novice = rankTierOf(100)
    assert.equal(novice.key, 'novice')
    assert.equal(novice.icon, 'sparkles')
    assert.equal(novice.progress, 50)

    // 2. Vào Sân: 200 - 399
    const rookie = rankTierOf(300)
    assert.equal(rookie.key, 'rookie')
    assert.equal(rookie.icon, 'play')
    assert.equal(rookie.progress, 50)

    // 3. Quen Sân: 400 - 599
    const regular = rankTierOf(500)
    assert.equal(regular.key, 'regular')
    assert.equal(regular.icon, 'shield')
    assert.equal(regular.progress, 50)

    // 4. Cứng Tay: 600 - 799
    const solid = rankTierOf(600)
    assert.equal(solid.key, 'solid')
    assert.equal(solid.icon, 'award')
    assert.equal(solid.progress, 0)

    // 5. Chém Lưới: 800 - 999
    const netMaster = rankTierOf(900)
    assert.equal(netMaster.key, 'net_master')
    assert.equal(netMaster.icon, 'zap')
    assert.equal(netMaster.progress, 50)

    // 6. Bao Sân: 1000 - 1199
    const coverage = rankTierOf(1100)
    assert.equal(coverage.key, 'coverage')
    assert.equal(coverage.icon, 'flame')
    assert.equal(coverage.progress, 50)

    // 7. Tay To: 1200 - 1399
    const heavy = rankTierOf(1300)
    assert.equal(heavy.key, 'heavy_hitter')
    assert.equal(heavy.icon, 'trophy')
    assert.equal(heavy.progress, 50)

    // 8. Trùm Sân: 1400+
    const boss = rankTierOf(1500)
    assert.equal(boss.key, 'court_boss')
    assert.equal(boss.icon, 'crown')
    assert.equal(boss.progress, 50)

    // Floor không cho điểm âm hiển thị trên UI
    const negTier = rankTierOf(-50)
    assert.equal(negTier.key, 'novice')
    assert.equal(negTier.progress, 0)

    // Test initialRatingOf gắn với trình độ
    assert.equal(initialRatingOf('Yếu'), 200)
    assert.equal(initialRatingOf('TB'), 500)
    assert.equal(initialRatingOf('Khá'), 800)
    assert.equal(initialRatingOf('Tốt'), 1000)
    assert.equal(initialRatingOf(undefined), 0)

    // getPlayerRating với member level
    const prNewbie = getPlayerRating({}, 'm_new', { level: 'Yếu' })
    assert.equal(prNewbie.rating, 200)
    assert.equal(prNewbie.tier.key, 'rookie')

    const prPro = getPlayerRating({}, 'm_pro', { level: 'Khá' })
    assert.equal(prPro.rating, 800)
    assert.equal(prPro.tier.key, 'net_master')

    // getPlayerRating floor với điểm âm
    const prWithNeg = getPlayerRating({ m1: { rating: -30, gamesCount: 2 } }, 'm1')
    assert.equal(prWithNeg.rating, -30) // Kỹ thuật
    assert.equal(prWithNeg.displayRating, 0) // UI Floor >= 0
    assert.equal(prWithNeg.tier.key, 'novice')
  })

  await t.test('4. Inactivity Decay (applyInactivityDecay)', () => {
    const now = new Date('2026-09-04T12:00:00Z')

    // Chơi hôm qua (1 ngày) -> Không decay
    const yesterday = new Date('2026-09-03T12:00:00Z').toISOString()
    const r1 = applyInactivityDecay(800, yesterday, now)
    assert.equal(r1.isInactive, false)
    assert.equal(r1.decayAmount, 0)
    assert.equal(r1.rating, 800)

    // Nghỉ 35 ngày (> 30 ngày warning nhưng < 45 ngày decay) -> isInactive = true, decayAmount = 0
    const d35 = new Date('2026-07-31T12:00:00Z').toISOString()
    const r35 = applyInactivityDecay(800, d35, now)
    assert.equal(r35.isInactive, true)
    assert.equal(r35.decayAmount, 0)
    assert.equal(r35.rating, 800)

    // Nghỉ 50 ngày (>= 45 ngày -> 1 chu kỳ decay 10 Elo)
    const d50 = new Date('2026-07-16T12:00:00Z').toISOString()
    const r50 = applyInactivityDecay(800, d50, now)
    assert.equal(r50.isInactive, true)
    assert.equal(r50.decayAmount, 10)
    assert.equal(r50.rating, 790)

    // Nghỉ 80 ngày -> 2 chu kỳ decay (20 Elo)
    const d80 = new Date('2026-06-16T12:00:00Z').toISOString()
    const r80 = applyInactivityDecay(800, d80, now)
    assert.equal(r80.isInactive, true)
    assert.equal(r80.decayAmount, 20)
    assert.equal(r80.rating, 780)

    // Decay không vượt quá điểm tối thiểu (floor >= 0)
    const lowDecay = applyInactivityDecay(5, d80, now)
    assert.equal(lowDecay.rating, 0)
  })

  await t.test('5. calcPlayerDeltas with Dynamic K and Doubles Balance', () => {
    // Đội A: m_newbie (0 trận, K=48), m_pro (60 trận, K=16)
    // Đội B: m_mid1 (20 trận, K=28), m_mid2 (20 trận, K=28)
    const teamA = ['m_newbie', 'm_pro']
    const teamB = ['m_mid1', 'm_mid2']
    const ratingsMap = {
      m_newbie: 100,
      m_pro: 900,
      m_mid1: 500,
      m_mid2: 500,
    }
    const gamesCountMap = {
      m_newbie: 0,
      m_pro: 60,
      m_mid1: 20,
      m_mid2: 20,
    }

    // Cả 2 đội ngang cơ (500 vs 500), Đội A thắng áp đảo 21-10
    const { deltas, multiplier } = calcPlayerDeltas({
      teamA,
      teamB,
      aWon: true,
      ratingsMap,
      gamesCountMap,
      sets: [[21, 10]],
    })

    assert.ok(multiplier > 1.2, 'Margin multiplier should be boosted for 21-10')
    // Người mới nhận delta gấp ~3 lần cao thủ cùng đội
    assert.ok(deltas['m_newbie'] > deltas['m_pro'] * 2.5)
    assert.ok(deltas['m_newbie'] > 0)
    assert.ok(deltas['m_pro'] > 0)

    // Đội B bị trừ điểm tương ứng theo K của họ
    assert.ok(deltas['m_mid1'] < 0)
    assert.ok(deltas['m_mid2'] < 0)
    assert.equal(deltas['m_mid1'], deltas['m_mid2'])
  })
})
