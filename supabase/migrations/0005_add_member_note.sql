-- 0005_add_member_note.sql
-- Thêm cột note vào bảng club_members để lưu ghi chú thành viên (link Facebook, link Zalo, v.v.)

ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS note text;
