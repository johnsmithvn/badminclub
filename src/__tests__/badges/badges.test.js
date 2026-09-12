import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMemberStreak,
  getPairStreak,
  getActiveBounties,
  calculateMemberBadges,
  getCollectorLeaderboard,
  getRarestBadges,
  getStreakTimeline,
  getBadgeById,
  getMemberHighestBadge,
  getClubAchievementFeed,
} from '#lib/badges.js'

test('Badges Engine: Chuỗi thắng đơn & tính toán mốc Bất bại', () => {
  const mockDb = {
    members: [{ id: 'm1', name: 'Minh' }, { id: 'm2', name: 'Hà' }],
    matches: [
      { id: 'mt1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: 'mt2', at: 200, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: 'mt3', at: 300, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: 'mt4', at: 400, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: 'mt5', at: 500, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  const { streak, maxStreak } = getMemberStreak('m1', mockDb)
  assert.equal(streak, 5, 'Chuỗi thắng liên tiếp của Minh phải đạt 5 trận')
  assert.equal(maxStreak, 5, 'Chuỗi dài nhất phải đạt 5 trận')

  const res = calculateMemberBadges('m1', mockDb)
  const batBaiV = res.unlocked.find((b) => b.id === 'bat_bai_v')
  assert.ok(batBaiV, 'Minh phải mở khóa danh hiệu Bất bại V khi đạt chuỗi 5')
  assert.equal(batBaiV.tier, 'elite')

  const batBaiX = res.inProgress.find((b) => b.id === 'bat_bai_x')
  assert.ok(batBaiX, 'Bất bại X phải ở trạng thái đang đạt (inProgress)')
  assert.equal(batBaiX.pct, 50, 'Tiến độ Bất bại X phải là 50% (5/10)')
})

test('Badges Engine: Tự động kích hoạt Bounty khi chạm mốc 5 trận', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Minh' },
      { id: 'm2', name: 'Hà' },
      { id: 'm3', name: 'Tuấn' },
    ],
    matches: [
      { id: '1', at: 10, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '4', at: 40, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' },
      { id: '5', at: 50, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '6', at: 60, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' }, // streak 6 -> HOT
    ],
  }

  const bounties = getActiveBounties(mockDb)
  assert.equal(bounties.length, 1, 'Phải có đúng 1 bounty đang mở')
  assert.equal(bounties[0].targetId, 'm1')
  assert.equal(bounties[0].streak, 6)
  assert.equal(bounties[0].hot, true, 'Chuỗi >= 6 phải được đánh dấu HOT')
  assert.equal(bounties[0].tier, 'legend')
})

test('Badges Engine: Bounty Đôi độc lập với kết quả đánh cặp khác', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Tuấn' },
      { id: 'm2', name: 'Vũ' },
      { id: 'm3', name: 'Nam' },
      { id: 'm4', name: 'Sơn' },
    ],
    matches: [
      // Tuấn và Vũ đánh cùng nhau thắng 4 trận liên tiếp
      { id: '1', at: 10, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A' },
      // Tuấn đánh cặp với người khác thua một trận
      { id: '4', at: 35, teamA: ['m1', 'm3'], teamB: ['m2', 'm4'], winnerTeam: 'B' },
      // Tuấn và Vũ lại đánh cùng nhau thắng tiếp trận thứ 4
      { id: '5', at: 40, teamA: ['m1', 'm2'], teamB: ['m3', 'm4'], winnerTeam: 'A' },
    ],
  }

  const pairStreak = getPairStreak('m1', 'm2', mockDb)
  assert.equal(pairStreak.streak, 4, 'Cặp Tuấn - Vũ phải duy trì chuỗi 4 trận thắng cùng nhau')

  const bounties = getActiveBounties(mockDb)
  const pairBounty = bounties.find((b) => b.type === 'pair')
  assert.ok(pairBounty, 'Cặp Tuấn - Vũ phải được kích hoạt Bounty Đôi')
  assert.equal(pairBounty.streak, 4)
})

test('Badges Engine: Điểm sưu tập tính đúng theo tier và tự phong bằng 0', () => {
  const mockDb = {
    members: [{ id: 'm1', name: 'Sơn' }],
    matches: [
      { id: '1', at: 10, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '4', at: 40, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '5', at: 50, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  const res = calculateMemberBadges('m1', mockDb)
  // Bất bại V (Elite 30) + Bất bại 3 (Rare 15) + Mở màn (Rare 15) = 60 pts.
  // 10 huy hiệu fun = 0 pts.
  assert.equal(res.collectionScore, 60, 'Tổng điểm sưu tập tính chuẩn xác theo các huy hiệu chính thức đã mở, Fun = 0')
})

test('Badges Engine: Bảng xếp hạng Collector Leaderboard sắp xếp chuẩn', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Minh' },
      { id: 'm2', name: 'Tuấn' },
    ],
    matches: [
      // Minh có chuỗi 5 -> Mở khóa các huy hiệu chuỗi và trận đấu
      { id: '1', at: 10, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' },
      { id: '4', at: 40, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' },
      { id: '5', at: 50, teamA: ['m1'], teamB: ['m3'], winnerTeam: 'A' },
    ],
  }

  const lb = getCollectorLeaderboard(mockDb)
  assert.equal(lb.length, 2)
  assert.equal(lb[0].name, 'Minh')
  assert.equal(lb[0].rank, 1)
  assert.equal(lb[0].score, 60)
  assert.equal(lb[0].count, 3, 'Minh có 3 huy hiệu chính thức đã mở, không tính danh hiệu tự phong')
  assert.equal(lb[1].name, 'Tuấn')
  assert.equal(lb[1].rank, 2)
  assert.equal(lb[1].score, 0)
  assert.equal(lb[1].count, 0, 'Tuấn chưa mở huy hiệu chính thức nào, không tính tự phong')
})

test('Badges Engine: Streak timeline 10 ô W/L', () => {
  const mockDb = {
    members: [{ id: 'm1', name: 'Minh' }],
    matches: [
      { id: '1', at: 10, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  const timeline = getStreakTimeline('m1', mockDb, 10)
  assert.equal(timeline.length, 10)
  assert.equal(timeline[0].label, 'W')
  assert.equal(timeline[1].label, 'W')
  assert.equal(timeline[2].label, 'W')
  assert.equal(timeline[3].label, '4')
  assert.equal(timeline[9].label, '10')
})

test('Badges Engine: getBadgeById tra cứu chính xác', () => {
  const b1 = getBadgeById('bat_bai_v')
  assert.ok(b1)
  assert.equal(b1.id, 'bat_bai_v')
  assert.equal(b1.tier, 'elite')

  const b2 = getBadgeById('bounty_hunter')
  assert.ok(b2)
  assert.equal(b2.tier, 'epic')

  const bNone = getBadgeById('khong_ton_tai')
  assert.equal(bNone, null)
})

test('Badges Engine: getMemberHighestBadge chọn đúng tier cao nhất', () => {
  const mockDb = {
    members: [{ id: 'm1', name: 'Minh' }],
    matches: [
      { id: '1', at: 10, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '4', at: 40, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '5', at: 50, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  const highest = getMemberHighestBadge('m1', mockDb)
  assert.ok(highest)
  // Đã mở Bất bại V (Elite)
  assert.equal(highest.id, 'bat_bai_v')
  assert.equal(highest.tier, 'elite')
})

test('Badges Engine: getClubAchievementFeed trích xuất sự kiện chuẩn xác', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Minh' },
      { id: 'm2', name: 'Tuấn' },
    ],
    matches: [
      // Tuấn thắng Minh ngắt chuỗi
      {
        id: 'mt-break',
        at: 1000,
        teamA: ['m2'],
        teamB: ['m1'],
        winnerTeam: 'A',
        scoreTeamA: 21,
        scoreTeamB: 19,
        bountyBroken: true,
        brokenStreak: 8,
      },
    ],
    playerRatings: {
      m2: { rating: 1520, displayRating: 1520 },
    },
  }

  const feed = getClubAchievementFeed(mockDb)
  assert.ok(feed.length >= 1)

  const bountyEvent = feed.find((f) => f.type === 'bounty_break')
  assert.ok(bountyEvent, 'Phải có sự kiện bounty_break')
  assert.equal(bountyEvent.actorName, 'Tuấn')
  assert.equal(bountyEvent.targetName, 'Minh')
  assert.equal(bountyEvent.streakBroken, 8)
  assert.equal(bountyEvent.score, '21 - 19')

  const eloEvent = feed.find((f) => f.type === 'elo_milestone')
  assert.ok(eloEvent, 'Phải có sự kiện elo_milestone khi đạt 1500+')
  assert.equal(eloEvent.actorName, 'Tuấn')
  assert.equal(eloEvent.elo, 1520)
})

test('Badges: Cơ chế mở khóa offline -> online chỉ bật cho chính chủ nhận danh hiệu', () => {
  // Giả sử có 2 thành viên trong CLB
  const mockDb = {
    clubId: 'club_badminton_1',
    members: [
      { id: 'm1', name: 'Minh', userId: 'user_minh', active: true },
      { id: 'm2', name: 'Hà', userId: 'user_ha', active: true },
    ],
    matches: [
      // Minh đạt chuỗi thắng 5 trận trong khi offline
      { id: '1', at: 10, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '4', at: 40, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '5', at: 50, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  // 1. Khi Hà đăng nhập (user_ha):
  const dbHa = { ...mockDb, currentUserId: 'user_ha' }
  const meHa = dbHa.members.find((m) => m.userId === dbHa.currentUserId)
  assert.equal(meHa.id, 'm2')
  const badgesHa = calculateMemberBadges(meHa.id, dbHa).unlocked
  assert.equal(badgesHa.some((b) => b.id === 'bat_bai_v'), false, 'Hà không nhận danh hiệu Bất bại V')

  // 2. Khi Minh đăng nhập lại (user_minh - lần tới onl):
  const dbMinh = { ...mockDb, currentUserId: 'user_minh' }
  const meMinh = dbMinh.members.find((m) => m.userId === dbMinh.currentUserId)
  assert.equal(meMinh.id, 'm1')
  const badgesMinh = calculateMemberBadges(meMinh.id, dbMinh).unlocked
  const batBaiV = badgesMinh.find((b) => b.id === 'bat_bai_v')
  assert.ok(batBaiV, 'Minh đạt danh hiệu Bất bại V sau khi các trận đấu được ghi nhận')

  // 3. Kiểm tra danh sách đã xem:
  const seenBadgesMinh = ['veteran_1'] // Minh mới chỉ xem veteran_1 trước đó
  const unseenMinh = badgesMinh.filter((b) => !seenBadgesMinh.includes(b.id))
  assert.ok(unseenMinh.some((b) => b.id === 'bat_bai_v'), 'bat_bai_v nằm trong danh sách chưa xem của Minh')

  // Sau khi Minh xem và đánh dấu:
  seenBadgesMinh.push('bat_bai_v')
  const unseenMinhNext = badgesMinh.filter((b) => !seenBadgesMinh.includes(b.id))
  assert.equal(unseenMinhNext.some((b) => b.id === 'bat_bai_v'), false, 'bat_bai_v đã được đánh dấu đã xem')
})

