import test from 'node:test'
import assert from 'node:assert/strict'
import { calcSeasonMatchDelta, calculateSeasonLeaderboard, getMemberSeasonLedger } from '../../lib/xp.js'

test('Season Points Rank-Climbing Engine Tests', async (t) => {
  // ── 1. Test 5 dải chênh lệch Team Elo ──
  await t.test('1. calcSeasonMatchDelta: 5 dải điểm chuẩn xác', () => {
    // 1. Cửa trên sâu (gap >= 150): Thắng +10, Thua -12
    const c1Win = calcSeasonMatchDelta(1650, 1500, true)
    assert.equal(c1Win.delta, 10)
    assert.equal(c1Win.tier, 'heavyFavored')
    assert.equal(c1Win.gap, 150)

    const c1Loss = calcSeasonMatchDelta(1700, 1500, false)
    assert.equal(c1Loss.delta, -12)
    assert.equal(c1Loss.tier, 'heavyFavored')

    // 2. Cửa trên vừa (50 <= gap < 150): Thắng +12, Thua -10
    const c2Win = calcSeasonMatchDelta(1550, 1500, true)
    assert.equal(c2Win.delta, 12)
    assert.equal(c2Win.tier, 'favored')
    assert.equal(c2Win.gap, 50)

    const c2Loss = calcSeasonMatchDelta(1600, 1510, false)
    assert.equal(c2Loss.delta, -10)
    assert.equal(c2Loss.tier, 'favored')

    // 3. Cân kèo (-50 < gap < 50): Thắng +14, Thua -8
    const c3Win = calcSeasonMatchDelta(1510, 1500, true)
    assert.equal(c3Win.delta, 14)
    assert.equal(c3Win.tier, 'balanced')

    const c3Loss = calcSeasonMatchDelta(1500, 1520, false)
    assert.equal(c3Loss.delta, -8)
    assert.equal(c3Loss.tier, 'balanced')

    // 4. Cửa dưới vừa (-150 < gap <= -50): Thắng +17, Thua -5
    const c4Win = calcSeasonMatchDelta(1450, 1500, true)
    assert.equal(c4Win.delta, 17)
    assert.equal(c4Win.tier, 'underdog')
    assert.equal(c4Win.gap, -50)

    const c4Loss = calcSeasonMatchDelta(1400, 1500, false)
    assert.equal(c4Loss.delta, -5)
    assert.equal(c4Loss.tier, 'underdog')

    // 5. Cửa dưới sâu (gap <= -150): Thắng +22, Thua -3
    const c5Win = calcSeasonMatchDelta(1350, 1500, true)
    assert.equal(c5Win.delta, 22)
    assert.equal(c5Win.tier, 'deepUnderdog')
    assert.equal(c5Win.gap, -150)

    const c5Loss = calcSeasonMatchDelta(1300, 1500, false)
    assert.equal(c5Loss.delta, -3)
    assert.equal(c5Loss.tier, 'deepUnderdog')
  })

  // ── 2. Test Sàn Floor = 0 (Không bao giờ âm điểm) ──
  await t.test('2. Floor = 0: Điểm không bao giờ bị âm khi thua liên tiếp', () => {
    const db = {
      members: [{ id: 'm1', name: 'ThuaLienTiep', active: true }],
      sessions: [{ id: 's1', date: '2026-07-05' }],
      matches: [
        // Trận 1: Thua kèo cân (-8) -> điểm = max(0, 0 - 8) = 0
        { id: 'mt1', sessionId: 's1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'B', initialRatingA: 1500, initialRatingB: 1500 },
        // Trận 2: Thua kèo trên (-12) -> điểm = max(0, 0 - 12) = 0
        { id: 'mt2', sessionId: 's1', at: 200, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'B', initialRatingA: 1700, initialRatingB: 1500 },
        // Trận 3: Thắng kèo cân (+14) -> điểm = max(0, 0 + 14) = 14
        { id: 'mt3', sessionId: 's1', at: 300, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
        // Trận 4: Thua kèo cân (-8) -> điểm = max(0, 14 - 8) = 6
        { id: 'mt4', sessionId: 's1', at: 400, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'B', initialRatingA: 1500, initialRatingB: 1500 },
        // Trận 5: Thua kèo cân (-8) -> điểm = max(0, 6 - 8) = 0
        { id: 'mt5', sessionId: 's1', at: 500, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'B', initialRatingA: 1500, initialRatingB: 1500 },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db)
    const row = leaderboard[0]
    assert.equal(row.totalSeasonPoints, 0, 'Sau chuỗi thua sàn phải giữ ở 0')
    assert.equal(row.lossesCount, 4)
    assert.equal(row.winsCount, 1)
  })

  // ── 3. Test Thưởng mốc Streak 3 (+5) và Streak 5 (+10) ──
  await t.test('3. Streak bonus: Thưởng tại thời điểm chạm mốc 3 và 5', () => {
    // 6 trận thắng liên tiếp kèo cân (+14 mỗi trận)
    // Trận 1: +14 -> 14
    // Trận 2: +14 -> 28
    // Trận 3: +14 + 5 (Streak 3) -> 47
    // Trận 4: +14 -> 61
    // Trận 5: +14 + 10 (Streak 5) -> 85
    // Trận 6: +14 (Không thưởng thêm ở 6) -> 99
    const db = {
      members: [{ id: 'm1', name: 'Streaker', active: true }],
      sessions: [{ id: 's1', date: '2026-07-05' }],
      matches: [
        { id: 'mt1', sessionId: 's1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
        { id: 'mt2', sessionId: 's1', at: 200, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
        { id: 'mt3', sessionId: 's1', at: 300, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
        { id: 'mt4', sessionId: 's1', at: 400, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
        { id: 'mt5', sessionId: 's1', at: 500, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
        { id: 'mt6', sessionId: 's1', at: 600, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db)
    const row = leaderboard[0]
    assert.equal(row.streak, 6)
    assert.equal(row.breakdown.streakBonusPts, 15, 'Tổng thưởng streak 3 (+5) + streak 5 (+10) = 15')
    assert.equal(row.totalSeasonPoints, 99, '6 trận * 14 + 15 bonus = 99')
  })

  // ── 4. Test Thưởng Upset >= 150 Elo (+5) ──
  await t.test('4. Upset bonus: Thắng đội hơn >= 150 Elo nhận +22 delta và +5 bonus', () => {
    // Đội A (1350) vs Đội B (1500): chênh -150 -> Cửa dưới sâu (+22) + Upset bonus (+5) = +27
    const db = {
      members: [{ id: 'm1', name: 'UnderdogHero', active: true }],
      sessions: [{ id: 's1', date: '2026-07-05' }],
      matches: [
        { id: 'mt1', sessionId: 's1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1350, initialRatingB: 1500 },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db)
    const row = leaderboard[0]
    assert.equal(row.upsetsCount, 1)
    assert.equal(row.breakdown.upsetBonusPts, 5)
    assert.equal(row.totalSeasonPoints, 27, '22 (deep underdog win) + 5 (upset) = 27')
  })

  // ── 5. Test Trạng thái Tạm nghỉ (Inactive sau 21 ngày) & Điều kiện 20 trận ──
  await t.test('5. Inactive sau 21 ngày và Qualified >= 20 trận', () => {
    const fixedSeason = {
      id: 'test-season',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      referenceDate: '2026-08-30', // Cố định ngày đối chiếu
      minMatchesOfficial: 20,
      inactiveDays: 21,
    }

    const db = {
      members: [
        { id: 'm1', name: 'NguoiNghiDai', active: true },
        { id: 'm2', name: 'NguoiChungCan', active: true },
      ],
      sessions: [{ id: 's1', date: '2026-07-05' }],
      matches: [
        // m1 đánh trận ngày 01/08 (cách 30/08 là 29 ngày > 21)
        { id: 'mt1', sessionId: 's1', at: Date.parse('2026-08-01T19:00:00Z'), teamA: ['m1'], teamB: ['mX'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
        // m2 đánh trận ngày 20/08 (cách 30/08 là 10 ngày <= 21)
        { id: 'mt2', sessionId: 's1', at: Date.parse('2026-08-20T19:00:00Z'), teamA: ['m2'], teamB: ['mX'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500 },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(db, fixedSeason)
    const m1 = leaderboard.find((r) => r.id === 'm1')
    const m2 = leaderboard.find((r) => r.id === 'm2')

    assert.equal(m1.isInactive, true, 'm1 nghỉ 29 ngày > 21 ngày -> isInactive = true')
    assert.equal(m1.isQualified, false, 'm1 mới đánh 1 trận < 20 -> isQualified = false')
    assert.equal(m1.totalSeasonPoints, 14, 'Điểm của m1 vẫn được bảo toàn nguyên vẹn 14 điểm')

    assert.equal(m2.isInactive, false, 'm2 mới đánh cách 10 ngày -> isInactive = false')
  })

  // ── 6. Test Sổ điểm thành viên (Member Season Ledger) ──
  await t.test('6. getMemberSeasonLedger: Hiển thị đúng dòng thời gian từng trận', () => {
    const db = {
      members: [{ id: 'm1', name: 'LedgerUser', active: true }],
      sessions: [{ id: 's1', date: '2026-07-05' }],
      matches: [
        { id: 'mt1', sessionId: 's1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1500, sets: [[21, 15]] },
      ],
    }

    const ledger = getMemberSeasonLedger('m1', db)
    assert.ok(ledger)
    assert.equal(ledger.totalPoints, 14)
    assert.equal(ledger.recentEvents.length, 1)
    assert.equal(ledger.recentEvents[0].type, 'win')
    assert.equal(ledger.recentEvents[0].pts, '+14')
    assert.equal(ledger.recentEvents[0].pointsAfter, 14)
  })
})

/* ==========================================================================
 * Nhóm bảo vệ tính đúng đắn của engine cày rank.
 * Sàn Floor = 0 kẹp sau MỖI trận nên tổng điểm phụ thuộc thứ tự duyệt trận —
 * sai ở đây là bảng xếp hạng đổi số giữa các lần render mà không ai biết vì sao.
 * ========================================================================== */
test('Season Rank Engine — Determinism & Config Suite', async (t) => {
  const baseSeason = { startDate: '2026-07-01', endDate: '2026-09-30', minMatchesOfficial: 20, inactiveDays: 21 }
  const mkMatch = (id, at, winner, ra = 500, rb = 500) => ({
    id, at, sessionId: 's1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'],
    winnerTeam: winner, sets: [[21, 15]], initialRatingA: ra, initialRatingB: rb,
  })
  const baseDb = {
    members: [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }, { id: 'm3', name: 'C' }, { id: 'm4', name: 'D' }],
    sessions: [{ id: 's1', date: '2026-07-05' }],
  }

  await t.test('7. Thứ tự trận trùng mốc thời gian phải cho cùng một kết quả', () => {
    // Hai trận CÙNG `at` — không có tie-break thì thứ tự do JS quyết, mà sàn Floor 0
    // làm phép tính phụ thuộc thứ tự: thua-rồi-thắng = 14đ, thắng-rồi-thua = 6đ.
    const win = mkMatch('zzz_win', 1000, 'A')
    const loss = mkMatch('aaa_loss', 1000, 'B')

    const forward = calculateSeasonLeaderboard({ ...baseDb, matches: [win, loss] }, baseSeason)
    const reversed = calculateSeasonLeaderboard({ ...baseDb, matches: [loss, win] }, baseSeason)
    const ptsOf = (res) => res.leaderboard.find((r) => r.id === 'm1').totalSeasonPoints

    assert.equal(
      ptsOf(forward), ptsOf(reversed),
      'Cùng dữ liệu mà đảo thứ tự mảng ra điểm khác nhau = BXH nhảy số mỗi lần F5'
    )
  })

  await t.test('8. Sàn Floor 0 không "ăn" điểm của trận thắng sau đó', () => {
    // Thua trước (kẹp về 0) rồi thắng: phải đúng bằng +14, không phải 6.
    const loss = mkMatch('m_a', 1000, 'B')
    const win = mkMatch('m_b', 2000, 'A')
    const res = calculateSeasonLeaderboard({ ...baseDb, matches: [loss, win] }, baseSeason)
    const row = res.leaderboard.find((r) => r.id === 'm1')
    assert.equal(row.totalSeasonPoints, 14, 'max(0, 0-8) = 0 rồi +14 = 14')
    assert.equal(row.matchesCount, 2)
  })

  await t.test('9. Ngưỡng dải điểm đọc từ config, không hard-code trong logic', () => {
    // Đổi minGap trong config phải đổi được dải — nếu logic hard-code 150/50 thì
    // sửa app.json sẽ không có tác dụng và người chỉnh luật sẽ tưởng mình sai.
    const customScale = {
      heavyFavored: { minGap: 300, win: 10, loss: -12 },
      favored: { minGap: 100, win: 12, loss: -10 },
      balanced: { minGap: -99, win: 14, loss: -8 },
      underdog: { minGap: -299, win: 17, loss: -5 },
      deepUnderdog: { minGap: -9999, win: 22, loss: -3 },
    }
    // gap = 150: theo config mặc định là heavyFavored, theo config này phải là favored
    assert.equal(calcSeasonMatchDelta(650, 500, true).tier, 'heavyFavored')
    assert.equal(calcSeasonMatchDelta(650, 500, true, customScale).tier, 'favored')
    assert.equal(calcSeasonMatchDelta(650, 500, true, customScale).delta, 12)

    // gap = -150: mặc định deepUnderdog, config này phải là underdog
    assert.equal(calcSeasonMatchDelta(500, 650, true).tier, 'deepUnderdog')
    assert.equal(calcSeasonMatchDelta(500, 650, true, customScale).tier, 'underdog')
  })

  await t.test('10. Người đủ 20 trận đứng trên người điểm cao hơn nhưng chưa đủ điều kiện', () => {
    // Chống "ôm rank": thắng 3 trận rồi nghỉ không được đứng đầu bảng.
    const matches = []
    // m1 & m2: 20 trận toàn thua kèo cân (-8) -> chạm sàn 0 điểm, nhưng ĐỦ điều kiện
    for (let i = 0; i < 20; i++) matches.push(mkMatch(`lose_${String(i).padStart(2, '0')}`, 1000 + i, 'B'))
    // m3 & m4 thắng cả 20 trận đó -> điểm cao và cũng đủ điều kiện
    // Thêm m5 & m6: chỉ 2 trận thắng kèo cân = 28 điểm, CHƯA đủ 20 trận
    matches.push({
      id: 'camp_1', at: 5000, sessionId: 's1', teamA: ['m5', 'm6'], teamB: ['m1', 'm2'],
      winnerTeam: 'A', sets: [[21, 10]], initialRatingA: 500, initialRatingB: 500,
    })

    const db = {
      ...baseDb,
      members: [...baseDb.members, { id: 'm5', name: 'E' }, { id: 'm6', name: 'F' }],
      matches,
    }
    const res = calculateSeasonLeaderboard(db, baseSeason)
    const m1 = res.leaderboard.find((r) => r.id === 'm1')
    const m5 = res.leaderboard.find((r) => r.id === 'm5')

    assert.equal(m1.isQualified, true, 'm1 đánh 21 trận -> đủ điều kiện')
    assert.equal(m5.isQualified, false, 'm5 chỉ đánh 1 trận -> chưa đủ điều kiện')
    assert.ok(m5.totalSeasonPoints > m1.totalSeasonPoints, 'm5 điểm cao hơn m1 (m1 chạm sàn 0)')
    assert.ok(m1.rank < m5.rank, 'Nhưng người đủ điều kiện vẫn phải xếp trên người đang thẩm định')
  })
})

/* ==========================================================================
 * Trận giao lưu (ratingEnabled = false) đứng ngoài hệ cày rank.
 * Cả mô hình điểm mùa dẫn xuất từ chênh lệch Elo, mà trận này cố ý không tính
 * Elo — cho nó sinh ±14 điểm rank là mâu thuẫn với chính cái cờ đã bật.
 * ========================================================================== */
test('Season Rank Engine — Trận không tính rating', async (t) => {
  const season = { startDate: '2026-07-01', endDate: '2026-09-30', minMatchesOfficial: 20, inactiveDays: 21 }
  const mk = (id, at, winner, ratingEnabled) => ({
    id, at, sessionId: 's1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'],
    winnerTeam: winner, sets: [[21, 15]], initialRatingA: 500, initialRatingB: 500,
    ...(ratingEnabled === undefined ? {} : { ratingEnabled }),
  })
  const baseDb = {
    members: [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }, { id: 'm3', name: 'C' }, { id: 'm4', name: 'D' }],
    sessions: [{ id: 's1', date: '2026-07-05' }],
  }

  await t.test('11. Trận ratingEnabled=false không sinh điểm và không tính vào mốc 20 trận', () => {
    const rated = calculateSeasonLeaderboard({ ...baseDb, matches: [mk('a', 1000, 'A', true)] }, season)
    const casual = calculateSeasonLeaderboard({ ...baseDb, matches: [mk('a', 1000, 'A', false)] }, season)

    const r = rated.leaderboard.find((x) => x.id === 'm1')
    const c = casual.leaderboard.find((x) => x.id === 'm1')

    assert.equal(r.totalSeasonPoints, 14, 'Trận tính rating: thắng kèo cân = +14')
    assert.equal(r.matchesCount, 1)

    assert.equal(c.totalSeasonPoints, 0, 'Trận giao lưu không được cộng điểm rank')
    assert.equal(c.matchesCount, 0, 'Trận giao lưu không được đếm vào điều kiện 20 trận')
    assert.equal(c.winsCount, 0)
  })

  await t.test('12. Nhưng vẫn được ghi nhận CÓ MẶT trong buổi', () => {
    // Đi tập đánh giao lưu cả buổi vẫn là đi tập — không được mất công chuyên cần.
    const res = calculateSeasonLeaderboard({ ...baseDb, matches: [mk('a', 1000, 'A', false)] }, season)
    const row = res.leaderboard.find((x) => x.id === 'm1')
    assert.equal(row.attendedCount, 1, 'Có ra sân trong buổi thì vẫn tính là có mặt')
  })

  await t.test('13. Trận cũ không có cờ ratingEnabled vẫn được tính (mặc định là tính)', () => {
    const res = calculateSeasonLeaderboard({ ...baseDb, matches: [mk('a', 1000, 'A', undefined)] }, season)
    const row = res.leaderboard.find((x) => x.id === 'm1')
    assert.equal(row.totalSeasonPoints, 14, 'Chỉ loại khi cờ === false, không loại khi thiếu cờ')
  })
})

/* ==========================================================================
 * Panel "Biến động sau trận" ở màn xếp sân dự báo điểm mùa bằng
 * calcSeasonMatchDelta + thưởng Upset. Nhóm test này khoá contract đó:
 * con số hiện TRƯỚC khi bấm Lưu phải đúng bằng con số engine trao SAU khi lưu.
 * ========================================================================== */
test('Season Rank Engine — Dự báo trước trận khớp điểm thực trao', async (t) => {
  const season = { startDate: '2026-07-01', endDate: '2026-09-30', minMatchesOfficial: 20, inactiveDays: 21 }
  const baseDb = {
    members: [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }, { id: 'm3', name: 'C' }, { id: 'm4', name: 'D' }],
    sessions: [{ id: 's1', date: '2026-07-05' }],
  }
  const oneMatch = (ra, rb, winner) => ({
    ...baseDb,
    matches: [{
      id: 'x1', at: 1000, sessionId: 's1', teamA: ['m1', 'm2'], teamB: ['m3', 'm4'],
      winnerTeam: winner, sets: [[21, 15]], initialRatingA: ra, initialRatingB: rb,
    }],
  })
  // Đúng công thức panel dùng: delta theo dải + thưởng Upset khi thắng cách biệt >= 150
  const preview = (myElo, oppElo, won) => {
    const { delta } = calcSeasonMatchDelta(myElo, oppElo, won)
    return delta + (won && oppElo - myElo >= 150 ? 5 : 0)
  }

  await t.test('14. Kèo cân — thắng +14, thua -8 (kẹp sàn 0)', () => {
    const res = calculateSeasonLeaderboard(oneMatch(500, 500, 'A'), season)
    assert.equal(preview(500, 500, true), 14)
    assert.equal(res.leaderboard.find((r) => r.id === 'm1').totalSeasonPoints, 14)
    // Bên thua: preview -8, nhưng điểm hiển thị bị sàn 0 kẹp lại
    assert.equal(preview(500, 500, false), -8)
    assert.equal(res.leaderboard.find((r) => r.id === 'm3').totalSeasonPoints, 0)
  })

  await t.test('15. Lật kèo sâu — preview +27 và engine trao đúng +27', () => {
    // Đội A yếu hơn 200 Elo mà thắng: dải deepUnderdog (+22) + thưởng Upset (+5)
    const res = calculateSeasonLeaderboard(oneMatch(400, 600, 'A'), season)
    assert.equal(preview(400, 600, true), 27, 'Panel phải hiện +27')
    assert.equal(
      res.leaderboard.find((r) => r.id === 'm1').totalSeasonPoints, 27,
      'Số hiện trước khi Lưu mà lệch số trao sau khi Lưu là mất niềm tin vào cả hệ điểm'
    )
    // Đội cửa trên sâu thua: -12
    assert.equal(preview(600, 400, false), -12)
  })

  await t.test('16. Cửa trên thắng — chỉ +10, không có thưởng Upset', () => {
    const res = calculateSeasonLeaderboard(oneMatch(700, 500, 'A'), season)
    assert.equal(preview(700, 500, true), 10)
    assert.equal(res.leaderboard.find((r) => r.id === 'm1').totalSeasonPoints, 10)
    assert.equal(res.leaderboard.find((r) => r.id === 'm1').upsetsCount, 0)
  })
})
