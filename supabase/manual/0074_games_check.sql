-- 0074_games_check.sql — kiểm tra migration 0074 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0074_games.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0074 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản.

DO $check$
DECLARE
  v_club  uuid;
  v_u1    uuid;
  v_u2    uuid;
  v_room  uuid;
  v_room2 uuid;
  v_room3 uuid;
  v_user  uuid;
  v_seat  int;
  v_err   text;
  r       game_rooms;
BEGIN
  /* ---------- 1. Bảng có, client chỉ đọc ---------- */
  IF to_regclass('public.game_rooms') IS NULL OR to_regclass('public.game_moves') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có bảng game_* — đã chạy 0074 chưa?';
  END IF;
  IF has_table_privilege('authenticated', 'public.game_moves', 'INSERT')
     OR has_table_privilege('authenticated', 'public.game_rooms', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.game_room_players', 'INSERT') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client ghi thẳng được bảng game_* — chỉ RPC game_* được ghi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'game_moves') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: game_moves chưa bật realtime — phòng sẽ không thấy nước của đối thủ';
  END IF;

  /* ---------- 2. Tìm hai thành viên cùng CLB ---------- */
  SELECT a.club_id, a.user_id, b.user_id INTO v_club, v_u1, v_u2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;

  /* ---------- 3. Người 1 tạo phòng, ngồi ghế 0 ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'caro', '{"size":15}'::jsonb, false);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'waiting' OR r.code !~ '^[A-Z2-9]{6}$' THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: phòng mới sai trạng thái / mã: % %', r.status, r.code; END IF;

  BEGIN
    PERFORM game_start(v_room, 2, 2);
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: bắt đầu được khi mới có một người';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badCount' THEN RAISE; END IF;
  END;

  /* ---------- 4. Người 2 vào ghế 1; vào lần nữa vẫn ghế 1; không bắt đầu được ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_seat := game_join(v_room, 2);
  IF v_seat <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 4: người thứ hai phải ngồi ghế 1, nhận %', v_seat; END IF;
  IF game_join(v_room, 2) <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 4: vào lại phải giữ ghế cũ'; END IF;
  BEGIN
    PERFORM game_start(v_room, 2, 2);
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: người không phải chủ phòng bắt đầu được ván';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notHost' THEN RAISE; END IF;
  END;

  /* ---------- 5. Chủ phòng bắt đầu; ghi nước theo seq ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'playing' OR r.seed IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 5: bắt đầu xong phải playing + có seed'; END IF;

  PERFORM game_move(v_room, 1, '{"i":112}'::jsonb);
  BEGIN
    PERFORM game_move(v_room, 1, '{"i":113}'::jsonb);
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: ghi trùng seq mà không bị chặn';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.stale' THEN RAISE; END IF;
  END;
  IF (SELECT seat FROM game_moves WHERE room_id = v_room AND seq = 1) <> 0 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: ghế của nước đi phải lấy từ server, không từ client';
  END IF;

  /* ---------- 6. Server tự chấm Caro: chưa đủ 5 quân thì từ chối, kết quả bịa bị bỏ qua ---------- */
  -- X (người 1) đi hàng 7 cột 7..11 = ô 112..116; O (người 2) đi hàng 0. Nước 1 (ô 112) đã đi ở bước 5.
  FOR v_seat IN 2..8 LOOP
    v_user := CASE WHEN v_seat % 2 = 0 THEN v_u2 ELSE v_u1 END;
    PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    PERFORM game_move(v_room, v_seat,
      jsonb_build_object('i', CASE WHEN v_seat % 2 = 0 THEN v_seat / 2 - 1 ELSE 112 + (v_seat - 1) / 2 END));
  END LOOP;
  -- Đang là người 2, X mới có 4 quân.
  BEGIN
    PERFORM game_finish(v_room, '{"winners":[1],"draw":false}'::jsonb);
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: chốt được ván khi chưa ai đủ 5 quân';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notOver' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_move(v_room, 9, '{"i":116}'::jsonb);
  -- Người 2 thua nhưng báo mình thắng.
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_finish(v_room, '{"winners":[1],"draw":false}'::jsonb);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'finished' OR r.result -> 'winners' <> '[0]'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: server phải tự chấm X thắng, bỏ qua kết quả client bịa — nhận % %', r.status, r.result;
  END IF;

  /* ---------- 7. Mất kết nối: chưa quá hạn thì không đòi được, quá hạn thì người còn lại thắng ---------- */
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room2 := game_create(v_club, 'caro', '{}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room2, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room2, 2, 2);
  BEGIN
    PERFORM game_claim(v_room2);
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: đòi xử thắng được khi đối thủ vừa còn nhịp';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notIdle' THEN RAISE; END IF;
  END;
  -- Giả lập người 2 mất nhịp 5 phút (chạy bằng quyền SQL Editor, không qua RPC).
  UPDATE game_room_players gp SET seen_at = now() - interval '5 minutes'
   WHERE gp.room_id = v_room2 AND gp.member_id = (SELECT id FROM club_members WHERE club_id = v_club AND user_id = v_u2 LIMIT 1);
  PERFORM game_claim(v_room2);
  SELECT * INTO r FROM game_rooms WHERE id = v_room2;
  IF r.status <> 'finished' OR r.result -> 'winners' <> '[0]'::jsonb OR (r.result ->> 'idle')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: đối thủ mất nhịp quá hạn phải xử người 1 thắng, nhận % %', r.status, r.result;
  END IF;

  /* ---------- 8. Chơi lại + rời giữa ván ---------- */
  v_room3 := game_create(v_club, 'caro', '{}'::jsonb, true, v_room);
  IF (SELECT next_room FROM game_rooms WHERE id = v_room) IS DISTINCT FROM v_room3 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 8: phòng cũ không trỏ sang phòng chơi lại';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room3, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room3, 2, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_leave(v_room3);
  SELECT * INTO r FROM game_rooms WHERE id = v_room3;
  IF r.status <> 'finished' OR r.result -> 'winners' <> '[0]'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 8: rời giữa ván phải xử người còn lại thắng, nhận % %', r.status, r.result;
  END IF;

  /* ---------- 9. Cỡ bàn ngoài 5..25 bị chặn ---------- */
  BEGIN
    PERFORM game_create(v_club, 'caro', '{"size":500}'::jsonb, true);
    RAISE EXCEPTION 'SAI Ở BƯỚC 9: tạo được bàn 500×500';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badOptions' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION '0074 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;
