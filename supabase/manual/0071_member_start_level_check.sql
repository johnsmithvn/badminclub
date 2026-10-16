-- 0071_member_start_level_check.sql — kiểm tra migration 0071 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0071_member_start_level.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0071 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một chủ CLB đã ghép tài khoản. Bước 4 cần thêm một thành viên thường đã ghép tài khoản
-- (không có thì bỏ qua, có thông báo).

DO $check$
DECLARE
  v_club        uuid;
  v_owner_user  uuid;
  v_owner_id    uuid;
  v_member_user uuid;
  v_member_id   uuid;
  v_from        bigint;
  v_n           int;
  v_row         record;
  v_err         text;
BEGIN
  /* ---------- 1. Có cột, mọi người hiện có đều NULL (= số không đổi) ---------- */
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'club_members' AND column_name = 'start_level') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có cột club_members.start_level — đã chạy 0071 chưa?';
  END IF;
  SELECT count(*) INTO v_n FROM club_members WHERE start_level IS NOT NULL;
  RAISE NOTICE '1 · % thành viên đã có trình xuất phát riêng (ngay sau migration phải là 0)', v_n;

  /* ---------- 2. Chọn chủ CLB, đóng vai chủ CLB (guard 0010 chặn sửa club_members khi không có quyền) ---------- */
  SELECT cm.club_id, cm.user_id, cm.id INTO v_club, v_owner_user, v_owner_id
    FROM club_members cm
   WHERE cm.role = 'owner' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một chủ CLB đã ghép tài khoản';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);

  /* ---------- 3. Chủ CLB ghi được; lịch sử (0070) chép cột mới ---------- */
  SELECT coalesce(max(id), 0) INTO v_from FROM audit_log;
  UPDATE club_members SET start_level = '__check__' WHERE id = v_owner_id;
  IF (SELECT start_level FROM club_members WHERE id = v_owner_id) IS DISTINCT FROM '__check__' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: chủ CLB không ghi được start_level';
  END IF;
  SELECT * INTO v_row FROM audit_log
   WHERE id > v_from AND table_name = 'club_members' AND row_id = v_owner_id::text AND action = 'U'
   ORDER BY id DESC LIMIT 1;
  IF v_row IS NULL OR v_row.new_data ->> 'start_level' IS DISTINCT FROM '__check__' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: lịch sử không chép start_level (dòng: %)', v_row.new_data;
  END IF;
  IF v_row.new_data ? 'phone' OR v_row.old_data ? 'phone' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: lịch sử chép cả SĐT';
  END IF;

  /* ---------- 4. Thành viên thường KHÔNG tự sửa được trình xuất phát của mình ---------- */
  SELECT cm.user_id, cm.id INTO v_member_user, v_member_id
    FROM club_members cm
   WHERE cm.club_id = v_club AND cm.role = 'member' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  IF v_member_user IS NULL THEN
    RAISE NOTICE '4 · bỏ qua: CLB không có thành viên thường nào đã ghép tài khoản';
  ELSE
    v_err := NULL;
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', v_member_user::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member_user, 'role', 'authenticated')::text, true);
      UPDATE club_members SET start_level = '__self__' WHERE id = v_member_id;
      RAISE EXCEPTION USING MESSAGE = '__no_error__';
    EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
    END;
    IF v_err = '__no_error__' THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 4: thành viên thường tự sửa được start_level của mình';
    END IF;
  END IF;

  -- Cố ý lỗi để Postgres huỷ MỌI thay đổi thử ở trên.
  RAISE EXCEPTION '0071 CHECK OK — tất cả 4 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;
