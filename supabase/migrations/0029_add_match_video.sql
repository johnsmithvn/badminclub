-- 0029_add_match_video.sql
-- Thêm các trường lưu thông tin video trận đấu (YouTube, Google Drive, iCloud)
-- vào bảng matches mà không tốn dung lượng / băng thông lưu trữ Supabase Storage.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_timestamp text,
  ADD COLUMN IF NOT EXISTS video_note text;

COMMENT ON COLUMN public.matches.video_url IS 'Đường link video xem lại trận đấu (YouTube, Drive, iCloud...)';
COMMENT ON COLUMN public.matches.video_timestamp IS 'Mốc thời gian bắt đầu trận trong video (ví dụ: 00:42, 12:30 hoặc giây)';
COMMENT ON COLUMN public.matches.video_note IS 'Ghi chú ngắn về video (ví dụ: Set cuối, Highlight, Pha cầu đẹp)';
