import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateMemberBadges,
  computeClubBadgeStats,
  getBadgeOwners,
  getBadgeChasers,
  getMemberHighestBadge,
  getClubAchievementFeed,
  getStreakTimeline,
  getRarestBadges,
} from '#lib/badges.js'

test('15 Fixes: Thâm niên đọc đúng member.joined và member.joinedAt', () => {
  const d12MonthsAgo = new Date()
  d12MonthsAgo.setMonth(d12MonthsAgo.getMonth() - 13)

  const mockDb = {
    members: [
      { id: 'm1', name: 'Thành viên A', joined: d12MonthsAgo.toISOString() }, // dùng joined
      { id: 'm2', name: 'Thành viên B', joinedAt: d12MonthsAgo.toISOString() }, // dùng joinedAt
    ],
    matches: [],
  }

  const res1 = calculateMemberBadges('m1', mockDb)
  const res2 = calculateMemberBadges('m2', mockDb)

  const congThan1 = res1.unlocked.find((b) => b.id === 'cong_than_1')
  const congThan2 = res2.unlocked.find((b) => b.id === 'cong_than_1')

  assert.ok(congThan1, 'Thành viên có field .joined mở được Công thần 1 năm')
  assert.ok(congThan2, 'Thành viên có field .joinedAt mở được Công thần 1 năm')
})

test('15 Fixes: Không trùng ID và tách biệt ke_ngat_chuoi, bounty_hunter, sat_than', () => {
  const mockDb = {
    members: [
      { id: 'hunter', name: 'Thợ Săn' },
      { id: 'victim1', name: 'Mục Tiêu 1' },
      { id: 'victim2', name: 'Mục Tiêu 2' },
      { id: 'victim3', name: 'Mục Tiêu 3' },
    ],
    matches: [
      // Trận 1: Ngắt bounty của victim1
      { id: 'mt1', at: 10, teamA: ['hunter'], teamB: ['victim1'], winnerTeam: 'A', bountyBroken: true, brokenStreak: 5 },
      // Trận 2: Ngắt bounty tiếp của victim1 (cùng 1 người)
      { id: 'mt2', at: 20, teamA: ['hunter'], teamB: ['victim1'], winnerTeam: 'A', bountyBroken: true, brokenStreak: 6 },
    ],
  }

  // Sau khi ngắt 1 trận bounty:
  const db1 = { ...mockDb, matches: [mockDb.matches[0]] }
  const res1 = calculateMemberBadges('hunter', db1)
  const hasKeNgatChuoi = res1.unlocked.some((b) => b.id === 'ke_ngat_chuoi')
  const hasBountyHunter = res1.unlocked.some((b) => b.id === 'bounty_hunter')
  const hasSatThan = res1.unlocked.some((b) => b.id === 'sat_than')

  assert.equal(hasKeNgatChuoi, true, 'Ngắt 1 bounty phải mở Kẻ ngắt chuỗi')
  assert.equal(hasBountyHunter, false, 'Ngắt 1 bounty KHÔNG được mở Kẻ săn tiền thưởng (cần 3 lần)')
  assert.equal(hasSatThan, false, 'Ngắt 1 bounty KHÔNG được mở Sát thần (cần 3 người khác nhau)')

  // Thêm trận 2 (ngắt lần 2 cùng người) và trận 3 (ngắt lần 3 cùng người) -> Mở bounty_hunter nhưng chưa mở sat_than
  const db3Same = {
    ...mockDb,
    matches: [
      mockDb.matches[0],
      mockDb.matches[1],
      { id: 'mt3', at: 30, teamA: ['hunter'], teamB: ['victim1'], winnerTeam: 'A', bountyBroken: true, brokenStreak: 7 },
    ],
  }
  const res3Same = calculateMemberBadges('hunter', db3Same)
  assert.equal(res3Same.unlocked.some((b) => b.id === 'bounty_hunter'), true, 'Ngắt 3 lần bounty mở Kẻ săn tiền thưởng')
  assert.equal(res3Same.unlocked.some((b) => b.id === 'sat_than'), false, 'Chưa ngắt 3 người KHÁC NHAU thì chưa mở Sát thần')

  // Ngắt 3 người khác nhau: victim1, victim2, victim3
  const db3Diff = {
    ...mockDb,
    matches: [
      { id: 'mt1', at: 10, teamA: ['hunter'], teamB: ['victim1'], winnerTeam: 'A', bountyBroken: true, brokenStreak: 5 },
      { id: 'mt2', at: 20, teamA: ['hunter'], teamB: ['victim2'], winnerTeam: 'A', bountyBroken: true, brokenStreak: 5 },
      { id: 'mt3', at: 30, teamA: ['hunter'], teamB: ['victim3'], winnerTeam: 'A', bountyBroken: true, brokenStreak: 5 },
    ],
  }
  const res3Diff = calculateMemberBadges('hunter', db3Diff)
  assert.equal(res3Diff.unlocked.some((b) => b.id === 'sat_than'), true, 'Ngắt 3 người khác nhau mở được Sát thần')
})

test('15 Fixes: Công nợ dues_clean_months đo đúng 12 tháng liên tiếp không nợ', () => {
  const d24MonthsAgo = new Date()
  d24MonthsAgo.setMonth(d24MonthsAgo.getMonth() - 24)

  const mockDb = {
    members: [{ id: 'm1', name: 'Minh', joined: d24MonthsAgo.toISOString() }],
    dues: [],
    groups: [],
    matches: [],
  }

  // 1. Hoàn toàn sạch nợ -> Mở khóa Sổ sách sạch 12/12
  const resClean = calculateMemberBadges('m1', mockDb)
  const soSachBadge = resClean.unlocked.find((b) => b.id === 'so_sach')
  assert.ok(soSachBadge, 'Thành viên 24 tháng không nợ gì mở được Sổ sách sạch')

  // 2. Tháng trước nợ 1 đồng -> Chuỗi liên tiếp lùi từ tháng trước bị ngắt ngay lập tức
  const prevDate = new Date()
  prevDate.setMonth(prevDate.getMonth() - 1)
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const mockDbDebt = {
    ...mockDb,
    dues: [
      { id: 'd1', memberId: 'm1', month: prevMonthKey, amount: 200000, paid: false, paidAmount: 0 },
    ],
  }
  const resDebt = calculateMemberBadges('m1', mockDbDebt)
  const soSachDebt = resDebt.unlocked.find((b) => b.id === 'so_sach')
  assert.equal(soSachDebt, undefined, 'Có nợ trong tháng trước thì không đạt Sổ sách sạch')
  const soSachProg = resDebt.inProgress.find((b) => b.id === 'so_sach') || resDebt.locked.find((b) => b.id === 'so_sach')
  assert.equal(soSachProg?.currentVal, 0, 'Tiến độ chuỗi tháng sạch liên tiếp về 0')
})

test('15 Fixes: Clutch Win đọc đúng sets dạng mảng lồng [[21, 19]]', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Đức' },
      { id: 'm2', name: 'Huy' },
    ],
    matches: [
      {
        id: 'mt1',
        at: 1000,
        teamA: ['m1'],
        teamB: ['m2'],
        winnerTeam: 'A',
        sets: [[21, 19]], // Mảng lồng các set
      },
    ],
  }

  const feed = getClubAchievementFeed(mockDb)
  const clutch = feed.find((f) => f.type === 'clutch_win')
  assert.ok(clutch, 'Trận đấu 21-19 phải sinh sự kiện clutch_win')
  assert.equal(clutch.score, '21 - 19')
})

test('15 Fixes: getBadgeOwners tìm đúng trận mốc chạm chuỗi', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Vũ' },
      { id: 'm2', name: 'Đối Thủ' },
    ],
    matches: [
      { id: '1', at: 1000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' }, // W 1
      { id: '2', at: 2000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'B' }, // L
      { id: '3', at: 3000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' }, // W 1
      { id: '4', at: 4000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' }, // W 2
      { id: '5', at: 5000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' }, // W 3
      { id: '6', at: 6000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' }, // W 4
      { id: '7', at: 7000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' }, // W 5 (chạm mốc 5 ở trận 7!)
      { id: '8', at: 8000, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' }, // W 6
    ],
  }

  const owners = getBadgeOwners('bat_bai_v', mockDb)
  const vuOwner = owners.find((o) => o.id === 'm1')
  assert.ok(vuOwner, 'Vũ là chủ sở hữu Bất bại V')

  // Trận thứ 7 có timestamp là 7000
  const expectedDate = new Date(7000)
  const expectedAt = `${String(expectedDate.getDate()).padStart(2, '0')}/${String(expectedDate.getMonth() + 1).padStart(2, '0')}`
  assert.equal(vuOwner.at, expectedAt, 'Ngày mở danh hiệu phải là ngày trận chạm chuỗi 5 (trận 7), không phải trận thứ 5 từng chơi')
})

test('15 Fixes: getStreakTimeline nhận season', () => {
  const mockDb = {
    members: [{ id: 'm1', name: 'Nam' }],
    matches: [
      { id: '1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 200, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  const timeline = getStreakTimeline('m1', mockDb, 5)
  assert.equal(timeline.length, 5)
  assert.equal(timeline[0].won, true)
  assert.equal(timeline[1].won, true)
  assert.equal(timeline[2].won, false)
})

test('15 Fixes: getBadgeOwners sessions_count đọc đúng attendance shape db.attendance', () => {
  const mockDb = {
    members: [{ id: 'm1', name: 'Đức' }],
    sessions: [
      { id: 's1', date: '2026-05-10', status: 'closed' },
      { id: 's2', date: '2026-05-12', status: 'closed' },
      { id: 's3', date: '2026-05-14', status: 'closed' },
    ],
    attendance: {
      s1: { m1: true },
      s2: { m1: 'extra' },
      s3: { m1: true },
    },
    matches: [],
  }

  // chuyen_can_50 cần 50 buổi, ở đây mock 3 buổi xem countAttendedSessions
  const owners = getBadgeOwners('chuyen_can_50', mockDb)
  assert.equal(owners.length, 0, 'Chưa đủ 50 buổi thì chưa là owner')

  // Giả sử có 50 buổi
  const sessions50 = []
  const attendance50 = {}
  for (let i = 1; i <= 50; i++) {
    const sid = `s${i}`
    const dateStr = `2026-06-${String(Math.min(30, i)).padStart(2, '0')}`
    sessions50.push({ id: sid, date: dateStr, status: 'closed' })
    attendance50[sid] = { m1: true }
  }
  const mockDb50 = {
    members: [{ id: 'm1', name: 'Đức' }],
    sessions: sessions50,
    attendance: attendance50,
    matches: [],
  }
  const owners50 = getBadgeOwners('chuyen_can_50', mockDb50)
  assert.equal(owners50.length, 1)
  assert.equal(owners50[0].name, 'Đức')
  assert.ok(owners50[0].at, 'Đạt mốc vào buổi thứ 50')
})

test('15 Fixes: beat_all_top5 yêu cầu 5 người KHÁC NHAU trong Top 5', () => {
  const mockDb = {
    members: [
      { id: 'hero', name: 'Hiệp Sĩ', rating: 1200 },
      { id: 't1', name: 'Top 1', rating: 2100 },
      { id: 't2', name: 'Top 2', rating: 2000 },
      { id: 't3', name: 'Top 3', rating: 1900 },
      { id: 't4', name: 'Top 4', rating: 1800 },
      { id: 't5', name: 'Top 5', rating: 1700 },
      { id: 'normal', name: 'Thường', rating: 1000 },
    ],
    matches: [
      // Thắng t1 3 lần, thắng t2 2 lần -> Tổng 5 trận thắng nhưng mới chỉ là 2 người khác nhau
      { id: '1', at: 10, teamA: ['hero'], teamB: ['t1'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['hero'], teamB: ['t1'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['hero'], teamB: ['t1'], winnerTeam: 'A' },
      { id: '4', at: 40, teamA: ['hero'], teamB: ['t2'], winnerTeam: 'A' },
      { id: '5', at: 50, teamA: ['hero'], teamB: ['t2'], winnerTeam: 'A' },
    ],
  }

  const res = calculateMemberBadges('hero', mockDb)
  const b = res.all.find((x) => x.id === 'can_ca_top')
  assert.ok(b)
  assert.equal(b.unlocked, false, 'Chưa mở vì mới hạ 2 người khác nhau trong Top 5')
  assert.equal(b.currentVal, 2, 'Tiến độ là 2/5')

  // Bổ sung thắng t3, t4, t5
  mockDb.matches.push(
    { id: '6', at: 60, teamA: ['hero'], teamB: ['t3'], winnerTeam: 'A' },
    { id: '7', at: 70, teamA: ['hero'], teamB: ['t4'], winnerTeam: 'A' },
    { id: '8', at: 80, teamA: ['hero'], teamB: ['t5'], winnerTeam: 'A' }
  )

  const resUnlocked = calculateMemberBadges('hero', mockDb)
  const bUnlocked = resUnlocked.unlocked.find((x) => x.id === 'can_ca_top')
  assert.ok(bUnlocked, 'Đã hạ cả 5 người khác nhau trong Top 5 thì mở khóa can_ca_top')
  assert.equal(bUnlocked.currentVal, 5)
})

test('15 Fixes: Ba danh hiệu LEGEND mở được từ dữ liệu thực', () => {
  const mockDb = {
    members: [
      { id: 'challenger', name: 'Kẻ Thách Thức', rating: 1500 },
      { id: 'king', name: 'Đương Kim Vô Địch', rating: 2200 },
    ],
    matches: [
      // 1. Thắng Đương kim vô địch (Rank 1)
      { id: '1', at: 100, teamA: ['challenger'], teamB: ['king'], winnerTeam: 'A' },
      // 2. Lội ngược dòng thế kỷ: thua set 1 đậm (8-21), thắng kịch tính set 3 (22-20)
      {
        id: '2',
        at: 200,
        teamA: ['challenger'],
        teamB: ['king'],
        winnerTeam: 'A',
        sets: [
          [8, 21],
          [21, 15],
          [22, 20],
        ],
      },
    ],
  }

  const res = calculateMemberBadges('challenger', mockDb)
  const beatChamp = res.unlocked.find((b) => b.id === 'ha_nha_vo_dich')
  const century = res.unlocked.find((b) => b.id === 'nguoc_dong_the_ky')

  assert.ok(beatChamp, 'Hạ Rank 1 (King) mở được danh hiệu LEGEND Hạ nhà vô địch')
  assert.ok(century, 'Lội ngược dòng thua set 1 sâu và thắng set 3 nghẹt thở mở được Ngược dòng thế kỷ')

  // Kiểm tra Độc cô cầu bại cho người giữ Rank 1
  const resKing = calculateMemberBadges('king', mockDb)
  const docCo = resKing.all.find((b) => b.id === 'doc_co')
  assert.ok(docCo, 'King đang là Rank 1 tích lũy được tiến độ Độc cô cầu bại')
  assert.ok(docCo.currentVal > 0, 'King tích lũy được số ngày giữ Rank 1 > 0')

  // Nếu King giữ Rank 1 đủ 60 ngày thì mở khóa doc_co
  const seasonOld = {
    id: 's1',
    startDate: new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10),
  }
  const resKing60 = calculateMemberBadges('king', mockDb, seasonOld)
  const docCo60 = resKing60.unlocked.find((b) => b.id === 'doc_co')
  assert.ok(docCo60, 'King giữ Rank 1 >= 60 ngày mở khóa được danh hiệu LEGEND Độc cô cầu bại')
  assert.equal(docCo60.unlocked, true)
})

test('15 Fixes: getMemberHighestBadge nhận preloadedSeasonMatches', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Sơn' },
      { id: 'm2', name: 'Tùng' },
    ],
    matches: [
      { id: '1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  const preloaded = mockDb.matches
  const highest = getMemberHighestBadge('m1', mockDb, null, preloaded)
  assert.ok(highest, 'Trả về danh hiệu cao nhất với preloaded matches')
  assert.equal(highest.id, 'mo_man')
})

test('15 Fixes: trum_giai (LEGEND) mở khóa khi là Quán quân CLB / Mùa giải', () => {
  const mockDb = {
    members: [
      { id: 'champ1', name: 'Vô Địch 1' },
      { id: 'player2', name: 'Người Chơi 2' },
    ],
    club: {
      championId: 'champ1',
    },
    matches: [],
  }

  // champ1 là championId của CLB -> mở trum_giai
  const resChamp1 = calculateMemberBadges('champ1', mockDb)
  const badge1 = resChamp1.unlocked.find((b) => b.id === 'trum_giai')
  assert.ok(badge1, 'Thành viên là quán quân CLB mở được trum_giai')
  assert.equal(badge1.unlocked, true)

  // player2 không phải quán quân -> không mở
  const resPlayer2 = calculateMemberBadges('player2', mockDb)
  const badge2 = resPlayer2.unlocked.find((b) => b.id === 'trum_giai')
  assert.equal(badge2, undefined, 'Người chơi thường không mở được trum_giai')

  // Mở qua previousChampion của season
  const mockDbSeason = {
    members: [{ id: 'seasonChamp', name: 'Quán Quân Mùa' }],
    matches: [],
  }
  const season = { id: 's1', previousChampion: 'seasonChamp' }
  const resSeason = calculateMemberBadges('seasonChamp', mockDbSeason, season)
  const badgeSeason = resSeason.unlocked.find((b) => b.id === 'trum_giai')
  assert.ok(badgeSeason, 'Quán quân mùa giải mở được trum_giai')
})

test('15 Fixes: sat_than_doi (beat_top_pair) xét cặp đôi uy tín và mở khóa khi đánh bại', () => {
  const mockDb = {
    members: [
      { id: 'u1', name: 'User 1' },
      { id: 'u2', name: 'User 2' },
      { id: 'pairA1', name: 'A1' },
      { id: 'pairA2', name: 'A2' },
    ],
    matches: [
      // Cặp A1 & A2 thắng 5 trận liên tiếp (uy tín cao: 5 trận, winrate 100%)
      { id: 'm1', at: 10, teamA: ['pairA1', 'pairA2'], teamB: ['other1', 'other2'], winnerTeam: 'A' },
      { id: 'm2', at: 20, teamA: ['pairA1', 'pairA2'], teamB: ['other1', 'other2'], winnerTeam: 'A' },
      { id: 'm3', at: 30, teamA: ['pairA1', 'pairA2'], teamB: ['other1', 'other2'], winnerTeam: 'A' },
      { id: 'm4', at: 40, teamA: ['pairA1', 'pairA2'], teamB: ['other1', 'other2'], winnerTeam: 'A' },
      { id: 'm5', at: 50, teamA: ['pairA1', 'pairA2'], teamB: ['other1', 'other2'], winnerTeam: 'A' },
      // u1 & u2 hạ cặp đôi số 1 CLB
      { id: 'm6', at: 60, teamA: ['u1', 'u2'], teamB: ['pairA1', 'pairA2'], winnerTeam: 'A' },
    ],
  }

  const resU1 = calculateMemberBadges('u1', mockDb)
  const satThanDoi = resU1.unlocked.find((b) => b.id === 'sat_than_doi')
  assert.ok(satThanDoi, 'Đánh bại cặp đôi top 1 CLB mở được danh hiệu LEGEND Sát Thần Đôi')
  assert.equal(satThanDoi.unlocked, true)
})

test('15 Fixes: hasRevengeWin và hasFirstTryBounty tối ưu O(M) chạy chính xác', () => {
  const mockDb = {
    members: [
      { id: 'hunter', name: 'Thợ Săn' },
      { id: 'target', name: 'Con Mồi' },
    ],
    matches: [
      // 1. hunter gặp target lần 1: target đang có bounty và hunter thắng ngay lần đầu -> first_try_bounty
      { id: 'm1', at: 10, teamA: ['hunter'], teamB: ['target'], winnerTeam: 'A', bountyBroken: true },
      // 2. hunter gặp target lần 2: hunter thua
      { id: 'm2', at: 20, teamA: ['hunter'], teamB: ['target'], winnerTeam: 'B' },
      // 3. hunter gặp target lần 3: hunter thắng phục thù -> revenge_win
      { id: 'm3', at: 30, teamA: ['hunter'], teamB: ['target'], winnerTeam: 'A' },
    ],
  }

  const res = calculateMemberBadges('hunter', mockDb)
  const firstTry = res.unlocked.find((b) => b.id === 'tho_san_hoan_hao')
  const revenge = res.unlocked.find((b) => b.id === 'doi_no')

  assert.ok(firstTry, 'Mở được Thợ Săn Hoàn Hảo (first_try_bounty)')
  assert.ok(revenge, 'Mở được Đòi Nợ (revenge_win)')
})

test('15 Fixes: computeClubBadgeStats tổng hợp dữ liệu CLB chuẩn xác', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Rank 1', rating: 2100 },
      { id: 'm2', name: 'Rank 2', rating: 2000 },
      { id: 'm3', name: 'Rank 3', rating: 1900 },
      { id: 'm4', name: 'Rank 4', rating: 1800 },
      { id: 'm5', name: 'Rank 5', rating: 1700 },
      { id: 'm6', name: 'Rank 6', rating: 1600 },
    ],
    club: { championId: 'm1' },
    matches: [
      { id: 'm1', at: 100, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A' },
    ],
  }

  const stats = computeClubBadgeStats(mockDb)
  assert.equal(stats.rank1Member.id, 'm1')
  assert.equal(stats.seasonChampionId, 'm1')
  assert.equal(stats.top5EloMemberIds.length, 5)
  assert.equal(stats.top5EloMemberIds[0], 'm1')
  assert.equal(stats.top5EloMemberIds.includes('m6'), false)
  assert.ok(stats.daysRank1Map.get('m1') > 0)
})
