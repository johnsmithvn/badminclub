-- 0046_challenge_accept_deploy_timestamps.sql
-- Ghi lại MỐC THỜI GIAN thật của vòng đời kèo: lúc nhận đủ, ai là người chốt, lúc đẩy lên sân.
--
-- Vì sao cần: `ChallengeDetailModal` đã đọc `acceptedBy` / `acceptedAt` / `deployedAt` từ lâu để
-- dựng dòng thời gian 4 bước, nhưng KHÔNG chỗ nào trong app ghi ba trường đó — grep ra 0 chỗ ghi.
-- Hệ quả: bước "nhận kèo" và bước "đẩy lên sân" luôn hiển thị GIỜ TẠO KÈO (fallback), nên một kèo
-- tạo 19:00 và nhận lúc 20:30 vẫn hiện 19:00 ở cả ba bước.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deployed_at timestamptz;

COMMENT ON COLUMN public.challenges.accepted_at IS
  'Lúc kèo đủ chữ ký của MỌI đấu thủ (status -> accepted), không phải lúc người đầu tiên bấm nhận.';
COMMENT ON COLUMN public.challenges.accepted_by IS
  'Người bấm nhát cuối làm kèo đủ. Admin duyệt hộ cả kèo thì đây là admin.';
COMMENT ON COLUMN public.challenges.deployed_at IS
  'Lúc kèo được đẩy lên sân thật.';

-- Dữ liệu cũ: kèo đã accepted/played trước migration này không có mốc thật để khôi phục.
-- CỐ Ý để NULL thay vì đổ đại `created_at` vào — UI đã có sẵn đường fallback về giờ tạo kèo, còn
-- đổ số giả xuống DB thì sau này không phân biệt nổi đâu là mốc thật đâu là mốc bịa.
