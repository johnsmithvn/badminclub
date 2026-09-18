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
  rankTopCrossGenderPlayers,
  effectiveRating,
  effectiveTeamRating,
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

    // Nhánh `deviation` ĐÃ BỊ XOÁ (app không tính độ lệch chuẩn ở đâu cả, cột
    // player_ratings.rating_deviation luôn là 350 mặc định — migration 0045 xoá hẳn cột).
    // Test này giữ lại để gác chiều ngược: nếu ai đó cắm lại một nhánh ăn theo tham số thứ hai
    // mà không đi kèm mô hình Glicko thật, dòng dưới sẽ đỏ.
    assert.equal(confidenceOf(100, 300), 'very_high', 'Tham số thứ hai phải bị bỏ qua hoàn toàn')
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

  await t.test('computeClubCalibration handles mixed doubles and ranks top cross-gender players', () => {
    const membersMap = {
      m1: { id: 'm1', name: 'Minh', gender: 'nam' },
      m2: { id: 'm2', name: 'Hải', gender: 'nam' },
      f1: { id: 'f1', name: 'Lan', gender: 'nu' },
      f2: { id: 'f2', name: 'Mai', gender: 'Nữ' },
    }

    const matches = [
      // 4 trận Đôi Nam Nữ (1M1F vs 1M1F)
      { teamA: ['m1', 'f1'], teamB: ['m2', 'f2'], initialRatingA: 1500, initialRatingB: 1520, winnerTeam: 'A', sets: [[21, 19]] },
      { teamA: ['m1', 'f1'], teamB: ['m2', 'f2'], initialRatingA: 1500, initialRatingB: 1530, winnerTeam: 'B', sets: [[18, 21]] },
      { teamA: ['m1', 'f1'], teamB: ['m2', 'f2'], initialRatingA: 1500, initialRatingB: 1510, winnerTeam: 'A', sets: [[21, 17]] },
      { teamA: ['m1', 'f1'], teamB: ['m2', 'f2'], initialRatingA: 1500, initialRatingB: 1540, winnerTeam: 'B', sets: [[19, 21]] },
    ]

    const calib = computeClubCalibration(matches, membersMap)
    const bLess100 = calib.find((c) => c.bucket === '<100')
    assert.equal(bLess100.sampleSize, 4)
    assert.equal(bLess100.observedWinRate, 0.5)
    assert.equal(calib.totalCrossMatches, 4)
    assert.equal(calib.mixedDoublesCount, 4)

    // Tất cả 4 người tham gia đều được ghi nhận 4 trận chéo
    assert.equal(calib.topCrossGenderPlayers['m1'], 4)
    assert.equal(calib.topCrossGenderPlayers['f1'], 4)
    assert.equal(calib.topCrossGenderPlayers['m2'], 4)
    assert.equal(calib.topCrossGenderPlayers['f2'], 4)

    // rankTopCrossGenderPlayers xếp hạng chính xác
    const ranked = rankTopCrossGenderPlayers(calib.topCrossGenderPlayers, membersMap)
    assert.equal(ranked.length, 4)
    assert.ok(ranked.every((p) => p.count === 4))
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

    // Giới tính ghi có dấu ('nữ') vẫn phải được nhận. Trước đây hàm so thẳng `=== 'nu'` nên
    // hồ sơ nào lưu có dấu là hiệu chỉnh chéo giới im lặng không chạy.
    assert.equal(effectiveRating({ gender: 'nữ', rating: 1600 }, true, calib), 1635)
    assert.equal(effectiveRating({ gender: 'Nữ', rating: 1600 }, true, calib), 1635)
    assert.equal(effectiveRating({ gender: 'female', rating: 1600 }, true, calib), 1635)
  })

  await t.test('effectiveTeamRating: hiệu chỉnh theo NGƯỜI rồi mới trung bình', () => {
    const calib = [{ bucket: '100-300', learnedAdjustment: -40 }]
    const ratings = { f1: 500, f2: 500, m1: 500, m2: 500 }
    const members = {
      f1: { gender: 'nu' }, f2: { gender: 'nữ' },
      m1: { gender: 'nam' }, m2: { gender: 'nam' },
    }

    // Đội 1 nam 1 nữ: chỉ MỘT người được hiệu chỉnh -> trung bình đội dịch đúng MỘT NỬA.
    // Đây là chỗ code cũ cộng thẳng `learnedAdjustment × 2` vào rating đội, tức gấp BỐN lần.
    assert.equal(effectiveTeamRating(['m1', 'f1'], ratings, members, true, calib), 480)

    // Đội hai nữ: cả hai được hiệu chỉnh -> dịch trọn một lần
    assert.equal(effectiveTeamRating(['f1', 'f2'], ratings, members, true, calib), 460)

    // Đội toàn nam: không ai được hiệu chỉnh
    assert.equal(effectiveTeamRating(['m1', 'm2'], ratings, members, true, calib), 500)

    // Không phải kèo chéo giới thì giữ nguyên, y hệt teamRating
    assert.equal(effectiveTeamRating(['m1', 'f1'], ratings, members, false, calib), 500)
    assert.equal(effectiveTeamRating(['m1', 'f1'], ratings, members, false, calib), teamRating(['m1', 'f1'], ratings))

    // Chưa có dữ liệu hiệu chỉnh (CLB mới) thì tuyệt đối không được tự dịch điểm ai
    assert.equal(effectiveTeamRating(['m1', 'f1'], ratings, members, true, []), 500)
    assert.equal(effectiveTeamRating(['m1', 'f1'], ratings, members, true, [{ bucket: '100-300', learnedAdjustment: 0 }]), 500)

    // Đội rỗng trả về mốc mặc định, không NaN
    assert.equal(effectiveTeamRating([], ratings, members, true, calib), DEFAULT_RATING)
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

    // Test huỷ/xoá trận: matchId không còn nằm trong remainingMatches vẫn phải cascade tính lại
    const runCancelled = replayRatingCascade([match2], 'm-1', members)
    assert.ok(runCancelled.finalRatings.p1 != null, 'Phải có kết quả tính rating khi huỷ trận')
    assert.equal(runCancelled.finalRatings.p1.gamesCount, 1, 'Sau khi huỷ match1 thì p1 chỉ còn 1 trận')

    // Test xoá hết mọi trận: đưa toàn bộ thành viên về điểm ban đầu
    const runEmpty = replayRatingCascade([], null, members)
    assert.equal(runEmpty.finalRatings.p1.gamesCount, 0, 'Xoá hết trận thì gamesCount = 0')
    assert.equal(runEmpty.finalRatings.p1.rating, 200, 'Xoá hết trận thì rating về điểm gốc (seed mặc định khi chưa khai trình độ)')
  })
})

