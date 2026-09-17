-- Migration 0040: Hỗ trợ thu / hoàn trả và hoàn tác độc lập theo từng buổi lẻ cho hội viên cố định
--
-- Bảng member_adjustments trước đây chỉ có 1 cờ boolean `paid` cho toàn bộ tháng (chốt cuối tháng).
-- Khi thành viên vắng nhiều buổi (được hoàn tiền) hoặc đi thêm nhiều buổi (cần thu tiền), thủ quỹ
-- có thể trả trước hoặc thu trước tiền của một số buổi lẻ, các buổi khác còn nợ lại.
--
-- Cột `settled_sessions` lưu mảng session_id của các buổi đã được thanh toán.
-- Khi tất cả các buổi phát sinh trong tháng đã được thanh toán (hoặc khi chốt trọn gói), paid = true.

ALTER TABLE public.member_adjustments
  ADD COLUMN IF NOT EXISTS settled_sessions uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.member_adjustments.settled_sessions IS
  'Danh sách session_id của các buổi tập đã được thanh toán tiền mặt/chuyển khoản lẻ. '
  'Khi tất cả buổi phát sinh trong tháng đã thanh toán thì paid = true. '
  'Mảng rỗng và paid = true là dữ liệu cũ (coi như đã thanh toán toàn bộ).';
