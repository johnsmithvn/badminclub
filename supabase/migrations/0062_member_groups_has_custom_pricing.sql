-- 0062_member_groups_has_custom_pricing.sql
-- Thêm cột has_custom_pricing vào member_groups để lưu rõ nhóm nào áp dụng mức riêng

ALTER TABLE public.member_groups
  ADD COLUMN IF NOT EXISTS has_custom_pricing boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.member_groups.has_custom_pricing IS
  'false = áp dụng theo Biểu phí CLB; true = áp dụng mức thu riêng của nhóm.';
