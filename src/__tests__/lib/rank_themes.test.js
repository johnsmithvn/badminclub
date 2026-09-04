import test from 'node:test'
import assert from 'node:assert/strict'
import rankData from '#data/rankThemes.json' with { type: 'json' }
import { rankTierOf, TIERS } from '#lib/rating.js'
import { RANK_THEMES, DEFAULT_RANK_THEME, PLAYSTYLE_BADGES, getMemberBadge, getTierName, getComedyQuip } from '#data/rankThemes.js'

test('Rank Themes & Playstyle Badges Test Suite', async (t) => {
  await t.test('1. Structure of RANK_THEMES in rankThemes.json', () => {
    assert.equal(RANK_THEMES.length, 4)
    const keys = RANK_THEMES.map((th) => th.key)
    assert.deepEqual(keys, ['street', 'comedy', 'destroyer', 'slang'])
    assert.equal(DEFAULT_RANK_THEME, 'street')

    // Every theme must have a non-empty label and valid icon
    RANK_THEMES.forEach((th) => {
      assert.ok(typeof th.label === 'string' && th.label.length > 0, `Missing label for theme ${th.key}`)
      assert.ok(typeof th.icon === 'string' && th.icon.length > 0, `Missing icon for theme ${th.key}`)
    })

    // Every theme must map all 8 tiers in rankThemes.json
    const tierKeys = TIERS.map((tier) => tier.key)
    keys.forEach((thKey) => {
      tierKeys.forEach((tierKey) => {
        const name = getTierName(thKey, tierKey)
        assert.ok(typeof name === 'string' && name.length > 0, `Missing tier name for theme ${thKey}.${tierKey}`)
      })
    })

    // Comedy quips must exist for all 8 tiers
    tierKeys.forEach((tierKey) => {
      const quip = getComedyQuip(tierKey)
      assert.ok(typeof quip === 'string' && quip.length > 0, `Missing comedy quip for tier ${tierKey}`)
    })
  })

  await t.test('2. Structure of PLAYSTYLE_BADGES with vector icons and tags', () => {
    assert.equal(PLAYSTYLE_BADGES.length, 10)
    const expectedBadges = [
      'vo_hut', 'boi_tham', 'he_chua', 'cai_cau', 'doi_vot',
      'khoi_dong', 'chia_san', 'be_tong', 'nguoc_dong', 'ban_chim',
    ]
    assert.deepEqual(PLAYSTYLE_BADGES.map((b) => b.key), expectedBadges)

    PLAYSTYLE_BADGES.forEach((b) => {
      assert.ok(typeof b.name === 'string' && b.name.length > 0, `Missing name for badge ${b.key}`)
      assert.ok(typeof b.tag === 'string' && b.tag.length > 0, `Missing tag for badge ${b.key}`)
      assert.ok(typeof b.desc === 'string' && b.desc.length > 0, `Missing desc for badge ${b.key}`)
      assert.ok(typeof b.icon === 'string' && b.icon.length > 0, `Missing icon for badge ${b.key}`)
      assert.ok(typeof b.color === 'string' && b.color.startsWith('#'), `Missing valid hex color for badge ${b.key}`)
    })
  })

  await t.test('3. getMemberBadge is deterministic and handles edge cases', () => {
    const b1 = getMemberBadge('mem_001')
    const b2 = getMemberBadge('mem_001')
    assert.equal(b1.key, b2.key, 'Same memberId must yield identical badge')
    assert.ok(b1.name && b1.desc && b1.tag)

    // Safe handling of null / undefined
    const bNull = getMemberBadge(null)
    const bUndefined = getMemberBadge(undefined)
    assert.ok(bNull && bNull.key)
    assert.ok(bUndefined && bUndefined.key)

    // Different members can get different badges
    const badges = new Set()
    for (let i = 0; i < 50; i++) {
      badges.add(getMemberBadge(`member_${i}`).key)
    }
    assert.ok(badges.size > 5, 'Should distribute badges across different member IDs')
  })

  await t.test('4. rankTierOf supports 4 theme switches with correct metadata', () => {
    // Street theme
    const tStreet = rankTierOf(1500, 'street')
    assert.equal(tStreet.key, 'court_boss')
    assert.equal(tStreet.icon, 'crown')
    assert.equal(tStreet.label, 'Thấy Là Chạy')

    // Comedy theme (with user's customization "Chuyên gia vồ hụt")
    const tComedy = rankTierOf(300, 'comedy')
    assert.equal(tComedy.key, 'rookie')
    assert.equal(tComedy.label, 'Chuyên gia vồ hụt')
    assert.ok(tComedy.quip.includes('thở 4 trận'))

    // Destroyer theme (with user's customization "Cỗ Máy Hủy Diệt")
    const tDestroyer = rankTierOf(500, 'destroyer')
    assert.equal(tDestroyer.key, 'regular')
    assert.equal(tDestroyer.label, 'Vua Phá Lưới')

    // Slang theme (with user's customization "Khó Lói")
    const tSlang = rankTierOf(900, 'slang')
    assert.equal(tSlang.key, 'net_master')
    assert.equal(tSlang.label, 'Khó Lói')

    // Default theme fallback
    const tDefault = rankTierOf(1100)
    assert.equal(tDefault.theme, 'street')
    assert.equal(tDefault.label, 'Có Tiếng')
  })
})
