-- Migration 0004: Bổ sung quyền XÓA thành viên (RLS DELETE) và cascade khóa ngoại
--
-- VẤN ĐỀ:
-- 1. Trong 0001_init.sql, bảng club_members chỉ khai báo policy SELECT, INSERT, UPDATE mà QUÊN policy DELETE.
--    Khiến lệnh DELETE của Supabase bị RLS chặn (xóa 0 dòng), F5 trang dữ liệu lại hiện lên.
-- 2. Bảng group_memberships thiếu ON DELETE CASCADE nên nếu thành viên đã nằm trong danh sách cố định
--    thì Postgres chặn xóa do dính khóa ngoại (Foreign key violation).

-- 1. Cấp quyền DELETE cho bảng club_members (chỉ người có quyền 'members' hoặc chủ CLB được xóa)
DROP POLICY IF EXISTS cm_del ON public.club_members;
CREATE POLICY cm_del ON public.club_members FOR DELETE
  USING (has_club_perm(club_id, 'members'));

-- 2. Đổi khóa ngoại group_memberships(member_id) sang ON DELETE CASCADE để tự động dọn sạch bản ghi tháng
ALTER TABLE public.group_memberships
  DROP CONSTRAINT IF EXISTS group_memberships_member_id_fkey;

ALTER TABLE public.group_memberships
  ADD CONSTRAINT group_memberships_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.club_members(id) ON DELETE CASCADE;
