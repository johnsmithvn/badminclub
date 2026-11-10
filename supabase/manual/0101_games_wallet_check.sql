-- 0101_games_wallet_check.sql — kiểm tra migration 0101 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0101_games_wallet.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0101 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử (ví, sổ, phòng thử).
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản (như 0093_games_coins_check.sql). Ví hai người được đặt tạm về 1000
-- trong lúc kiểm (huỷ khi xong). Bước 8 (cứu trợ) sai nếu người thứ hai đang thật sự ngồi một ván cược chưa xong.
-- Bộ mẫu ở bước 2 dùng chung với src/__tests__/games/coins.test.js (splitOf phải ra đúng các số này).

DO $check$
DECLARE
  v_fx   jsonb := $cx$[{"note":"tienlen đủ tiền","game":"tienlen","stake":10,"result":{"winners":[0],"draw":false,"scores":{"0":3,"1":-1,"2":-2}},"seats":[0,1,2],"caps":[100,100,100],"nets":[30,-10,-20]},{"note":"baucua thua chạm trần","game":"baucua","stake":100,"result":{"winners":[0],"draw":false,"scores":{"0":40,"1":-40}},"seats":[0,1],"caps":[1000,1000],"nets":[1000,-1000]},{"note":"chia theo tỷ lệ","game":"baucua","stake":10,"result":{"winners":[0],"draw":false,"scores":{"0":30,"1":10,"2":-50}},"seats":[0,1,2],"caps":[500,500,200],"nets":[150,50,-200]},{"note":"thu dư thì bỏ phần dư","game":"tienlen","stake":10,"result":{"winners":[0],"draw":false,"scores":{"0":1,"1":1,"2":-3}},"seats":[0,1,2],"caps":[100,100,25],"nets":[10,10,-25]},{"note":"tỷ lệ làm tròn xuống","game":"xidach","stake":10,"result":{"winners":[0],"draw":false,"scores":{"0":2,"1":1,"2":-4}},"seats":[0,1,2],"caps":[100,100,10],"nets":[6,3,-10]},{"note":"nửa điểm làm tròn ra xa 0","game":"phom","stake":10,"result":{"winners":[0],"draw":false,"scores":{"0":2.5,"1":-2.5}},"seats":[0,1],"caps":[100,100],"nets":[30,-30]},{"note":"điểm không phải số = 0","game":"bacay","stake":10,"result":{"winners":[0],"draw":false,"scores":{"0":5,"1":"x"}},"seats":[0,1,2],"caps":[100,100,100],"nets":[0,0,0]},{"note":"game điểm bỏ cuộc: người thua mất cả số mang vào","game":"phom","stake":50,"result":{"winners":[1],"draw":false,"forfeit":true},"seats":[0,1,2],"caps":[500,1000,500],"nets":[-500,1000,-500]},{"note":"caro thắng thua","game":"caro","stake":50,"result":{"winners":[0],"draw":false},"seats":[0,1],"caps":[50,50],"nets":[50,-50]},{"note":"hoà","game":"caro","stake":50,"result":{"winners":[],"draw":true},"seats":[0,1],"caps":[50,50],"nets":[0,0]},{"note":"hai người thắng chia hũ","game":"loto","stake":10,"result":{"winners":[0,1],"draw":false},"seats":[0,1,2],"caps":[10,10,10],"nets":[5,5,-10]},{"note":"ba người thắng, lẻ bỏ","game":"domino","stake":10,"result":{"winners":[0,1,2],"draw":false},"seats":[0,1,2,3],"caps":[10,10,10,10],"nets":[3,3,3,-10]},{"note":"ai cũng thắng","game":"loto","stake":10,"result":{"winners":[0,1],"draw":false},"seats":[0,1],"caps":[10,10],"nets":[0,0]},{"note":"không ai thắng","game":"caro","stake":10,"result":{"winners":[]},"seats":[0,1],"caps":[10,10],"nets":[0,0]},{"note":"không cược","game":"caro","stake":0,"result":{"winners":[0],"draw":false},"seats":[0,1],"caps":[0,0],"nets":[0,0]},{"note":"không có kết quả","game":"caro","stake":10,"result":null,"seats":[0,1],"caps":[10,10],"nets":[0,0]},{"note":"người thắng không còn trong ván","game":"caro","stake":10,"result":{"winners":[5],"draw":false},"seats":[0,1],"caps":[10,10],"nets":[0,0]},{"note":"game thắng thua có scores vẫn theo người thắng","game":"domino","stake":10,"result":{"winners":[0],"draw":false,"scores":{"0":-3,"1":-10}},"seats":[0,1],"caps":[10,10],"nets":[10,-10]},{"note":"phòng cũ: ví ít hơn mức cược","game":"caro","stake":100,"result":{"winners":[0],"draw":false},"seats":[0,1],"caps":[100,40],"nets":[40,-40]},{"note":"ba cây cược 100","game":"bacay","stake":100,"result":{"winners":[0],"draw":false,"scores":{"0":2,"1":-1,"2":-1}},"seats":[0,1,2],"caps":[1000,1000,1000],"nets":[200,-100,-100]},{"note":"scores là mảng: theo người thắng","game":"xidach","stake":10,"result":{"winners":[0],"draw":false,"scores":[1,-1]},"seats":[0,1],"caps":[100,100],"nets":[100,-100]},{"note":"ghế không liền (người rời), thứ tự lộn","game":"tienlen","stake":10,"result":{"winners":[2],"draw":false,"scores":{"0":-1,"2":4,"3":-3}},"seats":[2,0,3],"caps":[100,100,20],"nets":[30,-10,-20]}]$cx$;
  f      jsonb;
  v_got  int[];
  v_club uuid;
  v_u1   uuid;
  v_u2   uuid;
  v_m1   uuid;
  v_m2   uuid;
  v_room uuid;
  v_err  text;
  r      game_rooms;
BEGIN
  /* ---------- 1. Có đủ bảng / hàm / cột / trigger; quyền đúng ---------- */
  IF to_regclass('public.game_wallet') IS NULL OR to_regclass('public.game_coin_tx') IS NULL
     OR to_regprocedure('public.game_coin_split(text, integer, jsonb, integer[], integer[])') IS NULL
     OR to_regprocedure('public.game_buyin(uuid, integer)') IS NULL OR to_regprocedure('public.game_my_wallet(uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'game_room_players' AND column_name = 'buyin') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: thiếu bảng / hàm / cột của 0101 — đã chạy 0101 chưa?';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
      ('game_rooms_stake_guard', 'game_players_coin_guard', 'game_rooms_start_guard', 'game_rooms_settle')) <> 4 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: thiếu trigger xu (0093)';
  END IF;
  IF has_table_privilege('authenticated', 'public.game_wallet', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.game_wallet', 'INSERT')
     OR has_table_privilege('authenticated', 'public.game_coin_tx', 'INSERT')
     OR has_function_privilege('authenticated', 'public.game_wallet_add(uuid, uuid, text, integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_wallet_settle(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_wallet_open(uuid, boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.game_buyin(uuid, integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.game_my_wallet(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.game_wallets(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: quyền sai — máy khách chỉ được đọc ví / sổ và gọi game_buyin / game_my_wallet / game_wallets';
  END IF;

  /* ---------- 2. Chia xu khớp splitOf (bộ mẫu chung) + các mức mang vào bàn ---------- */
  FOR f IN SELECT * FROM jsonb_array_elements(v_fx) LOOP
    v_got := game_coin_split(f ->> 'game', (f ->> 'stake')::int, NULLIF(f -> 'result', 'null'::jsonb),
      ARRAY(SELECT x::int FROM jsonb_array_elements_text(f -> 'seats') WITH ORDINALITY t(x, k) ORDER BY k),
      ARRAY(SELECT x::int FROM jsonb_array_elements_text(f -> 'caps') WITH ORDINALITY t(x, k) ORDER BY k));
    IF v_got IS DISTINCT FROM ARRAY(SELECT x::int FROM jsonb_array_elements_text(f -> 'nets') WITH ORDINALITY t(x, k) ORDER BY k) THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 2 (%): game_coin_split ra %, phải ra %', f ->> 'note', v_got, f -> 'nets';
    END IF;
  END LOOP;
  IF game_buyins('baucua', 10) <> ARRAY[100, 200, 500] OR game_buyins('caro', 50) <> ARRAY[50]
     OR cardinality(game_buyins('caro', 0)) <> 0 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: game_buyins sai — Bầu cua 10 phải {100,200,500}, Caro 50 phải {50}, không cược phải {}';
  END IF;

  /* ---------- 3. Hai thành viên, ví đặt tạm về 1000 (hôm nay coi như đã cứu trợ) ---------- */
  SELECT a.club_id, a.user_id, b.user_id, a.id, b.id INTO v_club, v_u1, v_u2, v_m1, v_m2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;
  PERFORM game_wallet_open(v_m1, false);
  PERFORM game_wallet_open(v_m2, false);
  UPDATE game_wallet SET balance = 1000, relief_on = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date WHERE member_id IN (v_m1, v_m2);

  /* ---------- 4. Caro cược 50: góp 50 lúc bắt đầu; người 2 bỏ → người 1 nhận 100; trả lần nữa không nhân đôi ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'caro', '{"stake": 50}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  IF (SELECT count(*) FROM game_room_players WHERE room_id = v_room AND buyin = 50) <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: ghế phòng Caro cược 50 phải mang vào đúng 50';
  END IF;
  BEGIN
    PERFORM game_buyin(v_room, 100);
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: Caro góp được 100 (chỉ được đúng mức cược)';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badOptions' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);
  IF (SELECT balance FROM game_wallet WHERE member_id = v_m1) <> 950 OR (SELECT balance FROM game_wallet WHERE member_id = v_m2) <> 950
     OR (SELECT count(*) FROM game_coin_tx WHERE room_id = v_room AND kind = 'buyin') <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: bắt đầu phải trừ 50 khỏi ví mỗi người';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_leave(v_room);
  PERFORM game_wallet_settle(v_room); -- lần hai: không được trả thêm
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'finished' OR (SELECT balance FROM game_wallet WHERE member_id = v_m1) <> 1050
     OR (SELECT balance FROM game_wallet WHERE member_id = v_m2) <> 950
     OR (SELECT count(*) FROM game_coin_tx WHERE room_id = v_room) <> 4 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: người 1 phải nhận 100 đúng một lần — ví % / %, sổ phòng % dòng',
      (SELECT balance FROM game_wallet WHERE member_id = v_m1), (SELECT balance FROM game_wallet WHERE member_id = v_m2),
      (SELECT count(*) FROM game_coin_tx WHERE room_id = v_room);
  END IF;

  /* ---------- 5. Bầu cua giá điểm 10: chọn mang 200; thua hết số mang vào thì không đặt được; bỏ ngang mất cả 100 ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'baucua', '{"stake": 10, "time": 30, "laps": 3}'::jsonb, true);
  PERFORM game_buyin(v_room, 200);
  BEGIN
    PERFORM game_buyin(v_room, 150);
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: mang vào 150 (không có trong 100 / 200 / 500) vẫn nhận';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badOptions' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 10);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 10);
  IF (SELECT balance FROM game_wallet WHERE member_id = v_m1) <> 850 OR (SELECT balance FROM game_wallet WHERE member_id = v_m2) <> 850 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: bắt đầu phải trừ 200 (người 1) và 100 (người 2, mức mặc định)';
  END IF;
  -- Ván 1 (cái = ghế 0): người 2 đặt 10 vào bầu, ra ba cua → người 2 −10. Ván 2 (cái = ghế 1): người 1 chốt 0.
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES
    (v_room, 2, v_club, 1, '{"bet": [10, 0, 0, 0, 0, 0]}'),
    (v_room, 3, v_club, 0, '{"roll": true, "dice": [1, 1, 1]}'),
    (v_room, 4, v_club, 0, '{"bet": [0, 0, 0, 0, 0, 0]}'),
    (v_room, 5, v_club, 1, '{"roll": true, "dice": [0, 0, 0]}');
  -- Ván 3 (cái = ghế 0): người 2 còn 100 ÷ 10 − 10 = 0 điểm trên bàn.
  IF game_baucua_check(v_room, 1, '{"bet": [1, 0, 0, 0, 0, 0]}'::jsonb) IS DISTINCT FROM 'games.err.noChips' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: người 2 thua hết 10 điểm mang vào mà vẫn đặt được (%)',
      game_baucua_check(v_room, 1, '{"bet": [1, 0, 0, 0, 0, 0]}'::jsonb);
  END IF;
  IF game_baucua_check(v_room, 1, '{"bet": [0, 0, 0, 0, 0, 0]}'::jsonb) IS NOT NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: hết xu vẫn phải chốt 0 (bỏ ván) được';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_leave(v_room);
  IF (SELECT balance FROM game_wallet WHERE member_id = v_m1) <> 1150 OR (SELECT balance FROM game_wallet WHERE member_id = v_m2) <> 850 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: bỏ ngang Bầu cua phải mất cả 100 mang vào — ví % / % (phải 1150 / 850)',
      (SELECT balance FROM game_wallet WHERE member_id = v_m1), (SELECT balance FROM game_wallet WHERE member_id = v_m2);
  END IF;

  /* ---------- 6. Ván bỏ (abandoned) → trả lại nguyên số mang vào ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'caro', '{"stake": 10}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);
  UPDATE game_rooms SET status = 'abandoned', ended_at = now() WHERE id = v_room;
  IF (SELECT balance FROM game_wallet WHERE member_id = v_m1) <> 1150 OR (SELECT balance FROM game_wallet WHERE member_id = v_m2) <> 850
     OR (SELECT count(*) FROM game_coin_tx WHERE room_id = v_room AND kind = 'refund') <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: ván bỏ phải trả lại nguyên 10 cho mỗi người';
  END IF;

  /* ---------- 7. Ví thiếu: không vào được; vào rồi tụt ví → không bắt đầu được, không ai bị trừ ---------- */
  UPDATE game_wallet SET balance = 40 WHERE member_id = v_m2;
  v_room := game_create(v_club, 'caro', '{"stake": 50}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM game_join(v_room, 2);
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: ví 40 vẫn vào được phòng cược 50';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.noCoins' THEN RAISE; END IF;
  END;
  UPDATE game_wallet SET balance = 100 WHERE member_id = v_m2;
  PERFORM game_join(v_room, 2);
  UPDATE game_wallet SET balance = 20 WHERE member_id = v_m2;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM game_start(v_room, 2, 2);
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: người trong phòng còn 20 xu mà vẫn bắt đầu được ván cược 50';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.noCoinsSeat' THEN RAISE; END IF;
  END;
  IF (SELECT balance FROM game_wallet WHERE member_id = v_m1) <> 1150 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: bắt đầu hỏng mà ví người 1 vẫn bị trừ';
  END IF;

  /* ---------- 8. Cứu trợ: ví < 100 → nạp đủ 100, mỗi ngày một lần ---------- */
  UPDATE game_wallet SET balance = 30, relief_on = NULL WHERE member_id = v_m2;
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  IF game_my_wallet(v_club) <> 100
     OR NOT EXISTS (SELECT 1 FROM game_coin_tx WHERE member_id = v_m2 AND kind = 'relief' AND delta = 70 AND balance = 100) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 8: ví 30 phải được nạp thêm 70 cho đủ 100';
  END IF;
  UPDATE game_wallet SET balance = 30 WHERE member_id = v_m2;
  IF game_my_wallet(v_club) <> 30 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 8: một ngày cứu trợ hai lần'; END IF;

  /* ---------- 9. Phòng cược bắt đầu trước 0101 (không có xu trên bàn): trả thẳng vào ví (legacy) ---------- */
  UPDATE game_wallet SET balance = 1000 WHERE member_id IN (v_m1, v_m2);
  INSERT INTO game_rooms (club_id, game, code, host_id, status, options, started_at)
  VALUES (v_club, 'caro', 'Z01011', v_m1, 'playing', '{"stake": 50}', now() - interval '10 minutes') RETURNING id INTO v_room;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat) VALUES (v_room, v_m1, v_club, 0), (v_room, v_m2, v_club, 1);
  UPDATE game_rooms SET status = 'finished', ended_at = now(), result = '{"winners": [0], "draw": false}' WHERE id = v_room;
  IF (SELECT balance FROM game_wallet WHERE member_id = v_m1) <> 1050 OR (SELECT balance FROM game_wallet WHERE member_id = v_m2) <> 950
     OR (SELECT count(*) FROM game_coin_tx WHERE room_id = v_room AND kind = 'legacy') <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 9: phòng cũ phải +50 / −50 thẳng vào ví';
  END IF;

  /* ---------- 10. Quyền đọc: thành viên CLB đọc được ví / sổ, không ghi được; người ngoài không thấy ---------- */
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  IF (SELECT balance FROM game_wallets(v_club) WHERE member_id = v_m2) IS DISTINCT FROM 950 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 10: game_wallets phải trả ví 950 của người 2';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM game_coin_tx WHERE member_id = v_m2) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 10: thành viên CLB phải đọc được sổ xu';
  END IF;
  BEGIN
    INSERT INTO game_coin_tx (club_id, member_id, kind, delta, balance) VALUES (v_club, v_m1, 'relief', 1000, 1000);
    RAISE EXCEPTION 'SAI Ở BƯỚC 10: máy khách tự ghi được sổ xu';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM game_wallets(v_club)) OR EXISTS (SELECT 1 FROM game_coin_tx WHERE club_id = v_club) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 10: người ngoài CLB đọc được ví / sổ';
  END IF;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION '0101 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;
