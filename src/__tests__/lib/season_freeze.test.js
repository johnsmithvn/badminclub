// Bảng chốt mùa (0073, `season_standings`).
//
// Bug thật: điểm mùa là số dẫn xuất, mở mùa cũ là tính lại từ trận. "Tính lại Elo" ghi đè Elo lưu
// trong MỌI trận nên Q3 đã trao giải vẫn trôi tới −19/người (2026-10-16); người nghỉ CLB biến mất
// khỏi bảng mùa cũ. Từ giờ mùa đã chốt đọc bảng chốt — các test dưới khoá đúng lời hứa đó.
import test from 'node:test'
import assert from 'node:assert/strict'
import cfg from '#config/app.json' with { type: 'json' }
import { buildSeasonStandings, calculateSeasonLeaderboard, frozenSeasonOf, getMemberSeasonLedger } from '#lib/season.js'

const PHONE = '0900111222'
const BANK = '1234567890'
const mem = (id, level) => ({ id, name: id.toUpperCase(), level, gender: 'nam', active: true, phone: PHONE, bankNo: BANK })
const members = [mem('a', 'TB'), mem('b', 'TB'), mem('c', 'TB'), mem('d', 'TB')]
const T = (day, h = 19) => Date.parse(`2026-07-${String(day).padStart(2, '0')}T${h}:00:00Z`)
const match = (id, sessionId, at, teamA, teamB, winner) => ({
  id, sessionId, at, teamA, teamB, playerKeys: [...teamA, ...teamB], sets: winner === 'A' ? [[21, 15]] : [[15, 21]],
  winnerTeam: winner, ratingEnabled: true, initialRatingA: 500, initialRatingB: 500,
})
const Q3 = {
  id: '2026-Q3', code: '2026-Q3', startDate: '2026-07-01', endDate: '2026-09-30', active: false,
  closedAt: '2026-09-27T16:00:00Z', deltaScale: cfg.season.deltaScale, bonusConfig: cfg.season.bonusConfig,
}
const Q4 = { id: '2026-Q4', code: '2026-Q4', startDate: '2026-10-01', endDate: '2026-12-31', active: true }
const db = {
  members,
  guests: [],
  levels: ['Y', 'TBY', 'TB'],
  sessions: [{ id: 's1', date: '2026-07-05' }, { id: 's2', date: '2026-07-12' }],
  matches: [
    match('m1', 's1', T(5), ['a', 'b'], ['c', 'd'], 'A'),
    match('m2', 's1', T(5, 20), ['a', 'c'], ['b', 'd'], 'A'),
    match('m3', 's2', T(12), ['a', 'd'], ['b', 'c'], 'B'),
    match('m4', 's2', T(12, 20), ['a', 'b'], ['c', 'd'], 'A'),
  ],
  seasons: [Q4, Q3],
}
const eloOf = (id) => ({ rating: id === 'a' ? 640 : 500, gamesCount: 4, confidence: 'low' })
const pts = (lb) => lb.map((r) => [r.id, r.rank, r.totalSeasonPoints])

const standings = buildSeasonStandings(db, Q3, eloOf)
const q3Frozen = frozenSeasonOf(Q3, standings, '2026-10-25T10:00:00Z')
const frozenDb = { ...db, seasons: [Q4, q3Frozen], seasonStandings: { '2026-Q3': standings.rows } }

// "Tính lại Elo" chấm lại số lưu trong trận (đội A +200 → dải heavyFavored) và A nghỉ CLB.
const drifted = {
  ...frozenDb,
  matches: db.matches.map((m) => ({ ...m, initialRatingA: m.initialRatingA + 200 })),
  members: members.map((m) => (m.id === 'a' ? { ...m, active: false } : m)),
}

test('Bảng chốt chép đúng con số màn hình đang hiện, không chép dữ liệu cá nhân', () => {
  const live = calculateSeasonLeaderboard(db, Q3)
  assert.deepEqual(pts(standings.rows), pts(live.leaderboard), 'chốt ra số khác màn hình là chốt sai sự thật')
  assert.equal(standings.rows.find((r) => r.id === 'a').eloAtClose, 640, 'Elo lúc chốt đi kèm từng dòng')
  assert.deepEqual(standings.stats, { totalSeasonMatches: 4, playedSessionsCount: 2 })

  const json = JSON.stringify(standings.rows)
  assert.ok(!json.includes(PHONE) && !json.includes(BANK), 'bảng chốt cả CLB đọc được — không được mang SĐT / số tài khoản')
  const log = standings.rows.find((r) => r.id === 'a').matchLogs[0]
  assert.equal(log.playerKeys, undefined, 'sổ điểm chỉ giữ trường cần hiện, không trải nguyên object trận')
  assert.equal(typeof log.pointsAfter, 'number')
})

test('Mùa đã chốt: Tính lại Elo / người nghỉ CLB KHÔNG làm đổi bảng', () => {
  const before = calculateSeasonLeaderboard(frozenDb, q3Frozen)
  const after = calculateSeasonLeaderboard(drifted, q3Frozen)
  assert.equal(after.frozen, true)
  assert.deepEqual(after.leaderboard, before.leaderboard, 'mùa đã trao giải mà điểm còn trôi là đúng bug Q3 2026-10-16')
  assert.ok(after.leaderboard.some((r) => r.id === 'a'), 'người nghỉ CLB vẫn phải còn trong bảng mùa họ đã đánh')

  // Chứng minh dữ liệu trôi thật: không có bảng chốt thì cùng dữ liệu đó ra số khác.
  const recomputed = calculateSeasonLeaderboard({ ...drifted, seasonStandings: undefined }, q3Frozen)
  assert.notDeepEqual(pts(recomputed.leaderboard), pts(before.leaderboard))
})

test('Sổ điểm từng người của mùa đã chốt khớp bảng chốt', () => {
  const row = standings.rows.find((r) => r.id === 'a')
  const ledger = getMemberSeasonLedger('a', drifted, q3Frozen)
  assert.equal(ledger.totalPoints, row.totalSeasonPoints)
  assert.equal(ledger.rank, row.rank)
  assert.equal(ledger.allEvents.length, row.matchLogs.length)
  const s = ledger.split
  assert.equal(s.start + s.match + s.challenge + s.bonus + s.prediction, row.totalSeasonPoints, 'sổ cộng lệch tổng là người đọc mất lòng tin vào cả bảng')
})

test('Mùa đang chạy luôn tính trực tiếp, kể cả khi có bảng chốt lạc', () => {
  const live = calculateSeasonLeaderboard(db, Q4)
  const stray = calculateSeasonLeaderboard({ ...db, seasonStandings: { '2026-Q4': standings.rows } }, Q4)
  assert.equal(stray.frozen, undefined, 'mùa chưa chốt mà đọc bảng chốt thì sửa tỉ số trong mùa không còn tác dụng')
  assert.deepEqual(pts(stray.leaderboard), pts(live.leaderboard))
})

test('Chưa nạp bảng chốt thì tính như cũ (truy vết / backtest đi đường này)', () => {
  const noRows = calculateSeasonLeaderboard({ ...frozenDb, seasonStandings: undefined }, q3Frozen)
  assert.equal(noRows.frozen, undefined)
  assert.deepEqual(pts(noRows.leaderboard), pts(standings.rows))
})

test('Bảng chốt dựng lại đủ chỉ số tổng của mùa', () => {
  const { topStats } = calculateSeasonLeaderboard(frozenDb, q3Frozen)
  assert.equal(topStats.playedSessionsCount, 2)
  assert.equal(topStats.totalSeasonMatches, 4)
  assert.equal(topStats.leaderPlayer.id, standings.rows[0].id)
})

test('frozenSeasonOf: đóng mùa, khoá luật đã dùng, bục vinh danh gọn', () => {
  assert.equal(q3Frozen.active, false)
  assert.equal(q3Frozen.frozenAt, '2026-10-25T10:00:00Z')
  assert.equal(q3Frozen.closedAt, Q3.closedAt, 'mùa đóng từ trước giữ nguyên ngày đóng')
  assert.equal(q3Frozen.startPoints, cfg.season.startPoints, 'mùa không lưu điểm khởi đầu thì khoá theo app.json lúc chốt')
  assert.equal(q3Frozen.challengeMultiplier, cfg.season.challengeMultiplier)
  assert.deepEqual(q3Frozen.podiumSnapshot.map((p) => p.id), standings.rows.slice(0, 3).map((r) => r.id))

  // Bục cũ (ảnh lúc trao giải) được giữ nhưng bỏ trường cá nhân.
  const old = { ...Q3, podiumSnapshot: [{ id: 'b', name: 'B', rank: 1, gender: 'nam', totalSeasonPoints: 999, member: { phone: PHONE } }] }
  const kept = frozenSeasonOf(old, standings, '2026-10-25T10:00:00Z')
  assert.deepEqual(kept.podiumSnapshot, [{ id: 'b', name: 'B', rank: 1, gender: 'nam', totalSeasonPoints: 999 }])
})
