// Truy vết điểm mùa (lib/trace.js): tua dữ liệu bằng lịch sử thay đổi (audit_log, 0070) và chia
// công từng lần ghi. Hai thứ phải đúng tuyệt đối:
//   1. Tua lùi rồi tiến lại phải ra ĐÚNG trạng thái — sai là kết luận nhầm "ai làm mất điểm".
//   2. Tổng phần chia cho các lần ghi = chênh lệch hai mốc — không có điểm nào "trôi" không nguồn.
import test from 'node:test'
import assert from 'node:assert/strict'
import { boardOf, explainChange, parseAt, rewind, rowKey, summarizeTx, tablesToDb } from '../../lib/trace.js'

const T = (hm) => `2026-10-02T${hm}:00.000Z`
const S1 = 'S1'
const season = {
  id: 'Q', code: 'Q', active: true, startDate: '2026-10-01', endDate: '2026-12-31',
  deltaScale: {
    heavyFavored: { win: 10, loss: -12, minGap: 150 }, favored: { win: 12, loss: -10, minGap: 50 },
    balanced: { win: 14, loss: -8, minGap: -49 }, underdog: { win: 17, loss: -5, minGap: -149 },
    deepUnderdog: { win: 22, loss: -3, minGap: -9999 },
  },
  bonusConfig: { streak3: 5, streak5: 10, upset150: 5, upsetMinGap: 150 },
}
const mem = (id, name) => ({ id, club_id: 'C', name, level: 'TB', gender: 'nam', active: true, user_id: 'U-' + id })
const match = (id, at, ra, rb, winner = 'A') => ({
  id, session_id: S1, court_index: 0, minutes: 20, ended_at: at, sets: winner === 'A' ? [[21, 15]] : [[15, 21]],
  winner_team: winner, rating_enabled: true, initial_rating_a: ra, initial_rating_b: rb, source_type: 'session',
})
const players = (mid, [a1, a2, b1, b2]) => [
  { id: mid + 'p1', match_id: mid, player_type: 'member', player_id: a1, team: 0 },
  { id: mid + 'p2', match_id: mid, player_type: 'member', player_id: a2, team: 0 },
  { id: mid + 'p3', match_id: mid, player_type: 'member', player_id: b1, team: 1 },
  { id: mid + 'p4', match_id: mid, player_type: 'member', player_id: b2, team: 1 },
]
const TEAM = ['a', 'b', 'c', 'd']

// Trạng thái HIỆN TẠI (sau mọi thay đổi): còn m1 (đã bị tính lại Elo), m2 đã bị huỷ.
const base = () => ({
  clubs: [{ id: 'C', code: 'X', name: 'CLB', levels: ['Y', 'TB'], seasons: [season] }],
  club_members: TEAM.map((x) => mem(x, x.toUpperCase())),
  sessions: [{ id: S1, club_id: 'C', date: '2026-10-02', status: 'open' }],
  matches: [match('m1', T('12:00'), 500, 640)],
  match_players: players('m1', TEAM),
})
const audit = [
  // tx 1 · 12:00 — ghi m1 (đội a+b thắng, lúc đó Elo hai đội ngang nhau)
  { id: 1, tx_id: 1, changed_at: T('12:00'), table_name: 'matches', row_id: 'm1', action: 'I', new_data: match('m1', T('12:00'), 500, 500), actor: 'U-a' },
  ...players('m1', TEAM).map((p, i) => ({ id: 2 + i, tx_id: 1, changed_at: T('12:00'), table_name: 'match_players', row_id: p.id, action: 'I', new_data: p, actor: 'U-a' })),
  // tx 2 · 12:30 — ghi m2 (đội c+d thắng)
  { id: 6, tx_id: 2, changed_at: T('12:30'), table_name: 'matches', row_id: 'm2', action: 'I', new_data: match('m2', T('12:30'), 500, 500, 'B'), actor: 'U-a' },
  ...players('m2', TEAM).map((p, i) => ({ id: 7 + i, tx_id: 2, changed_at: T('12:30'), table_name: 'match_players', row_id: p.id, action: 'I', new_data: p, actor: 'U-a' })),
  // tx 3 · 13:00 — Tính lại Elo: số Elo lưu trong m1 đổi (đội a+b thành cửa dưới)
  { id: 11, tx_id: 3, changed_at: T('13:00'), table_name: 'matches', row_id: 'm1', action: 'U', old_data: { initial_rating_b: 500 }, new_data: { initial_rating_b: 640 }, actor: 'U-b' },
  // tx 4 · 13:30 — Huỷ m2 (bản ghi trùng)
  { id: 12, tx_id: 4, changed_at: T('13:30'), table_name: 'matches', row_id: 'm2', action: 'D', old_data: match('m2', T('12:30'), 500, 500, 'B'), actor: 'U-b' },
  ...players('m2', TEAM).map((p, i) => ({ id: 13 + i, tx_id: 4, changed_at: T('13:30'), table_name: 'match_players', row_id: p.id, action: 'D', old_data: p, actor: 'U-b' })),
]
const ms = (h) => Date.parse(T(h))

test('rowKey trùng cách trigger audit_row tính row_id', () => {
  assert.equal(rowKey('matches', { id: 'm1' }), 'm1')
  assert.equal(rowKey('member_levels', { member_id: 'x', from_month: '2026-10' }), 'x|2026-10')
})

test('rewind — lùi thêm / sửa / xoá', () => {
  const at1215 = rewind(base(), audit, ms('12:15'))
  assert.deepEqual(at1215.matches.map((m) => m.id), ['m1'], '12:15 chỉ mới có m1')
  assert.equal(at1215.matches[0].initial_rating_b, 500, 'chưa bị tính lại Elo')

  const at1245 = rewind(base(), audit, ms('12:45'))
  assert.deepEqual(at1245.matches.map((m) => m.id).sort(), ['m1', 'm2'], 'm2 đã huỷ phải được dựng lại')
  assert.equal(at1245.match_players.length, 8)

  const before = rewind(base(), audit, ms('11:00'))
  assert.equal(before.matches.length, 0)
  assert.equal(before.match_players.length, 0)

  const now = rewind(base(), audit, ms('23:00'))
  assert.deepEqual(now, { ...base(), member_levels: [], guests: [], session_guests: [], attendances: [], challenges: [], challenge_players: [], challenge_guests: [], challenge_predictions: [], player_ratings: [], club_calibration: [] })
})

test('tablesToDb — đi qua đúng toDb của app', () => {
  const db = tablesToDb(rewind(base(), audit, ms('12:45')))
  assert.equal(db.matches.length, 2)
  assert.deepEqual(db.matches.find((m) => m.id === 'm1').teamA, ['a', 'b'])
  assert.equal(db.seasons[0].id, 'Q')
})

test('boardOf — bảng điểm mùa tại một mốc', () => {
  const b = boardOf(rewind(base(), audit, ms('12:15')), ms('12:15'))
  const pts = Object.fromEntries(b.rows.map((r) => [r.id, r.points]))
  assert.equal(b.season.id, 'Q')
  assert.equal(pts.a, 114, '100 khởi đầu + thắng cân +14')
  assert.equal(pts.c, 92, '100 − thua cân 8')
})

test('explainChange — chia công từng lần ghi, tổng khớp chênh lệch', () => {
  const r = explainChange(base(), audit, ms('11:00'), ms('23:00'))
  const before = Object.fromEntries(r.before.rows.map((x) => [x.id, x.points]))
  const after = Object.fromEntries(r.after.rows.map((x) => [x.id, x.points]))
  TEAM.forEach((id) => {
    const sum = r.steps.reduce((s, st) => s + (st.deltas[id] || 0), 0)
    assert.equal(sum, (after[id] ?? 0) - (before[id] ?? 0), `${id}: tổng các bước phải bằng chênh lệch hai mốc`)
  })
  // Mốc sau khớp đúng trạng thái hiện tại tính thẳng
  const direct = Object.fromEntries(boardOf(base(), ms('23:00')).rows.map((x) => [x.id, x.points]))
  assert.deepEqual(after, direct)

  const recalc = r.steps.find((s) => s.summary.eloRewrites === 1)
  assert.ok(recalc, 'lần Tính lại Elo phải có mặt và được ghi công')
  // Đội a+b 500 vs 640 → chênh −140 → dải underdog (minGap −149): thắng +17 thay vì +14.
  assert.equal(recalc.deltas.a, 17 - 14, 'a+b từ thắng cân (+14) thành thắng cửa dưới (+17)')
  const cancel = r.steps.find((s) => s.summary.matchesDeleted.length === 1)
  assert.equal(cancel.summary.matchesDeleted[0].players.length, 4, 'trận huỷ kèm người chơi cùng lần ghi')
})

test('summarizeTx — nhận đúng loại thay đổi', () => {
  const s = summarizeTx(audit.filter((e) => e.tx_id === 4))
  assert.equal(s.matchesDeleted[0].id, 'm2')
  assert.equal(s.actor, 'U-b')
  assert.equal(summarizeTx(audit.filter((e) => e.tx_id === 3)).eloRewrites, 1)
})

test('summarizeTx — xoá kèo kéo theo phiếu cược, trận thôi là kèo', () => {
  const del = summarizeTx([
    { id: 1, tx_id: 9, changed_at: T('14:00'), table_name: 'challenges', row_id: 'K1', action: 'D', old_data: { id: 'K1', code: 'C-0200' } },
    { id: 2, tx_id: 9, changed_at: T('14:00'), table_name: 'challenge_predictions', row_id: 'P1', action: 'D', old_data: { id: 'P1', challenge_id: 'K1', member_id: 'a', status: 'won', stake_points: 20 } },
  ])
  assert.equal(del.challengesDeleted[0].code, 'C-0200')
  assert.equal(del.challengesDeleted[0].predictions[0].stake_points, 20, 'phiếu cược bị xoá theo kèo phải hiện ra')
  const unlink = summarizeTx([
    { id: 3, tx_id: 8, changed_at: T('14:00'), table_name: 'matches', row_id: 'm1', action: 'U', old_data: { challenge_id: 'K1', source_type: 'challenge' }, new_data: { challenge_id: null, source_type: 'session' } },
  ])
  assert.equal(unlink.unlinkedFromChallenge, 1)
  assert.equal(unlink.eloRewrites, 0, 'đổi challenge_id không phải tính lại Elo')
})

test('parseAt — giờ gõ tay hiểu theo giờ CLB', () => {
  assert.equal(parseAt('2026-10-16 14:00'), Date.parse('2026-10-16T14:00:00+07:00'))
  assert.equal(parseAt('2026-10-16T07:00:00Z'), Date.parse('2026-10-16T07:00:00Z'))
  assert.equal(parseAt('2026-10-16'), Date.parse('2026-10-16T23:59:59+07:00'), 'chỉ có ngày = cuối ngày')
})
