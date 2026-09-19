-- 0051_session_rsvp_invited_at.sql
-- Mốc "đã gửi lời mời điểm danh cho buổi này" — chống spam khi đóng/mở lại buổi.
--
-- VÌ SAO CẦN CỘT, KHÔNG DÙNG BIẾN TRONG BỘ NHỚ:
-- `setSessionStatus` gửi `session_rsvp_invite` mỗi lần buổi chuyển sang `open`. Lọc theo
-- "người CHƯA trả lời" là chưa đủ — đóng rồi mở lại (sửa sân, sửa giờ, hoặc chỉ để test) thì
-- đúng những người chưa kịp trả lời lại bị mời lần nữa, lần nữa. Họ là nhóm dễ tắt thông báo
-- nhất, mà tắt rồi là mất luôn những thứ đáng đọc.
--
-- Biến trong RAM không giải quyết được: tải lại trang là mất, và quản trò mở buổi từ máy khác
-- thì không thấy gì cả. Sự thật này phải nằm cùng chỗ với buổi tập.
--
-- NULL      = chưa từng mời
-- có giá trị = đã mời, không mời lại dù mở lại bao nhiêu lần
--
-- Muốn mời lại có chủ đích (ví dụ dời lịch, cần hỏi lại cả nhóm):
--     UPDATE public.sessions SET rsvp_invited_at = NULL WHERE id = '<session_id>';

BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS rsvp_invited_at timestamptz;

COMMENT ON COLUMN public.sessions.rsvp_invited_at IS
  'Mốc đã gửi session_rsvp_invite. NULL = chưa mời. Đặt NULL lại để cho phép mời lại.';

COMMIT;

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------
     SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sessions'
        AND column_name = 'rsvp_invited_at';
   Phải trả về đúng 1 dòng.
*/
