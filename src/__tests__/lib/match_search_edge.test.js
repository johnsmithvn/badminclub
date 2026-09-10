import test from 'node:test'
import assert from 'node:assert/strict'
import {
  neverMetWithSessionCount,
  buildH2HMatrix,
  topDisparatePairs,
  filterMatches,
} from '../../lib/matchSearch.js'
import { rankPairs } from '../../lib/rating.js'

/**
 * Edge cases của matchSearch.js và rankPairs chưa được test kỹ:
 * - neverMetWithSessionCount: attendance=false không tính, fallback qua matches
 * - topDisparatePairs: không bị nhầm với pair chưa từng gặp
 * - rankPairs: minGames filter loại cặp ít trận
 * - buildH2HMatrix: inactive member bị loại
 */

test('matchSearch.js — neverMetWithSessionCount Edge Cases', async (t) => {

  // ── 1. attendance=false → thành viên đó KHÔNG tính là có mặt ──
  await t.test('1. attendance=false không được tính là có mặt để ghép cặp chưa gặp', () => {
    // p1 có mặt s1, p2 VẮNG s1 (false) → không cùng buổi → commonSessions = 0
    const members = [{ id: 'p1' }, { id: 'p2' }]
    const { neverMet } = buildH2HMatrix(members, [])
    // Cả 2 chưa từng gặp nhau

    const sessions = [{ id: 's1' }]
    const attendance = { s1: { p1: true, p2: false } } // p2 vắng

    const result = neverMetWithSessionCount(neverMet, { sessions, attendance, matches: [] })
    const pair = result.find((x) => (x.p1 === 'p1' && x.p2 === 'p2') || (x.p1 === 'p2' && x.p2 === 'p1'))
    assert.ok(pair, 'Cặp p1-p2 chưa từng gặp phải xuất hiện')
    assert.equal(
      pair.commonSessionsCount,
      0,
      'p2 vắng (false) → không phải cùng buổi — tính p2 là có mặt sẽ gợi ý sai cặp "nên gạ kèo"'
    )
  })

  // ── 2. Tìm qua matches (không có attendance map) ──
  await t.test('2. Phát hiện cùng buổi qua matches khi không có attendance map', () => {
    const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
    // p1 và p3 đã từng gặp nhau → không vào neverMet
    const match = { id: 'mt1', teamA: ['p1'], teamB: ['p3'], winnerTeam: 'A' }
    const { neverMet } = buildH2HMatrix(members, [match])
    // neverMet chứa cặp p1-p2 và p2-p3 (chưa gặp đối đầu)

    // Cả p1, p2, p3 đều có trận ở s1 → commonSessions = 1
    const sessions = [{ id: 's1' }]
    const matches = [
      { sessionId: 's1', playerKeys: ['p1', 'p2', 'p3', 'p4'] },
    ]

    const result = neverMetWithSessionCount(neverMet, { sessions, attendance: {}, matches })
    const p1p2 = result.find((x) => (x.p1 === 'p1' && x.p2 === 'p2') || (x.p1 === 'p2' && x.p2 === 'p1'))
    assert.ok(p1p2, 'Cặp p1-p2 chưa đối đầu phải xuất hiện')
    assert.equal(
      p1p2.commonSessionsCount,
      1,
      'Cùng có mặt qua matches ở s1 → commonSessions=1 — sai là không gợi ý được cặp hay chưa từng gặp'
    )
  })

  // ── 3. Sắp xếp đúng: cặp cùng nhiều buổi hơn đứng trước ──
  await t.test('3. neverMetWithSessionCount sắp xếp descending theo commonSessionsCount', () => {
    const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
    const { neverMet } = buildH2HMatrix(members, []) // chưa ai gặp ai

    // p1-p2: cùng 3 buổi; p1-p3: cùng 1 buổi; p2-p3: cùng 2 buổi
    const sessions = [
      { id: 's1', participantIds: ['p1', 'p2', 'p3'] },
      { id: 's2', participantIds: ['p1', 'p2'] },
      { id: 's3', participantIds: ['p1', 'p2'] },
    ]

    const result = neverMetWithSessionCount(neverMet, { sessions, attendance: {}, matches: [] })
    assert.ok(result.length >= 2)
    // Pair có commonSessions cao nhất phải đứng đầu
    assert.ok(
      result[0].commonSessionsCount >= result[1].commonSessionsCount,
      'Cặp cùng đi nhiều buổi nhất phải đứng đầu — sai là gợi ý gạ kèo sai đối tượng'
    )
    // p1-p2 nên đứng đầu (3 buổi)
    const top = result[0]
    assert.ok(
      (top.p1 === 'p1' && top.p2 === 'p2') || (top.p1 === 'p2' && top.p2 === 'p1'),
      'p1-p2 (3 buổi chung) phải đứng đầu'
    )
  })

  // ── 4. neverMet rỗng trả về mảng rỗng, không throw ──
  await t.test('4. neverMetWithSessionCount với neverMet rỗng không throw', () => {
    const result = neverMetWithSessionCount([], { sessions: [], attendance: {}, matches: [] })
    assert.deepEqual(result, [], 'Mảng rỗng phải trả về mảng rỗng — throw là vỡ màn H2H tab')

    const result2 = neverMetWithSessionCount(null, { sessions: [] })
    assert.deepEqual(result2, [], 'null input phải trả về mảng rỗng')
  })
})

test('matchSearch.js — topDisparatePairs Edge Cases', async (t) => {

  // ── 5. topDisparatePairs: chỉ lấy cặp có total > 0 ──
  await t.test('5. topDisparatePairs bỏ qua cặp chưa từng gặp nhau (total=0)', () => {
    const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
    // p1 vs p2: 3-0 (disparity=3); p1 vs p3, p2 vs p3: chưa gặp
    const matches = [
      { id: 'mt1', teamA: ['p1'], teamB: ['p2'], winnerTeam: 'A' },
      { id: 'mt2', teamA: ['p1'], teamB: ['p2'], winnerTeam: 'A' },
      { id: 'mt3', teamA: ['p1'], teamB: ['p2'], winnerTeam: 'A' },
    ]
    const { matrix } = buildH2HMatrix(members, matches)
    const pairs = topDisparatePairs(matrix, members, 5)

    assert.equal(pairs.length, 1, 'Chỉ có 1 cặp đã từng gặp nhau — thêm cặp chưa gặp là dữ liệu sai')
    assert.equal(pairs[0].disparity, 3, 'p1 thắng p2 3-0, disparity=3')
    assert.equal(pairs[0].total, 3)
    assert.ok(
      (pairs[0].p1 === 'p1' && pairs[0].p2 === 'p2') || (pairs[0].p1 === 'p2' && pairs[0].p2 === 'p1'),
      'Cặp p1-p2 phải được xác định đúng'
    )
  })

  // ── 6. topDisparatePairs: giới hạn limit ──
  await t.test('6. topDisparatePairs tuân thủ limit', () => {
    const members = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }]
    // p1 vs p2: 5-0; p1 vs p3: 3-0; p2 vs p4: 2-0; p3 vs p4: 1-0
    const matches = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, teamA: ['p1'], teamB: ['p2'], winnerTeam: 'A' })),
      ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, teamA: ['p1'], teamB: ['p3'], winnerTeam: 'A' })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `c${i}`, teamA: ['p2'], teamB: ['p4'], winnerTeam: 'A' })),
      { id: 'd0', teamA: ['p3'], teamB: ['p4'], winnerTeam: 'A' },
    ]
    const { matrix } = buildH2HMatrix(members, matches)
    const pairs2 = topDisparatePairs(matrix, members, 2)

    assert.equal(pairs2.length, 2, 'limit=2 phải trả đúng 2 cặp')
    assert.equal(pairs2[0].disparity, 5, 'Cặp lệch nhất (p1-p2) phải đứng đầu')
    assert.equal(pairs2[1].disparity, 3, 'Cặp lệch nhì (p1-p3) đứng thứ hai')
  })
})

test('rankPairs — minGames Filter', async (t) => {

  // ── 7. rankPairs loại cặp ít hơn minGames ──
  await t.test('7. rankPairs với minGames=5: cặp chỉ có 3 trận không vào danh sách', () => {
    const membersMap = {
      p1: { id: 'p1', name: 'Minh', gender: 'nam' },
      p2: { id: 'p2', name: 'Nam',  gender: 'nam' },
      p3: { id: 'p3', name: 'Huy',  gender: 'nam' },
    }
    const ratingsMap = { p1: 1600, p2: 1600, p3: 1600 }

    // p1+p2: 10 trận → đủ điều kiện
    // p1+p3: 3 trận → không đủ (< minGames=5)
    const matches = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `mn${i}`, at: 1000+i,
        teamA: ['p1', 'p2'], teamB: ['px', 'py'], winnerTeam: i < 7 ? 'A' : 'B',
        initialRatingA: 1600, initialRatingB: 1600,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `mk${i}`, at: 2000+i,
        teamA: ['p1', 'p3'], teamB: ['px', 'py'], winnerTeam: 'A',
        initialRatingA: 1600, initialRatingB: 1600,
      })),
    ]

    const result = rankPairs(matches, membersMap, ratingsMap, { minGames: 5 })
    const hasP1P3 = result.rankedPairs.some(
      (p) => (p.playerA === 'p1' && p.playerB === 'p3') || (p.playerA === 'p3' && p.playerB === 'p1')
    )
    assert.equal(
      hasP1P3,
      false,
      'p1+p3 chỉ 3 trận (< minGames=5) phải bị loại — hiển thị cặp ít trận là synergy không đáng tin'
    )

    const hasP1P2 = result.rankedPairs.some(
      (p) => (p.playerA === 'p1' && p.playerB === 'p2') || (p.playerA === 'p2' && p.playerB === 'p1')
    )
    assert.equal(hasP1P2, true, 'p1+p2 có 10 trận phải có mặt trong danh sách')
  })

  // ── 8. rankPairs: topPair và underperformingPair không phải cùng một cặp ──
  await t.test('8. topPair và underperformingPair là hai cặp khác nhau', () => {
    const membersMap = {
      pA: { id: 'pA', name: 'A', gender: 'nam' },
      pB: { id: 'pB', name: 'B', gender: 'nam' },
      pC: { id: 'pC', name: 'C', gender: 'nam' },
    }
    const ratingsMap = { pA: 1600, pB: 1600, pC: 1600 }

    // pA+pB: thắng 9/10 trận → synergy cao
    // pA+pC: thắng 2/10 trận → synergy thấp
    const matches = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `ab${i}`, at: 1000+i,
        teamA: ['pA', 'pB'], teamB: ['px', 'py'], winnerTeam: i < 9 ? 'A' : 'B',
        initialRatingA: 1600, initialRatingB: 1600,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `ac${i}`, at: 2000+i,
        teamA: ['pA', 'pC'], teamB: ['px', 'py'], winnerTeam: i < 2 ? 'A' : 'B',
        initialRatingA: 1600, initialRatingB: 1600,
      })),
    ]

    const result = rankPairs(matches, membersMap, ratingsMap)
    assert.ok(result.topPair, 'topPair phải tồn tại')
    assert.ok(result.underperformingPair, 'underperformingPair phải tồn tại')
    assert.ok(
      result.topPair.synergyScore > result.underperformingPair.synergyScore,
      `topPair synergy(${result.topPair.synergyScore}) phải > underperformingPair(${result.underperformingPair.synergyScore})`
    )
    // Hai cặp phải khác nhau
    const topKey = [result.topPair.playerA, result.topPair.playerB].sort().join('-')
    const underKey = [result.underperformingPair.playerA, result.underperformingPair.playerB].sort().join('-')
    assert.notEqual(topKey, underKey, 'topPair và underperformingPair không được là cùng một cặp')
  })
})

test('filterMatches — edge cases', async (t) => {

  // ── 9. filterMatches với mảng rỗng không throw ──
  await t.test('9. filterMatches với input rỗng/null không throw', () => {
    assert.deepEqual(filterMatches([], {}), [], 'Mảng rỗng trả rỗng')
    assert.deepEqual(filterMatches(null, {}), [], 'null trả rỗng — throw là vỡ màn Tìm trận')
    assert.deepEqual(filterMatches(undefined), [], 'undefined trả rỗng')
  })

  // ── 10. Chỉ lọc theo một player (không chỉ định playerB) ──
  await t.test('10. filterMatches chỉ playerA: lọc tất cả trận của người đó', () => {
    const matches = [
      { id: 'm1', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], sets: [[21, 18]], winnerTeam: 'A' },
      { id: 'm2', teamA: ['p3', 'p4'], teamB: ['p1', 'p5'], sets: [[15, 21]], winnerTeam: 'B' },
      { id: 'm3', teamA: ['p6', 'p7'], teamB: ['p8', 'p9'], sets: [[21, 10]], winnerTeam: 'A' }, // p1 không tham gia
    ]
    const res = filterMatches(matches, { playerA: 'p1' })
    assert.equal(res.length, 2, 'p1 tham gia m1 và m2 — chỉ lọc theo playerA')
    assert.deepEqual(res.map(x => x.id).sort(), ['m1', 'm2'])
  })
})
