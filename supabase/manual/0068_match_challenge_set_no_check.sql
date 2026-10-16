-- 0068_match_challenge_set_no_check.sql — kiểm tra migration 0068 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0068_match_challenge_set_no.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý:
--   ✅ "0068 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi dòng thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
-- Mọi thứ nằm trong một khối DO: lỗi ở đâu là huỷ hết ở đó.
--
-- Cần: DB có ít nhất một trận kèo (matches.challenge_id khác NULL).
-- Các lệnh ghi dưới đây dùng đúng câu app gửi (`INSERT … ON CONFLICT (id) DO UPDATE` — upsert của
-- storage.js), không phải INSERT trần, để chắc DB chặn đúng đường app thật đi.

DO $check$
DECLARE
  v_match uuid;
  v_set   smallint;
  v_n     int;
  v_err   text;
BEGIN
  /* ---------- 1. Cột, CHECK và index đã có ---------- */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'set_no'
  ) THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có cột matches.set_no — đã chạy 0068_match_challenge_set_no.sql chưa?';
  END IF;
  IF to_regclass('public.uq_matches_challenge_set') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có index uq_matches_challenge_set';
  END IF;

  /* ---------- 2. Trận kèo cũ đã được đánh số ---------- */
  SELECT count(*) INTO v_n FROM matches WHERE challenge_id IS NOT NULL AND set_no IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: còn % trận kèo chưa có set_no', v_n;
  END IF;

  /* ---------- 3. Lấy một ván kèo có thật ---------- */
  SELECT id, set_no INTO v_match, v_set FROM matches WHERE challenge_id IS NOT NULL LIMIT 1;
  IF v_match IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 3: DB chưa có trận kèo nào để thử';
  END IF;

  /* ---------- 4. Máy cũ ghi lại ĐÚNG ván đó bằng id mới → bị chặn ---------- */
  v_err := NULL;
  BEGIN
    INSERT INTO matches (id, session_id, court_index, minutes, source_type, challenge_id, set_no)
    SELECT gen_random_uuid(), session_id, court_index, minutes, 'challenge', challenge_id, set_no
      FROM matches WHERE id = v_match
    ON CONFLICT (id) DO UPDATE SET set_no = EXCLUDED.set_no;
  EXCEPTION WHEN unique_violation THEN
    v_err := SQLERRM;
  END;
  IF v_err IS NULL OR v_err NOT LIKE '%uq_matches_challenge_set%' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: ghi trùng ván % của kèo mà không bị chặn (lỗi: %)', v_set, v_err;
  END IF;

  /* ---------- 5. Ván KẾ TIẾP của cùng kèo → ghi được ---------- */
  INSERT INTO matches (id, session_id, court_index, minutes, source_type, challenge_id, set_no)
  SELECT gen_random_uuid(), session_id, court_index, minutes, 'challenge', challenge_id,
         (SELECT max(set_no) + 1 FROM matches x WHERE x.challenge_id = m.challenge_id)
    FROM matches m WHERE id = v_match
  ON CONFLICT (id) DO UPDATE SET set_no = EXCLUDED.set_no;

  /* ---------- 6. App cũ (không gửi set_no) vẫn ghi được ---------- */
  INSERT INTO matches (id, session_id, court_index, minutes, source_type, challenge_id)
  SELECT gen_random_uuid(), session_id, court_index, minutes, 'challenge', challenge_id
    FROM matches WHERE id = v_match
  ON CONFLICT (id) DO UPDATE SET minutes = EXCLUDED.minutes;

  /* ---------- 7. Sửa tỷ số ván đã có (upsert cùng id, cùng số ván) → không bị chặn ---------- */
  INSERT INTO matches (id, session_id, court_index, minutes, source_type, challenge_id, set_no)
  SELECT id, session_id, court_index, minutes, 'challenge', challenge_id, set_no
    FROM matches WHERE id = v_match
  ON CONFLICT (id) DO UPDATE SET set_no = EXCLUDED.set_no, minutes = EXCLUDED.minutes;

  /* ---------- 8. Số ván phải ≥ 1 ---------- */
  v_err := NULL;
  BEGIN
    UPDATE matches SET set_no = 0 WHERE id = v_match;
  EXCEPTION WHEN check_violation THEN
    v_err := SQLERRM;
  END;
  IF v_err IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 8: set_no = 0 mà không bị CHECK chặn';
  END IF;

  -- Cố ý lỗi để Postgres huỷ MỌI dòng thử ở trên.
  RAISE EXCEPTION '0068 CHECK OK — tất cả 8 bước đạt. Đây là lỗi CỐ Ý để huỷ dữ liệu thử; DB không đổi gì.';
END $check$;
