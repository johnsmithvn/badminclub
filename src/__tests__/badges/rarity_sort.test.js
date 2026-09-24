import assert from 'node:assert/strict'
import { sortBadgesByRarity } from '../../lib/badges.js'

console.log('--- 1. Testing sortBadgesByRarity: Hierarchy of Tiers ---')
const sampleBadges = [
  { id: 'b_rare', tier: 'rare', unlocked: true, pct: 100 },
  { id: 'b_legend', tier: 'legend', unlocked: false, pct: 10 },
  { id: 'b_epic', tier: 'epic', unlocked: false, pct: 50 },
  { id: 'b_elite', tier: 'elite', unlocked: true, pct: 100 },
]

const sorted = sortBadgesByRarity(sampleBadges)
assert.equal(sorted[0].id, 'b_legend', 'Legend phai dung dau tien bat ke unlock hay chua')
assert.equal(sorted[1].id, 'b_epic', 'Epic phai dung thu hai')
assert.equal(sorted[2].id, 'b_elite', 'Elite phai dung thu ba')
assert.equal(sorted[3].id, 'b_rare', 'Rare phai dung cuoi cung')
console.log('Hierarchy of tiers: OK')

console.log('--- 2. Testing sortBadgesByRarity: Unlocked before Locked within same Tier ---')
const sameTierBadges = [
  { id: 'leg_locked', tier: 'legend', unlocked: false, pct: 40 },
  { id: 'leg_unlocked', tier: 'legend', unlocked: true, pct: 100 },
]
const sortedSameTier = sortBadgesByRarity(sameTierBadges)
assert.equal(sortedSameTier[0].id, 'leg_unlocked', 'Badge da mo phai dung truoc badge chua mo trong cung tier')
assert.equal(sortedSameTier[1].id, 'leg_locked')
console.log('Unlocked priority: OK')

console.log('--- 3. Testing sortBadgesByRarity: Progress percentage within same Tier ---')
const progressBadges = [
  { id: 'epic_low', tier: 'epic', unlocked: false, pct: 20 },
  { id: 'epic_high', tier: 'epic', unlocked: false, pct: 85 },
]
const sortedProgress = sortBadgesByRarity(progressBadges)
assert.equal(sortedProgress[0].id, 'epic_high', 'Tien do cao hon phai dung truoc')
assert.equal(sortedProgress[1].id, 'epic_low')
console.log('Progress priority: OK')

console.log('--- 4. Testing sortBadgesByRarity: Family badge uses highest tier ---')
const familyBadge = {
  id: 'fam_bat_bai',
  isFamily: true,
  tier: 'rare', // mốc hiện tại hoặc mốc 1
  tiers: [
    { id: 'm1', tier: 'rare' },
    { id: 'm2', tier: 'elite' },
    { id: 'm3', tier: 'epic' },
    { id: 'm4', tier: 'legend' },
  ],
  unlockedTiersCount: 1,
  nextTarget: { pct: 50 },
}
const soloEpic = { id: 'solo_epic', isFamily: false, tier: 'epic', unlocked: true, pct: 100 }
const sortedFamily = sortBadgesByRarity([soloEpic, familyBadge])
assert.equal(sortedFamily[0].id, 'fam_bat_bai', 'Family co moc cuoi la Legend phai dung tren Epic')
console.log('Family highest tier: OK')

console.log('All rarity sort checks: OK')
