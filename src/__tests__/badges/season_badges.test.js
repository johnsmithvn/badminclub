import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getMemberStreak,
  getActiveBounties,
  calculateMemberBadges,
} from '#lib/badges.js'
import { seasonMatchesOf } from '#lib/season.js'

test('Season Badges: C1 - Trận chưa có kết quả (winnerTeam: null) không được làm đứt chuỗi', () => {
  const mockDb = {
    members: [
      { id: 'm1', name: 'Minh', active: true },
      { id: 'm2', name: 'Hà', active: true },
    ],
    matches: [
      // 3 trận thắng liên tiếp
      { id: '1', at: 100, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 200, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', at: 300, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      // 1 trận dở dang chưa nhập tỷ số
      { id: '4', at: 400, teamA: ['m1'], teamB: ['m2'], winnerTeam: null },
    ],
  }

  const { streak, maxStreak } = getMemberStreak('m1', mockDb)
  assert.equal(streak, 3, 'Trận chưa kết quả không được tính là thua, chuỗi hiện tại phải giữ 3')
  assert.equal(maxStreak, 3, 'Chuỗi dài nhất phải là 3')
})

test('Season Badges: A2 - Chuỗi thắng phải cắt theo mùa giải (không tính all-time)', () => {
  const season1 = { id: 's1', name: 'Mùa 1', startDate: '2026-01-01', endDate: '2026-03-31', active: false }
  const season2 = { id: 's2', name: 'Mùa 2', startDate: '2026-04-01', endDate: '2026-06-30', active: true }

  const mockDb = {
    seasons: [season1, season2],
    members: [{ id: 'm1', name: 'Minh', active: true }, { id: 'm2', name: 'Hà', active: true }],
    matches: [
      // Mùa 1: Minh thắng 5 trận liên tiếp
      { id: '1', playedAt: '2026-02-01', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', playedAt: '2026-02-05', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', playedAt: '2026-02-10', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '4', playedAt: '2026-02-15', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '5', playedAt: '2026-02-20', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      // Mùa 2: Minh mới chỉ thắng 1 trận
      { id: '6', playedAt: '2026-04-10', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  // Khi tính cho mùa 2 (mùa đang active)
  const { streak: streakS2, maxStreak: maxS2 } = getMemberStreak('m1', mockDb, season2)
  assert.equal(streakS2, 1, 'Chuỗi của Minh trong Mùa 2 chỉ là 1 trận')
  assert.equal(maxS2, 1, 'Chuỗi dài nhất của Minh trong Mùa 2 chỉ là 1 trận')

  // Mùa 1
  const { streak: streakS1, maxStreak: maxS1 } = getMemberStreak('m1', mockDb, season1)
  assert.equal(streakS1, 5, 'Chuỗi trong Mùa 1 phải là 5')
})

test('Season Badges: A3 & A4 - Bounty cắt theo mùa và thống nhất ngưỡng 5, không fallback 2', () => {
  const season1 = { id: 's1', startDate: '2026-01-01', endDate: '2026-03-31', active: false }
  const season2 = { id: 's2', startDate: '2026-04-01', endDate: '2026-06-30', active: true }

  const mockDb = {
    seasons: [season1, season2],
    members: [{ id: 'm1', name: 'Minh', active: true }, { id: 'm2', name: 'Hà', active: true }],
    matches: [
      // Mùa 1: Minh thắng 6 trận
      { id: '1', playedAt: '2026-03-01', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', playedAt: '2026-03-05', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', playedAt: '2026-03-10', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '4', playedAt: '2026-03-15', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '5', playedAt: '2026-03-20', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '6', playedAt: '2026-03-25', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      // Mùa 2: Minh thắng 2 trận (dưới ngưỡng 5)
      { id: '7', playedAt: '2026-04-05', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '8', playedAt: '2026-04-10', teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  // Ở Mùa 2, Minh chuỗi 2 < 5 -> không được có Bounty, không được fallback chuỗi 2
  const bountiesS2 = getActiveBounties(mockDb, season2)
  assert.equal(bountiesS2.length, 0, 'Mùa 2 không có ai chuỗi >= 5 nên bảng Bounty phải rỗng (không fallback 2)')
})

test('Season Badges: C2 - Chuỗi thắng đang chạy hiển thị đúng tiến độ inProgress và mở khóa vĩnh viễn khi chạm mốc', () => {
  const mockDb = {
    members: [{ id: 'm1', name: 'Minh', active: true }, { id: 'm2', name: 'Hà', active: true }],
    matches: [
      // Minh thắng 8 trận liên tiếp đang chạy
      { id: '1', at: 10, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '2', at: 20, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '3', at: 30, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '4', at: 40, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '5', at: 50, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '6', at: 60, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '7', at: 70, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
      { id: '8', at: 80, teamA: ['m1'], teamB: ['m2'], winnerTeam: 'A' },
    ],
  }

  const { inProgress, unlocked } = calculateMemberBadges('m1', mockDb)
  const batBaiX = inProgress.find((b) => b.id === 'bat_bai_x')
  assert.ok(batBaiX, 'Bất bại X phải ở trạng thái inProgress khi đang có chuỗi 8')
  assert.equal(batBaiX.currentVal, 8, 'Tiến độ Bất bại X phải là chuỗi 8 đang chạy')
  assert.equal(batBaiX.pct, 80, 'Tiến độ phải là 80% (8/10)')

  const batBaiV = unlocked.find((b) => b.id === 'bat_bai_v')
  assert.ok(batBaiV, 'Bất bại V (mốc 5) phải mở khóa khi chuỗi đạt 8')
})

test('Season Badges: A1 - so_sach không cấp cho người đang nợ công nợ', () => {
  const mockDbWithDebt = {
    month: '2026-08',
    members: [{ id: 'm1', name: 'Minh', joinedAt: '2024-01-01', active: true }],
    dues: [{ id: 'd1', memberId: 'm1', month: '2026-08', amount: 300000, paid: 0 }], // Nợ quỹ 300k
    sessionGuests: [],
  }

  const resDebt = calculateMemberBadges('m1', mockDbWithDebt)
  const soSachDebt = resDebt.unlocked.find((b) => b.id === 'so_sach')
  assert.equal(soSachDebt, undefined, 'Người đang nợ quỹ không được mở khóa huy hiệu Sổ sách sạch')

  const mockDbClean = {
    month: '2026-08',
    members: [{ id: 'm1', name: 'Minh', joinedAt: '2024-01-01', active: true }], // thâm niên > 12 tháng
    dues: [{ id: 'd1', memberId: 'm1', month: '2026-08', amount: 300000, paid: 300000 }], // Đã đóng đủ
    sessionGuests: [],
  }

  const resClean = calculateMemberBadges('m1', mockDbClean)
  const soSachClean = resClean.unlocked.find((b) => b.id === 'so_sach')
  assert.ok(soSachClean, 'Người đủ thâm niên và sổ sách sạch phải mở khóa huy hiệu so_sach')
})
