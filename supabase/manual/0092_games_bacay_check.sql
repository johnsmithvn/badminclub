-- 0092_games_bacay_check.sql — kiểm tra migration 0092 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0092_games_bacay.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0092 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản (như 0085_games_claim_check.sql).
-- Bộ ván mẫu ($bc$ … $bc$) dùng chung với src/__tests__/games/bacay.test.js: JS chấm ra đúng `result` của từng ván,
-- ở đây game_bacay_score phải ra y vậy. Thêm ván: viết hands / out, lấy result từ scoreOf (lib/games/bacay.js) —
-- bacay.test.js báo ngay nếu result trong khối lệch với luật JS.

DO $check$
DECLARE
  v_fx   jsonb := $bc$[{"name":"bằng 9 nút: lá rô thắng lá cơ dù cơ là 9","hands":[[7,28,35],[6,9,12],[13,20,32]],"out":[false,false,false],"result":{"winners":[1],"draw":false,"ranks":[1,0,2],"scores":{"0":-1,"1":2,"2":-1}}},{"name":"cùng chất rô: A rô thắng 9 rô","hands":[[2,4,8],[9,13,34]],"out":[false,false],"result":{"winners":[0],"draw":false,"ranks":[0,1],"scores":{"0":1,"1":-1}}},{"name":"người rời có 9 nút vẫn thua","hands":[[1,32,35],[4,8,12],[17,21,25]],"out":[true,false,false],"result":{"winners":[1],"draw":false,"ranks":[1,2,0],"scores":{"0":-1,"1":2,"2":-1}}},{"name":"bù (0 nút) thua 1 nút","hands":[[10,11,14],[0,1,32]],"out":[false,false],"result":{"winners":[1],"draw":false,"ranks":[1,0],"scores":{"0":-1,"1":1}}},{"name":"bù gặp bù: A cơ (to nhất) thắng 9 cơ","hands":[[3,7,27],[5,33,35]],"out":[false,false],"result":{"winners":[0],"draw":false,"ranks":[0,1],"scores":{"0":1,"1":-1}}},{"name":"8 người, hai người rời","hands":[[0,4,8],[12,16,20],[24,28,32],[1,5,9],[13,17,21],[25,29,33],[2,6,10],[14,18,22]],"out":[false,true,false,false,false,false,true,false],"result":{"winners":[0],"draw":false,"ranks":[0,3,7,4,2,5,1,6],"scores":{"0":7,"1":-1,"2":-1,"3":-1,"4":-1,"5":-1,"6":-1,"7":-1}}},{"name":"ngẫu nhiên 1","hands":[[1,12,34],[28,30,31]],"out":[false,false],"result":{"winners":[0],"draw":false,"ranks":[0,1],"scores":{"0":1,"1":-1}}},{"name":"ngẫu nhiên 2","hands":[[3,16,29],[5,30,34],[2,7,28]],"out":[false,false,false],"result":{"winners":[1],"draw":false,"ranks":[1,0,2],"scores":{"0":-1,"1":2,"2":-1}}},{"name":"ngẫu nhiên 3","hands":[[7,13,15],[23,24,27],[18,20,26],[1,32,33]],"out":[false,false,false,false],"result":{"winners":[3],"draw":false,"ranks":[3,2,1,0],"scores":{"0":-1,"1":-1,"2":-1,"3":3}}},{"name":"ngẫu nhiên 4","hands":[[22,23,31],[14,21,32],[13,17,34],[11,18,30],[8,16,35]],"out":[false,false,false,false,true],"result":{"winners":[1],"draw":false,"ranks":[1,2,3,0,4],"scores":{"0":-1,"1":4,"2":-1,"3":-1,"4":-1}}},{"name":"ngẫu nhiên 5","hands":[[13,15,19],[8,17,21],[16,25,28],[22,27,31],[9,11,32],[14,20,29]],"out":[false,false,false,false,false,false],"result":{"winners":[5],"draw":false,"ranks":[5,4,1,0,3,2],"scores":{"0":-1,"1":-1,"2":-1,"3":-1,"4":-1,"5":5}}},{"name":"ngẫu nhiên 6","hands":[[6,18,35],[21,26,32],[15,22,30],[1,16,19],[10,25,31],[20,23,27],[7,17,24]],"out":[false,true,true,false,true,false,false],"result":{"winners":[5],"draw":false,"ranks":[5,0,6,3,1,2,4],"scores":{"0":-1,"1":-1,"2":-1,"3":-1,"4":-1,"5":6,"6":-1}}},{"name":"ngẫu nhiên 7","hands":[[7,20,23],[2,16,25],[4,8,31],[9,32,33],[5,26,27],[13,30,34],[1,3,11],[10,17,35]],"out":[false,false,false,false,false,false,false,false],"result":{"winners":[7],"draw":false,"ranks":[7,4,6,0,1,2,5,3],"scores":{"0":-1,"1":-1,"2":-1,"3":-1,"4":-1,"5":-1,"6":-1,"7":7}}},{"name":"ngẫu nhiên 8","hands":[[7,13,21],[26,29,32]],"out":[false,false],"result":{"winners":[1],"draw":false,"ranks":[1,0],"scores":{"0":-1,"1":1}}},{"name":"ngẫu nhiên 9","hands":[[19,22,28],[5,14,18],[12,21,27]],"out":[false,true,false],"result":{"winners":[0],"draw":false,"ranks":[0,2,1],"scores":{"0":2,"1":-1,"2":-1}}},{"name":"ngẫu nhiên 10","hands":[[0,22,30],[6,10,26],[11,27,31],[4,9,20]],"out":[false,false,false,false],"result":{"winners":[2],"draw":false,"ranks":[2,0,1,3],"scores":{"0":-1,"1":-1,"2":3,"3":-1}}},{"name":"ngẫu nhiên 11","hands":[[5,23,28],[14,20,27],[4,19,34],[0,24,35],[12,16,18]],"out":[false,false,false,false,false],"result":{"winners":[1],"draw":false,"ranks":[1,3,2,0,4],"scores":{"0":-1,"1":4,"2":-1,"3":-1,"4":-1}}},{"name":"ngẫu nhiên 12","hands":[[12,13,32],[8,23,29],[0,2,24],[31,33,35],[5,18,30],[7,10,17]],"out":[false,false,false,false,true,true],"result":{"winners":[2],"draw":false,"ranks":[2,1,0,3,4,5],"scores":{"0":-1,"1":-1,"2":5,"3":-1,"4":-1,"5":-1}}},{"name":"ngẫu nhiên 13","hands":[[0,4,32],[9,13,30],[6,7,16],[5,27,31],[10,24,35],[8,18,23],[1,21,25]],"out":[false,false,false,false,true,false,true],"result":{"winners":[2],"draw":false,"ranks":[2,3,1,5,0,4,6],"scores":{"0":-1,"1":-1,"2":6,"3":-1,"4":-1,"5":-1,"6":-1}}},{"name":"ngẫu nhiên 14","hands":[[28,32,35],[0,4,25],[10,24,27],[9,15,23],[5,7,20],[11,19,31],[2,18,33],[6,13,21]],"out":[false,false,false,false,false,false,false,false],"result":{"winners":[2],"draw":false,"ranks":[2,0,5,6,3,7,4,1],"scores":{"0":-1,"1":-1,"2":7,"3":-1,"4":-1,"5":-1,"6":-1,"7":-1}}}]$bc$;
  f      jsonb;
  v_got  jsonb;
  v_club uuid;
  v_u1   uuid;
  v_u2   uuid;
  v_m1   uuid;
  v_room uuid;
  v_err  text;
  v_h0   int[];
  v_h1   int[];
  v_exp  jsonb;
  r      game_rooms;
BEGIN
  /* ---------- 1. Có đủ hàm; máy khách không gọi thẳng được hàm nội bộ ---------- */
  IF to_regprocedure('public.game_bacay_score(jsonb, jsonb)') IS NULL OR to_regprocedure('public.game_bacay_deal(uuid)') IS NULL
     OR to_regprocedure('public.game_bacay_fill(uuid, integer, jsonb)') IS NULL OR to_regprocedure('public.game_bacay_result(uuid)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: thiếu hàm game_bacay_* — đã chạy 0092 chưa?';
  END IF;
  IF has_function_privilege('authenticated', 'public.game_bacay_fill(uuid, integer, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_bacay_deal(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: người đăng nhập gọi thẳng được game_bacay_fill / _deal — phải chỉ qua game_move / game_start';
  END IF;

  /* ---------- 2. Bộ ván mẫu: chấm y như JS ---------- */
  FOR f IN SELECT * FROM jsonb_array_elements(v_fx) LOOP
    v_got := game_bacay_score(f -> 'hands', f -> 'out');
    IF v_got IS DISTINCT FROM f -> 'result' THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 2 (%): JS chấm % — server chấm %', f ->> 'name', f -> 'result', v_got;
    END IF;
  END LOOP;
  IF game_bacay_score('[[0, 4, 8], null]'::jsonb, '[false, false]'::jsonb) IS NOT NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: người còn chơi thiếu bài thì chưa chấm được';
  END IF;

  /* ---------- 3. Ván thật qua RPC: tạo, vào, bắt đầu → chia mỗi người 3 lá khác nhau, nước 1 = { deal: { n: 2 } } ---------- */
  SELECT a.club_id, a.user_id, b.user_id, a.id INTO v_club, v_u1, v_u2, v_m1
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'bacay', '{}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 8);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 8);

  SELECT cards INTO v_h0 FROM game_hands WHERE room_id = v_room AND seat = 0;
  SELECT cards INTO v_h1 FROM game_hands WHERE room_id = v_room AND seat = 1;
  IF coalesce(array_length(v_h0, 1), 0) <> 3 OR coalesce(array_length(v_h1, 1), 0) <> 3
     OR (SELECT count(DISTINCT x) FROM unnest(v_h0 || v_h1) x) <> 6
     OR (SELECT count(*) FROM game_hands WHERE room_id = v_room) <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: phải chia mỗi người 3 lá, 6 lá khác nhau, không có nọc — nhận % / %', v_h0, v_h1;
  END IF;
  IF (SELECT move FROM game_moves WHERE room_id = v_room AND seq = 1) IS DISTINCT FROM '{"deal": {"n": 2}}'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: nước 1 phải là { deal: { n: 2 } }';
  END IF;

  /* ---------- 4. Lật: log mang đúng 3 lá thật; lật lần hai / gửi kèm lá bịa bị từ chối; chưa ai lật hết thì chưa xong ---------- */
  PERFORM game_move(v_room, 2, '{"flip": true}'::jsonb);
  IF (SELECT move FROM game_moves WHERE room_id = v_room AND seq = 2) IS DISTINCT FROM jsonb_build_object('flip', true, 'cards', to_jsonb(v_h0)) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: nước lật phải ghi đúng 3 lá của ghế 0 — nhận %', (SELECT move FROM game_moves WHERE room_id = v_room AND seq = 2);
  END IF;
  BEGIN
    PERFORM game_move(v_room, 3, '{"flip": true}'::jsonb);
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: lật lần hai vẫn được ghi';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.flipped' THEN RAISE; END IF;
  END;
  IF game_bacay_result(v_room) IS NOT NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 4: ghế 1 chưa lật mà đã có kết quả'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM game_move(v_room, 3, jsonb_build_object('flip', true, 'cards', to_jsonb(v_h0)));
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: gửi kèm lá tự chọn vẫn được ghi';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badMove' THEN RAISE; END IF;
  END;

  /* ---------- 5. Ghế 1 lật → xong; game_finish ghi đúng kết quả chấm từ bài thật ---------- */
  PERFORM game_move(v_room, 3, '{"flip": true}'::jsonb);
  v_exp := game_bacay_score(jsonb_build_array(to_jsonb(v_h0), to_jsonb(v_h1)), '[false, false]'::jsonb);
  IF game_bacay_result(v_room) IS DISTINCT FROM v_exp THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: kết quả phải là % — nhận %', v_exp, game_bacay_result(v_room);
  END IF;
  PERFORM game_finish(v_room, '{"winners": [], "draw": true}'::jsonb); -- kết quả máy khách bịa phải bị bỏ qua
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'finished' OR r.result IS DISTINCT FROM v_exp THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: phòng phải xong với kết quả % — nhận % %', v_exp, r.status, r.result;
  END IF;

  /* ---------- 6. Đọc log như JS: người rời giữa ván thua; nước sau lúc ván đã xong bị bỏ qua ---------- */
  INSERT INTO game_rooms (club_id, game, code, host_id, status, started_at)
  VALUES (v_club, 'bacay', 'Z92001', v_m1, 'playing', now()) RETURNING id INTO v_room;
  INSERT INTO game_hands (room_id, seat, member_id, club_id, cards) VALUES
    (v_room, 0, v_m1, v_club, ARRAY[0, 4, 8]),      -- A♠ 2♠ 3♠ = 6 nút
    (v_room, 1, v_m1, v_club, ARRAY[6, 10, 14]),    -- 2♦ 3♦ 4♦ = 9 nút (mạnh nhất), nhưng rời ván
    (v_room, 2, v_m1, v_club, ARRAY[13, 17, 21]);   -- 4♣ 5♣ 6♣ = 5 nút
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES
    (v_room, 1, v_club, 0, '{"deal": {"n": 3}}'),
    (v_room, 2, v_club, 1, '{"flip": true, "cards": [6, 10, 14]}'),
    (v_room, 3, v_club, 0, '{"flip": true, "cards": [0, 4, 8]}'),
    (v_room, 4, v_club, 1, '{"out": true}');
  IF game_bacay_result(v_room) IS NOT NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 6: ghế 2 chưa lật mà đã có kết quả'; END IF;
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES
    (v_room, 5, v_club, 2, '{"flip": true, "cards": [13, 17, 21]}'),
    (v_room, 6, v_club, 0, '{"out": true}');           -- sau khi ván đã xong → bỏ qua
  v_exp := '{"winners": [0], "draw": false, "ranks": [0, 2, 1], "scores": {"0": 2, "1": -1, "2": -1}}'::jsonb;
  IF game_bacay_result(v_room) IS DISTINCT FROM v_exp THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: người rời có 9 nút vẫn thua, nước sau khi xong bị bỏ qua — phải % , nhận %', v_exp, game_bacay_result(v_room);
  END IF;

  RAISE EXCEPTION '0092 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;
