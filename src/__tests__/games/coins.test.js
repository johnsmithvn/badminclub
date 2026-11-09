// Xu ảo (0093): hằng số máy khách khớp SQL + danh sách game không được cược đúng là game server chưa tự chấm.
// Luật trả xu / chặn ví nằm hết ở SQL (trigger) — kiểm trên DB thật bằng supabase/manual/0093_games_coins_check.sql.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { BOARD_POINTS, COIN_START, GAME_IDS, NO_STAKE, STAKES, stakeOf } from '#lib/games/registry.js'

const dir = new URL('../../../supabase/migrations/', import.meta.url)
const sql = readFileSync(new URL('0093_games_coins.sql', dir), 'utf8')
const vi = JSON.parse(readFileSync(new URL('../../i18n/vi.json', import.meta.url), 'utf8'))

/* ---------- stakeOf như game_stake ---------- */
assert.deepEqual(STAKES, [0, 10, 50, 100])
assert.equal(stakeOf({ stake: 50 }), 50)
assert.equal(stakeOf({ stake: 25 }), 0, 'mức lạ = không cược')
assert.equal(stakeOf({ stake: '50' }), 0, 'chuỗi không tính — server so jsonb số')
assert.equal(stakeOf({}), 0)
assert.equal(stakeOf(null), 0)

/* ---------- Hằng số khớp SQL ---------- */
const listIn = (s) => s.match(/'[a-z]+'/g).map((x) => x.slice(1, -1))
assert.match(sql, /p_options -> 'stake' IN \('10'::jsonb, '50'::jsonb, '100'::jsonb\)/, 'mức cược SQL phải khớp STAKES')
assert.equal((sql.match(new RegExp('SELECT ' + COIN_START + ' \\+ coalesce')) || []).length, 1, 'ví ban đầu SQL phải khớp COIN_START')
assert.match(sql, new RegExp('\\(' + COIN_START + ' \\+ sum\\(c\\.delta\\)\\)'), 'game_wallets dùng cùng số ví ban đầu')
for (const m of sql.matchAll(/game IN \(('[a-z]+'(?:, '[a-z]+')*)\)/g)) {
  const ids = listIn(m[1])
  if (ids.includes('covua')) assert.deepEqual(ids, NO_STAKE, 'danh sách game không cược ở SQL phải khớp NO_STAKE')
  else assert.deepEqual(ids, BOARD_POINTS, 'game trả xu theo điểm ở SQL phải khớp BOARD_POINTS')
}
assert.equal((sql.match(/'covua', 'cotuong', 'cangua'/g) || []).length, 2, 'chặn tạo phòng + bỏ qua lúc trả xu')

/* ---------- Game không được cược = đúng những game chưa có bản chấm server ---------- */
const all = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n')
for (const id of GAME_IDS) {
  const scored = new RegExp('FUNCTION public\\.game_' + id + '_result\\(').test(all)
  assert.equal(NO_STAKE.includes(id), !scored,
    id + (scored ? ': server đã tự chấm — bỏ khỏi NO_STAKE (cả 0093) để cho cược' : ': kết quả do máy khách báo — phải nằm trong NO_STAKE'))
}

/* ---------- Mã lỗi RAISE có chữ ---------- */
for (const m of sql.matchAll(/games\.err\.([A-Za-z]+)/g)) assert.ok(vi.games.err[m[1]], 'thiếu chữ cho games.err.' + m[1])

/* ---------- Trigger gắn đủ đường: tạo phòng, ngồi ghế, bắt đầu, xong ván ---------- */
assert.match(sql, /CREATE TRIGGER game_rooms_stake_guard BEFORE INSERT ON public\.game_rooms/)
assert.match(sql, /CREATE TRIGGER game_players_coin_guard BEFORE INSERT OR UPDATE OF left_at ON public\.game_room_players/)
assert.match(sql, /CREATE TRIGGER game_rooms_start_guard BEFORE UPDATE OF status ON public\.game_rooms/)
assert.match(sql, /CREATE TRIGGER game_rooms_settle AFTER UPDATE OF status ON public\.game_rooms/)
assert.match(sql, /ON CONFLICT \(room_id, member_id\) DO NOTHING/, 'trả xu đúng một lần')
assert.match(sql, /p\.left_at IS NULL OR p\.left_at >= r\.started_at/, 'người của ván như BXH: người rời lúc chờ không bị trừ')
assert.match(readFileSync(new URL('../../../supabase/manual/0093_games_coins_check.sql', import.meta.url), 'utf8'), /0093 CHECK OK/)

console.log('games coins check: OK')
