// Hai phía của một trận để vẽ thẻ/hàng trận: ai thắng, tên hiển thị, điểm từng set theo phía thắng/thua.
// Dùng chung cho tab Trận của buổi và trang Trận đấu (mobile + desktop).
import assert from 'node:assert/strict'
import { matchSides } from '../../lib/matchSearch.js'

const short = (id) => id.toUpperCase()
const full = (id) => 'Full ' + id

// A thắng 1 set
const a = matchSides({ teamA: ['an', 'binh'], teamB: ['cuong', 'dung'], winnerTeam: 'A', sets: [[21, 17]] }, short, full)
assert.equal(a.aWon, true)
assert.deepEqual(a.winnerTeam, ['an', 'binh'])
assert.deepEqual(a.loserTeam, ['cuong', 'dung'])
assert.equal(a.winnerNames, 'AN · BINH')
assert.equal(a.loserNames, 'CUONG · DUNG')
assert.equal(a.winnerFull, 'Full an · Full binh')
assert.equal(a.loserFull, 'Full cuong · Full dung')
assert.deepEqual(a.scoreSets, [{ winPts: 21, losePts: 17 }])
assert.equal(a.isMultiSet, false)
assert.equal(a.winSetsCount, 0, '1 set: không đếm set')
assert.equal(a.loseSetsCount, 0)

// B thắng: điểm đảo theo phía thắng
const b = matchSides({ teamA: ['an'], teamB: ['cuong'], winnerTeam: 'B', sets: [[19, 21]] }, short, full)
assert.equal(b.aWon, false)
assert.equal(b.winnerNames, 'CUONG')
assert.deepEqual(b.scoreSets, [{ winPts: 21, losePts: 19 }])

// 3 set: đếm set mỗi bên
const c = matchSides({ teamA: ['an'], teamB: ['cuong'], winnerTeam: 'A', sets: [[21, 19], [18, 21], [21, 15]] }, short, full)
assert.equal(c.isMultiSet, true)
assert.equal(c.winSetsCount, 2)
assert.equal(c.loseSetsCount, 1)
assert.deepEqual(c.scoreSets.map((s) => s.winPts), [21, 18, 21])

// Thiếu dữ liệu: không vỡ
const d = matchSides({ winnerTeam: null }, short, full)
assert.deepEqual(d.winnerTeam, [])
assert.equal(d.winnerNames, '')
assert.deepEqual(d.scoreSets, [])
assert.equal(d.isMultiSet, false)

console.log('match_sides.test.js: OK')
