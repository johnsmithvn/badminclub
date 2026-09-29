import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanShelf, calculateMemberBadges } from '#lib/badges.js'

// Kệ danh hiệu: cleanShelf là nguồn duy nhất cho mọi chỗ đọc/ghi kệ.
// Bug thật: kệ giữ mã cũ (de_bep_3) không hiện trong modal nên không gỡ được, hiện trùng
// "Đè bẹp I"; và kệ trống bị tự lấp bằng danh hiệu Tự phong, gỡ ra lại mọc lại.

test('cleanShelf: quy mã cũ, bỏ trùng, bỏ mã lạ, cắt 3 ô', () => {
  assert.deepEqual(cleanShelf(['de_bep_3', 'de_bep_2', 'khong_ton_tai', 'vo_hut', 'lau_san', 'he_chua']),
    ['de_bep_2', 'vo_hut', 'lau_san'])
  assert.deepEqual(cleanShelf(null), [])
})

test('cleanShelf: gắn lên đầu, đầy thì rớt ô cuối; gắn lại cái đã có chỉ đưa lên đầu', () => {
  const full = ['vo_hut', 'lau_san', 'he_chua']
  assert.deepEqual(cleanShelf(['chich_choe', ...full]), ['chich_choe', 'vo_hut', 'lau_san'])
  assert.deepEqual(cleanShelf(['he_chua', ...full]), ['he_chua', 'vo_hut', 'lau_san'])
})

test('Kệ trống thì hiện trống — không tự lấp danh hiệu Tự phong', () => {
  const db = { members: [{ id: 'm1', name: 'A', badge_shelf: [] }], matches: [] }
  const res = calculateMemberBadges('m1', db)
  assert.ok(res.unlocked.some((b) => b.tier === 'fun'), 'Tự phong vẫn mở sẵn để tự gắn')
  assert.deepEqual(res.shelfBadges, [])
})

test('Kệ hiện đúng thứ đã gắn, mã cũ được quy về mã mới', () => {
  const db = { members: [{ id: 'm1', name: 'A', badge_shelf: ['de_bep_3', 'de_bep_2', 'vo_hut'] }], matches: [] }
  assert.deepEqual(calculateMemberBadges('m1', db).shelfBadges.map((b) => b.id), ['de_bep_2', 'vo_hut'])
})

console.log('Shelf check: OK')
