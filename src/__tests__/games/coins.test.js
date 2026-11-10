// Xu ảo (0093): hằng số máy khách khớp SQL + danh sách game không được cược đúng là game server chưa tự chấm.
// Luật trả xu / chặn ví nằm hết ở SQL (trigger) — kiểm trên DB thật bằng supabase/manual/0093_games_coins_check.sql.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { BOARD_POINTS, BUYIN_MULT, COIN_RELIEF, COIN_START, GAME_IDS, NO_STAKE, STAKES, buyinsOf, chipsOf, splitOf, stakeOf } from '#lib/games/registry.js'
import { budgetOf } from '#lib/games/baucua.js'

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

/* ---------- 0101: ví chuẩn — mang xu vào bàn, chia xu, Bầu cua chặn đặt quá tay ---------- */
{
  const w = readFileSync(new URL('0101_games_wallet.sql', dir), 'utf8').replace(/\r\n/g, '\n')
  const check = readFileSync(new URL('../../../supabase/manual/0101_games_wallet_check.sql', import.meta.url), 'utf8')

  // Bộ mẫu chung với file kiểm: splitOf (JS) và game_coin_split (SQL) phải ra cùng số.
  const fx = JSON.parse(check.match(/v_fx\s+jsonb := \$cx\$(.*?)\$cx\$;/s)[1])
  assert.ok(fx.length >= 20, 'bộ mẫu chia xu quá ít')
  for (const f of fx) assert.deepEqual(splitOf(f.game, f.stake, f.result, f.seats, f.caps), f.nets, f.note + ': splitOf khác bộ mẫu 0101')
  assert.match(check, /0101 CHECK OK/)

  // Không ai mất quá số mang vào; tổng xu không sinh ra từ hư không (người thắng nhận ≤ người thua mất).
  for (const f of fx) {
    f.nets.forEach((n, i) => assert.ok(n >= -f.caps[i], f.note + ': mất quá số mang vào'))
    assert.ok(f.nets.reduce((a, b) => a + b, 0) <= 0, f.note + ': chia ra nhiều hơn thu vào')
  }
  assert.deepEqual(splitOf('baucua', 10, { scores: { 0: 30, 1: -30 } }, [0, 1], [500, 100]), [100, -100], 'thua chạm trần thì người thắng chỉ nhận chừng ấy')

  // Hằng số khớp SQL.
  assert.deepEqual(buyinsOf('baucua', 10), [100, 200, 500])
  assert.deepEqual(buyinsOf('caro', 50), [50])
  assert.deepEqual(buyinsOf('caro', 0), [])
  assert.ok(w.includes('ARRAY[' + BUYIN_MULT.map((k) => k + ' * p_stake').join(', ') + ']'), 'mức mang vào SQL ≠ BUYIN_MULT')
  assert.deepEqual(listIn(w.match(/SELECT p_game IN \(([^)]*)\)/)[1]), BOARD_POINTS, 'game_points SQL ≠ BOARD_POINTS')
  assert.ok(w.includes('w.balance < ' + COIN_RELIEF) && w.includes("'relief', " + COIN_RELIEF + ' - w.balance, ' + COIN_RELIEF), 'cứu trợ SQL ≠ COIN_RELIEF')
  assert.ok(w.includes('GREATEST(0, ' + COIN_START + ' + coalesce('), 'mở ví SQL ≠ COIN_START')
  assert.equal(chipsOf(100, -30, 10), 0, 'xu trên bàn không âm')
  assert.equal(chipsOf(200, 5, 10), 250)

  // Bầu cua: run ở 0101 = run ở 0096 + đúng các khối "0101 ↓ … 0101 ↑" (đổi 0096 mà quên 0101 là test đỏ).
  const fnOf = (s) => { const a = s.indexOf('CREATE OR REPLACE FUNCTION public.game_baucua_run('); return s.slice(a, s.indexOf('\n$$;', a) + 4) }
  const base = fnOf(readFileSync(new URL('0096_games_baucua.sql', dir), 'utf8').replace(/\r\n/g, '\n'))
  const mine = fnOf(w)
  assert.equal(mine.replace(/^ *-- 0101 ↓[\s\S]*?-- 0101 ↑\n/gm, ''), base, 'game_baucua_run 0101 phải chép nguyên 0096, chỉ thêm khối 0101')
  assert.ok(mine.includes('SELECT floor(buyin::numeric / v_stake)::int INTO v_budget'), 'budgetOf: xu mang vào ÷ giá điểm, làm tròn xuống')
  assert.ok(mine.includes('> v_budget + v_scores[m.seat + 1]'), 'budgetOf: + điểm đã ăn thua')
  assert.equal(budgetOf(100, 10, -10), 0)
  assert.equal(budgetOf(250, 100, 3), 5)

  // Trigger 0093 giữ tên, 0101 thay thân; RPC mới có quyền cho máy khách.
  for (const fn of ['game_players_coin_guard', 'game_rooms_start_guard', 'game_rooms_settle']) {
    assert.ok(w.includes('CREATE OR REPLACE FUNCTION public.' + fn + '()'), '0101 phải thay thân ' + fn)
  }
  for (const fn of ['game_my_wallet(uuid)', 'game_buyin(uuid, int)', 'game_wallets(uuid)']) {
    assert.ok(w.includes('GRANT EXECUTE ON FUNCTION public.' + fn + ' TO authenticated'), 'thiếu quyền ' + fn)
  }
  for (const m of w.matchAll(/games\.err\.([A-Za-z]+)/g)) assert.ok(vi.games.err[m[1]], 'thiếu chữ cho games.err.' + m[1])
  assert.equal((w.match(/\$\$/g) || []).length % 2, 0, 'dấu $$ lẻ — thân hàm hỏng')
}

console.log('games coins check: OK')
