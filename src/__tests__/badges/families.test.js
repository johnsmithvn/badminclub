import test from 'node:test'
import assert from 'node:assert/strict'

import { groupBadgesByFamily, getBadgeFamily, ANIME_GLYPHS, ANIME_TIERS } from '#lib/badges.js'
import cfgBadges from '#config/badges.json' with { type: 'json' }

/**
 * HỌ DANH HIỆU (Evolving Badges).
 *
 * Hai nhóm test:
 *  1. `groupBadgesByFamily` — logic gộp nhiều mốc thành một thẻ đại diện.
 *  2. Tính nhất quán của `families` + `catalog` trong badges.json. Nhóm này gác CẤU HÌNH,
 *     vì phần lớn cách làm hỏng họ danh hiệu là sửa JSON chứ không phải sửa code.
 */

const activeCatalog = () =>
  (cfgBadges.catalog || []).concat(cfgBadges.bountyBadges || []).filter((b) => b.enabled !== false)

/** Dựng danh sách badge đã "tính toán" giả lập, đánh dấu mốc nào đã mở. */
const makeBadges = (ids, unlockedIds = []) =>
  ids.map((id) => ({ id, tier: 'rare', glyph: 'crystal', unlocked: unlockedIds.includes(id) }))

test('Families: gộp các mốc cùng họ thành MỘT thẻ, mốc lẻ vẫn đứng riêng', () => {
  const famIds = cfgBadges.families.bat_bai.badgeIds
  const list = makeBadges([...famIds, 'so_sach'])

  const grouped = groupBadgesByFamily(list)

  assert.equal(
    grouped.length,
    2,
    '4 mốc Bất bại phải gộp thành 1 thẻ, cộng thêm so_sach đứng riêng = 2 thẻ. Không gộp thì người chơi thấy 4 ô gần như giống hệt nhau trên cùng một màn.',
  )

  const fam = grouped.find((g) => g.familyKey === 'bat_bai')
  assert.ok(fam, 'Phải có thẻ đại diện cho họ bat_bai')
  assert.equal(fam.isFamily, true)
  assert.equal(fam.totalTiers, famIds.length)

  const solo = grouped.find((g) => g.id === 'so_sach')
  assert.equal(solo.isFamily, false, 'Badge không thuộc họ nào phải giữ nguyên, không bị nuốt mất')
  assert.equal(solo.totalTiers, 1)
})

test('Families: thẻ đại diện là mốc CAO NHẤT đã mở, không phải mốc đầu tiên', () => {
  const famIds = cfgBadges.families.bat_bai.badgeIds // dễ -> khó
  // Mở 2 mốc đầu -> đại diện phải là mốc thứ 2, và đích kế tiếp là mốc thứ 3.
  const grouped = groupBadgesByFamily(makeBadges(famIds, [famIds[0], famIds[1]]))
  const fam = grouped.find((g) => g.familyKey === 'bat_bai')

  assert.equal(
    fam.highestUnlocked.id,
    famIds[1],
    'Vinh danh sai mốc là khoe thành tích thấp hơn thực tế người chơi đạt được',
  )
  assert.equal(fam.id, famIds[1], 'Thẻ đại diện phải mang id của mốc cao nhất đã mở')
  assert.equal(fam.unlockedTiersCount, 2)
  assert.equal(fam.nextTarget.id, famIds[2], 'Đích kế tiếp phải là mốc khoá đầu tiên')
  assert.equal(fam.isAllUnlocked, false)
})

test('Families: chưa mở mốc nào thì đại diện là mốc DỄ NHẤT, mở hết thì hết đích', () => {
  const famIds = cfgBadges.families.bat_bai.badgeIds

  const none = groupBadgesByFamily(makeBadges(famIds, [])).find((g) => g.familyKey === 'bat_bai')
  assert.equal(none.highestUnlocked, null)
  assert.equal(none.id, famIds[0], 'Chưa mở gì thì phải chỉ vào mốc dễ nhất để người chơi biết bắt đầu từ đâu')
  assert.equal(none.nextTarget.id, famIds[0])
  assert.equal(none.unlockedTiersCount, 0)

  const all = groupBadgesByFamily(makeBadges(famIds, famIds)).find((g) => g.familyKey === 'bat_bai')
  assert.equal(all.isAllUnlocked, true)
  assert.equal(all.nextTarget, null, 'Mở hết rồi mà vẫn còn đích kế tiếp là hiển thị sai tiến độ')
  assert.equal(all.unlockedTiersCount, famIds.length)
})

test('Families: chỉ có một phần số mốc trong danh sách thì vẫn dựng được họ', () => {
  // Xảy ra thật khi lọc theo nhóm: `groupBadgesByFamily` nhận badge của MỘT nhóm.
  const famIds = cfgBadges.families.bat_bai.badgeIds
  const partial = groupBadgesByFamily(makeBadges(famIds.slice(0, 2), [famIds[0]]))
  const fam = partial.find((g) => g.familyKey === 'bat_bai')

  assert.equal(fam.totalTiers, 2, 'Chỉ đếm những mốc thực sự có mặt, không đếm theo config')
  assert.equal(fam.highestUnlocked.id, famIds[0])
})

test('Families: getBadgeFamily tra đúng họ, badge lẻ trả null', () => {
  const fam = getBadgeFamily(cfgBadges.families.bat_bai.badgeIds[0])
  assert.equal(fam.key, 'bat_bai')
  assert.equal(getBadgeFamily('so_sach'), null, 'Badge không thuộc họ nào phải trả null')
  assert.equal(getBadgeFamily(''), null)
})

test('Config: badgeIds của mọi họ phải trỏ tới badge CÓ THẬT và đang bật', () => {
  const ids = new Set(activeCatalog().map((b) => b.id))
  for (const [key, fam] of Object.entries(cfgBadges.families || {})) {
    for (const bId of fam.badgeIds || []) {
      assert.ok(
        ids.has(bId),
        `Họ "${key}" trỏ tới badge "${bId}" không tồn tại (hoặc đang tắt). Mốc đó biến mất khỏi thẻ họ mà không báo lỗi gì — người chơi mất một bậc tiến độ.`,
      )
    }
  }
})

test('Config: mọi mốc trong một họ phải cùng groupId với họ đó', () => {
  const byId = new Map(activeCatalog().map((b) => [b.id, b]))
  for (const [key, fam] of Object.entries(cfgBadges.families || {})) {
    for (const bId of fam.badgeIds || []) {
      assert.equal(
        byId.get(bId).groupId,
        fam.groupId,
        `Mốc "${bId}" nằm khác nhóm với họ "${key}". Trang Danh hiệu gộp họ TRONG TỪNG NHÓM, nên họ bị xé đôi và hiện thành hai thẻ rời ở hai tab.`,
      )
    }
  }
})

test('Config: mỗi badge chỉ được thuộc tối đa MỘT họ', () => {
  const seen = new Map()
  for (const [key, fam] of Object.entries(cfgBadges.families || {})) {
    for (const bId of fam.badgeIds || []) {
      assert.equal(
        seen.has(bId),
        false,
        `Badge "${bId}" nằm trong cả họ "${seen.get(bId)}" lẫn "${key}". groupBadgesByFamily gộp theo họ đầu tiên gặp được, nên một trong hai họ sẽ thiếu mốc.`,
      )
      seen.set(bId, key)
    }
  }
})

test('Config: bậc phẩm cấp trong một họ phải TĂNG DẦN theo độ khó', () => {
  const byId = new Map(activeCatalog().map((b) => [b.id, b]))
  for (const [key, fam] of Object.entries(cfgBadges.families || {})) {
    const pts = (fam.badgeIds || []).map((id) => ANIME_TIERS[byId.get(id).tier]?.pts ?? 0)
    for (let i = 1; i < pts.length; i++) {
      assert.ok(
        pts[i] > pts[i - 1],
        `Họ "${key}" có bậc ${i + 1} (${pts[i]}đ) không cao hơn bậc ${i} (${pts[i - 1]}đ) — chuỗi điểm: ${pts.join(' -> ')}. Mốc khó hơn mà không được thêm điểm thì người chơi hết động lực leo tiếp.`,
      )
    }
  }
})

test('Config: cùng một checkType thì ngưỡng trong họ phải đi MỘT CHIỀU', () => {
  // `groupBadgesByFamily` lấy `unlockedTiers[cuối]` làm mốc cao nhất — tức NGẦM giả định
  // mảng `badgeIds` xếp từ dễ tới khó. Xếp nhầm thì thẻ khoe sai bậc mà không ai biết.
  // Một chiều tăng (chuỗi thắng, số trận) hoặc giảm (điểm đối thủ càng thấp càng khó) đều được.
  const byId = new Map(activeCatalog().map((b) => [b.id, b]))
  for (const [key, fam] of Object.entries(cfgBadges.families || {})) {
    const ths = (fam.badgeIds || []).map((id) => byId.get(id).threshold)
    if (ths.length < 2) continue
    const up = ths.every((v, i) => i === 0 || v > ths[i - 1])
    const down = ths.every((v, i) => i === 0 || v < ths[i - 1])
    assert.ok(
      up || down,
      `Họ "${key}" có ngưỡng ${ths.join(' -> ')} lúc tăng lúc giảm. Không suy ra được mốc nào khó hơn mốc nào.`,
    )
  }
})

test('Config: không hai danh hiệu nào được mở bằng CÙNG một điều kiện', () => {
  // Trùng điều kiện = một thành tích ăn hai lần điểm sưu tập và hai lần thưởng.
  // Ngoại lệ duy nhất: nhóm Tự phong (`fun`) cố ý mở sẵn cho mọi người.
  const groups = new Map()
  for (const b of activeCatalog()) {
    if (b.checkType === 'fun') continue
    const key = `${b.checkType}@${b.threshold}`
    groups.set(key, (groups.get(key) || []).concat(b.id))
  }
  const dup = [...groups.entries()].filter(([, ids]) => ids.length > 1)
  assert.deepEqual(
    dup,
    [],
    `Các danh hiệu sau trùng điều kiện mở khoá: ${dup
      .map(([k, ids]) => `${k} -> ${ids.join(' + ')}`)
      .join('; ')}. Đạt một lần được cả hai, cộng dồn điểm lẫn XP.`,
  )
})

test('Config: mọi glyph được gọi tên đều phải có hình thật', () => {
  // BadgeHex rơi về `crystal` khi không tìm thấy glyph, nên gõ sai tên KHÔNG gây lỗi —
  // nó âm thầm biến nhiều họ danh hiệu thành cùng một hình.
  const used = new Set()
  Object.values(cfgBadges.families || {}).forEach((f) => f.glyph && used.add(f.glyph))
  activeCatalog().forEach((b) => b.glyph && used.add(b.glyph))

  const missing = [...used].filter((g) => !ANIME_GLYPHS[g])
  assert.deepEqual(missing, [], `Glyph không có hình: ${missing.join(', ')}`)
})

test('Config: mỗi họ danh hiệu phải mang một glyph RIÊNG', () => {
  const byGlyph = new Map()
  for (const [key, fam] of Object.entries(cfgBadges.families || {})) {
    if (!fam.glyph) continue
    byGlyph.set(fam.glyph, (byGlyph.get(fam.glyph) || []).concat(key))
  }
  const clash = [...byGlyph.entries()].filter(([, keys]) => keys.length > 1)
  assert.deepEqual(
    clash,
    [],
    `Các họ dùng chung glyph: ${clash
      .map(([g, keys]) => `${g} -> ${keys.join(', ')}`)
      .join('; ')}. Thẻ họ chỉ khác nhau ở hình, trùng hình là người chơi không phân biệt được.`,
  )
})
