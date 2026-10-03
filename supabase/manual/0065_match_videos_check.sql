-- 0065_match_videos_check.sql — kiểm tra migration 0065 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0065_match_videos.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0065 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
-- Mọi thứ nằm trong một khối DO: lỗi ở đâu là huỷ hết ở đó, kể cả trận thật bị sửa thử bên dưới.
--
-- Cần: một chủ CLB đã ghép tài khoản và CLB đó có ít nhất một trận. Bước 5 cần thêm một thành viên
-- thường đã ghép tài khoản trong cùng CLB (không có thì bỏ qua, có thông báo).

DO $check$
DECLARE
  v_club   uuid;
  v_owner_user  uuid;
  v_member_user uuid;
  v_match  uuid;
  v_n      int;
  v_row    record;
  v_err    text;
BEGIN
  /* ---------- 1. Cột mới ---------- */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'videos'
  ) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có cột matches.videos — đã chạy 0065_match_videos.sql chưa?';
  END IF;

  /* ---------- 2. Link cũ đã thành Part 1 ---------- */
  SELECT count(*) INTO v_n
    FROM matches
   WHERE NULLIF(btrim(COALESCE(video_url, '')), '') IS NOT NULL
     AND (jsonb_array_length(videos) = 0 OR videos->0->>'url' IS DISTINCT FROM btrim(video_url));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: % trận có video_url mà Part 1 trong videos không khớp', v_n;
  END IF;

  /* ---------- 3. Đóng vai chủ CLB, lấy một trận của CLB đó ---------- */
  SELECT cm.club_id, cm.user_id INTO v_club, v_owner_user
    FROM club_members cm
   WHERE cm.role = 'owner' AND cm.active AND cm.user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM matches m JOIN sessions s ON s.id = m.session_id WHERE s.club_id = cm.club_id)
   LIMIT 1;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: cần một chủ CLB đã ghép tài khoản, CLB có ít nhất một trận';
  END IF;
  SELECT m.id INTO v_match
    FROM matches m JOIN sessions s ON s.id = m.session_id
   WHERE s.club_id = v_club LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);
  IF auth.uid() IS DISTINCT FROM v_owner_user THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: auth.uid() không phải chủ CLB';
  END IF;

  /* ---------- 4. Chủ CLB gắn 2 phần: chuẩn hoá + giữ cột cũ = Part 1 ---------- */
  PERFORM attach_match_videos(v_match, jsonb_build_array(
    jsonb_build_object('url', '  https://youtu.be/part1  ', 'start', ' 00:42 '),
    jsonb_build_object('url', '   ', 'start', '01:00'),           -- link rỗng → bị bỏ
    jsonb_build_object('url', 'https://drive.google.com/part2', 'start', '')
  ), '  Set cuối  ');
  SELECT videos, video_url, video_timestamp, video_note INTO v_row FROM matches WHERE id = v_match;
  IF jsonb_array_length(v_row.videos) <> 2 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: mong 2 phần, nhận % — %', jsonb_array_length(v_row.videos), v_row.videos;
  END IF;
  IF v_row.videos->0->>'url' <> 'https://youtu.be/part1' OR v_row.videos->0->>'start' <> '00:42'
     OR v_row.videos->1->>'url' <> 'https://drive.google.com/part2' OR v_row.videos->1->'start' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: chuẩn hoá sai — %', v_row.videos;
  END IF;
  IF v_row.video_url <> 'https://youtu.be/part1' OR v_row.video_timestamp <> '00:42' OR v_row.video_note <> 'Set cuối' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: cột cũ không bằng Part 1 — url=%, ts=%, note=%',
      v_row.video_url, v_row.video_timestamp, v_row.video_note;
  END IF;

  /* ---------- 5. Thành viên thường: thêm được, bớt thì bị chặn ---------- */
  SELECT cm.user_id INTO v_member_user
    FROM club_members cm
   WHERE cm.club_id = v_club AND cm.role = 'member' AND cm.active AND cm.user_id IS NOT NULL
   LIMIT 1;
  IF v_member_user IS NULL THEN
    RAISE NOTICE '5 · bỏ qua: CLB không có thành viên thường nào đã ghép tài khoản';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', v_member_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member_user, 'role', 'authenticated')::text, true);

    PERFORM attach_match_videos(v_match, jsonb_build_array(
      jsonb_build_object('url', 'https://youtu.be/part1', 'start', '00:42'),
      jsonb_build_object('url', 'https://drive.google.com/part2', 'start', null),
      jsonb_build_object('url', 'https://youtu.be/part3', 'start', '00:05')
    ), NULL);
    SELECT jsonb_array_length(videos) INTO v_n FROM matches WHERE id = v_match;
    IF v_n <> 3 THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 5: thành viên thêm phần thứ 3 không được (còn % phần)', v_n;
    END IF;

    v_err := NULL;
    BEGIN
      PERFORM attach_match_videos(v_match, jsonb_build_array(
        jsonb_build_object('url', 'https://youtu.be/part1', 'start', '00:42')
      ), NULL);
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
    END;
    IF v_err IS NULL OR v_err NOT LIKE '%quản trị viên%' THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 5: thành viên thường BỚT phần video mà không bị chặn (lỗi: %)', v_err;
    END IF;

    PERFORM set_config('request.jwt.claim.sub', v_owner_user::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_user, 'role', 'authenticated')::text, true);
  END IF;

  /* ---------- 6. Chủ CLB gỡ hết: được phép, cột cũ về null ---------- */
  PERFORM attach_match_videos(v_match, '[]'::jsonb, NULL);
  SELECT videos, video_url, video_timestamp INTO v_row FROM matches WHERE id = v_match;
  IF jsonb_array_length(v_row.videos) <> 0 OR v_row.video_url IS NOT NULL OR v_row.video_timestamp IS NOT NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: gỡ hết mà còn dữ liệu — videos=%, url=%', v_row.videos, v_row.video_url;
  END IF;

  -- Cố ý lỗi để Postgres huỷ MỌI thay đổi thử ở trên.
  RAISE EXCEPTION '0065 CHECK OK — tất cả 6 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;
