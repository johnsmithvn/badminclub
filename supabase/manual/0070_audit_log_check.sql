-- 0070_audit_log_check.sql — kiểm tra migration 0070 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0070_audit_log.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0070 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi dòng thử (cả dòng lịch sử thử).
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
-- Mọi thứ nằm trong một khối DO: lỗi ở đâu là huỷ hết ở đó.
--
-- Cần: một chủ CLB đã ghép tài khoản, CLB đó có ít nhất một buổi. Bước 7 cần thêm một thành viên
-- thường đã ghép tài khoản (không có thì bỏ qua, có thông báo).

DO $check$
DECLARE
  v_club        uuid;
  v_owner_user  uuid;
  v_member_user uuid;
  v_session     uuid;
  v_match       uuid := gen_random_uuid();
  v_p1          uuid := gen_random_uuid();
  v_p2          uuid := gen_random_uuid();
  v_edit        uuid := gen_random_uuid();
  v_from        bigint;
  v_n           int;
  v_row         record;
  v_err         text;
BEGIN
  /* ---------- 1. Bảng, hàm, bộ ghi ---------- */
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có bảng audit_log — đã chạy 0070_audit_log.sql chưa?';
  END IF;
  SELECT count(*) INTO v_n FROM pg_trigger WHERE tgname LIKE 'audit\_%' AND NOT tgisinternal;
  IF v_n < 28 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: mong 28 bộ ghi (14 bảng × thêm-sửa / xoá), có %', v_n;
  END IF;

  /* ---------- 2. Chọn chủ CLB + một buổi ---------- */
  SELECT cm.club_id, cm.user_id INTO v_club, v_owner_user
    FROM club_members cm
   WHERE cm.role = 'owner' AND cm.active AND cm.user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM sessions s WHERE s.club_id = cm.club_id)
   LIMIT 1;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một chủ CLB đã ghép tài khoản, CLB có ít nhất một buổi';
  END IF;
  SELECT id INTO v_session FROM sessions WHERE club_id = v_club ORDER BY date DESC LIMIT 1;
  SELECT coalesce(max(id), 0) INTO v_from FROM audit_log;

  /* ---------- 3. Ghi trận + 2 người chơi: dòng I, đúng CLB (bảng con tra qua cha) ---------- */
  INSERT INTO matches (id, session_id, court_index, minutes, sets, winner_team)
  VALUES (v_match, v_session, 0, 20, '[[21,15]]', 'A');
  INSERT INTO match_players (id, match_id, player_type, player_id, team)
  SELECT v_p1, v_match, 'member', cm.id, 0 FROM club_members cm WHERE cm.club_id = v_club LIMIT 1;
  INSERT INTO match_players (id, match_id, player_type, player_id, team)
  SELECT v_p2, v_match, 'member', cm.id, 1 FROM club_members cm WHERE cm.club_id = v_club OFFSET 1 LIMIT 1;

  SELECT count(*) INTO v_n FROM audit_log
   WHERE id > v_from AND action = 'I' AND club_id = v_club
     AND ((table_name = 'matches' AND row_id = v_match::text)
       OR (table_name = 'match_players' AND row_id IN (v_p1::text, v_p2::text)));
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: mong 3 dòng I (1 trận + 2 người, đúng CLB), có %', v_n;
  END IF;

  /* ---------- 4. Sửa tỉ số: dòng U chỉ có cột đổi; đổi riêng lượt xem video thì không ghi ---------- */
  UPDATE matches SET sets = '[[21,19]]', score_text = '21 – 19' WHERE id = v_match;
  SELECT * INTO v_row FROM audit_log
   WHERE id > v_from AND table_name = 'matches' AND row_id = v_match::text AND action = 'U'
   ORDER BY id DESC LIMIT 1;
  IF v_row IS NULL OR v_row.old_data -> 'sets' <> '[[21,15]]'::jsonb OR v_row.new_data -> 'sets' <> '[[21,19]]'::jsonb
     OR v_row.new_data ? 'court_index' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: dòng U sai — cũ %, mới %', v_row.old_data, v_row.new_data;
  END IF;

  SELECT count(*) INTO v_n FROM audit_log WHERE id > v_from;
  UPDATE matches SET video_views = coalesce(video_views, 0) + 1 WHERE id = v_match;
  UPDATE matches SET minutes = minutes WHERE id = v_match;  -- upsert lại y nguyên
  IF (SELECT count(*) FROM audit_log WHERE id > v_from) <> v_n THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: đổi lượt xem / ghi lại y nguyên mà vẫn sinh dòng lịch sử';
  END IF;

  /* ---------- 5. Huỷ trận: nhật ký huỷ còn, dòng D giữ nguyên bản, người chơi xoá dây chuyền vẫn đúng CLB ---------- */
  INSERT INTO match_edits (id, match_id, club_id, field_changed, old_value, new_value, reason)
  VALUES (v_edit, v_match, v_club, 'status', 'completed', 'cancelled', 'check 0070');
  DELETE FROM matches WHERE id = v_match;

  IF NOT EXISTS (SELECT 1 FROM match_edits WHERE id = v_edit) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: nhật ký huỷ trận bị xoá dây chuyền theo trận';
  END IF;
  SELECT * INTO v_row FROM audit_log
   WHERE id > v_from AND table_name = 'matches' AND row_id = v_match::text AND action = 'D';
  IF v_row IS NULL OR v_row.old_data ->> 'session_id' <> v_session::text OR v_row.old_data -> 'sets' <> '[[21,19]]'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: dòng D của trận không giữ nguyên bản (%)', v_row.old_data;
  END IF;
  SELECT count(*) INTO v_n FROM audit_log
   WHERE id > v_from AND table_name = 'match_players' AND action = 'D' AND club_id = v_club
     AND row_id IN (v_p1::text, v_p2::text);
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: mong 2 dòng D người chơi đúng CLB (xoá dây chuyền), có %', v_n;
  END IF;

  /* ---------- 6. Bảng thành viên: chỉ chép cột ảnh hưởng điểm ---------- */
  -- Đóng vai chủ CLB: trigger cm_guard_self_update (0010) chặn mọi lần sửa club_members của người
  -- không có cờ `members` — kể cả SQL Editor, vì auth.uid() lúc đó là NULL.
  PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_n FROM audit_log WHERE id > v_from;
  UPDATE club_members SET note = coalesce(note, '') || ' ' WHERE club_id = v_club AND role = 'owner' AND user_id = v_owner_user;
  IF (SELECT count(*) FROM audit_log WHERE id > v_from) <> v_n THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: đổi ghi chú thành viên (không ảnh hưởng điểm) mà vẫn ghi lịch sử';
  END IF;
  UPDATE club_members SET level = level || '' WHERE club_id = v_club AND role = 'owner' AND user_id = v_owner_user;
  IF (SELECT count(*) FROM audit_log WHERE id > v_from) <> v_n THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: trình độ không đổi mà vẫn ghi lịch sử';
  END IF;
  SELECT count(*) INTO v_n FROM audit_log
   WHERE id > v_from AND (old_data ? 'phone' OR new_data ? 'phone' OR old_data ? 'bank_no' OR new_data ? 'bank_no');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: lịch sử chép cả SĐT / tài khoản ngân hàng';
  END IF;

  /* ---------- 7. Quyền đọc: chủ CLB đọc được, thành viên thường không; không ai ghi tay ---------- */
  v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    SELECT count(*) INTO v_n FROM audit_log WHERE id > v_from AND club_id = v_club;
    RAISE EXCEPTION USING MESSAGE = '__seen_' || v_n || '__';
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_err = '__seen_0__' OR v_err NOT LIKE '\_\_seen\_%' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: chủ CLB không đọc được lịch sử của CLB mình (%)', v_err;
  END IF;

  v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    INSERT INTO audit_log (club_id, table_name, row_id, action) VALUES (v_club, 'matches', 'x', 'I');
    RAISE EXCEPTION USING MESSAGE = '__no_error__';
  EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  IF v_err NOT LIKE '42501%' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: ghi tay vào audit_log mà không bị chặn (nhận: %)', v_err;
  END IF;

  SELECT cm.user_id INTO v_member_user
    FROM club_members cm
   WHERE cm.club_id = v_club AND cm.role = 'member' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  IF v_member_user IS NULL THEN
    RAISE NOTICE '7 · bỏ qua phần thành viên thường: CLB không có ai đã ghép tài khoản';
  ELSE
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_member_user::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member_user, 'role', 'authenticated')::text, true);
      PERFORM set_config('role', 'authenticated', true);
      SELECT count(*) INTO v_n FROM audit_log WHERE club_id = v_club;
      RAISE EXCEPTION USING MESSAGE = '__seen_' || v_n || '__';
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    IF v_err <> '__seen_0__' THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 7: thành viên thường đọc được lịch sử (%)', v_err;
    END IF;
  END IF;

  -- Cố ý lỗi để Postgres huỷ MỌI dòng thử ở trên.
  RAISE EXCEPTION '0070 CHECK OK — tất cả 7 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;
