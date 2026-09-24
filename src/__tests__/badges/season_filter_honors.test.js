import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateMemberBadges } from '#lib/badges.js'

test('Season Honors & Seasonal Isolation: Danh hiệu theo mùa & bảo toàn vĩnh viễn', async (t) => {
  const season3 = {
    id: 's3',
    code: 'Mùa 3',
    name: 'Thu Rực Lửa',
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    active: false,
    podiumSnapshot: [
      { id: 'male_champ', name: 'Nam Vương Mùa 3', gender: 'nam', rank: 1 },
      { id: 'fem_champ', name: 'Nữ Hoàng Mùa 3', gender: 'nu', rank: 1 },
    ],
  }

  const season4 = {
    id: 's4',
    code: 'Mùa 4',
    name: 'Đông Quyết Chiến',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    active: true,
  }

  const members = [
    { id: 'male_champ', name: 'Nam Vương Mùa 3', gender: 'nam', rating: 2200, joined: '2025-01-01', funBadges: ['den_dau'] },
    { id: 'fem_champ', name: 'Nữ Hoàng Mùa 3', gender: 'nu', rating: 2000, joined: '2025-01-01' },
    { id: 'new_challenger', name: 'Tân Binh Mùa 4', gender: 'nam', rating: 1800, joined: '2026-10-01' },
  ]

  // Các trận của Mùa 3 (tháng 8/2026)
  const matchesSeason3 = [
    {
      id: 'm_s3_1',
      at: Date.parse('2026-08-10T10:00:00Z'),
      teamA: ['male_champ'],
      teamB: ['new_challenger'],
      winnerTeam: 'A',
      ratingEnabled: true,
    },
  ]

  // Mùa 4 chưa có trận nào (khởi tranh mùa mới)
  const matchesSeason4 = []

  const db = {
    members,
    seasons: [season4, season3],
    matches: [...matchesSeason3, ...matchesSeason4],
  }

  await t.test('1. Mùa 4 vừa khởi tranh: Combat badges reset về 0 cho mọi người', () => {
    const resNew = calculateMemberBadges('new_challenger', db, season4)
    const winStreak = resNew.all.find((b) => b.id === 'bat_bai_5')
    assert.equal(winStreak?.currentVal, 0, 'Chuỗi thắng mùa 4 của người chơi phải là 0')
    assert.equal(winStreak?.unlocked, false, 'Chưa mở bất bại mùa 4')
  })

  await t.test('2. Nhóm Soul & Fun luôn bảo toàn vĩnh viễn ở mọi mùa giải', () => {
    const resChampS4 = calculateMemberBadges('male_champ', db, season4)
    // Thâm niên tính all-time từ ngày gia nhập 2025-01-01
    const tenure = resChampS4.all.find((b) => b.id === 'lao_lang_12' || b.id === 'thanh_vien_cung')
    if (tenure) {
      assert.ok(tenure.currentVal >= 12, 'Thâm niên tính toàn thời gian không bị reset theo mùa')
    }
    // Danh hiệu tự phong (Fun) giữ nguyên
    const ngamCau = resChampS4.unlocked.find((b) => b.id === 'ngam_cau')
    assert.ok(ngamCau, 'Danh hiệu Tấu hài (Fun) giữ vĩnh viễn')
  })

  await t.test('3. Top 1 Nam Mùa 3 giữ vĩnh viễn danh hiệu Sao mà đỡ được kèm nhãn Mùa 3', () => {
    const resChampS4 = calculateMemberBadges('male_champ', db, season4)
    const saoMaDoDuoc = resChampS4.unlocked.find((b) => b.id === 'sao_ma_do_duoc')
    assert.ok(saoMaDoDuoc, 'Nam vương Mùa 3 giữ vĩnh viễn Sao mà đỡ được sang Mùa 4')
    assert.equal(saoMaDoDuoc?.seasonCode, 'Mùa 3', 'Danh hiệu mang nhãn Mùa 3 lịch sử')

    const nuHoang = calculateMemberBadges('fem_champ', db, season4)
    const nuHoangSanCau = nuHoang.unlocked.find((b) => b.id === 'nu_hoang_san_cau')
    assert.ok(nuHoangSanCau, 'Nữ hoàng Mùa 3 giữ vĩnh viễn Nữ hoàng sân cầu sang Mùa 4')
    assert.equal(nuHoangSanCau?.seasonCode, 'Mùa 3', 'Danh hiệu mang nhãn Mùa 3 lịch sử')
  })
})
