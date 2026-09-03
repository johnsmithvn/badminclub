-- 0020_sync_default_levels.sql
-- Cập nhật hàm create_club để đồng bộ fallback thang trình độ 10 bậc:
-- ARRAY['Y', 'Y+', 'TBY-', 'TBY', 'TBY+', 'TB-', 'TB', 'TB+', 'TBK', 'Khá']
-- Khớp với clubs.levels default (0014) và app.json levelsDefault.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_club(
  p_name            text,
  p_opening_balance bigint,
  p_opening_date    date,
  p_lock_day        int DEFAULT 25,
  p_bank_holder     text DEFAULT NULL,
  p_bank_no         text DEFAULT NULL,
  p_bank_name       text DEFAULT NULL,
  p_levels          text[] DEFAULT NULL
)
RETURNS public.clubs
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me            public.profiles%ROWTYPE;
  new_club      public.clubs%ROWTYPE;
  new_member_id uuid;
  v_levels      text[];
BEGIN
  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'Tài khoản này chưa có hồ sơ. Đăng xuất rồi đăng nhập lại; nếu vẫn lỗi thì chạy lại migration hoặc đăng ký tài khoản mới.';
  END IF;

  -- Không truyền hoặc truyền mảng rỗng thì dùng thang mặc định 10 bậc của CLB
  v_levels := CASE WHEN p_levels IS NULL OR array_length(p_levels, 1) IS NULL
                   THEN NULL ELSE p_levels END;

  INSERT INTO clubs (name, code, opening_balance, opening_date, opening_by,
                     lock_day, bank_holder, bank_no, bank_name, multi_group, levels)
  VALUES (trim(p_name), gen_club_code(), p_opening_balance, p_opening_date,
          COALESCE(me.nick, me.name), p_lock_day, p_bank_holder, p_bank_no, p_bank_name, false,
          COALESCE(v_levels, ARRAY['Y', 'Y+', 'TBY-', 'TBY', 'TBY+', 'TB-', 'TB', 'TB+', 'TBK', 'Khá']))
  RETURNING * INTO new_club;

  INSERT INTO club_members (club_id, user_id, role, name, full_name, phone, email, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.name, me.phone, me.email,
          COALESCE(me.gender, 'nam'),
          -- Thang là của TỪNG CLB (0009): ngoài thang thì lấy bậc thấp nhất.
          CASE WHEN me.level = ANY (new_club.levels) THEN me.level ELSE new_club.levels[1] END,
          CURRENT_DATE, now())
  RETURNING id INTO new_member_id;

  INSERT INTO shuttle_types (club_id, name, per_tube, price_per_tube)
  VALUES (new_club.id, 'Cầu mặc định', 12, NULL);

  RETURN new_club;
END $$;

COMMENT ON FUNCTION public.create_club(text, bigint, date, int, text, text, text, text[]) IS
  'Tạo CLB + bản ghi owner + một loại cầu mặc định. p_levels = thang trình độ khởi tạo (client truyền app.json levelsDefault); NULL thì dùng default 10 bậc của cột clubs.levels.';

COMMIT;

NOTIFY pgrst, 'reload schema';
