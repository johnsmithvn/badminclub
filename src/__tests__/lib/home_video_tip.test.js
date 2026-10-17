// node src/__tests__/lib/home_video_tip.test.js
// Home: thẻ "Trận của bạn có video" (18d) và dải "Gợi ý tập" (17b).

import assert from 'node:assert/strict'
import { getMyVideoMatches } from '#lib/homePersonal.js'
import { pickTip } from '#lib/library.js'

const V = 'https://youtu.be/dQw4w9WgXcQ'
const at = (iso) => Date.parse(iso + 'T12:00:00')

/* ---------- 18d: trận của mình có video ---------- */
const db = {
  sessions: [{ id: 's1', date: '2026-09-12' }],
  matches: [
    // Trận cũ nhất, mình đứng đội B, 1 set, thắng.
    { id: 'old', at: at('2026-08-22'), teamA: ['x', 'y'], teamB: ['me', 'z'], sets: [[20, 22]], winnerTeam: 'B', videoUrl: V },
    // Có video nhưng không có mình → không được lọt vào thẻ của mình.
    { id: 'other', at: at('2026-09-20'), teamA: ['x', 'y'], teamB: ['z', 'w'], sets: [[21, 10]], winnerTeam: 'A', videoUrl: V },
    // Có mình nhưng không có video → không được lọt.
    { id: 'novid', at: at('2026-09-19'), teamA: ['me', 'z'], teamB: ['x', 'y'], sets: [[21, 10]], winnerTeam: 'A', videoUrl: '' },
    // 3 set, mình đội A thua 1–2. Ngày lấy theo buổi chứ không theo `at`.
    { id: 'bo3', sessionId: 's1', at: at('2026-09-13'), teamA: ['me', 'z'], teamB: ['x', 'y'], sets: [[21, 15], [18, 21], [19, 21]], winnerTeam: 'B', videoUrl: V },
    { id: 'm3', at: at('2026-09-05'), teamA: ['me', 'z'], teamB: ['x', 'y'], scoreA: 17, scoreB: 21, winnerTeam: 'B', videoUrl: V },
    { id: 'm4', at: at('2026-08-29'), teamA: ['x', 'me'], teamB: ['z', 'y'], sets: [[21, 15]], winnerTeam: 'A', videoUrl: V },
    { id: 'm5', at: at('2026-09-18'), teamA: ['me', 'z'], teamB: ['x', 'y'], sets: [[21, 19]], winnerTeam: 'A', videoUrl: V },
  ],
}

const r = getMyVideoMatches(db, 'me', 4)
assert.equal(r.total, 5, 'tổng = mọi trận có mình VÀ có video — khớp số trận Lịch sử trận hiện ra khi bấm sang')
assert.deepEqual(r.items.map((m) => m.id), ['m5', 'bo3', 'm3', 'm4'],
  'mới nhất trước, cắt đúng 4 ô — không lọc đã xem / chưa xem')
assert.deepEqual(r.items[0], { id: 'm5', won: true, score: '21–19', date: '2026-09-18' })
assert.deepEqual(r.items[1], { id: 'bo3', won: false, score: '1–2', date: '2026-09-12' },
  'trận nhiều set hiện số set thắng–thua phía mình; ngày theo buổi tập')
assert.equal(r.items[2].score, '17–21', 'trận chỉ có scoreA/scoreB vẫn hiện tỷ số, phía mình đứng trước')

const old = getMyVideoMatches(db, 'me', 10).items.find((m) => m.id === 'old')
assert.deepEqual([old.won, old.score], [true, '22–20'], 'mình ở đội B thì đảo tỷ số cho phía mình đứng trước — không thì ô thắng hiện như thua')

assert.deepEqual(getMyVideoMatches(db, 'ghost', 4), { total: 0, items: [] }, 'chưa có trận có video thì thẻ không có gì để vẽ')
assert.deepEqual(getMyVideoMatches(null, 'me', 4), { total: 0, items: [] })

/* ---------- 17b: chọn bài gợi ý ---------- */
const posts = [
  { id: 'p1', authorId: 'me' },
  { id: 'p2', authorId: 'b' },
  { id: 'p3', authorId: 'c' },
]
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length] }

assert.equal(pickTip(posts, { p2: { viewedAt: '2026-10-01' } }, 'me', () => 0).id, 'p3',
  'ưu tiên bài người khác đăng mà mình chưa mở')
assert.equal(pickTip(posts, {}, 'me', () => 0).id, 'p2',
  'bài của chính mình không tính là chưa xem (tác giả không bao giờ có lượt xem)')
assert.deepEqual([0, 0.99].map((x) => pickTip(posts, {}, 'me', seq(x)).id), ['p2', 'p3'], 'số ngẫu nhiên chọn trong cả nhóm bài chưa xem')
assert.equal(pickTip(posts, { p2: { viewedAt: 'x' }, p3: { viewedAt: 'x' } }, 'me', () => 0.5).id, 'p2',
  'xem hết rồi vẫn gợi ý, chọn trong mọi bài')
assert.equal(pickTip(posts, {}, 'me', () => 1).id, 'p3', 'rnd chạm 1 không được vượt khỏi danh sách')
assert.equal(pickTip([], {}, 'me'), null, 'CLB chưa có bài thì không có gì để gợi ý')

console.log('home video + tip check: OK')
