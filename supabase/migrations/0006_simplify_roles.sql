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
