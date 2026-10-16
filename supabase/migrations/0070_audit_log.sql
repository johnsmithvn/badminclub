-- 0070_audit_log.sql — Lịch sử thay đổi để BACKTEST và TRUY VẾT về sau.
--
-- Vì sao: 2026-10-16 điểm mùa top 1 tụt 38 mà không truy ra nổi. "Tính lại toàn bộ", "Huỷ trận",
-- "Sửa tỉ số" đều chạy lại Elo cả lịch sử và GHI ĐÈ số Elo lưu trong từng trận; trận bị huỷ thì
-- xoá hẳn; nhật ký huỷ trận (`match_edits`) còn bị xoá dây chuyền theo trận. Số cũ mất sạch.
--
-- Cách làm: một bảng `audit_log` + bộ ghi tự động (trigger) đặt NGAY TRONG DB trên mọi bảng làm
-- thay đổi Elo / điểm mùa. Thêm / sửa / xoá dòng nào là DB tự chép lại — app không cần biết, nên
-- không sót được đường ghi nào (máy thứ hai, bản app cũ trong cache, sửa tay trong Supabase).
--   - Thêm: nguyên dòng mới.   Sửa: CHỈ các cột đổi, giá trị cũ và mới.   Xoá: nguyên dòng cũ.
--   - Đủ để TUA NGƯỢC dữ liệu về một thời điểm rồi chạy backtest (docs/BACKTEST.md).
--   - Bảng thành viên / khách / CLB chỉ chép các cột ảnh hưởng điểm (tên, trình độ, giới tính,
--     còn hoạt động, thang mùa) — không chép SĐT, tài khoản ngân hàng vào lịch sử.
--   - Lưu vết KHÔNG BAO GIỜ làm hỏng việc ghi thật: bộ ghi lỗi thì chỉ cảnh báo, dòng gốc vẫn lưu.
--   - Chỉ chủ CLB (cờ `settings`) đọc được. Không ai ghi tay / sửa / xoá được — chỉ trigger ghi.
--
-- Kèm: bỏ khoá ngoại CASCADE của `match_edits.match_id` — huỷ trận xong nhật ký huỷ phải còn.
--
-- Không đổi Elo / điểm mùa. CHỈ THÊM MỚI, chạy lại được bao nhiêu lần cũng được.
-- Kiểm tra sau khi chạy: supabase/manual/0070_audit_log_check.sql (tự huỷ, không để lại dữ liệu).

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigserial PRIMARY KEY,
  -- Không khoá ngoại: dòng gốc (kể cả CLB) bị xoá thì lịch sử vẫn phải còn để truy.
  club_id     uuid,
  table_name  text NOT NULL,
  row_id      text NOT NULL,
  action      char(1) NOT NULL CHECK (action IN ('I', 'U', 'D')),
  old_data    jsonb,                      -- U: giá trị CŨ của cột đổi · D: nguyên dòng
  new_data    jsonb,                      -- I: nguyên dòng · U: giá trị MỚI của cột đổi
  actor       uuid,                       -- auth.uid(); NULL = SQL Editor / service role
  changed_at  timestamptz NOT NULL DEFAULT now(),
  tx_id       bigint NOT NULL DEFAULT txid_current()  -- các dòng cùng MỘT lần ghi
);

CREATE INDEX IF NOT EXISTS idx_audit_log_club_time ON public.audit_log(club_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_row ON public.audit_log(table_name, row_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (club_id IS NOT NULL AND has_club_perm(club_id, 'settings'));

-- Không policy ghi nào + thu quyền: chỉ trigger (SECURITY DEFINER, chủ bảng) ghi được.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon, authenticated;

/**
 * Bộ ghi dùng chung cho mọi bảng.
 *   TG_ARGV[0]: các cột được chép, cách nhau dấu phẩy; '*' = mọi cột.
 *   TG_ARGV[1]: các cột nhiễu bỏ qua (đổi riêng chúng thì không ghi gì).
 * Gắn AFTER INSERT/UPDATE và BEFORE DELETE: xoá ghi TRƯỚC khi khoá ngoại xoá dây chuyền bảng con,
 * để dòng lịch sử của cha có sẵn khi bảng con cần tra CLB của mình qua nó.
 */
CREATE OR REPLACE FUNCTION public.audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep   text[] := CASE WHEN TG_NARGS = 0 OR TG_ARGV[0] = '*' THEN NULL ELSE string_to_array(TG_ARGV[0], ',') END;
  v_skip   text[] := CASE WHEN TG_NARGS > 1 AND TG_ARGV[1] <> '' THEN string_to_array(TG_ARGV[1], ',') ELSE '{}'::text[] END;
  v_old    jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new    jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_row    jsonb;
  v_id     text;
  v_club   uuid;
  v_parent text;
  v_pkey   text;
  o        jsonb;
  n        jsonb;
BEGIN
  BEGIN
    v_row := COALESCE(v_new, v_old);
    -- member_levels không có cột id: khoá là (member_id, from_month).
    v_id := COALESCE(v_row ->> 'id', (v_row ->> 'member_id') || '|' || (v_row ->> 'from_month'));

    SELECT jsonb_object_agg(key, value) INTO o FROM jsonb_each(v_old)
     WHERE (v_keep IS NULL OR key = ANY (v_keep)) AND NOT (key = ANY (v_skip));
    SELECT jsonb_object_agg(key, value) INTO n FROM jsonb_each(v_new)
     WHERE (v_keep IS NULL OR key = ANY (v_keep)) AND NOT (key = ANY (v_skip));

    IF TG_OP = 'UPDATE' THEN
      -- Chỉ giữ cột ĐỔI. Upsert lại y nguyên, hoặc chỉ đổi cột nhiễu / cột không chép → không ghi.
      SELECT jsonb_object_agg(key, value) INTO n FROM jsonb_each(n) WHERE value IS DISTINCT FROM (o -> key);
      IF n IS NULL THEN
        RETURN NULL;
      END IF;
      SELECT jsonb_object_agg(key, value) INTO o FROM jsonb_each(o) WHERE n ? key;
    END IF;

    v_club := CASE WHEN TG_TABLE_NAME = 'clubs' THEN (v_row ->> 'id')::uuid ELSE (v_row ->> 'club_id')::uuid END;
    IF v_club IS NULL THEN
      -- Bảng con không có club_id: tra qua cha.
      v_parent := CASE TG_TABLE_NAME
        WHEN 'matches' THEN 'sessions'
        WHEN 'session_guests' THEN 'sessions'
        WHEN 'match_players' THEN 'matches'
        WHEN 'challenge_players' THEN 'challenges'
        WHEN 'challenge_guests' THEN 'challenges'
        WHEN 'member_levels' THEN 'club_members'
      END;
      v_pkey := v_row ->> CASE TG_TABLE_NAME
        WHEN 'matches' THEN 'session_id'
        WHEN 'session_guests' THEN 'session_id'
        WHEN 'match_players' THEN 'match_id'
        WHEN 'challenge_players' THEN 'challenge_id'
        WHEN 'challenge_guests' THEN 'challenge_id'
        WHEN 'member_levels' THEN 'member_id'
      END;
      IF v_parent = 'sessions' THEN
        SELECT s.club_id INTO v_club FROM sessions s WHERE s.id = v_pkey::uuid;
      ELSIF v_parent = 'matches' THEN
        SELECT s.club_id INTO v_club FROM matches m JOIN sessions s ON s.id = m.session_id WHERE m.id = v_pkey::uuid;
      ELSIF v_parent = 'challenges' THEN
        SELECT c.club_id INTO v_club FROM challenges c WHERE c.id = v_pkey::uuid;
      ELSIF v_parent = 'club_members' THEN
        SELECT cm.club_id INTO v_club FROM club_members cm WHERE cm.id = v_pkey::uuid;
      END IF;
      -- Cha đang bị xoá dây chuyền (không còn trong bảng) → lấy từ dòng lịch sử của chính cha,
      -- vừa ghi ở BEFORE DELETE của cha trong cùng giao dịch.
      IF v_club IS NULL AND v_parent IS NOT NULL THEN
        SELECT a.club_id INTO v_club FROM audit_log a
         WHERE a.table_name = v_parent AND a.row_id = v_pkey
         ORDER BY a.id DESC LIMIT 1;
      END IF;
    END IF;

    INSERT INTO audit_log (club_id, table_name, row_id, action, old_data, new_data, actor)
    VALUES (v_club, TG_TABLE_NAME, v_id, left(TG_OP, 1), o, n, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- Lưu vết KHÔNG được làm hỏng việc ghi thật: lỗi ở đây chỉ cảnh báo, dòng gốc vẫn lưu.
    RAISE WARNING 'audit_row %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_row() FROM PUBLIC;

-- Gắn bộ ghi. Bảng nào ảnh hưởng Elo / điểm mùa thì có mặt ở đây — thiếu là không tua lại được.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    -- Trận, Elo, kèo, cược: chép mọi cột (không có dữ liệu cá nhân).
    ('matches',               '*', 'video_views,video_viewers'),
    ('match_players',         '*', ''),
    ('player_ratings',        '*', ''),
    ('club_calibration',      '*', ''),
    ('challenges',            '*', ''),
    ('challenge_players',     '*', ''),
    ('challenge_guests',      '*', ''),
    ('challenge_predictions', '*', ''),
    ('member_levels',         '*', ''),
    -- Chỉ các cột ảnh hưởng điểm. Thang mùa và danh sách trình độ nằm ở `clubs`.
    ('clubs',          'id,seasons,levels', ''),
    ('club_members',   'id,club_id,name,level,gender,active', ''),
    ('guests',         'id,club_id,name,level,gender', ''),
    ('sessions',       'id,club_id,date,status', ''),
    ('session_guests', 'id,session_id,guest_id,member_id,level,gender', '')
  ) AS t(tbl, keep, skip)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN
      RAISE NOTICE 'audit: bỏ qua %, bảng chưa có', r.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'audit_' || r.tbl, r.tbl);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row(%L, %L)',
      'audit_' || r.tbl, r.tbl, r.keep, r.skip);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'audit_' || r.tbl || '_del', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row(%L, %L)',
      'audit_' || r.tbl || '_del', r.tbl, r.keep, r.skip);
  END LOOP;
END $$;

-- Nhật ký huỷ / sửa trận phải SỐNG khi trận bị xoá. Tên khoá ngoại tra từ catalog, không đoán.
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
     WHERE con.conrelid = 'public.match_edits'::regclass
       AND con.contype = 'f'
       AND con.confrelid = 'public.matches'::regclass
       AND a.attname = 'match_id'
  LOOP
    EXECUTE format('ALTER TABLE public.match_edits DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

COMMIT;
