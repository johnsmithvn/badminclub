-- Migration 0024: Cấu hình chênh lệch giá thành viên đi thêm so với khách giao lưu.
--
-- Thành viên cố định của CLB khi tham gia thêm các buổi khác (ngoài nhóm cố định)
-- có thể được giảm trừ một khoản so với giá khách giao lưu.
--   has_member_extra_discount: Bật/tắt ưu đãi (mặc định false - tính bằng giá giao lưu)
--   member_extra_discount: Số tiền giảm trừ (mặc định 5000đ khi bật)

BEGIN;

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS has_member_extra_discount boolean NOT NULL DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS member_extra_discount bigint NOT NULL DEFAULT 5000;

COMMENT ON COLUMN public.clubs.has_member_extra_discount IS
  'Bật/tắt giảm trừ cho thành viên cố định khi đi thêm buổi so với giá giao lưu. Mặc định false (tính theo giá giao lưu).';
COMMENT ON COLUMN public.clubs.member_extra_discount IS
  'Số tiền giảm trừ cho thành viên khi đi thêm buổi nếu has_member_extra_discount = true. Mặc định 5000đ.';

COMMIT;

NOTIFY pgrst, 'reload schema';
