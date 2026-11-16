// Cược điểm mùa trong mini-game (0110): hằng số máy khách khớp SQL + điểm game cộng đúng vào điểm mùa.
// Luật chuyển điểm lúc hết ván nằm ở SQL (trigger game_sp_settle) — kiểm tay trên DB thật (docs/GAMES.md §4c).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GAME_IDS, NO_STAKE, SP_GAMES, SP_MAX, spOf } from '#lib/games/registry.js'
import { calculateSeasonLeaderboard, getMemberSeasonLedger } from '#lib/season.js'
import { stakeBaseOf } from '#lib/challenge.js'

const sql = readFileSync(new URL('../../../supabase/migrations/0110_games_season_points.sql', import.meta.url), 'utf8')

/* ---------- spOf như game_sp ---------- */
assert.equal(spOf({ sp: 5 }), 5)
assert.equal(spOf({ sp: SP_MAX }), SP_MAX)
assert.equal(spOf({ sp: SP_MAX + 1 }), 0, 'quá trần = không cược (server cũng từ chối)')
assert.equal(spOf({ sp: 2.5 }), 0)
assert.equal(spOf({ sp: '5' }), 0, 'chuỗi không tính — server đòi jsonb số')
assert.equal(spOf({}), 0)
assert.equal(spOf(null), 0)

/* ---------- Hằng số khớp SQL ---------- */
const list = sql.match(/NEW\.game NOT IN \(([^)]*)\)/)[1].match(/'[a-z]+'/g).map((x) => x.slice(1, -1))
assert.deepEqual(list, SP_GAMES, 'danh sách game cược điểm mùa ở SQL phải khớp SP_GAMES')
assert.match(sql, new RegExp('BETWEEN 1 AND ' + SP_MAX), 'trần SQL phải khớp SP_MAX')
assert.ok(SP_GAMES.every((g) => GAME_IDS.includes(g)), 'SP_GAMES chỉ gồm game có thật')
for (const g of ['bacay', 'baucua', 'xidach', 'loto', 'cangua']) assert.ok(!SP_GAMES.includes(g), g + ' là may rủi — không cược điểm mùa')
assert.deepEqual(NO_STAKE.filter((g) => SP_GAMES.includes(g)), ['covua', 'cotuong', 'coup'], 'chỉ 3 game cờ do máy khách báo được cho cược (chủ dự án chấp nhận)')

/* ---------- Điểm game cộng vào điểm mùa ---------- */
const season = { id: 's', code: 'S', name: 'S', startDate: '2026-07-01', endDate: '2026-09-30' }
const members = ['A', 'B'].map((id) => ({ id, name: id, level: 'trung_binh', active: true }))
const match = {
  id: 'm1', sessionId: 's1', at: Date.parse('2026-08-01T10:00:00Z'), teamA: ['A'], teamB: ['B'], winnerTeam: 'A',
  sets: [[21, 15]], initialRatingA: 1000, initialRatingB: 1000, ratingEnabled: true,
}
const gameSp = [
  { roomId: 'r1', memberId: 'A', game: 'caro', delta: 20, createdAt: '2026-08-02T10:00:00Z' },
  { roomId: 'r1', memberId: 'B', game: 'caro', delta: -20, createdAt: '2026-08-02T10:00:00Z' },
  // Ngoài mùa: không tính
  { roomId: 'r0', memberId: 'A', game: 'caro', delta: 20, createdAt: '2026-06-01T10:00:00Z' },
]
const base = calculateSeasonLeaderboard({ members, matches: [match] }, season).leaderboard
const withGame = calculateSeasonLeaderboard({ members, matches: [match], gameSeasonPoints: gameSp }, season).leaderboard
const pts = (rows, id) => rows.find((r) => r.id === id).totalSeasonPoints
assert.equal(pts(withGame, 'A') - pts(base, 'A'), 20, 'người thắng ván +20')
assert.equal(pts(withGame, 'B') - pts(base, 'B'), -20, 'người thua ván -20')
assert.equal(
  pts(withGame, 'A') + pts(withGame, 'B'), pts(base, 'A') + pts(base, 'B'),
  'chuyển điểm, không sinh điểm: tổng cả CLB giữ nguyên',
)
const rowA = withGame.find((r) => r.id === 'A')
assert.equal(rowA.breakdown.gameNetPoints, 20)
assert.equal(rowA.gameLogs.length, 1)
assert.equal(rowA.gameLogs[0].pointsAfter, rowA.totalSeasonPoints, 'dòng game cuối mang điểm sau khớp tổng')

// Người chưa ra sân: vốn cược = điểm khởi đầu + lãi/lỗ game
const onlyGame = calculateSeasonLeaderboard({ members, matches: [], gameSeasonPoints: gameSp }, season)
assert.equal(stakeBaseOf(onlyGame, 'B'), (season.startPoints ?? 100) - 20)

// Sổ cái: dòng game, và các nguồn cộng lại = tổng
const ledger = getMemberSeasonLedger('A', { members, matches: [match], gameSeasonPoints: gameSp }, season)
const gameRows = ledger.allEvents.filter((e) => e.isGame)
assert.equal(gameRows.length, 1)
assert.equal(gameRows[0].gameId, 'caro')
assert.equal(gameRows[0].titleKey, 'season.ledgerGameWon')
const s = ledger.split
assert.equal(s.game, 20)
assert.equal(s.start + s.match + s.challenge + s.bonus + s.prediction + s.game, ledger.totalPoints)

console.log('season points in games check: OK')
