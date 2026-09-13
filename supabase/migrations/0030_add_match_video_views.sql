-- 0030_add_match_video_views.sql
-- Thêm trường đếm tổng lượt xem (video_views) và thống kê người xem (video_viewers)
-- để theo dõi mức độ tương tác và làm bộ lọc ẩn cho quản trị viên.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS video_views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_viewers jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.matches.video_views IS 'Tổng số lượt xem video trận đấu trên ứng dụng';
COMMENT ON COLUMN public.matches.video_viewers IS 'Thống kê người xem { [member_id]: count } dành cho quản trị viên';
