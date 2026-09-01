-- Migration 0006: Thu gọn hệ thống vai trò thành 3 vai:
-- 1. Chủ CLB (owner): toàn quyền
-- 2. Thủ quỹ (treasurer): sửa toàn bộ trừ Cài đặt và Thành viên
-- 3. Thành viên (member): xem được toàn bộ hoạt động, không có quyền sửa

DELETE FROM role_permissions WHERE role IN ('host', 'viewer');

INSERT INTO role_permissions (role, can_money, can_members, can_sessions, can_assign, can_settings, can_view_all)
VALUES
  ('owner',     true,  true,  true,  true,  true,  true),
  ('treasurer', true,  false, true,  true,  false, true),
  ('member',    false, false, false, false, false, true)
ON CONFLICT (role) DO UPDATE SET
  can_money = EXCLUDED.can_money,
  can_members = EXCLUDED.can_members,
  can_sessions = EXCLUDED.can_sessions,
  can_assign = EXCLUDED.can_assign,
  can_settings = EXCLUDED.can_settings,
  can_view_all = EXCLUDED.can_view_all;

-- Chuyển các thành viên cũ đang gán vai host hoặc viewer về member
UPDATE club_members SET role = 'member' WHERE role IN ('host', 'viewer');

-- Cho phép thành viên tự cập nhật thông tin cá nhân của mình trong CLB
DROP POLICY IF EXISTS cm_update_self ON club_members;
CREATE POLICY cm_update_self ON club_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Cho phép Chủ CLB tìm kiếm tài khoản user để ghép vào bản ghi thành viên
CREATE OR REPLACE FUNCTION public.search_users_for_club(p_club uuid, p_query text DEFAULT '')
RETURNS TABLE (
  id uuid, name text, nick text, phone text, gender gender, level text, email text
)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name, p.nick, p.phone, p.gender, p.level, p.email
    FROM profiles p
   WHERE has_club_perm(p_club, 'members')
     AND (
       p_query = '' OR
       p.name ILIKE '%' || p_query || '%' OR
       COALESCE(p.phone, '') ILIKE '%' || p_query || '%' OR
       COALESCE(p.email, '') ILIKE '%' || p_query || '%' OR
       COALESCE(p.username, '') ILIKE '%' || p_query || '%'
     )
   ORDER BY p.name
   LIMIT 50;
$$;
