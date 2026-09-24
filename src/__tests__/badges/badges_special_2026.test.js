import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateMemberBadges, getBadgeById, resolveBadgeId } from '#lib/badges.js'

test('Badges 2026: can_quet_clb yêu cầu thắng >= 85% số thành viên active trong CLB', () => {
  // Giả sử CLB có 11 thành viên active (trừ người chơi còn 10 thành viên)
  // Ngưỡng 85% -> cần thắng ít nhất ceil(10 * 0.85) = 9 thành viên khác nhau
  const members = [
    { id: 'me', name: 'Tôi', active: true },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `mem_${i + 1}`, name: `Thành viên ${i + 1}`, active: true }))
  ]

  // Thắng 8 người -> 80% -> Chưa mở
  const matches8 = Array.from({ length: 8 }, (_, i) => ({
    id: `m_${i}`,
    at: (i + 1) * 10,
    teamA: ['me'],
    teamB: [`mem_${i + 1}`],
    winnerTeam: 'A',
  }))

  const mockDb8 = { members, matches: matches8 }
  const res8 = calculateMemberBadges('me', mockDb8)
  const b8 = res8.all.find((b) => b.id === 'can_quet_clb')
  assert.ok(b8)
  assert.equal(b8.unlocked, false, '8/10 người (80%) chưa đạt ngưỡng 85%')
  assert.equal(b8.currentVal, 80)

  // Thắng thêm người thứ 9 -> 90% -> Mở khóa!
  const matches9 = [
    ...matches8,
    { id: 'm_9', at: 90, teamA: ['me'], teamB: ['mem_9'], winnerTeam: 'A' },
  ]
  const mockDb9 = { members, matches: matches9 }
  const res9 = calculateMemberBadges('me', mockDb9)
  const b9 = res9.unlocked.find((b) => b.id === 'can_quet_clb')
  assert.ok(b9, '9/10 người (90%) vượt ngưỡng 85% càn quét CLB')
  assert.equal(b9.unlocked, true)
})

test('Badges 2026: dai_nao_thien_cung yêu cầu thắng tất cả cao thủ Top 5 mỗi người >= 2 lần', () => {
  const members = [
    { id: 'challenger', name: 'Kẻ Thách Thức', rating: 1200 },
    { id: 'top1', name: 'T1', rating: 2100 },
    { id: 'top2', name: 'T2', rating: 2000 },
    { id: 'top3', name: 'T3', rating: 1900 },
    { id: 'top4', name: 'T4', rating: 1800 },
    { id: 'top5', name: 'T5', rating: 1700 },
  ]

  // Thắng top1 3 lần, top2 2 lần, top3 2 lần, top4 2 lần, nhưng top5 mới 1 lần
  const matches = [
    { id: '1', at: 10, teamA: ['challenger'], teamB: ['top1'], winnerTeam: 'A' },
    { id: '2', at: 20, teamA: ['challenger'], teamB: ['top1'], winnerTeam: 'A' },
    { id: '3', at: 30, teamA: ['challenger'], teamB: ['top1'], winnerTeam: 'A' },
    { id: '4', at: 40, teamA: ['challenger'], teamB: ['top2'], winnerTeam: 'A' },
    { id: '5', at: 50, teamA: ['challenger'], teamB: ['top2'], winnerTeam: 'A' },
    { id: '6', at: 60, teamA: ['challenger'], teamB: ['top3'], winnerTeam: 'A' },
    { id: '7', at: 70, teamA: ['challenger'], teamB: ['top3'], winnerTeam: 'A' },
    { id: '8', at: 80, teamA: ['challenger'], teamB: ['top4'], winnerTeam: 'A' },
    { id: '9', at: 90, teamA: ['challenger'], teamB: ['top4'], winnerTeam: 'A' },
    { id: '10', at: 100, teamA: ['challenger'], teamB: ['top5'], winnerTeam: 'A' },
  ]

  const resIncomplete = calculateMemberBadges('challenger', { members, matches })
  const bIncomplete = resIncomplete.all.find((x) => x.id === 'dai_nao_thien_cung')
  assert.equal(bIncomplete.unlocked, false, 'Top 5 mới bị hạ 1 lần chưa đủ điều kiện mỗi người >= 2 lần')
  assert.equal(bIncomplete.currentVal, 4, 'Mới có 4/5 người bị hạ >= 2 lần')

  // Thắng tiếp top5 lần 2
  const matchesFull = [...matches, { id: '11', at: 110, teamA: ['challenger'], teamB: ['top5'], winnerTeam: 'A' }]
  const resFull = calculateMemberBadges('challenger', { members, matches: matchesFull })
  const bFull = resFull.unlocked.find((x) => x.id === 'dai_nao_thien_cung')
  assert.ok(bFull, 'Cả 5 người trong Top 5 bị hạ >= 2 lần mở khóa Đại Náo Thiên Cung')
  assert.equal(bFull.unlocked, true)
  assert.equal(bFull.currentVal, 5)
})

test('Badges 2026: ke_di_san đòi hỏi chênh lệch Elo >= 120 và mốc 10, 20, 30', () => {
  const members = [
    { id: 'p1', name: 'Player 1' },
    { id: 'p2', name: 'High Elo' },
  ]

  // Thắng 10 trận mà đối thủ chỉ hơn 80 Elo (chưa đủ mốc 120)
  const matches80 = Array.from({ length: 10 }, (_, i) => ({
    id: `m_${i}`,
    at: (i + 1) * 10,
    teamA: ['p1'],
    teamB: ['p2'],
    winnerTeam: 'A',
    initialRatingA: 1000,
    initialRatingB: 1080,
  }))

  const res80 = calculateMemberBadges('p1', { members, matches: matches80 })
  assert.equal(res80.unlocked.some((b) => b.id === 'ke_di_san_10'), false, 'Chênh lệch 80 Elo chưa đủ mốc 120 Elo')

  // Thắng 10 trận với đối thủ hơn 130 Elo (>= 120 Elo)
  const matches130 = Array.from({ length: 10 }, (_, i) => ({
    id: `m_${i}`,
    at: (i + 1) * 10,
    teamA: ['p1'],
    teamB: ['p2'],
    winnerTeam: 'A',
    initialRatingA: 1000,
    initialRatingB: 1130,
  }))

  const res130 = calculateMemberBadges('p1', { members, matches: matches130 })
  const b10 = res130.unlocked.find((b) => b.id === 'ke_di_san_10')
  assert.ok(b10, 'Hạ 10 trận đối thủ hơn >= 120 Elo mở Kẻ Đi Săn I')
  assert.equal(b10.unlocked, true)
})

test('Badges 2026: ke_huy_diet_giac_mo yêu cầu đấu >= 15 trận với đối thủ dưới >= 50 Elo và winrate >= 90%', () => {
  const members = [
    { id: 'gatekeeper', name: 'Gác Cổng' },
    { id: 'underdog', name: 'Cửa Dưới' },
  ]

  // Đấu 14 trận thắng cả 14 (winrate 100% nhưng chưa đủ 15 trận)
  const matches14 = Array.from({ length: 14 }, (_, i) => ({
    id: `m_${i}`,
    at: (i + 1) * 10,
    teamA: ['gatekeeper'],
    teamB: ['underdog'],
    winnerTeam: 'A',
    initialRatingA: 1500,
    initialRatingB: 1400, // chênh 100 Elo >= 50 Elo
  }))

  const res14 = calculateMemberBadges('gatekeeper', { members, matches: matches14 })
  assert.equal(res14.unlocked.some((b) => b.id === 'ke_huy_diet_giac_mo'), false, '14 trận chưa đủ tối thiểu 15 trận')

  // Thêm trận thứ 15 thắng -> 15/15 (100% >= 90%)
  const matches15 = [
    ...matches14,
    { id: 'm_15', at: 150, teamA: ['gatekeeper'], teamB: ['underdog'], winnerTeam: 'A', initialRatingA: 1500, initialRatingB: 1400 }
  ]
  const res15 = calculateMemberBadges('gatekeeper', { members, matches: matches15 })
  const b15 = res15.unlocked.find((b) => b.id === 'ke_huy_diet_giac_mo')
  assert.ok(b15, '15 trận thắng 100% trước kèo dưới mở Kẻ Hủy Diệt Giấc Mơ')
  assert.equal(b15.unlocked, true)
})

test('Badges 2026: sao_ma_do_duoc và nu_hoang_san_cau trao cho Top 1 Nam/Nữ khi đủ 20 trận', () => {
  const members = [
    { id: 'male_top', name: 'Nam Vương', gender: 'nam', rating: 2200 },
    { id: 'male_sub', name: 'Nam Á Vương', gender: 'nam', rating: 1800 },
    { id: 'fem_top', name: 'Nữ Hoàng', gender: 'nu', rating: 2000 },
    { id: 'fem_sub', name: 'Nữ Á Vương', gender: 'nu', rating: 1700 },
  ]

  // Đấu 20 trận (thắng 15 trận)
  const matchesMale = Array.from({ length: 20 }, (_, i) => ({
    id: `m_m_${i}`,
    at: (i + 1) * 10,
    teamA: ['male_top'],
    teamB: ['male_sub'],
    winnerTeam: i < 15 ? 'A' : 'B',
  }))

  const matchesFem = Array.from({ length: 20 }, (_, i) => ({
    id: `m_f_${i}`,
    at: (i + 1) * 10,
    teamA: ['fem_top'],
    teamB: ['fem_sub'],
    winnerTeam: i < 15 ? 'A' : 'B',
  }))

  const allMatches = [...matchesMale, ...matchesFem]
  const db = { members, matches: allMatches }

  const resMale = calculateMemberBadges('male_top', db)
  const resFem = calculateMemberBadges('fem_top', db)

  assert.ok(resMale.unlocked.some((b) => b.id === 'sao_ma_do_duoc'), 'Top 1 Nam đủ 20 trận mở Sao mà đỡ được')
  assert.equal(resMale.unlocked.some((b) => b.id === 'nu_hoang_san_cau'), false, 'Nam không được nhận Nữ hoàng sân cầu')

  assert.ok(resFem.unlocked.some((b) => b.id === 'nu_hoang_san_cau'), 'Top 1 Nữ đủ 20 trận mở Nữ hoàng sân cầu')
  assert.equal(resFem.unlocked.some((b) => b.id === 'sao_ma_do_duoc'), false, 'Nữ không được nhận Sao mà đỡ được')
})

test('Badges 2026: tam_dau_y_hop (đôi Nam Nữ cùng nhau >= 10 trận, winrate >= 80%)', () => {
  const members = [
    { id: 'boy', name: 'Anh Nam', gender: 'nam' },
    { id: 'girl', name: 'Chị Nữ', gender: 'nu' },
    { id: 'opp1', name: 'Opp 1' },
    { id: 'opp2', name: 'Opp 2' },
  ]

  // Đấu 10 trận cùng nhau, thắng 8 trận (80%)
  const matches = Array.from({ length: 10 }, (_, i) => ({
    id: `m_${i}`,
    at: (i + 1) * 10,
    teamA: ['boy', 'girl'],
    teamB: ['opp1', 'opp2'],
    winnerTeam: i < 8 ? 'A' : 'B',
  }))

  const resBoy = calculateMemberBadges('boy', { members, matches })
  const resGirl = calculateMemberBadges('girl', { members, matches })

  assert.ok(resBoy.unlocked.some((b) => b.id === 'tam_dau_y_hop'), 'Nam mở Tâm đầu ý hợp')
  assert.ok(resGirl.unlocked.some((b) => b.id === 'tam_dau_y_hop'), 'Nữ mở Tâm đầu ý hợp')
})

test('Badges 2026: ganh_ta_gay_lung (thắng 8 trận đánh đôi khi đồng đội kém mình >= 150 Elo)', () => {
  const members = [
    { id: 'pro', name: 'Gánh Kèo', rating: 1600 },
    { id: 'newbie', name: 'Gà Con', rating: 1400 }, // Kém 200 Elo >= 150
    { id: 'opp1', name: 'Opp 1' },
    { id: 'opp2', name: 'Opp 2' },
  ]

  const matches = Array.from({ length: 8 }, (_, i) => ({
    id: `m_${i}`,
    at: (i + 1) * 10,
    teamA: ['pro', 'newbie'],
    teamB: ['opp1', 'opp2'],
    winnerTeam: 'A',
  }))

  const res = calculateMemberBadges('pro', { members, matches })
  const b = res.unlocked.find((x) => x.id === 'ganh_ta_gay_lung')
  assert.ok(b, 'Gánh đồng đội kém >= 150 Elo thắng 8 trận mở Gánh tạ gãy lưng')
  assert.equal(b.unlocked, true)
})

test('Badges 2026: robin_hood (thắng Top 3 Elo nhưng thua người kém mình >= 120 Elo)', () => {
  const members = [
    { id: 'robin', name: 'Robin Hood', rating: 1500 },
    { id: 't1', name: 'Top 1', rating: 2000 },
    { id: 't2', name: 'Top 2', rating: 1900 },
    { id: 't3', name: 'Top 3', rating: 1800 },
    { id: 'underdog', name: 'Người Nghèo', rating: 1200 },
  ]

  // Thắng Top 1
  const m1 = { id: 'm1', at: 10, teamA: ['robin'], teamB: ['t1'], winnerTeam: 'A' }
  // Thua Người Nghèo (chênh 1500 - 1300 = 200 Elo >= 120)
  const m2 = { id: 'm2', at: 20, teamA: ['robin'], teamB: ['underdog'], winnerTeam: 'B', initialRatingA: 1500, initialRatingB: 1300 }

  const res = calculateMemberBadges('robin', { members, matches: [m1, m2] })
  const b = res.unlocked.find((x) => x.id === 'robin_hood')
  assert.ok(b, 'Thắng Top 3 và thua người kém >= 120 Elo mở Robin Hood')
  assert.equal(b.unlocked, true)
})
