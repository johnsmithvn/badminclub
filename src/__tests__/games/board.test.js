// Bảng xếp hạng mini-game: hàm xếp thuần (registry.boardOf) + gác SQL 0091 (game_board).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BOARD_POINTS, GAMES, boardOf } from '#lib/games/registry.js'
import tienlen from '#lib/games/tienlen.js'
import phom from '#lib/games/phom.js'

const row = (game, memberId, played, won, drawn, lost, points = 0) => ({ game, memberId, played, won, drawn, lost, points })

/* ---------- Game theo thắng: thắng → ít ván hơn (= tỉ lệ cao hơn) ---------- */
{
  const { byPoints, rows } = boardOf([
    row('caro', 'a', 10, 6, 0, 4), // 6 thắng, 60%
    row('caro', 'b', 8, 6, 1, 1), //  6 thắng, 75% → trên a
    row('caro', 'c', 3, 3, 0, 0), //  3 thắng
    row('caro', 'd', 1, 0, 0, 1),
    row('covua', 'c', 5, 5, 0, 0), // game khác — không lẫn vào
  ], 'caro')
  assert.equal(byPoints, false)
  assert.deepEqual(rows.map((r) => r.memberId), ['b', 'a', 'c', 'd'])
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4])
  assert.equal(rows[0].rate, 75)
  assert.equal(rows[3].rate, 0)
}

/* ---------- Bằng hết tiêu chí → cùng hạng, hạng sau nhảy cóc ---------- */
{
  const { rows } = boardOf([
    row('caro', 'x', 4, 2, 0, 2),
    row('caro', 'y', 4, 2, 0, 2),
    row('caro', 'z', 4, 1, 0, 3),
    row('caro', 'w', 9, 5, 0, 4),
  ], 'caro')
  assert.deepEqual(rows.map((r) => [r.memberId, r.rank]), [['w', 1], ['x', 2], ['y', 2], ['z', 4]])
}

/* ---------- Cùng số thắng, cùng tỉ lệ → ít ván hơn đứng trên ---------- */
{
  const { rows } = boardOf([row('caro', 'big', 4, 2, 0, 2), row('caro', 'small', 2, 1, 0, 1), row('caro', 'mid', 4, 2, 1, 1)], 'caro')
  // big & mid cùng 2 thắng, 50%, 4 ván → cùng hạng; small 1 thắng
  assert.deepEqual(rows.map((r) => [r.memberId, r.rank]), [['big', 1], ['mid', 1], ['small', 3]])
}

/* ---------- Game có điểm: điểm → thắng → ít ván ---------- */
{
  const { byPoints, rows } = boardOf([
    row('phom', 'a', 10, 4, 0, 6, 12),
    row('phom', 'b', 10, 6, 0, 4, 12), // cùng điểm, thắng nhiều hơn → trên a
    row('phom', 'c', 3, 3, 0, 0, 20),
    row('phom', 'd', 12, 2, 0, 10, -44),
  ], 'phom')
  assert.equal(byPoints, true)
  assert.deepEqual(rows.map((r) => r.memberId), ['c', 'b', 'a', 'd'])
  assert.equal(rows[3].points, -44)
}

/* ---------- Tiến lên cũng xếp theo điểm; game có scores nhưng không cộng dồn (Cờ vây) thì không ---------- */
{
  const tl = boardOf([row('tienlen', 'a', 5, 4, 0, 1, -3), row('tienlen', 'b', 5, 1, 0, 4, 3)], 'tienlen')
  assert.equal(tl.byPoints, true)
  assert.deepEqual(tl.rows.map((r) => r.memberId), ['b', 'a'])
  const cv = boardOf([row('covay', 'a', 2, 2, 0, 0, 120), row('covay', 'b', 3, 1, 0, 2, 300)], 'covay')
  assert.equal(cv.byPoints, false)
  assert.deepEqual(cv.rows.map((r) => r.memberId), ['a', 'b'])
}

/* ---------- Tất cả game: cộng dồn theo người, xếp theo thắng, bỏ game lạ ---------- */
{
  const { byPoints, rows } = boardOf([
    row('caro', 'a', 3, 1, 1, 1),
    row('phom', 'a', 5, 2, 0, 3, -7),
    row('covua', 'b', 4, 4, 0, 0),
    row('gamecu', 'c', 50, 50, 0, 0), // game đã gỡ khỏi GAMES → không tính
  ], null)
  assert.equal(byPoints, false)
  assert.deepEqual(rows.map((r) => r.memberId), ['b', 'a'])
  assert.deepEqual(rows[1], { memberId: 'a', played: 8, won: 3, drawn: 1, lost: 4, points: -7, rate: 38, rank: 2 })
}

/* ---------- Rỗng / null ---------- */
assert.deepEqual(boardOf(null, 'caro'), { byPoints: false, rows: [] })
assert.deepEqual(boardOf([row('caro', 'a', 0, 0, 0, 0)], 'caro').rows, [])

/* ---------- Game xếp theo điểm phải là game thật và server chấm có trả `scores` ---------- */
// Kết quả lưu vào game_rooms.result do hàm SQL game_<id>_result dựng (Phỏm phía client chỉ trả pending).
const SCORED_BY = { tienlen: '0078_games_tienlen.sql', phom: '0090_games_phom.sql', bacay: '0092_games_bacay.sql',
  baucua: '0096_games_baucua.sql', xidach: '0098_games_xidach.sql' }
for (const id of BOARD_POINTS) {
  assert.ok(GAMES[id], 'BOARD_POINTS có game không tồn tại: ' + id)
  assert.ok(SCORED_BY[id], 'game mới trong BOARD_POINTS — thêm file SQL chấm điểm của nó vào SCORED_BY')
  const sql = readFileSync(new URL('../../../supabase/migrations/' + SCORED_BY[id], import.meta.url), 'utf8')
  assert.match(sql, new RegExp('FUNCTION public\\.game_' + id + '_result'), id + ': phải có hàm chấm trên server')
  assert.match(sql, /'scores'/, id + ': kết quả server phải có scores')
}
assert.match(String(tienlen.result), /scores/)
assert.equal(phom.result({ over: false }), null)

/* ---------- SQL 0091: đúng các điều kiện đã chốt ---------- */
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0091_games_board.sql', import.meta.url), 'utf8')
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.game_board'))
  assert.match(fn, /SECURITY INVOKER/, 'game_board phải chạy bằng quyền người gọi để RLS giới hạn CLB')
  assert.match(fn, /r\.status = 'finished'/, 'chỉ tính phòng đã xong')
  assert.match(fn, /p\.left_at IS NULL OR p\.left_at >= r\.started_at/, 'người rời lúc phòng còn chờ không tính')
  assert.match(fn, /AT TIME ZONE 'Asia\/Ho_Chi_Minh'/, 'tháng tính theo giờ Việt Nam')
  assert.match(fn, /jsonb_typeof\(r\.result -> 'scores' -> \(p\.seat::text\)\) = 'number'/, 'điểm lạ kiểu không được làm hỏng bảng')
  assert.doesNotMatch(fn, /->> 'draw'\)::boolean/, 'không ép kiểu draw — result client gửi có thể sai kiểu')
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.game_board\(uuid, text\) TO authenticated/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.game_board\(uuid, text\) FROM PUBLIC, anon/)
  const check = readFileSync(new URL('../../../supabase/manual/0091_games_board_check.sql', import.meta.url), 'utf8')
  assert.match(check, /0091 CHECK OK/)
}

console.log('games board check: OK')
