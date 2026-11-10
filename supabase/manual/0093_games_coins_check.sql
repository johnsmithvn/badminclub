-- 0093_games_coins_check.sql — kiểm tra migration 0093 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0092 và 0093_games_coins.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0093 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử (kể cả xu đã trả thử).
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản (như 0085_games_claim_check.sql), ví mỗi người còn ≥ 200 xu.

DO $check$
DECLARE
  v_club uuid;
  v_u1   uuid;
  v_u2   uuid;
  v_m1   uuid;
  v_m2   uuid;
  v_b1   int;
  v_b2   int;
  v_room uuid;
  v_err  text;
  r      game_rooms;
BEGIN
  /* ---------- 1. Có đủ bảng / hàm / trigger; quyền đúng ---------- */
  IF to_regclass('public.game_coins') IS NULL OR to_regprocedure('public.game_wallets(uuid)') IS NULL
     OR to_regprocedure('public.game_coin_balance(uuid)') IS NULL OR to_regprocedure('public.game_coins_settle(uuid)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: thiếu game_coins / game_wallets / game_coin_balance / game_coins_settle — đã chạy 0093 chưa?';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
      ('game_rooms_stake_guard', 'game_players_coin_guard', 'game_rooms_start_guard', 'game_rooms_settle')) <> 4 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: thiếu trigger xu';
  END IF;
  IF has_function_privilege('authenticated', 'public.game_coins_settle(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.game_wallets(uuid)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.game_coins', 'INSERT')
     OR has_table_privilege('authenticated', 'public.game_coins', 'UPDATE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: quyền sai — máy khách chỉ được đọc sổ xu và gọi game_wallets';
  END IF;

  SELECT a.club_id, a.user_id, b.user_id, a.id, b.id INTO v_club, v_u1, v_u2, v_m1, v_m2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
     AND game_coin_balance(a.id) >= 200 AND game_coin_balance(b.id) >= 200
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 1: cần một CLB có hai thành viên đã ghép tài khoản, ví ≥ 200 xu'; END IF;
  v_b1 := game_coin_balance(v_m1);
  v_b2 := game_coin_balance(v_m2);

  /* ---------- 2. Mức cược lạ / game không được cược → badOptions; mức hợp lệ thì tạo được ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM game_create(v_club, 'caro', '{"stake": 25}'::jsonb, true);
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: mức cược 25 vẫn tạo được phòng';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badOptions' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM game_create(v_club, 'covua', '{"stake": 10}'::jsonb, true);
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: Cờ vua (kết quả máy khách báo) vẫn cược được';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badOptions' THEN RAISE; END IF;
  END;
  PERFORM game_create(v_club, 'covua', '{"stake": 0}'::jsonb, true); -- không cược thì vẫn chơi được

  /* ---------- 3. Caro cược 50: người 2 bỏ giữa ván → người 1 +50, người 2 −50; trả lại lần nữa không nhân đôi ---------- */
  v_room := game_create(v_club, 'caro', '{"stake": 50}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_leave(v_room);
  PERFORM game_coins_settle(v_room);
  IF game_coin_balance(v_m1) <> v_b1 + 50 OR game_coin_balance(v_m2) <> v_b2 - 50
     OR (SELECT count(*) FROM game_coins WHERE room_id = v_room) <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: phải +50 / −50 đúng một lần — ví nhận % / % (trước % / %)', game_coin_balance(v_m1), game_coin_balance(v_m2), v_b1, v_b2;
  END IF;

  /* ---------- 4. Ba cây cược 100: xu = điểm × 100 ---------- */
  v_b1 := game_coin_balance(v_m1);
  v_b2 := game_coin_balance(v_m2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'bacay', '{"stake": 100}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 8);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 8);
  PERFORM game_move(v_room, 2, '{"flip": true}'::jsonb);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_move(v_room, 3, '{"flip": true}'::jsonb);
  PERFORM game_finish(v_room, '{"winners": []}'::jsonb);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'finished'
     OR game_coin_balance(v_m1) <> v_b1 + 100 * (r.result #>> '{scores,0}')::int
     OR game_coin_balance(v_m2) <> v_b2 + 100 * (r.result #>> '{scores,1}')::int THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: Ba cây phải trả điểm × 100 — kết quả %, ví % / % (trước % / %)',
      r.result, game_coin_balance(v_m1), game_coin_balance(v_m2), v_b1, v_b2;
  END IF;

  /* ---------- 5. Hoà không ai mất; người rời lúc phòng còn chờ không bị trừ ---------- */
  INSERT INTO game_rooms (club_id, game, code, host_id, status, options, started_at)
  VALUES (v_club, 'caro', 'Z93001', v_m1, 'playing', '{"stake": 10}', now() - interval '10 minutes') RETURNING id INTO v_room;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat) VALUES (v_room, v_m1, v_club, 0), (v_room, v_m2, v_club, 1);
  UPDATE game_rooms SET status = 'finished', ended_at = now(), result = '{"winners": [], "draw": true}' WHERE id = v_room;
  IF EXISTS (SELECT 1 FROM game_coins WHERE room_id = v_room) THEN RAISE EXCEPTION 'SAI Ở BƯỚC 5: ván hoà vẫn trừ xu'; END IF;

  INSERT INTO game_rooms (club_id, game, code, host_id, status, options, started_at)
  VALUES (v_club, 'caro', 'Z93002', v_m1, 'playing', '{"stake": 10}', now() - interval '10 minutes') RETURNING id INTO v_room;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat) VALUES (v_room, v_m1, v_club, 0);
  INSERT INTO game_room_players (room_id, member_id, club_id, seat, left_at) VALUES (v_room, v_m2, v_club, 1, now() - interval '20 minutes');
  UPDATE game_rooms SET status = 'finished', ended_at = now(), result = '{"winners": [0], "draw": false}' WHERE id = v_room;
  IF EXISTS (SELECT 1 FROM game_coins WHERE room_id = v_room) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: người rời lúc phòng còn chờ bị trừ xu (hoặc người thắng được cộng khi không ai thua)';
  END IF;

  /* ---------- 6. Ví cạn: đã ngồi rồi tụt ví → không bắt đầu được; vào phòng có cược bị chặn; phòng không cược vẫn vào ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'caro', '{"stake": 10}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  -- Giả lập người 2 vừa thua sạch ở phòng khác: một dòng sổ trừ xuống còn 5 xu.
  INSERT INTO game_coins (room_id, member_id, club_id, delta)
  SELECT id, v_m2, v_club, 5 - game_coin_balance(v_m2) FROM game_rooms WHERE club_id = v_club AND code = 'Z93001';
  IF game_coin_balance(v_m2) <> 5 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 6: dựng ví 5 xu không được'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM game_start(v_room, 2, 2);
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: người trong phòng còn 5 xu mà vẫn bắt đầu được ván cược 10';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.noCoinsSeat' THEN RAISE; END IF;
  END;
  v_room := game_create(v_club, 'caro', '{"stake": 10}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM game_join(v_room, 2);
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: ví 5 xu vẫn vào được phòng cược 10';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.noCoins' THEN RAISE; END IF;
  END;
  PERFORM game_create(v_club, 'caro', '{}'::jsonb, true); -- phòng không cược: vẫn tạo / ngồi được

  /* ---------- 7. game_wallets: ví = 1000 + tổng sổ, người ngoài CLB không thấy ---------- */
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  IF (SELECT balance FROM game_wallets(v_club) WHERE member_id = v_m2) IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: game_wallets phải trả ví 5 xu của người 2';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM game_wallets(v_club)) THEN RAISE EXCEPTION 'SAI Ở BƯỚC 7: người ngoài CLB đọc được ví'; END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION '0093 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;
