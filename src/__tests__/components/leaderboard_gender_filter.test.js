import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Pure helper function simulating gender filtering & rank recalculation on leaderboard
 */
function filterAndRerankLeaderboard(list, genderFilter = 'all') {
  if (genderFilter === 'all') return list
  return list
    .filter((r) => (r.gender || 'nam') === genderFilter)
    .map((r, idx) => ({
      ...r,
      rank: idx + 1,
      originalRank: r.rank,
    }))
}

/**
 * Pure helper for counting members by gender
 */
function getGenderCounts(list) {
  const totalCount = list.length
  const maleCount = list.filter((r) => (r.gender || 'nam') === 'nam').length
  const femaleCount = list.filter((r) => (r.gender || 'nam') === 'nu').length
  return { totalCount, maleCount, femaleCount }
}

test('Leaderboard Gender Filtering and Re-ranking Logic', async (t) => {
  const sampleSeasonData = [
    { id: 'm1', name: 'Nguyễn Văn Nam 1', gender: 'nam', rank: 1, totalSeasonPoints: 1200, rating: 1750 },
    { id: 'w1', name: 'Trần Thị Nữ 1', gender: 'nu', rank: 2, totalSeasonPoints: 1100, rating: 1600 },
    { id: 'm2', name: 'Lê Văn Nam 2', gender: 'nam', rank: 3, totalSeasonPoints: 950, rating: 1550 },
    { id: 'w2', name: 'Phạm Thị Nữ 2', gender: 'nu', rank: 4, totalSeasonPoints: 900, rating: 1520 },
    { id: 'm3', name: 'Hoàng Văn Nam 3', gender: undefined, rank: 5, totalSeasonPoints: 850, rating: 1480 }, // default fallback to 'nam'
  ]

  await t.test('Calculates correct member counts for tabs', () => {
    const counts = getGenderCounts(sampleSeasonData)
    assert.equal(counts.totalCount, 5, 'Tổng số thành viên phải là 5')
    assert.equal(counts.maleCount, 3, 'Số thành viên nam (bao gồm default fallback) phải là 3')
    assert.equal(counts.femaleCount, 2, 'Số thành viên nữ phải là 2')
  })

  await t.test('Returns original ranks when genderFilter is "all"', () => {
    const all = filterAndRerankLeaderboard(sampleSeasonData, 'all')
    assert.equal(all.length, 5)
    assert.equal(all[0].rank, 1)
    assert.equal(all[1].rank, 2)
    assert.equal(all[2].rank, 3)
    assert.equal(all[3].rank, 4)
    assert.equal(all[4].rank, 5)
  })

  await t.test('Correctly filters and re-ranks Male (nam) leaderboard', () => {
    const maleList = filterAndRerankLeaderboard(sampleSeasonData, 'nam')
    assert.equal(maleList.length, 3, 'Chỉ có 3 thành viên nam')

    // Top 1 Nam
    assert.equal(maleList[0].id, 'm1')
    assert.equal(maleList[0].rank, 1, 'Top 1 Nam phải có rank = 1')
    assert.equal(maleList[0].originalRank, 1, 'Rank gốc là 1')

    // Top 2 Nam
    assert.equal(maleList[1].id, 'm2')
    assert.equal(maleList[1].rank, 2, 'Top 2 Nam phải có rank = 2')
    assert.equal(maleList[1].originalRank, 3, 'Rank gốc trong bảng tổng là 3')

    // Top 3 Nam (fallback gender)
    assert.equal(maleList[2].id, 'm3')
    assert.equal(maleList[2].rank, 3, 'Top 3 Nam phải có rank = 3')
    assert.equal(maleList[2].originalRank, 5, 'Rank gốc trong bảng tổng là 5')
  })

  await t.test('Correctly filters and re-ranks Female (nu) leaderboard', () => {
    const femaleList = filterAndRerankLeaderboard(sampleSeasonData, 'nu')
    assert.equal(femaleList.length, 2, 'Chỉ có 2 thành viên nữ')

    // Top 1 Nữ
    assert.equal(femaleList[0].id, 'w1')
    assert.equal(femaleList[0].rank, 1, 'Top 1 Nữ phải có rank = 1')
    assert.equal(femaleList[0].originalRank, 2, 'Rank gốc trong bảng tổng là 2')

    // Top 2 Nữ
    assert.equal(femaleList[1].id, 'w2')
    assert.equal(femaleList[1].rank, 2, 'Top 2 Nữ phải có rank = 2')
    assert.equal(femaleList[1].originalRank, 4, 'Rank gốc trong bảng tổng là 4')
  })

  await t.test('Handles empty list gracefully without throwing', () => {
    const emptyResult = filterAndRerankLeaderboard([], 'nu')
    assert.deepEqual(emptyResult, [])
    const counts = getGenderCounts([])
    assert.equal(counts.totalCount, 0)
    assert.equal(counts.maleCount, 0)
    assert.equal(counts.femaleCount, 0)
  })

  await t.test('Podium Top 3 mapping reflects gender filter cleanly', () => {
    const femaleList = filterAndRerankLeaderboard(sampleSeasonData, 'nu')
    const top1 = femaleList[0] || null
    const top2 = femaleList[1] || null
    const top3 = femaleList[2] || null

    assert.ok(top1)
    assert.equal(top1.name, 'Trần Thị Nữ 1')
    assert.equal(top1.rank, 1)

    assert.ok(top2)
    assert.equal(top2.name, 'Phạm Thị Nữ 2')
    assert.equal(top2.rank, 2)

    assert.equal(top3, null, 'Không có top 3 nếu danh sách nữ chỉ có 2 người')
  })
})
