import test from 'node:test'
import assert from 'node:assert/strict'
import { calcPairImpact, calcMatchupEdge } from '../../lib/rating.js'
import { detailedCourtBalance } from '../../lib/assign.js'

test('Screen M1 & M2 Balance Score and Pair Synergy Logic Suite', async (t) => {

  await t.test('1. Rule: Synergy row presence logic for team slots', () => {
    // Helper function checking whether synergy row should be shown for a team
    const shouldShowSynergy = (mode, teamLength) => mode !== 'singles' && teamLength === 2

    // 0 người -> không có dòng nào
    assert.equal(shouldShowSynergy('doubles', 0), false, '0 người không thể có dòng ăn ý')
    // 1 người -> không có dòng nào (chưa thành cặp)
    assert.equal(shouldShowSynergy('doubles', 1), false, '1 người chưa thành cặp, không có dòng ăn ý')
    // 2 người cùng bên -> 1 dòng ăn ý
    assert.equal(shouldShowSynergy('doubles', 2), true, '2 người cùng bên phải có 1 dòng ăn ý')
    // Đánh đơn -> không bao giờ có dòng ăn ý
    assert.equal(shouldShowSynergy('singles', 2), false, 'Đánh đơn không bao giờ có dòng ăn ý')
    assert.equal(shouldShowSynergy('singles', 1), false, 'Đánh đơn 1 người không có dòng ăn ý')
  })

  await t.test('2. calcPairImpact calculates gamesCount, expectedWinPct, actualWinPct and synergyScore accurately', () => {
    // Tạo 8 trận cho cặp Mai (pMai) và Đức Anh (pDucAnh): Thắng 5, Thua 3 -> Thực tế = 62.5% -> 63% hoặc 62%
    const matches = []
    for (let i = 0; i < 8; i++) {
      matches.push({
        id: `m_${i}`,
        teamA: ['pMai', 'pDucAnh'],
        teamB: ['pOpp1', 'pOpp2'],
        winnerTeam: i < 5 ? 'A' : 'B',
        initialRatingA: 1500,
        initialRatingB: 1515, // Đối thủ hơi mạnh hơn -> kỳ vọng A ~ 48%
      })
    }

    const pairInfo = calcPairImpact(matches, 'pMai', 'pDucAnh')
    assert.equal(pairInfo.gamesCount, 8, 'Số trận phải là 8')
    assert.equal(pairInfo.winsCount, 5, 'Số trận thắng phải là 5')
    assert.equal(pairInfo.actualWinPct, 63, 'Thực tế thắng 5/8 trận ~ 63%')
    assert.equal(pairInfo.expectedWinPct, 48, 'Kỳ vọng ~ 48%')
    assert.ok(pairInfo.gamesCount >= 5, 'Đủ từ 5 trận trở lên để tính điểm ăn ý')
    assert.ok(pairInfo.synergyScore > 50, 'Vượt kỳ vọng (+15pp) thì điểm ăn ý phải > 50')

    // Cặp Tuấn - Hằng mới đánh 2 trận (< 5 trận) -> chưa đủ dữ liệu
    const matches2 = [
      { id: 'm_x1', teamA: ['pTuan', 'pHang'], teamB: ['pO1', 'pO2'], winnerTeam: 'A' },
      { id: 'm_x2', teamA: ['pTuan', 'pHang'], teamB: ['pO1', 'pO2'], winnerTeam: 'B' },
    ]
    const pairShort = calcPairImpact(matches2, 'pTuan', 'pHang')
    assert.equal(pairShort.gamesCount, 2, 'Số trận là 2')
    assert.equal(pairShort.gamesCount < 5, true, 'Dưới 5 trận phải xác định chưa đủ dữ liệu')
  })

  await t.test('3. detailedCourtBalance returns all 6 indicators and matchup edge for M2', () => {
    const ratingsMap = {
      pMai: 254,
      pDucAnh: 434,
      pTuan: 398,
      pHang: 301,
    }

    // Matches lịch sử đối đầu của 2 cặp
    const historyMatches = [
      {
        id: 'h_1',
        teamA: ['pMai', 'pDucAnh'],
        teamB: ['pTuan', 'pHang'],
        winnerTeam: 'A',
        initialRatingA: 688,
        initialRatingB: 699,
      },
    ]

    const result = detailedCourtBalance({
      lineup: { c0t0s0: 'pMai', c0t0s1: 'pDucAnh', c0t1s0: 'pTuan', c0t1s1: 'pHang' },
      ci: 0,
      ratingsMap,
      matches: [],
      allMatches: historyMatches,
      players: [
        { key: 'pMai', name: 'Mai' },
        { key: 'pDucAnh', name: 'Đức Anh' },
        { key: 'pTuan', name: 'Tuấn' },
        { key: 'pHang', name: 'Hằng' },
      ],
      stats: {},
    })

    assert.ok(result !== null, 'Phải tính được điểm cân bằng cho 4 người')
    assert.ok(result.totalScore > 0, 'Điểm cân bằng totalScore phải > 0')

    // 1. Cân rating
    assert.ok(result.canRating.delta !== undefined, 'Phải có độ lệch delta rating')
    assert.ok(result.canRating.score > 0, 'Điểm cân rating > 0')

    // 2. Đổi partner
    assert.ok(result.partner.score > 0, 'Điểm đổi partner > 0')

    // 3. Đổi đối thủ
    assert.ok(result.opponent.score > 0, 'Điểm đổi đối thủ > 0')

    // 4. Đều lượt đánh
    assert.ok(result.fairness.score > 0, 'Điểm đều lượt đánh > 0')

    // 5. Ăn ý cặp A và B
    assert.ok(result.pairAInfo !== null, 'Phải có pairAInfo')
    assert.ok(result.pairBInfo !== null, 'Phải có pairBInfo')

    // 6. Khắc chế matchup
    assert.ok(result.matchup !== null, 'Phải có kết quả tính matchup')
    assert.equal(result.matchup.gamesCount, 1, '2 cặp này mới gặp nhau 1 lần')
    assert.equal(result.matchup.gamesCount < 5, true, '1 trận < 5 trận nên chưa đủ mẫu')
  })

  await t.test('4. Directional counter edge (calcMatchupEdge) when sample size >= 5', () => {
    // Mock 6 trận giữa cặp A và cặp B: Cặp A thắng 5/6 trận
    const h2hMatches = []
    for (let i = 0; i < 6; i++) {
      h2hMatches.push({
        id: `h2h_${i}`,
        teamA: ['pA1', 'pA2'],
        teamB: ['pB1', 'pB2'],
        winnerTeam: i < 5 ? 'A' : 'B',
        initialRatingA: 1500,
        initialRatingB: 1500,
      })
    }

    const edge = calcMatchupEdge(h2hMatches, ['pA1', 'pA2'], ['pB1', 'pB2'])
    assert.equal(edge.gamesCount, 6, 'Số trận đối đầu là 6')
    assert.equal(edge.winsCount, 5, 'Cặp A thắng 5')
    assert.ok(edge.gamesCount >= 5, 'Đủ mẫu >= 5 trận')
    assert.ok(edge.advantageScore > 50, 'Cặp A thắng áp đảo thì advantageScore > 50')
  })

  await t.test('5. detailedCourtBalance uses natural expectedGapPp curve, 55% Elo weight, and supports effective rating', () => {
    const ratingsMap = {
      pA1: 460,
      pA2: 663, // Team A = 561.5 ~ 562
      pB1: 242,
      pB2: 247, // Team B = 244.5 ~ 245
    }
    const players = [
      { key: 'pA1', name: 'Anh Quân' },
      { key: 'pA2', name: 'Kuro' },
      { key: 'pB1', name: 'Vân Anh' },
      { key: 'pB2', name: 'Mai' },
    ]
    const lineup = {
      c0t0s0: 'pA1',
      c0t0s1: 'pA2',
      c0t1s0: 'pB1',
      c0t1s1: 'pB2',
    }

    // 1. Raw ratings calculation
    const rawRes = detailedCourtBalance({
      lineup,
      ci: 0,
      ratingsMap,
      matches: [],
      players,
      stats: {},
    })

    assert.ok(rawRes !== null)
    // Team A ~ 562 vs Team B ~ 245 -> delta ~ 317 -> expectedGapPp around 72 -> canRating.score around 28
    assert.ok(rawRes.canRating.score < 50, 'Lệch trình độ sâu thì canRating.score phải dưới 50')
    assert.ok(rawRes.totalScore < 70, 'Điểm tổng trận lệch sâu phải dưới 70, không bị vọt lên 87 như trước')
    assert.equal(rawRes.breakdown.matchup, 0, 'H2H không được âm thầm cộng vào breakdown')

    // 2. Effective ratings calculation (truyền effective ratings đã hiệu chỉnh chéo giới tính)
    const effRes = detailedCourtBalance({
      lineup,
      ci: 0,
      ratingsMap,
      matches: [],
      players,
      stats: {},
      effectiveRatingA: 502,
      effectiveRatingB: 321,
    })

    assert.ok(effRes !== null)
    assert.equal(effRes.canRating.delta, 181, 'Delta phải dùng theo effective delta 181')
    assert.equal(effRes.canRating.isEffective, true, 'isEffective phải là true')
    assert.ok(effRes.canRating.score > rawRes.canRating.score, 'Effective rating thu hẹp khoảng cách thì canRating.score phải cao hơn raw')
    assert.ok(effRes.totalScore >= 70, 'Trận được hiệu chỉnh chéo giới tính đạt mức điểm cân bằng hợp lý ~70-74')
  })
})

