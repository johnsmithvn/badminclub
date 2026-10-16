-- 0069_session_live_matches_check.sql — kiểm tra migration 0069 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0069_session_live_matches.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0069 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi dòng thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
-- Mọi thứ nằm trong một khối DO: lỗi ở đâu là huỷ hết ở đó.
--
-- Cần: một chủ CLB đã ghép tài khoản, CLB đó có ít nhất một buổi. Bước 4 cần thêm một thành viên
-- thường đã ghép tài khoản (không có thì bỏ qua, có thông báo).
-- Ghi bằng đúng câu app gửi (`INSERT … ON CONFLICT (id) DO UPDATE` — upsert của storage.js) dưới
-- vai `authenticated`, để chắc RLS cho đúng đường app thật đi.

DO $check$
DECLARE
  v_club        uuid;
  v_owner_user  uuid;
  v_member_user uuid;
  v_session     uuid;
  v_live        uuid := gen_random_uuid();
  v_n           int;
  v_err         text;
BEGIN
  /* ---------- 1. Bảng, cột, index ---------- */
  IF to_regclass('public.session_live_matches') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có bảng session_live_matches — đã chạy 0069_session_live_matches.sql chưa?';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'live_id'
  ) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có cột matches.live_id';
  END IF;
  IF to_regclass('public.uq_matches_live_id') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có index uq_matches_live_id';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies WHERE tablename = 'session_live_matches';
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: mong 4 policy trên session_live_matches, có %', v_n;
  END IF;

  /* ---------- 2. Chọn chủ CLB + một buổi của CLB đó ---------- */
  SELECT cm.club_id, cm.user_id INTO v_club, v_owner_user
    FROM club_members cm
   WHERE cm.role = 'owner' AND cm.active AND cm.user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM sessions s WHERE s.club_id = cm.club_id)
   LIMIT 1;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một chủ CLB đã ghép tài khoản, CLB có ít nhất một buổi';
  END IF;
  SELECT id INTO v_session FROM sessions WHERE club_id = v_club ORDER BY date DESC LIMIT 1;

  /* ---------- 3. Chủ CLB (cờ assign) xếp lên sân được — đúng câu upsert của app ---------- */
  v_err := NULL;
  BEGIN
    PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    INSERT INTO session_live_matches (id, club_id, session_id, court_index, team_a, team_b, mode, created_by)
    VALUES (v_live, v_club, v_session, 0, ARRAY['a1', 'a2'], ARRAY['b1', 'b2'], 'doubles', v_owner_user)
    ON CONFLICT (id) DO UPDATE SET court_index = EXCLUDED.court_index;
    SELECT count(*) INTO v_n FROM session_live_matches WHERE id = v_live;
    IF v_n <> 1 THEN
      RAISE EXCEPTION USING MESSAGE = '__unseen__';
    END IF;
    RAISE EXCEPTION USING MESSAGE = '__ok__';  -- huỷ dòng thử + trả vai về postgres
  EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM;
  END;
  IF v_err NOT LIKE '%__ok__%' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: chủ CLB không xếp lên sân / không đọc lại được (lỗi: %)', v_err;
  END IF;
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: vai chưa trả về postgres';
  END IF;

  /* ---------- 4. Thành viên thường: đọc được, ghi thì không ---------- */
  SELECT cm.user_id INTO v_member_user
    FROM club_members cm
   WHERE cm.club_id = v_club AND cm.role = 'member' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  IF v_member_user IS NULL THEN
    RAISE NOTICE '4 · bỏ qua: CLB không có thành viên thường nào đã ghép tài khoản';
  ELSE
    -- Dòng có sẵn (ghi bằng postgres) để thử quyền đọc.
    INSERT INTO session_live_matches (id, club_id, session_id) VALUES (v_live, v_club, v_session);

    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_member_user::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member_user, 'role', 'authenticated')::text, true);
      PERFORM set_config('role', 'authenticated', true);
      SELECT count(*) INTO v_n FROM session_live_matches WHERE id = v_live;
      RAISE EXCEPTION USING MESSAGE = '__seen_' || v_n || '__';
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    IF v_err <> '__seen_1__' THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 4: thành viên thường không thấy trận trên sân của CLB mình (%)', v_err;
    END IF;

    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_member_user::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member_user, 'role', 'authenticated')::text, true);
      PERFORM set_config('role', 'authenticated', true);
      INSERT INTO session_live_matches (id, club_id, session_id) VALUES (gen_random_uuid(), v_club, v_session);
      RAISE EXCEPTION USING MESSAGE = '__no_error__';
    EXCEPTION WHEN OTHERS THEN v_err := SQLSTATE || ' ' || SQLERRM;
    END;
    IF v_err NOT LIKE '42501%' THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 4: thành viên thường xếp lên sân mà không bị RLS chặn (nhận: %)', v_err;
    END IF;
    DELETE FROM session_live_matches WHERE id = v_live;
  END IF;

  /* ---------- 5. Một trận nháp chỉ ra MỘT trận thật ---------- */
  INSERT INTO matches (id, session_id, court_index, minutes, live_id)
  VALUES (gen_random_uuid(), v_session, 0, 20, v_live)
  ON CONFLICT (id) DO UPDATE SET live_id = EXCLUDED.live_id;

  v_err := NULL;
  BEGIN
    INSERT INTO matches (id, session_id, court_index, minutes, live_id)
    VALUES (gen_random_uuid(), v_session, 0, 20, v_live)
    ON CONFLICT (id) DO UPDATE SET live_id = EXCLUDED.live_id;
  EXCEPTION WHEN unique_violation THEN v_err := SQLERRM;
  END;
  IF v_err IS NULL OR v_err NOT LIKE '%uq_matches_live_id%' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: máy thứ hai ghi cùng trận nháp mà không bị chặn (lỗi: %)', v_err;
  END IF;

  /* ---------- 6. Trận thường (live_id NULL) không bị ràng buộc ---------- */
  INSERT INTO matches (id, session_id, court_index, minutes) VALUES (gen_random_uuid(), v_session, 0, 20);
  INSERT INTO matches (id, session_id, court_index, minutes) VALUES (gen_random_uuid(), v_session, 0, 20);

  -- Cố ý lỗi để Postgres huỷ MỌI dòng thử ở trên.
  RAISE EXCEPTION '0069 CHECK OK — tất cả 6 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;
