import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { BOT_LINE_VARIANTS, ARCADE_DAILY_CAP } from '#lib/bot.js'

// ---------------------------------------------------------------------------
// Vì sao có file này
//
// Năm RPC của bot (migration 0064) đều SECURITY DEFINER và GRANT cho mọi `authenticated` — thành
// viên nào cũng gọi thẳng được với tham số tự chọn. Bản đầu để lọt mấy lỗ:
//   · `post_bot_reaction` nhận `p_kind` tự do → spam tab Hoạt động không giới hạn, và bot bêu
//     "người đầu đội B" là người từ chối kèo — sai người trước cả CLB.
//   · `place_bot_prediction` nhận phe từ client → ai biết gõ lệnh là bắt bot đặt cửa thua.
//   · `play_arcade_round` lấy CLB bằng `LIMIT 1` → người ở hai CLB bị trừ điểm nhầm CLB.
//   · Số dư SP cộng dồn TOÀN THỜI GIAN trong khi `season.js` tính theo mùa.
//   · Kèo bot là kèo đơn, trong khi CLB hầu như chỉ đánh đôi.
//
// Hành vi thật chỉ kiểm được trên Postgres với phiên đăng nhập, ngoài tầm bộ test thuần này. Nhưng
// HÌNH DẠNG của các cổng thì kiểm tĩnh được, và đó là chỗ các lỗi trên nằm.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../../supabase/migrations')
const BOT_FILE = '0064_bot_member_and_challenge.sql'
const sql = readFileSync(path.join(MIGRATIONS_DIR, BOT_FILE), 'utf8')

/** Thân hàm từ `CREATE OR REPLACE FUNCTION public.<name>(` tới hết `$fn$;`. */
const fnBody = (name) => {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
  assert.ok(start >= 0, `Không thấy hàm ${name} trong ${BOT_FILE}`)
  const end = sql.indexOf('$fn$;', start)
  return sql.slice(start, end)
}

/** Các chuỗi trong mệnh đề `p_kind NOT IN (...)` của một hàm. */
const kindWhitelist = (body) => {
  const m = body.match(/p_kind NOT IN \(([^)]*)\)/)
  assert.ok(m, 'Hàm phải có whitelist `p_kind NOT IN (...)`')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
}

test('migration: số thứ tự không trùng nhau', () => {
  // 0055 của bot từng trùng số với `0055_add_club_seasons.sql` của main sau khi merge.
  const nums = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).map((f) => f.split('_')[0])
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i)
  assert.deepEqual(dup, [], 'Hai migration cùng số thì thứ tự chạy phụ thuộc tên file — dễ chạy sai thứ tự: ' + dup.join(', '))
})

test('create_bot_challenge: luôn là kèo đôi và chỉ dựng khi có buổi tập sắp tới', () => {
  const body = fnBody('create_bot_challenge')
  assert.match(body, /p_team_a uuid\[\],\s*p_team_b uuid\[\]/, 'Nhận hai mảng người, không nhận từng người lẻ')
  assert.match(body, /cardinality\(p_team_a\) <> 2 OR cardinality\(p_team_b\) <> 2/, 'Mỗi phe đúng 2 người — kèo đơn phải bị từ chối')
  assert.match(body, /count\(DISTINCT x\)[\s\S]*<> 4/, 'Bốn đấu thủ phải khác nhau')
  assert.match(body, /FROM sessions[\s\S]*status IN \('draft', 'open'\)/, 'Hạn kèo phải gắn với buổi tập kế tiếp, không phải 24h cố định')
  assert.match(body, /expires_at, bot_reason\)[\s\S]*v_expires/, 'expires_at lấy từ buổi tập kế tiếp')
  assert.ok(!/CREATE OR REPLACE FUNCTION public\.create_bot_challenge\(\s*p_a uuid/.test(sql), 'Không còn bản kèo đơn (p_a, p_b)')
})

test('post_bot_reaction: bot chỉ nhận xét SAU TRẬN, mỗi kèo một dòng', () => {
  const body = fnBody('post_bot_reaction')
  assert.deepEqual(kindWhitelist(body), ['blowout', 'clutch', 'normal'],
    'Kèo bị từ chối / huỷ / hết hạn thì bot im — không còn cửa nào để bêu tên người từ chối')
  assert.ok(!/team = 'B'/.test(body), 'Không được suy "người từ chối" từ đội B')
  assert.match(body, /created_by IS DISTINCT FROM v_bot/, 'Bot chỉ bình phẩm kèo do chính nó dựng')
  assert.match(body, /ref_type = 'challenge' AND ref_id = p_challenge_id\s*\)/,
    'Chặn trùng theo KÈO, không theo kind — đổi kind không được đẻ thêm dòng')
})

test('post_bot_remark: whitelist khớp đúng bộ câu `BOT_LINE_VARIANTS.remark`', () => {
  const allowed = kindWhitelist(fnBody('post_bot_remark'))
  assert.deepEqual(allowed, Object.keys(BOT_LINE_VARIANTS.remark).sort(),
    'Mã được đăng mà không có câu thì hiện câu dự phòng; có câu mà SQL chặn thì bot câm — hai bên phải khớp')
  assert.ok(!allowed.includes('rank_drop'), 'Kênh công khai không bêu ai tụt Elo')
})

test('place_bot_prediction: phe do server chọn, client chỉ gửi mức cược', () => {
  const body = fnBody('place_bot_prediction')
  assert.match(body, /place_bot_prediction\(\s*p_challenge_id uuid,\s*p_stake\s+integer\s*\)/, 'Không còn tham số p_team')
  assert.match(sql, /GRANT\s+EXECUTE ON FUNCTION public\.place_bot_prediction\(uuid, integer\) TO authenticated/)
  assert.match(body, /v_team := CASE WHEN v_ra >= v_rb/, 'Phe = cửa có Elo trung bình cao hơn')
  assert.match(body, /member_season_sp\(v_chal\.club_id, v_bot, true\)/, 'Số dư bot tính theo mùa')
})

test('play_arcade_round: đúng CLB, số dư theo mùa, cap khớp client', () => {
  const body = fnBody('play_arcade_round')
  assert.match(body, /play_arcade_round\(\s*p_club\s+uuid,/, 'Tham số đầu là CLB')
  assert.match(body, /club_id = p_club AND user_id = auth\.uid\(\)/, 'Người chơi lấy theo đúng CLB, không LIMIT 1 theo tài khoản')
  assert.match(body, /member_season_sp\(p_club, v_bot, true\)/)
  assert.match(body, /member_season_sp\(p_club, v_me, false\)/)
  const cap = Number(body.match(/c_daily_cap constant integer := (\d+)/)?.[1])
  assert.equal(cap, ARCADE_DAILY_CAP, 'SQL không đọc được JS — hai con số phải được sửa cùng nhau')
  assert.match(body, /UPDATE activity_events/, 'Tab Hoạt động: một dòng mỗi người mỗi ngày, cộng dồn tại chỗ')
})

test('số dư SP: tính trong khung mùa, không cộng dồn toàn thời gian', () => {
  const body = fnBody('member_season_sp')
  assert.match(body, /settled_at BETWEEN b\.start_at AND b\.end_at/, 'Phiếu cược lọc theo mùa')
  assert.match(body, /created_at BETWEEN b\.start_at AND b\.end_at/, 'Ván Arcade lọc theo mùa')
  assert.match(fnBody('club_season_bounds'), /c\.seasons/, 'Khung mùa đọc từ clubs.seasons')
})

test('set_club_bot: chỉ chủ CLB, và mỗi CLB tối đa một bot', () => {
  const body = fnBody('set_club_bot')
  assert.match(body, /has_club_perm\(p_club, 'members'\)/, 'Chỉ người có quyền quản lý thành viên mới đổi được bot')
  // Mọi RPC lấy bot bằng `is_bot LIMIT 1` — hai bot là chọn ngẫu nhiên mỗi lần gọi. DB phải tự chặn.
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS \w+\s+ON public\.club_members\(club_id\) WHERE is_bot;/, 'Thiếu index unique một-bot-một-CLB')
  const off = body.indexOf('SET is_bot = false')
  const on = body.indexOf('SET is_bot = true')
  assert.ok(off >= 0 && on > off, 'Phải tắt người cũ TRƯỚC khi bật người mới, không thì đụng index unique')
})
