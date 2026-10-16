// Đổi trình độ không viết lại quá khứ (0071, `club_members.start_level`).
//
// Bug thật 2026-10-16: nâng hai người TBY- → TBY, lần "Tính lại toàn bộ" sau đó coi họ là TBY
// ngay từ trận đầu, chấm lại mọi trận cũ — điểm mùa top 1 và nhiều người khác đổi dù không ai
// đánh thêm trận nào. Từ giờ:
//   - Tiến bộ (mặc định): Elo xuất phát giữ trình cũ → tính lại ra ĐÚNG như trước khi đổi.
//   - Ghi nhầm từ đầu / chưa đánh trận nào: trình mới là trình từ ngày đầu.
import test from 'node:test'
import assert from 'node:assert/strict'
import { getPlayerRating, initialRatingOf, replayRatingCascade, seedLevelOf, startLevelAfter } from '#lib/rating.js'
import { toDb, toRows } from '#contexts/dbmap.js'

const LEVELS = ['Y', 'Y+', 'TBY-', 'TBY', 'TBY+', 'TB-', 'TB', 'TB+', 'TBK', 'Khá']
const mem = (id, level, extra = {}) => ({ id, name: id.toUpperCase(), level, gender: 'nam', ...extra })
const match = (id, at, teamA, teamB, winner = 'A') => ({
  id, at, teamA, teamB, sets: winner === 'A' ? [[21, 15]] : [[15, 21]], winnerTeam: winner, ratingEnabled: true,
})
const history = [
  match('m1', 1000, ['k', 'a'], ['b', 'c']),
  match('m2', 2000, ['k', 'b'], ['a', 'c'], 'B'),
  match('m3', 3000, ['a', 'b'], ['k', 'c']),
]
const others = [mem('a', 'TB'), mem('b', 'TB'), mem('c', 'TBY')]

test('seedLevelOf — trình xuất phát thắng trình hiện tại; khách luôn theo level', () => {
  assert.equal(seedLevelOf(mem('k', 'TBY', { startLevel: 'TBY-' })), 'TBY-')
  assert.equal(seedLevelOf(mem('k', 'TBY', { startLevel: null })), 'TBY')
  assert.equal(seedLevelOf({ id: 'g', level: 'TB' }), 'TB')
  assert.equal(seedLevelOf(undefined), undefined)
})

test('startLevelAfter — tiến bộ giữ trình cũ, ghi nhầm / chưa đánh thì bỏ', () => {
  const k = mem('k', 'TBY-')
  assert.equal(startLevelAfter(k, 'TBY-', { played: true }), null, 'không đổi trình thì không đụng')
  assert.equal(startLevelAfter(k, 'TBY', { played: true }), 'TBY-', 'tiến bộ: giữ trình xuất phát cũ')
  assert.equal(startLevelAfter(k, 'TBY', { played: true, mistake: true }), null, 'ghi nhầm: trình mới từ ngày đầu')
  assert.equal(startLevelAfter(k, 'TBY', { played: false }), null, 'chưa đánh trận nào: sửa thẳng')

  const k2 = mem('k', 'TBY', { startLevel: 'TBY-' })
  assert.equal(startLevelAfter(k2, 'TBY+', { played: true }), 'TBY-', 'tiến bộ lần hai vẫn giữ mốc ĐẦU TIÊN')
  assert.equal(startLevelAfter(k2, 'TBY', { played: true }), 'TBY-', 'lưu lại không đổi trình thì giữ mốc')
  assert.equal(startLevelAfter(k2, 'TB-', { played: true, mistake: true }), null, 'ghi nhầm xoá cả mốc cũ')
})

test('Tính lại sau khi đổi trình vì TIẾN BỘ ra đúng y như trước khi đổi', () => {
  const before = replayRatingCascade(history, null, [mem('k', 'TBY-'), ...others], LEVELS)
  const progressed = replayRatingCascade(history, null, [mem('k', 'TBY', { startLevel: 'TBY-' }), ...others], LEVELS)
  assert.deepEqual(progressed.updatedMatches, before.updatedMatches, 'số Elo lưu trong các trận cũ không đổi')
  assert.deepEqual(progressed.finalRatings, before.finalRatings, 'Elo hiện tại của cả CLB không đổi')

  // Cách CŨ (seed theo trình hiện tại) — chính là thứ đã làm đổi điểm mùa: trận đầu bị chấm lại.
  const old = replayRatingCascade(history, null, [mem('k', 'TBY'), ...others], LEVELS)
  assert.notEqual(old.updatedMatches[0].initialRatingA, before.updatedMatches[0].initialRatingA)
})

test('Ghi nhầm từ đầu: trận đầu tiên chấm theo trình mới', () => {
  const fixed = replayRatingCascade(history, null, [mem('k', 'TB'), ...others], LEVELS)
  const expectA = Math.round((initialRatingOf('TB', LEVELS) + initialRatingOf('TB', LEVELS)) / 2)
  assert.equal(fixed.updatedMatches[0].initialRatingA, expectA)
})

test('getPlayerRating — điểm xuất phát theo trình lúc bắt đầu', () => {
  const k = mem('k', 'TBY', { startLevel: 'TBY-' })
  assert.equal(getPlayerRating({}, 'k', k, LEVELS).seedRating, initialRatingOf('TBY-', LEVELS))
  assert.equal(getPlayerRating(null, 'k', mem('k', 'TBY'), LEVELS).seedRating, initialRatingOf('TBY', LEVELS))
})

test('dbmap — start_level đi về hai chiều, người chưa đổi thì null', () => {
  const raw = {
    club: { id: 'CL1', name: 'CLB', levels: LEVELS },
    members: [
      { id: 'k', club_id: 'CL1', name: 'K', level: 'TBY', start_level: 'TBY-', gender: 'nam', active: true },
      { id: 'a', club_id: 'CL1', name: 'A', level: 'TB', gender: 'nam', active: true },
    ],
  }
  const db = toDb(raw)
  assert.equal(db.members.find((m) => m.id === 'k').startLevel, 'TBY-')
  assert.equal(db.members.find((m) => m.id === 'a').startLevel, null)
  const rows = toRows(db, { clubId: 'CL1', memberIds: new Set(['k', 'a']) }).club_members
  assert.equal(rows.find((r) => r.id === 'k').start_level, 'TBY-')
  assert.equal(rows.find((r) => r.id === 'a').start_level, null)
})
