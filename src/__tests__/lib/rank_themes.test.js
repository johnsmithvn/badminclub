import test from 'node:test'
import assert from 'node:assert/strict'
import vi from '#i18n/vi.json' with { type: 'json' }
import { rankTierOf, TIERS, TIER_EMOJIS } from '#lib/rating.js'
import { RANK_THEMES, DEFAULT_RANK_THEME, PLAYSTYLE_BADGES, getMemberBadge } from '#data/rankThemes.js'

test('Rank Themes & Playstyle Badges Test Suite', async (t) => {
  await t.test('1. Structure of RANK_THEMES and i18n presence', () => {
    assert.equal(RANK_THEMES.length, 4)
    const keys = RANK_THEMES.map((th) => th.key)
    assert.deepEqual(keys, ['street', 'comedy', 'destroyer', 'slang'])
    assert.equal(DEFAULT_RANK_THEME, 'street')

    // Every theme label must exist in vi.json
    RANK_THEMES.forEach((th) => {
      const label = th.labelKey.split('.').reduce((o, k) => o?.[k], vi)
      assert.ok(typeof label === 'string' && label.length > 0, `Missing theme label for ${th.key}`)
    })

    // Every theme must map all 8 tiers in vi.json
    const tierKeys = TIERS.map((t) => t.key)
    keys.forEach((thKey) => {
      tierKeys.forEach((tierKey) => {
        const str = vi.rating?.tierThemes?.[thKey]?.[tierKey]
        assert.ok(typeof str === 'string' && str.length > 0, `Missing tier name for theme ${thKey}.${tierKey}`)
      })
    })

    // Comedy quips must exist for all 8 tiers
    tierKeys.forEach((tierKey) => {
      const quip = vi.rating?.comedyQuips?.[tierKey]
      assert.ok(typeof quip === 'string' && quip.length > 0, `Missing comedy quip for tier ${tierKey}`)
    })
  })

  await t.test('2. Structure of PLAYSTYLE_BADGES and i18n descriptions', () => {
    assert.equal(PLAYSTYLE_BADGES.length, 10)
    const expectedBadges = [
      'vo_hut', 'boi_tham', 'he_chua', 'cai_cau', 'doi_vot',
      'khoi_dong', 'chia_san', 'be_tong', 'nguoc_dong', 'ban_chim',
    ]
    assert.deepEqual(PLAYSTYLE_BADGES.map((b) => b.key), expectedBadges)

    PLAYSTYLE_BADGES.forEach((b) => {
      const name = vi.playstyleBadges?.[b.key]?.name
      const desc = vi.playstyleBadges?.[b.key]?.desc
      assert.ok(typeof name === 'string' && name.length > 0, `Missing name for badge ${b.key}`)
      assert.ok(typeof desc === 'string' && desc.length > 0, `Missing desc for badge ${b.key}`)
      assert.ok(b.emoji, `Badge ${b.key} must have an emoji`)
      assert.ok(b.color, `Badge ${b.key} must have a color`)
    })
  })

  await t.test('3. getMemberBadge is deterministic and handles edge cases', () => {
    const b1 = getMemberBadge('mem_001')
    const b2 = getMemberBadge('mem_001')
    assert.equal(b1.key, b2.key, 'Same memberId must yield identical badge')
    assert.equal(b1.nameKey, `playstyleBadges.${b1.key}.name`)
    assert.equal(b1.descKey, `playstyleBadges.${b1.key}.desc`)

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
    assert.equal(tStreet.emoji, '👑')
    assert.equal(tStreet.labelKey, 'rating.tierThemes.street.court_boss')
    assert.equal(vi.rating.tierThemes.street.court_boss, 'Thấy Là Chạy')

    // Comedy theme
    const tComedy = rankTierOf(300, 'comedy')
    assert.equal(tComedy.key, 'rookie')
    assert.equal(tComedy.labelKey, 'rating.tierThemes.comedy.rookie')
    assert.equal(vi.rating.tierThemes.comedy.rookie, 'Thánh Thở Oxy')
    assert.ok(vi.rating.comedyQuips.rookie.includes('thở 4 trận'))

    // Destroyer theme
    const tDestroyer = rankTierOf(500, 'destroyer')
    assert.equal(tDestroyer.key, 'regular')
    assert.equal(tDestroyer.labelKey, 'rating.tierThemes.destroyer.regular')
    assert.equal(vi.rating.tierThemes.destroyer.regular, 'Vua Phá Lưới')

    // Slang theme
    const tSlang = rankTierOf(900, 'slang')
    assert.equal(tSlang.key, 'net_master')
    assert.equal(tSlang.labelKey, 'rating.tierThemes.slang.net_master')
    assert.equal(vi.rating.tierThemes.slang.net_master, 'Chém Lưới')

    // Default theme fallback
    const tDefault = rankTierOf(1100)
    assert.equal(tDefault.theme, 'street')
    assert.equal(tDefault.labelKey, 'rating.tierThemes.street.coverage')
    assert.equal(vi.rating.tierThemes.street.coverage, 'Có Tiếng')
  })
})
