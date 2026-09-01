-- Migration 0003: buổi ĐỘT XUẤT thu tiền theo lượt cho cả THÀNH VIÊN, không chỉ khách.
--
-- Buổi đột xuất (schedule_id IS NULL) không nằm trong gói quỹ tháng của ai. Trước migration này
-- chỉ khách ngoài CLB có chỗ ghi tiền (session_guests), còn thành viên đi buổi đó chỉ có ô điểm
-- danh — không ô tiền, không nút thu. Kết quả: quỹ gánh trọn tiền sân + cầu của mọi buổi lẻ.
--
-- Cách chữa rẻ nhất: `session_guests` vốn đã là "MỘT LƯỢT TRẢ TIỀN TRONG MỘT BUỔI" (giá đóng
-- băng tại buổi, cờ đã thu, người rủ). Cho nó trỏ được vào club_members thay vì chỉ guests.

ALTER TABLE public.session_guests
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.club_members(id);

ALTER TABLE public.session_guests
  ALTER COLUMN guest_id DROP NOT NULL;

-- Đúng MỘT trong hai. Cả hai cùng NULL thì dòng tiền không biết của ai; cả hai cùng có thì
-- một người bị đếm hai lần ở mọi chỗ cộng đầu người.
ALTER TABLE public.session_guests
  DROP CONSTRAINT IF EXISTS session_guests_who_chk;
ALTER TABLE public.session_guests
  ADD CONSTRAINT session_guests_who_chk
  CHECK ((guest_id IS NOT NULL) <> (member_id IS NOT NULL));

-- Một thành viên chỉ có MỘT lượt trong một buổi — cùng luật với khách (appActions: addGuest),
-- nhưng ở đây khoá cứng dưới DB vì dòng này sinh tự động theo điểm danh.
CREATE UNIQUE INDEX IF NOT EXISTS session_guests_member_uq
  ON public.session_guests (session_id, member_id) WHERE member_id IS NOT NULL;

COMMENT ON COLUMN public.session_guests.member_id IS
  'Thành viên CLB trả tiền theo LƯỢT cho một buổi đột xuất. NULL = dòng của khách ngoài CLB '
  '(guest_id). Giá lấy từ guest_price_rules lúc điểm danh rồi đóng băng, sửa đè được.';
