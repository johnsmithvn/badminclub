-- 0014_guest_notes_and_levels.sql
-- Thêm cột note cho bảng guests (ghi chú đặc điểm khách: tay trái, bạn Mai, v.v.)
-- Cập nhật thang trình độ mặc định 10 bậc cho bảng clubs: Y, Y+, TBY-, TBY, TBY+, TB-, TB, TB+, TBK, Khá

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS note text;

COMMENT ON COLUMN public.guests.note IS 'Ghi chú về khách: tay trái, bạn ai, đặc điểm phong cách chơi';

-- Cập nhật default cho clubs.levels đồng bộ với app.json levelsDefault
ALTER TABLE public.clubs
  ALTER COLUMN levels SET DEFAULT ARRAY['Y', 'Y+', 'TBY-', 'TBY', 'TBY+', 'TB-', 'TB', 'TB+', 'TBK', 'Khá'];
