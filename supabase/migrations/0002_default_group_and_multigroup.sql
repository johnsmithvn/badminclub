-- Migration 0002: Thêm cờ multi_group cho CLB và tự động sinh nhóm mặc định cho các CLB đã tạo / tạo mới

-- 1. Thêm cột multi_group vào bảng clubs (mặc định false: chế độ 1 nhóm sinh hoạt chung)
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS multi_group boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clubs.multi_group IS
  'false = chế độ 1 nhóm sinh hoạt chung (mặc định cho CLB đơn giản); true = chế độ nhiều ca tập/nhóm riêng biệt.';

-- 2. Tự động bù nhóm mặc định cho các CLB đã lỡ tạo trước đây mà chưa có nhóm nào
DO $$
DECLARE
  r RECORD;
  new_group_id uuid;
BEGIN
  FOR r IN SELECT c.id, c.name FROM public.clubs c WHERE NOT EXISTS (SELECT 1 FROM public.member_groups mg WHERE mg.club_id = c.id)
  LOOP
    new_group_id := gen_random_uuid();
    INSERT INTO public.member_groups (
      id, club_id, name, short, weekday,
      fee_male, fee_female, unit_male, unit_female,
      start_time, end_time, quota, active
    )
    VALUES (
      new_group_id, r.id, 'Cố định', 'CĐ', 0,
      0, 0, 0, 0,
      '18:00', '20:00', 24, true
    );

    -- Gán toàn bộ thành viên hiện có của CLB này vào nhóm mặc định
    INSERT INTO public.club_member_groups (member_id, group_id)
    SELECT cm.id, new_group_id
      FROM public.club_members cm
     WHERE cm.club_id = r.id
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 3. Cập nhật hàm RPC create_club để luôn sinh nhóm mặc định kèm liên kết owner
CREATE OR REPLACE FUNCTION public.create_club(
  p_name            text,
  p_opening_balance bigint DEFAULT 0,
  p_opening_date    date   DEFAULT CURRENT_DATE,
  p_lock_day        int    DEFAULT 25,
  p_bank_holder     text   DEFAULT NULL,
  p_bank_no         text   DEFAULT NULL,
  p_bank_name       text   DEFAULT NULL
)
RETURNS clubs
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_club clubs;
  me profiles;
  new_member_id uuid;
  new_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  IF length(coalesce(trim(p_name), '')) < 2 THEN RAISE EXCEPTION 'Tên CLB quá ngắn'; END IF;

  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  IF me.id IS NULL THEN
    RAISE EXCEPTION 'Tài khoản này chưa có hồ sơ. Đăng xuất rồi đăng nhập lại; nếu vẫn lỗi thì chạy lại migration hoặc đăng ký tài khoản mới.';
  END IF;

  INSERT INTO clubs (name, code, opening_balance, opening_date, opening_by,
                     lock_day, bank_holder, bank_no, bank_name, multi_group)
  VALUES (trim(p_name), gen_club_code(), p_opening_balance, p_opening_date,
          COALESCE(me.nick, me.name), p_lock_day, p_bank_holder, p_bank_no, p_bank_name, false)
  RETURNING * INTO new_club;

  INSERT INTO club_members (club_id, user_id, role, name, phone, gender, level, joined_at, linked_at)
  VALUES (new_club.id, me.id, 'owner',
          COALESCE(me.nick, me.name), me.phone,
          COALESCE(me.gender, 'nam'), COALESCE(me.level, new_club.levels[1]),
          CURRENT_DATE, now())
  RETURNING id INTO new_member_id;

  INSERT INTO shuttle_types (club_id, name, per_tube, price_per_tube)
  VALUES (new_club.id, 'Cầu mặc định', 12, NULL);

  -- Tự động sinh 1 nhóm mặc định "Cố định" để CLB không bao giờ bị rỗng nhóm
  new_group_id := gen_random_uuid();
  INSERT INTO member_groups (
    id, club_id, name, short, weekday,
    fee_male, fee_female, unit_male, unit_female,
    start_time, end_time, quota, active
  )
  VALUES (
    new_group_id, new_club.id, 'Cố định', 'CĐ', 0,
    0, 0, 0, 0,
    '18:00', '20:00', 24, true
  );

  -- Gán owner vào nhóm mặc định
  INSERT INTO club_member_groups (member_id, group_id)
  VALUES (new_member_id, new_group_id);

  RETURN new_club;
END;
$$;
