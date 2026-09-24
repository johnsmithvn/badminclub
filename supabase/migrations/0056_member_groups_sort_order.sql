-- 0056_member_groups_sort_order.sql
-- Thêm sort_order (để lưu thứ tự hiển thị tuỳ biến) và created_at cho member_groups

ALTER TABLE public.member_groups 
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS member_groups_sort_idx ON public.member_groups (club_id, sort_order);
