import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterMatches,
  searchMatches,
  buildH2HMatrix,
  headToHeadMatrix,
  neverMetPairs,
} from '../../lib/matchSearch.js'

test('Comprehensive Match Search & H2H Matrix Tests', async (t) => {
  const matches = [
    {
      id: 'm1',
      date: '2026-09-01',
      teamA: ['p1', 'p2'],
      teamB: ['p3', 'p4'],
      sets: [[21, 19], [21, 18]], // Sát điểm: 21-19 và 21-18
      winnerTeam: 'A',
      initialRatingA: 1500,
      initialRatingB: 1500,
    },
    {
      id: 'm2',
      date: '2026-09-02',
      teamA: ['p1', 'p3'],
      teamB: ['p2', 'p4'],
      sets: [[15, 21], [21, 10], [21, 12]], // 3 sets -> close game
      winnerTeam: 'A',
      initialRatingA: 1400,
      initialRatingB: 1600, // Upset: Team A (1400) thắng Team B (1600)
    },
    {
      id: 'm3',
      date: '2026-09-05',
      teamA: ['p2', 'p3'],
      teamB: ['p1', 'p4'],
      sets: [[21, 11], [21, 12]], // Cách biệt lớn, không close, không upset
      winnerTeam: 'A',
      initialRatingA: 1650,
      initialRatingB: 1450,
    },
  ]

  await t.test('Filter by H2H relationship (vs)', () => {
    // p1 đối đầu p3: có trong m1 (p1 ở teamA, p3 ở teamB) và m3 (p3 ở teamA, p1 ở teamB)
    const res = filterMatches(matches, { playerA: 'p1', playerB: 'p3', mode: 'vs' })
    assert.equal(res.length, 2)
    assert.deepEqual(res.map((x) => x.id).sort(), ['m1', 'm3'])
  })

  await t.test('Filter by teammate relationship (team)', () => {
    // p1 cùng đội p3: có trong m2 (teamA gồm p1 và p3)
    const res = filterMatches(matches, { playerA: 'p1', playerB: 'p3', mode: 'team' })
    assert.equal(res.length, 1)
    assert.equal(res[0].id, 'm2')
  })

  await t.test('Filter by date range', () => {
    const fromSep02 = filterMatches(matches, { fromDate: '2026-09-02' })
    assert.equal(fromSep02.length, 2)

    const untilSep02 = filterMatches(matches, { toDate: '2026-09-02' })
    assert.equal(untilSep02.length, 2)

    const exactSep02 = filterMatches(matches, { fromDate: '2026-09-02', toDate: '2026-09-02' })
    assert.equal(exactSep02.length, 1)
    assert.equal(exactSep02[0].id, 'm2')
  })

  await t.test('Filter by quality: close and upset', () => {
    // Close: m1 (21-19, 21-18) và m2 (3 sets)
    const close = filterMatches(matches, { quality: 'close' })
    assert.equal(close.length, 2)
    assert.deepEqual(close.map((x) => x.id).sort(), ['m1', 'm2'])

    // Upset: chỉ có m2 (chênh 200 điểm mà đội thấp hơn thắng)
    const upset = filterMatches(matches, { quality: 'upset' })
    assert.equal(upset.length, 1)
    assert.equal(upset[0].id, 'm2')
  })

  await t.test('H2H Matrix symmetry and correctness', () => {
    const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }, { id: 'p5' }]
    const mat = headToHeadMatrix(members, matches)

    // Trong m1: teamA [p1, p2] thắng teamB [p3, p4]
    assert.equal(mat['p1']['p3'].wins >= 1, true)
    assert.equal(mat['p3']['p1'].losses >= 1, true)
    // Tính đối xứng tổng thể
    members.forEach((a) => {
      members.forEach((b) => {
        if (a.id !== b.id) {
          assert.equal(mat[a.id][b.id].wins, mat[b.id][a.id].losses)
          assert.equal(mat[a.id][b.id].total, mat[b.id][a.id].total)
        }
      })
    })

    // p5 chưa từng đánh trận nào
    assert.equal(mat['p1']['p5'].total, 0)
  })

  await t.test('neverMetPairs finds pairs who never faced each other', () => {
    const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p5' }]
    const pairs = neverMetPairs(members, matches)
    // p5 chưa từng gặp p1 hoặc p2
    const hasP1P5 = pairs.some((p) => (p[0] === 'p1' && p[1] === 'p5') || (p[0] === 'p5' && p[1] === 'p1'))
    assert.ok(hasP1P5)
  })
})
