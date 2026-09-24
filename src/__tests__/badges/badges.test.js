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
  const batBai5 = res.unlocked.find((b) => b.id === 'bat_bai_5')
  assert.ok(batBai5, 'Minh phải mở khóa danh hiệu Bất bại I khi đạt chuỗi 5')
  assert.equal(batBai5.tier, 'rare')

  const batBai10 = res.inProgress.find((b) => b.id === 'bat_bai_10')
  assert.ok(batBai10, 'Bất bại III phải ở trạng thái đang đạt (inProgress)')
  assert.equal(batBai10.pct, 50, 'Tiến độ Bất bại 10 phải là 50% (5/10)')
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
  // Bất bại I (Rare 15) = 15 pts.
  // 10 huy hiệu fun = 0 pts.
  assert.equal(res.collectionScore, 15, 'Tổng điểm sưu tập tính chuẩn xác theo các huy hiệu chính thức đã mở, Fun = 0')
})

test('Badges Engine: Bảng xếp hạng Collector Leaderboard sắp xếp chuẩn', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Minh' },
      { id: 'm2', name: 'Tuấn' },
    ],
    matches: [
      // Minh có chuỗi 5 -> Mở khóa Bất bại I
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
  assert.equal(lb[0].score, 15)
  assert.equal(lb[0].count, 1, 'Minh có 1 huy hiệu chính thức đã mở, không tính danh hiệu tự phong')
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

test('Badges Engine: getBadgeById tra cứu chính xác và hỗ trợ alias ID cũ', () => {
  const b1 = getBadgeById('bat_bai_5')
  assert.ok(b1)
  assert.equal(b1.id, 'bat_bai_5')
  assert.equal(b1.tier, 'rare')

  // Tra bằng alias ID cũ bat_bai_v
  const bAlias = getBadgeById('bat_bai_v')
  assert.ok(bAlias)
  assert.equal(bAlias.id, 'bat_bai_5')

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
  // Đã mở Bất bại I (Rare)
  assert.equal(highest.id, 'bat_bai_5')
  assert.equal(highest.tier, 'rare')
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
  assert.equal(badgesHa.some((b) => b.id === 'bat_bai_5'), false, 'Hà không nhận danh hiệu Bất bại I')

  // 2. Khi Minh đăng nhập lại (user_minh - lần tới onl):
  const dbMinh = { ...mockDb, currentUserId: 'user_minh' }
  const meMinh = dbMinh.members.find((m) => m.userId === dbMinh.currentUserId)
  assert.equal(meMinh.id, 'm1')
  const badgesMinh = calculateMemberBadges(meMinh.id, dbMinh).unlocked
  const batBai5 = badgesMinh.find((b) => b.id === 'bat_bai_5')
  assert.ok(batBai5, 'Minh đạt danh hiệu Bất bại I sau khi các trận đấu được ghi nhận')

  // 3. Kiểm tra danh sách đã xem:
  const seenBadgesMinh = ['veteran_1'] // Minh mới chỉ xem veteran_1 trước đó
  const unseenMinh = badgesMinh.filter((b) => !seenBadgesMinh.includes(b.id))
  assert.ok(unseenMinh.some((b) => b.id === 'bat_bai_5'), 'bat_bai_5 nằm trong danh sách chưa xem của Minh')

  // Sau khi Minh xem và đánh dấu:
  seenBadgesMinh.push('bat_bai_5')
  const unseenMinhNext = badgesMinh.filter((b) => !seenBadgesMinh.includes(b.id))
  assert.equal(unseenMinhNext.some((b) => b.id === 'bat_bai_5'), false, 'bat_bai_5 đã được đánh dấu đã xem')
})

test('Guest Names: getMemberSeasonLedger hiển thị đúng tên khách thay vì UUID', async () => {
  const { getMemberSeasonLedger } = await import('../../lib/season.js')
  const { playerName } = await import('../../lib/money.js')

  const guestId = '16277406-a57c-46f8-9753-4c3eebedcfd6'
  const mockDb = {
    members: [
      { id: 'm1', name: 'Anh Tungdd' },
      { id: 'm2', name: 'Đức Anh' },
      { id: 'm3', name: 'Trường' },
    ],
    guests: [
      { id: guestId, name: 'Khách Nam' },
    ],
    matches: [
      {
        id: 'mt-guest-break',
        at: 1789386120000,
        teamA: ['m1', guestId],
        teamB: ['m2', 'm3'],
        winnerTeam: 'A',
        sets: [[21, 15]],
        bountyBroken: true,
        brokenStreak: 6,
        scoreText: '21 - 15',
      },
    ],
    playerRatings: {
      m1: { rating: 1600, displayRating: 1600 },
      m2: { rating: 1550, displayRating: 1550 },
      m3: { rating: 1520, displayRating: 1520 },
    },
  }

  // 1. Kiểm tra playerName trả về tên khách thật
  assert.equal(playerName(mockDb, guestId), 'Khách Nam')

  // 2. Kiểm tra getMemberSeasonLedger của Anh Tungdd
  const ledger = getMemberSeasonLedger('m1', mockDb)
  assert.ok(ledger)
  assert.ok(ledger.recentEvents.length >= 1)
  const ev = ledger.recentEvents[0]
  assert.equal(ev.partnerName, 'Khách Nam', 'partnerName phải là tên khách, không được là UUID')
  assert.ok(!ev.partnerName.includes(guestId))
})


