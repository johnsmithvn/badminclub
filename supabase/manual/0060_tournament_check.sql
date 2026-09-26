-- 0060_tournament_check.sql — kiểm migration 0060 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0060_tournament_templates.sql trước, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
-- Script LUÔN kết thúc bằng lỗi (cố ý, để huỷ dữ liệu thử):
--   ✅ "0060 CHECK OK — ..."  → đạt.      ❌ "SAI Ở BƯỚC ..." → dán nguyên thông báo cho người viết migration.

DO $check$
DECLARE
  v_club uuid;
  v_n    int;
BEGIN
  SELECT id INTO v_club FROM clubs WHERE deleted_at IS NULL LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'Cần ít nhất một CLB để kiểm tra.'; END IF;

  -- 1. Lưu mẫu hợp lệ.
  INSERT INTO tournament_templates (club_id, name, graph)
  VALUES (v_club, '__Mẫu thử__', '{"stages":[{"seq":1,"type":"round_robin"}],"links":[]}');
  SELECT count(*) INTO v_n FROM tournament_templates WHERE club_id = v_club AND name = '__Mẫu thử__';
  IF v_n <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 1: không lưu được mẫu'; END IF;

  -- 2. Tên rỗng / graph sai hình → bị chặn.
  BEGIN
    INSERT INTO tournament_templates (club_id, name, graph) VALUES (v_club, '  ', '{"stages":[]}');
    RAISE EXCEPTION 'SAI Ở BƯỚC 2a: tên rỗng vẫn lưu được';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO tournament_templates (club_id, name, graph) VALUES (v_club, 'x', '{"links":[]}');
    RAISE EXCEPTION 'SAI Ở BƯỚC 2b: graph thiếu stages vẫn lưu được';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 3. RLS đã bật.
  SELECT count(*) INTO v_n FROM pg_class WHERE relname = 'tournament_templates' AND relrowsecurity;
  IF v_n <> 1 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: chưa bật RLS'; END IF;

  RAISE EXCEPTION '0060 CHECK OK — lưu mẫu CLB đúng (dữ liệu thử đã huỷ)';
END $check$;
