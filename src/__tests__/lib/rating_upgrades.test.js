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
  replayRatingCascade,
  lastMatchAtOf,
} from '../../lib/rating.js'


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

/* ==========================================================================
 * Nhóm sửa lỗi "đầu vào Elo" — 4 blocker khiến cùng một người ra hai con số
 * khác nhau tuỳ màn hình. Sai ở đây là chia sai bucket chênh lệch và trao
 * nhầm điểm mùa, nên mỗi assert dưới đây khoá một đường rò rỉ cụ thể.
 * ========================================================================== */
test('Rating Input Consistency Suite', async (t) => {
  await t.test('A1. getPlayerRating: người chưa có row phải rơi về seed theo trình độ, không phải 0', () => {
    // Không truyền member -> không tra được level -> seed 0. Đây là lý do các màn
    // quên truyền member hiển thị Elo 0 cho hội viên mới trong khi Leaderboard hiện 720.
    const noMember = getPlayerRating({}, 'm_new')
    assert.equal(noMember.rating, 0, 'Thiếu member thì hàm không thể biết seed — call site PHẢI truyền member')

    const withMember = getPlayerRating({}, 'm_new', { level: 'tbk' })
    assert.equal(withMember.rating, 720, 'Có member thì seed phải bằng levelInitialRatings.tbk = 720')
    assert.equal(withMember.effectiveStrength, 720, 'Chưa đấu trận nào thì sức mạnh hiệu dụng = seed')
  })

  await t.test('A1b. effectiveStrength co cụm về seed thật khi có member', () => {
    const prMap = { m1: { rating: 1000, gamesCount: 3 } }
    // < 5 trận: 60% seed + 40% Elo. Seed 'kha' = 800 -> 800*0.6 + 1000*0.4 = 880
    const withMember = getPlayerRating(prMap, 'm1', { level: 'kha' })
    assert.equal(withMember.effectiveStrength, 880, 'Co cụm sai seed là xếp sân sai trình')

    // BẪY CÒN LẠI: thiếu member -> seedRating = 0, mà effectiveStrengthOf dùng
    // `seedRating || r` nên số 0 hợp lệ bị nuốt và seed rơi về chính rating
    // -> KHÔNG co cụm chút nào. Người mới 3 trận bị xếp sân như người đã 30 trận.
    // Sửa `||` thành `??` sẽ đổi sức mạnh hiệu dụng của mọi người có seed = 0,
    // tức đổi cách chia đội — cần user quyết trước, xem báo cáo.
    const noMember = getPlayerRating(prMap, 'm1')
    assert.equal(noMember.effectiveStrength, 1000, 'Hành vi HIỆN TẠI: thiếu member thì không co cụm')
    assert.notEqual(noMember.effectiveStrength, withMember.effectiveStrength)
  })

  await t.test('A5. replayRatingCascade seed khách theo guest.level, không phải 500 cứng', () => {
    const members = [{ id: 'm1', level: 'tb' }, { id: 'm2', level: 'tb' }]
    const guests = [{ id: 'g1', level: 'tot' }, { id: 'g2', level: 'tot' }]
    // m1+m2 (seed 500 mỗi người) THUA g1+g2. Nếu khách bị seed 500 như cũ thì đội
    // ngang nhau -> m1 mất nhiều điểm. Seed đúng (tot = 1000) thì thua là đúng kèo
    // -> m1 chỉ mất ít điểm. Chênh lệch này chính là chỗ recalc làm lệch cả CLB.
    const matches = [{
      id: 'x1', at: 1000, teamA: ['m1', 'm2'], teamB: ['g1', 'g2'],
      winnerTeam: 'B', sets: [[15, 21]], ratingEnabled: true,
    }]

    const withGuests = replayRatingCascade(matches, null, members, null, guests)
    const withoutGuests = replayRatingCascade(matches, null, members, null, [])

    assert.ok(
      withGuests.finalRatings.m1.rating > withoutGuests.finalRatings.m1.rating,
      'Thua đội mạnh hơn phải mất ít điểm hơn thua đội ngang cơ'
    )
    assert.equal(withGuests.updatedMatches[0].initialRatingB, 1000, 'Team khách phải mang seed tot = 1000')
    assert.equal(withoutGuests.updatedMatches[0].initialRatingB, 0, 'Không truyền guests thì rơi về DEFAULT_RATING = 0')
  })

  await t.test('A5b. cascade replay hai lần cho cùng kết quả dù trận trùng mốc thời gian', () => {
    const members = [{ id: 'm1', level: 'tb' }, { id: 'm2', level: 'tb' }, { id: 'm3', level: 'kha' }, { id: 'm4', level: 'kha' }]
    // Hai trận CÙNG `at` — trước khi có tie-break theo id, thứ tự replay không xác định
    const matches = [
      { id: 'b_second', at: 500, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A', sets: [[21, 12]], ratingEnabled: true },
      { id: 'a_first', at: 500, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'B', sets: [[9, 21]], ratingEnabled: true },
    ]
    const run1 = replayRatingCascade(matches, null, members, null, [])
    const run2 = replayRatingCascade([...matches].reverse(), null, members, null, [])
    assert.equal(run1.finalRatings.m1.rating, run2.finalRatings.m1.rating, 'Recalc phải ổn định, không phụ thuộc thứ tự mảng đầu vào')
  })

  await t.test('C4. lastMatchAtOf suy mốc ra sân gần nhất từ lịch sử trận', () => {
    const matches = [
      { id: '1', at: Date.parse('2026-01-10T10:00:00Z'), teamA: ['m1', 'm2'], teamB: ['m3', 'm4'] },
      { id: '2', at: Date.parse('2026-03-20T10:00:00Z'), teamA: ['m3', 'm4'], teamB: ['m5', 'm6'] },
      { id: '3', at: Date.parse('2026-02-15T10:00:00Z'), teamA: ['m1', 'm5'], teamB: ['m3', 'm6'] },
    ]
    assert.equal(lastMatchAtOf(matches, 'm1'), '2026-02-15T10:00:00.000Z', 'Phải lấy trận mới nhất, không phải trận đầu mảng')
    assert.equal(lastMatchAtOf(matches, 'm3'), '2026-03-20T10:00:00.000Z')
    assert.equal(lastMatchAtOf(matches, 'm_never'), null, 'Chưa ra sân thì không có mốc — decay không được tính bừa')
    assert.equal(lastMatchAtOf([], 'm1'), null)

    // Nối thẳng vào decay: nghỉ quá 45 ngày mới bắt đầu trừ
    const decay = applyInactivityDecay(800, lastMatchAtOf(matches, 'm1'), new Date('2026-05-01T00:00:00Z'))
    assert.ok(decay.isInactive, 'Nghỉ 75 ngày phải bị gắn cờ tạm nghỉ')
    assert.ok(decay.decayAmount > 0)
  })

  await t.test('B4. fallback 0 hợp lệ không bị nuốt thành 1500/1200', () => {
    // Elo 0 là giá trị HỢP LỆ (defaultRating = 0, tier novice bắt đầu từ 0).
    // Dùng `||` ở call site sẽ biến 0 thành 1500 -> gap 1500 -> chia sai bucket.
    const pr = getPlayerRating({ m1: { rating: 0, gamesCount: 10 } }, 'm1', { level: 'yeu' })
    assert.equal(pr.rating, 0, 'Elo 0 phải giữ nguyên 0')
    assert.equal(pr.displayRating, 0)
    assert.equal(pr.tier.key, 'novice')
    assert.equal(initialRatingOf('yeu'), 200)
  })
})

/* ==========================================================================
 * Nút "Tính lại toàn bộ Elo" chạy replayRatingCascade. Nó CHỈ đáng tin nếu
 * replay tái tạo đúng những gì đường ghi trực tiếp (saveMatchScore) đã làm.
 * Khác biệt duy nhất còn sót: khách giao lưu.
 * ========================================================================== */
test('Replay Cascade — Khách giao lưu không tích luỹ Elo', async (t) => {
  const members = [{ id: 'm1', level: 'tb' }, { id: 'm2', level: 'tb' }, { id: 'm3', level: 'tb' }]
  const guests = [{ id: 'g1', level: 'tb' }]
  const mk = (id, at, winner) => ({
    id, at, sessionId: 's1', teamA: ['m1', 'g1'], teamB: ['m2', 'm3'],
    winnerTeam: winner, sets: [[21, 10]], ratingEnabled: true,
  })

  await t.test('11. Khách không vào bảng Elo và trận đầu cả hai đều ở seed', () => {
    const matches = [mk('a', 1000, 'A'), mk('b', 2000, 'A'), mk('c', 3000, 'A'), mk('d', 4000, 'A')]
    const { updatedMatches, finalRatings } = replayRatingCascade(matches, null, members, null, guests)
    const seed = initialRatingOf('tb')

    assert.equal(updatedMatches[0].initialRatingA, seed, 'Trận đầu: cả m1 lẫn g1 đều ở seed')
    assert.equal(finalRatings.g1, undefined, 'Khách giao lưu không được vào bảng xếp hạng Elo CLB')
    assert.ok(finalRatings.m1, 'Hội viên thì phải có')
    assert.equal(finalRatings.m1.gamesCount, 4, 'Hội viên vẫn đếm đủ 4 trận')
  })

  await t.test('12. Số trận của khách không làm tụt K-factor của chính họ', () => {
    // Nếu khách được cộng gamesCount, K của họ tụt 48 -> 36 sau 5 trận và delta đội đổi theo.
    const many = Array.from({ length: 6 }, (_, i) => mk(`m${i}`, 1000 + i * 100, 'A'))
    const withGuest = replayRatingCascade(many, null, members, null, guests)
    // Đối chứng: chạy lại y hệt nhưng khai báo g1 LÀ hội viên -> khách được tích luỹ
    const asMember = replayRatingCascade(many, null, [...members, { id: 'g1', level: 'tb' }], null, [])

    // Khách đóng băng ở seed -> đội A bị đánh giá YẾU hơn -> thắng được cộng NHIỀU hơn.
    // Nếu khách tích luỹ, đội A trông mạnh dần lên và m1 ăn ít điểm đi.
    assert.ok(
      withGuest.finalRatings.m1.rating > asMember.finalRatings.m1.rating,
      'Đóng băng khách phải cho m1 điểm cao hơn là để khách trôi điểm'
    )
    assert.equal(withGuest.finalRatings.m1.gamesCount, 6)
    // Chốt luôn con số để lần sau đổi công thức là biết ngay
    assert.equal(withGuest.finalRatings.m1.rating, 630)
    assert.equal(asMember.finalRatings.m1.rating, 619)
  })
})
