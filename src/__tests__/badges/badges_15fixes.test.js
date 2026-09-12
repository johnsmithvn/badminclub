import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateMemberBadges,
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
    matches: [],
  }

  // 1. Hoàn toàn sạch nợ -> Mở khóa Sổ sách sạch 12/12
  const resClean = calculateMemberBadges('m1', mockDb)
  const soSachBadge = resClean.unlocked.find((b) => b.id === 'so_sach')
  assert.ok(soSachBadge, 'Thành viên 24 tháng không nợ gì mở được Sổ sách sạch')

  // 2. Tháng hiện tại nợ 1 đồng -> Chuỗi liên tiếp lùi từ tháng hiện tại bị ngắt ngay lập tức
  const curMonthKey = new Date().toISOString().slice(0, 7)
  const mockDbDebt = {
    ...mockDb,
    dues: [
      { id: 'd1', memberId: 'm1', month: curMonthKey, amount: 200000, paid: false, paidAmount: 0 },
    ],
  }
  const resDebt = calculateMemberBadges('m1', mockDbDebt)
  const soSachDebt = resDebt.unlocked.find((b) => b.id === 'so_sach')
  assert.equal(soSachDebt, undefined, 'Có nợ trong tháng hiện tại thì không đạt Sổ sách sạch')
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
