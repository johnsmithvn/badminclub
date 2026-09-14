import test from 'node:test'
import assert from 'node:assert/strict'
import { detailedCourtBalance } from '#lib/assign.js'
import { calculateSeasonLeaderboard } from '#lib/season.js'
import vi from '#i18n/vi.json' with { type: 'json' }

test('Phase 1 & Phase 2 verification suite', async (t) => {
  await t.test('1. BUG-10: eloGapPill displays Lệch {{gap}} Elo to prevent confusion', () => {
    assert.equal(vi.season.eloGapPill, 'Lệch {{gap}} Elo')
  })

  await t.test('5. BUG-02: Historical matches lacking initialRatingA/B still calculate upset via member seed', () => {
    // Trận đấu mt_old KHÔNG có initialRatingA và initialRatingB
    // Nhưng đội A gồm m_weak (yeu: seed 200), đội B gồm m_strong (kha: seed 800)
    // Đội A thắng -> Chênh lệch 800 - 200 = 600 >= 150 -> Phải tính Upset!
    const mockDb = {
      members: [
        { id: 'm_weak', name: 'Yếu', level: 'yeu', active: true },
        { id: 'm_strong', name: 'Mạnh', level: 'kha', active: true },
      ],
      sessions: [
        { id: 's1', date: '2026-08-01', attendees: ['m_weak', 'm_strong'] },
      ],
      matches: [
        {
          id: 'mt_old',
          sessionId: 's1',
          at: Date.parse('2026-08-01T19:00:00Z'),
          teamA: ['m_weak'],
          teamB: ['m_strong'],
          winnerTeam: 'A',
          sets: [[21, 15]],
          // Cố tình KHÔNG có initialRatingA và initialRatingB
        },
      ],
    }

    const { leaderboard } = calculateSeasonLeaderboard(mockDb)
    const weakRow = leaderboard.find((r) => r.id === 'm_weak')
    assert.ok(weakRow, 'm_weak phải có trong leaderboard')
    assert.equal(weakRow.upsetsCount, 1, 'Trận cũ thiếu initialRatingA/B phải được tính Upset = 1 nhờ seed level')
    assert.equal(weakRow.breakdown.upsetBonusPts, 5, 'Phải được nhận +5 điểm thưởng Upset')
  })

  await t.test('6. LỖ HỔNG-04: fairScore gradient remains active for waitDiff >= 5', () => {
    // Kiểm tra gradient: người chờ 5 lượt vs người chờ 7 lượt không bị cào bằng ở 40
    const players = [
      { key: 'p1', name: 'P1' },
      { key: 'p2', name: 'P2' },
      { key: 'p3', name: 'P3' },
      { key: 'p4', name: 'P4' },
      { key: 'wait1', name: 'Wait5' },
    ]
    // Sân gồm p1, p2, p3, p4 đã đánh 5 trận, wait1 đánh 0 trận -> waitDiff = 5
    const stats5 = { p1: { n: 5 }, p2: { n: 5 }, p3: { n: 5 }, p4: { n: 5 }, wait1: { n: 0 } }
    const bal5 = detailedCourtBalance({
      lineup: { c0t0s0: 'p1', c0t0s1: 'p2', c0t1s0: 'p3', c0t1s1: 'p4' },
      ci: 0,
      ratingsMap: { p1: 500, p2: 500, p3: 500, p4: 500, wait1: 500 },
      matches: [],
      players,
      stats: stats5,
    })

    // Khi waitDiff = 7 (p1..p4 đánh 7 trận, wait1 đánh 0 trận)
    const stats7 = { p1: { n: 7 }, p2: { n: 7 }, p3: { n: 7 }, p4: { n: 7 }, wait1: { n: 0 } }
    const bal7 = detailedCourtBalance({
      lineup: { c0t0s0: 'p1', c0t0s1: 'p2', c0t1s0: 'p3', c0t1s1: 'p4' },
      ci: 0,
      ratingsMap: { p1: 500, p2: 500, p3: 500, p4: 500, wait1: 500 },
      matches: [],
      players,
      stats: stats7,
    })

    assert.equal(bal5.fairness.score, 30, 'waitDiff = 5 -> 100 - 5*14 = 30 (không bị chặn ở 40)')
    assert.equal(bal7.fairness.score, 2, 'waitDiff = 7 -> 100 - 7*14 = 2 (phân biệt rõ với waitDiff 5)')
    assert.ok(bal5.fairness.score > bal7.fairness.score, 'Gradient công bằng phân biệt rõ ràng giữa 5 và 7 lượt chờ')
  })
})

test('Phase 1 — vá lỗi phát sinh sau đợt sửa', async (t) => {
  await t.test('9. Người chưa khai trình độ không được đẩy cả đội thành kèo dưới', () => {
    const mkDb = (guests) => ({
      members: [
        { id: 'mA', name: 'A', level: 'tb', active: true },
        { id: 'mC', name: 'C', level: 'tb', active: true },
        { id: 'mD', name: 'D', level: 'tb', active: true },
      ],
      guests,
      sessions: [{ id: 's1', date: '2026-08-01' }],
      attendance: {},
      matches: [{
        id: 'x1', sessionId: 's1', at: Date.parse('2026-08-01T10:00:00Z'),
        teamA: ['mA', 'gX'], teamB: ['mC', 'mD'], winnerTeam: 'A', sets: [[21, 15]],
      }],
    })

    // Khách KHÔNG khai trình độ: seed 0 sẽ kéo trung bình đội A xuống 250, gap -250 -> deepUnderdog
    // -> cả đội ăn +22 thay vì +14 mỗi trận thắng, và chỉ mất 3 thay vì 8 khi thua.
    const unknown = calculateSeasonLeaderboard(mkDb([{ id: 'gX', name: 'Khách' }]))
    const rowUnknown = unknown.leaderboard.find((r) => r.id === 'mA')
    assert.equal(rowUnknown.matchLogs[0].gap, 0, 'Thiếu trình độ thì phải coi hai đội ngang nhau, không được suy ra kèo dưới')
    assert.equal(rowUnknown.matchLogs[0].tier, 'balanced')
    assert.equal(rowUnknown.matchLogs[0].delta, 14, 'Trao +22 cho một trận cân là lạm phát điểm mùa âm thầm')

    // Khách CÓ khai trình độ ngang trình: vẫn phải ra dải balanced như cũ.
    const known = calculateSeasonLeaderboard(mkDb([{ id: 'gX', name: 'Khách', level: 'tb' }]))
    assert.equal(known.leaderboard.find((r) => r.id === 'mA').matchLogs[0].delta, 14)
  })

  await t.test('10. Trình độ khách lấy theo buổi (sessionGuests) trước khi lấy mức mặc định', () => {
    const db = {
      members: [
        { id: 'mA', name: 'A', level: 'tb', active: true },
        { id: 'mC', name: 'C', level: 'tb', active: true },
        { id: 'mD', name: 'D', level: 'tb', active: true },
      ],
      guests: [{ id: 'gX', name: 'Khách', level: 'yeu' }],
      sessionGuests: [{ id: 'sg1', sessionId: 's1', guestId: 'gX', level: 'kha' }],
      sessions: [{ id: 's1', date: '2026-08-01' }],
      attendance: {},
      matches: [{
        id: 'x1', sessionId: 's1', at: Date.parse('2026-08-01T10:00:00Z'),
        teamA: ['mA', 'gX'], teamB: ['mC', 'mD'], winnerTeam: 'A', sets: [[21, 15]],
      }],
    }
    // kha = 800 -> đội A = (500 + 800) / 2 = 650 vs 500 -> gap +150 -> heavyFavored (thắng chỉ +10).
    // Nếu đọc nhầm `guests.level` (yeu = 200) thì đội A = 350, gap -150 -> underdog (+17).
    const row = calculateSeasonLeaderboard(db).leaderboard.find((r) => r.id === 'mA')
    assert.equal(row.matchLogs[0].gap, 150, 'Khách đánh trình nào thì tính trình đó, màn Chia sân cũng đọc sessionGuests.level')
    assert.equal(row.matchLogs[0].delta, 10)
  })
})
