import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_RATING,
  K_FACTOR,
  expectedScore,
  teamRating,
  calcEloDelta,
  confidenceOf,
  computeClubCalibration,
  effectiveRating,
  replayRatingCascade,
  evalBalance,
} from '../../lib/rating.js'

test('Comprehensive Rating & Elo Engine Tests', async (t) => {
  await t.test('Initial rating matches config (default = 0)', () => {
    assert.equal(DEFAULT_RATING, 0)
    assert.equal(teamRating([]), 0)
  })

  await t.test('expectedScore mathematical properties', () => {
    // Hai người bằng điểm nhau: P = 0.5
    assert.equal(expectedScore(1000, 1000), 0.5)
    assert.equal(expectedScore(0, 0), 0.5)
    assert.equal(expectedScore(-50, -50), 0.5)

    // Đối xứng P(A) + P(B) = 1
    const pA = expectedScore(1250, 1100)
    const pB = expectedScore(1100, 1250)
    assert.ok(Math.abs(pA + pB - 1.0) < 1e-9)

    // Chênh lệch 400 điểm: 1 / (1 + 10^(-1)) = 10/11 ≈ 0.90909
    const p400 = expectedScore(1400, 1000)
    assert.ok(Math.abs(p400 - 10 / 11) < 0.001)

    // Chênh lệch 800 điểm: 1 / (1 + 10^(-2)) = 100/101 ≈ 0.9901
    const p800 = expectedScore(1800, 1000)
    assert.ok(p800 > 0.99)
  })

  await t.test('teamRating handles singles and doubles', () => {
    const ratings = { m1: 1500, m2: 1700, m3: 1600 }
    assert.equal(teamRating(['m1'], ratings), 1500)
    assert.equal(teamRating(['m1', 'm2'], ratings), 1600)
    // Người chưa có rating dùng default (0)
    assert.equal(teamRating(['m1', 'newbie'], ratings), 750)
  })

  await t.test('calcEloDelta zero-sum and upset bonuses', () => {
    // Trận đấu cân bằng: delta = 16
    const even = calcEloDelta(1500, 1500, true, 32)
    assert.equal(even.deltaA, 16)
    assert.equal(even.deltaB, -16)
    assert.equal(even.deltaA + even.deltaB, 0)

    // Đội yếu hơn thắng (Upset): được cộng nhiều hơn 16 điểm
    const upset = calcEloDelta(1300, 1700, true, 32)
    assert.ok(upset.deltaA > 25, `Upset win should give large bonus, got ${upset.deltaA}`)
    assert.equal(upset.deltaA + upset.deltaB, 0)

    // Đội mạnh hơn thắng (Stomp): được cộng ít hơn 16 điểm
    const stomp = calcEloDelta(1700, 1300, true, 32)
    assert.ok(stomp.deltaA < 10, `Stomp win should give small gain, got ${stomp.deltaA}`)
    assert.equal(stomp.deltaA + stomp.deltaB, 0)
  })

  await t.test('confidenceOf boundaries', () => {
    // Dưới 5 trận
    assert.equal(confidenceOf(0), 'low')
    assert.equal(confidenceOf(4), 'low')

    // 5 đến 14 trận
    assert.equal(confidenceOf(5), 'medium')
    assert.equal(confidenceOf(14), 'medium')

    // 15 đến 29 trận
    assert.equal(confidenceOf(15), 'high')
    assert.equal(confidenceOf(29), 'high')

    // 30 trận trở lên
    assert.equal(confidenceOf(30), 'very_high')
    assert.equal(confidenceOf(100), 'very_high')

    // Nếu chỉ định explicit deviation
    assert.equal(confidenceOf(100, 300), 'low') // deviation quá cao ép về low
  })

  await t.test('evalBalance thresholds', () => {
    const bal1 = evalBalance(1600, 1650)
    assert.equal(bal1.level, 'balanced')

    const bal2 = evalBalance(1600, 1780)
    assert.equal(bal2.level, 'slight')

    const bal3 = evalBalance(1500, 1800)
    assert.equal(bal3.level, 'imbalanced')
  })

  await t.test('computeClubCalibration cross-gender learning', () => {
    const membersMap = {
      m1: { id: 'm1', gender: 'nam' },
      m2: { id: 'm2', gender: 'nam' },
      f1: { id: 'f1', gender: 'nu' },
      f2: { id: 'f2', gender: 'nu' },
    }

    const matches = [
      // 5 trận nữ thắng nam ở khoảng cách < 100
      { teamA: ['f1', 'f2'], teamB: ['m1', 'm2'], initialRatingA: 1500, initialRatingB: 1520, winnerTeam: 'A', sets: [[21, 19]] },
      { teamA: ['f1', 'f2'], teamB: ['m1', 'm2'], initialRatingA: 1500, initialRatingB: 1530, winnerTeam: 'A', sets: [[21, 18]] },
      { teamA: ['f1', 'f2'], teamB: ['m1', 'm2'], initialRatingA: 1500, initialRatingB: 1510, winnerTeam: 'A', sets: [[21, 17]] },
      { teamA: ['f1', 'f2'], teamB: ['m1', 'm2'], initialRatingA: 1500, initialRatingB: 1540, winnerTeam: 'A', sets: [[21, 16]] },
      { teamA: ['f1', 'f2'], teamB: ['m1', 'm2'], initialRatingA: 1500, initialRatingB: 1550, winnerTeam: 'B', sets: [[19, 21]] },
    ]

    const calib = computeClubCalibration(matches, membersMap)
    const bLess100 = calib.find((c) => c.bucket === '<100')
    assert.equal(bLess100.sampleSize, 5)
    assert.equal(bLess100.femaleWins, 4)
    assert.equal(bLess100.observedWinRate, 0.8)
    assert.ok(bLess100.learnedAdjustment > 0) // Nữ thắng 80% -> adjustment dương
  })

  await t.test('effectiveRating logic', () => {
    const memberFemale = { id: 'f1', gender: 'nu', rating: 1600 }
    const memberMale = { id: 'm1', gender: 'nam', rating: 1600 }
    const calib = [{ bucket: '100-300', learnedAdjustment: 35 }]

    // Nữ gặp nam áp dụng adjustment
    assert.equal(effectiveRating(memberFemale, true, calib), 1635)
    // Nữ không gặp nam giữ nguyên rating
    assert.equal(effectiveRating(memberFemale, false, calib), 1600)
    // Nam gặp nữ không đổi base rating
    assert.equal(effectiveRating(memberMale, true, calib), 1600)
  })

  await t.test('replayRatingCascade recalculates all subsequent matches', () => {
    const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }]
    const match1 = {
      id: 'm-1',
      at: 100,
      playerKeys: ['p1', 'p2', 'p3', 'p4'],
      sets: [[21, 19], [21, 18]],
      winnerTeam: 'A',
      ratingEnabled: true,
    }
    const match2 = {
      id: 'm-2',
      at: 200,
      playerKeys: ['p1', 'p3', 'p2', 'p4'],
      sets: [[21, 15], [21, 17]],
      winnerTeam: 'A',
      ratingEnabled: true,
    }

    // Lần 1: match 1 A thắng
    const run1 = replayRatingCascade([match1, match2], 'm-1', members)
    const p1Rating1 = run1.finalRatings.p1.rating

    // Giả lập sửa điểm match 1 thành B thắng
    const match1Edited = { ...match1, winnerTeam: 'B', sets: [[19, 21], [18, 21]] }
    const run2 = replayRatingCascade([match1Edited, match2], 'm-1', members)
    const p1Rating2 = run2.finalRatings.p1.rating

    // p1 thua match 1 nên rating cuối cùng chắc chắn phải thấp hơn run1
    assert.ok(p1Rating2 < p1Rating1, `Expected recalculated rating ${p1Rating2} < ${p1Rating1}`)
  })
})
