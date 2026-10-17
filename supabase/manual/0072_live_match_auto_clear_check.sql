-- 0072_live_match_auto_clear_check.sql — kiểm tra migration 0072 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0072_live_match_auto_clear.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0072 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi dòng thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một chủ CLB đã ghép tài khoản, CLB đó có ít nhất một buổi. Bước 4 cần CLB có từ 2 buổi
-- (không có thì bỏ qua, có thông báo).

DO $check$
DECLARE
  v_club        uuid;
  v_owner_user  uuid;
  v_session     uuid;
  v_session2    uuid;
  v_l1          uuid := gen_random_uuid();
  v_l2          uuid := gen_random_uuid();
  v_l3          uuid := gen_random_uuid();
  v_l4          uuid := gen_random_uuid();
  v_l5          uuid := gen_random_uuid();
  v_m3          uuid := gen_random_uuid();
  v_m5          uuid := gen_random_uuid();
  v_err         text;
BEGIN
  /* ---------- 1. Hàm + trigger ---------- */
  IF to_regprocedure('public.matches_clear_live()') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có hàm matches_clear_live — đã chạy 0072 chưa?';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'matches_clear_live' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có trigger matches_clear_live trên matches';
  END IF;

  /* ---------- 2. Chọn chủ CLB + buổi ---------- */
  SELECT cm.club_id, cm.user_id INTO v_club, v_owner_user
    FROM club_members cm
   WHERE cm.role = 'owner' AND cm.active AND cm.user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM sessions s WHERE s.club_id = cm.club_id)
   LIMIT 1;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một chủ CLB đã ghép tài khoản, CLB có ít nhất một buổi';
  END IF;
  SELECT id INTO v_session FROM sessions WHERE club_id = v_club ORDER BY date DESC LIMIT 1;
  SELECT id INTO v_session2 FROM sessions WHERE club_id = v_club AND id <> v_session ORDER BY date DESC LIMIT 1;

  /* ---------- 3. Ghi trận từ nháp: nháp rời sân NGAY lúc chèn trận ---------- */
  INSERT INTO session_live_matches (id, club_id, session_id, team_a, team_b)
  VALUES (v_l1, v_club, v_session, ARRAY['a1', 'a2'], ARRAY['b1', 'b2']);
  INSERT INTO matches (id, session_id, court_index, minutes, live_id)
  VALUES (gen_random_uuid(), v_session, 0, 20, v_l1);
  IF EXISTS (SELECT 1 FROM session_live_matches WHERE id = v_l1) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: chèn trận mang live_id mà trận nháp vẫn còn';
  END IF;

  /* ---------- 4. live_id trỏ sang nháp của buổi KHÁC thì không đụng ---------- */
  IF v_session2 IS NULL THEN
    RAISE NOTICE '4 · bỏ qua: CLB chỉ có một buổi';
  ELSE
    INSERT INTO session_live_matches (id, club_id, session_id) VALUES (v_l2, v_club, v_session);
    INSERT INTO matches (id, session_id, court_index, minutes, live_id)
    VALUES (gen_random_uuid(), v_session2, 0, 20, v_l2);
    IF NOT EXISTS (SELECT 1 FROM session_live_matches WHERE id = v_l2) THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 4: trận buổi khác xoá mất trận nháp của buổi này';
    END IF;
  END IF;

  /* ---------- 5. Trận thường không đụng nháp; gắn live_id sau (UPDATE) thì nháp đi ---------- */
  INSERT INTO session_live_matches (id, club_id, session_id) VALUES (v_l3, v_club, v_session);
  INSERT INTO matches (id, session_id, court_index, minutes) VALUES (v_m3, v_session, 0, 20);
  IF NOT EXISTS (SELECT 1 FROM session_live_matches WHERE id = v_l3) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: trận không mang live_id mà xoá mất trận nháp';
  END IF;
  UPDATE matches SET live_id = v_l3 WHERE id = v_m3;
  IF EXISTS (SELECT 1 FROM session_live_matches WHERE id = v_l3) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: gắn live_id cho trận mà trận nháp vẫn còn';
  END IF;

  /* ---------- 6. Đúng đường app: chủ CLB upsert trận dưới vai authenticated ---------- */
  INSERT INTO session_live_matches (id, club_id, session_id) VALUES (v_l4, v_club, v_session);
  v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    INSERT INTO matches (id, session_id, court_index, minutes, live_id)
    VALUES (gen_random_uuid(), v_session, 0, 20, v_l4)
    ON CONFLICT (id) DO UPDATE SET live_id = EXCLUDED.live_id;
    IF EXISTS (SELECT 1 FROM session_live_matches WHERE id = v_l4) THEN
      RAISE EXCEPTION USING MESSAGE = '__still_there__';
    END IF;
    -- Lệnh xoá nháp của app tới SAU: xoá 0 dòng, không được lỗi.
    DELETE FROM session_live_matches WHERE id = v_l4;
    RAISE EXCEPTION USING MESSAGE = '__ok__';  -- huỷ dòng thử + trả vai về postgres
  EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  IF v_err IS NULL OR position('__ok__' in v_err) = 0 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: ghi trận như app mà trận nháp không đi / lỗi (%)', v_err;
  END IF;
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: vai chưa trả về postgres';
  END IF;

  /* ---------- 7. Ghi đè trận đã có (Tính lại Elo upsert cả trận) khi nháp đã đi: không lỗi ---------- */
  INSERT INTO matches (id, session_id, court_index, minutes, live_id)
  VALUES (v_m5, v_session, 0, 20, v_l5);
  INSERT INTO matches (id, session_id, court_index, minutes, live_id)
  VALUES (v_m5, v_session, 0, 25, v_l5)
  ON CONFLICT (id) DO UPDATE SET minutes = EXCLUDED.minutes, live_id = EXCLUDED.live_id;
  IF (SELECT minutes FROM matches WHERE id = v_m5) <> 25 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 7: ghi đè trận có live_id không lưu được';
  END IF;

  -- Cố ý lỗi để Postgres huỷ MỌI dòng thử ở trên.
  RAISE EXCEPTION '0072 CHECK OK — tất cả 7 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;
