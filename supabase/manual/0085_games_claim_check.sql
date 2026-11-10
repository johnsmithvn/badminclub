-- 0085_games_claim_check.sql — kiểm tra migration 0085 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0085_games_claim.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0085 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản (như 0074_games_check.sql).
-- Trong một giao dịch now() đứng yên, nên "đã qua 5 phút" được giả lập bằng cách lùi giờ trong bảng (quyền SQL Editor).

DO $check$
DECLARE
  v_club uuid;
  v_u1   uuid;
  v_u2   uuid;
  v_m2   uuid;
  v_room uuid;
  v_err  text;
  r      game_rooms;
BEGIN
  /* ---------- 1. Chỉ còn bản hai tham số; người đăng nhập gọi được, anon thì không ---------- */
  IF to_regprocedure('public.game_claim(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: bản game_claim(uuid) cũ vẫn còn — máy khách cũ vẫn xử được mọi người đang khoá máy';
  END IF;
  IF to_regprocedure('public.game_claim(uuid, integer[])') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có game_claim(uuid, int[]) — đã chạy 0085 chưa?';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.game_claim(uuid, integer[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.game_claim(uuid, integer[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: quyền gọi game_claim sai (phải: authenticated có, anon không)';
  END IF;

  /* ---------- 2. Hai thành viên cùng CLB mở một ván Caro; người 2 (ghế 1) khoá máy từ 5 phút trước ---------- */
  SELECT a.club_id, a.user_id, b.user_id, b.id INTO v_club, v_u1, v_u2, v_m2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_room := game_create(v_club, 'caro', '{}'::jsonb, true);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);
  UPDATE game_room_players SET seen_at = now() - interval '5 minutes' WHERE room_id = v_room AND member_id = v_m2;

  /* ---------- 3. Ván vừa bắt đầu: chưa đứng yên đủ hạn → không xử, dù người 2 đã mất nhịp ---------- */
  BEGIN
    PERFORM game_claim(v_room, ARRAY[1]);
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: xử được người 2 ngay khi ván vừa bắt đầu chờ họ';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notIdle' THEN RAISE; END IF;
  END;

  /* ---------- 4. Ván đứng yên 5 phút nhưng không nêu ghế 1 → không xử ai ---------- */
  UPDATE game_rooms SET started_at = now() - interval '5 minutes' WHERE id = v_room;
  BEGIN
    PERFORM game_claim(v_room, ARRAY[]::int[]);
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: xử cả người không được nêu — người chỉ đang chờ đối thủ cũng bị xử';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notIdle' THEN RAISE; END IF;
  END;

  /* ---------- 5. Được nêu, ván đứng yên, nhưng người 2 vừa có nhịp → không xử ---------- */
  UPDATE game_room_players SET seen_at = now() WHERE room_id = v_room AND member_id = v_m2;
  BEGIN
    PERFORM game_claim(v_room, ARRAY[1]);
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: xử được người vẫn còn nhịp';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notIdle' THEN RAISE; END IF;
  END;
  UPDATE game_room_players SET seen_at = now() - interval '5 minutes' WHERE room_id = v_room AND member_id = v_m2;

  /* ---------- 6. Người 1 vừa đi → ván vừa chuyển sang chờ người 2 → họ còn đủ 120 giây ---------- */
  PERFORM game_move(v_room, 1, '{"i":112}'::jsonb);
  BEGIN
    PERFORM game_claim(v_room, ARRAY[1]);
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: nước vừa đi xong đã xử được người 2 — họ phải có đủ 120 giây';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notIdle' THEN RAISE; END IF;
  END;

  /* ---------- 7. Người 2 treo ván 5 phút sau nước đó → bị xử, người 1 thắng; người gọi không tự xử mình ---------- */
  UPDATE game_moves SET created_at = now() - interval '5 minutes' WHERE room_id = v_room;
  PERFORM game_claim(v_room, ARRAY[0, 1]);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'finished' OR r.result -> 'winners' <> '[0]'::jsonb OR (r.result ->> 'idle')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: người 2 treo ván quá hạn phải bị xử, người 1 thắng — nhận % %', r.status, r.result;
  END IF;

  RAISE EXCEPTION '0085 CHECK OK — mọi bước đạt (lỗi này để huỷ dữ liệu thử)';
END;
$check$;
