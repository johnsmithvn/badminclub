-- 0028_add_bounty_broken_to_matches.sql
-- Thêm trường ghi nhận ngắt chuỗi Bounty (bounty_broken) và độ dài chuỗi bị ngắt (broken_streak)
-- vào bảng matches để phục vụ truy vấn danh hiệu Kẻ Ngắt Chuỗi và Bảng tin CLB bền vững.

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS bounty_broken boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS broken_streak integer DEFAULT 0;

COMMENT ON COLUMN public.matches.bounty_broken IS 'Đánh dấu trận đấu có làm đứt chuỗi thắng Bounty của đối thủ hay không';
COMMENT ON COLUMN public.matches.broken_streak IS 'Độ dài chuỗi thắng lớn nhất bị ngắt bởi trận đấu này';
