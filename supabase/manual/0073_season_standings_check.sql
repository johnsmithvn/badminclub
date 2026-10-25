-- 0073_season_standings_check.sql — kiểm tra migration 0073 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0073_season_standings.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0073 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một chủ CLB đã ghép tài khoản. Bước 6 cần thêm một thành viên thường đã ghép tài khoản
-- (không có thì bỏ qua, có thông báo).

DO $check$
DECLARE
  v_club        uuid;
  v_owner_user  uuid;
  v_owner_id    uuid;
  v_member_user uuid;
  v_seasons     jsonb;
  v_frozen      jsonb;
  v_rows        jsonb;
  v_from        bigint;
  v_n           int;
  v_err         text;
BEGIN
  /* ---------- 1. Bảng có, client chỉ đọc được ---------- */
  IF to_regclass('public.season_standings') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có bảng season_standings — đã chạy 0073 chưa?';
  END IF;
  IF has_table_privilege('authenticated', 'public.season_standings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.season_standings', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.season_standings', 'DELETE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client ghi / sửa / xoá thẳng được bảng chốt — chỉ RPC season_freeze được ghi';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.season_standings', 'SELECT') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client không đọc được bảng chốt';
  END IF;
  SELECT count(*) INTO v_n FROM season_standings;
  RAISE NOTICE '1 · đang có % dòng bảng chốt', v_n;

  /* ---------- 2. Đóng vai chủ CLB ---------- */
  SELECT cm.club_id, cm.user_id, cm.id INTO v_club, v_owner_user, v_owner_id
    FROM club_members cm
   WHERE cm.role = 'owner' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một chủ CLB đã ghép tài khoản';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);

  SELECT COALESCE(seasons, '[]'::jsonb) INTO v_seasons FROM clubs WHERE id = v_club;
  v_frozen := v_seasons || jsonb_build_array(jsonb_build_object(
    'id', '__check__', 'code', '__check__', 'active', false, 'frozenAt', now()::text,
    'startDate', '2000-01-01', 'endDate', '2000-03-31'));
  v_rows := jsonb_build_array(jsonb_build_object('id', v_owner_id, 'rank', 1, 'totalSeasonPoints', 123, 'name', '__check__'));

  /* ---------- 3. Chốt được: bảng + clubs.seasons cùng lúc, lịch sử chép lại ---------- */
  SELECT coalesce(max(id), 0) INTO v_from FROM audit_log;
  v_n := season_freeze(v_club, '__check__', v_rows, v_frozen);
  IF v_n IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: season_freeze trả % dòng, phải là 1', v_n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM season_standings WHERE club_id = v_club AND season_id = '__check__' AND member_id = v_owner_id AND points = 123 AND rank = 1) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: không thấy dòng bảng chốt vừa ghi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM clubs c, jsonb_array_elements(c.seasons) s WHERE c.id = v_club AND s ->> 'id' = '__check__') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: clubs.seasons không được ghi cùng giao dịch';
  END IF;
  IF to_regclass('public.audit_log') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM audit_log WHERE id > v_from AND table_name = 'season_standings' AND action = 'I'
  ) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: lịch sử (0070) không chép dòng bảng chốt';
  END IF;

  /* ---------- 4. Chốt một lần ---------- */
  v_err := NULL;
  BEGIN
    PERFORM season_freeze(v_club, '__check__', v_rows, v_frozen);
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_err IS DISTINCT FROM 'season.err.alreadyFrozen' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: chốt lần hai phải bị chặn (lỗi nhận được: %)', v_err;
  END IF;

  /* ---------- 5. Chặn mùa chưa đóng / người ngoài CLB ---------- */
  v_err := NULL;
  BEGIN
    PERFORM season_freeze(v_club, '__check2__', v_rows, v_seasons || jsonb_build_array(jsonb_build_object('id', '__check2__', 'active', true, 'frozenAt', now()::text)));
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_err IS DISTINCT FROM 'season.err.notClosed' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: mùa đang chạy mà chốt được (lỗi nhận được: %)', v_err;
  END IF;
  v_err := NULL;
  BEGIN
    PERFORM season_freeze(v_club, '__check3__',
      jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'rank', 1, 'totalSeasonPoints', 1)),
      v_seasons || jsonb_build_array(jsonb_build_object('id', '__check3__', 'active', false, 'frozenAt', now()::text)));
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  IF v_err IS DISTINCT FROM 'season.err.foreignMember' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: chốt được người không thuộc CLB (lỗi nhận được: %)', v_err;
  END IF;

  /* ---------- 6. Thành viên thường không chốt được ---------- */
  SELECT cm.user_id INTO v_member_user
    FROM club_members cm
   WHERE cm.club_id = v_club AND cm.role = 'member' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  IF v_member_user IS NULL THEN
    RAISE NOTICE '6 · bỏ qua: CLB không có thành viên thường nào đã ghép tài khoản';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', v_member_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member_user, 'role', 'authenticated')::text, true);
    v_err := NULL;
    BEGIN
      PERFORM season_freeze(v_club, '__check4__', v_rows,
        v_seasons || jsonb_build_array(jsonb_build_object('id', '__check4__', 'active', false, 'frozenAt', now()::text)));
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    IF v_err IS DISTINCT FROM 'season.err.noPerm' THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 6: thành viên thường chốt được bảng mùa (lỗi nhận được: %)', v_err;
    END IF;
  END IF;

  -- Cố ý lỗi để Postgres huỷ MỌI thay đổi thử ở trên.
  RAISE EXCEPTION '0073 CHECK OK — tất cả 6 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;
