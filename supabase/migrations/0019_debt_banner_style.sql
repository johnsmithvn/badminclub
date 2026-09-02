-- Migration 0019: kiểu banner nhắc công nợ hiện cho THÀNH VIÊN ở Trang chủ.
--
-- Cài đặt của CLB, không phải của từng người: chủ CLB chọn một kiểu, mọi thành viên thấy
-- giống nhau. Cùng một CLB mà mỗi người một kiểu thì lúc hỏi nhau "cái banner đỏ ở đâu"
-- không ai trả lời được.
--
--   slim  · một dòng vàng mảnh, danh sách nằm trong popup  (mặc định)
--   alert · thẻ đỏ, số tiền to, kèm vài khoản gần nhất
--   bar   · thanh mảnh sát trên hàng tab, thấy ở mọi tab
--   off   · tắt hẳn, thành viên tự vào màn Công nợ
--
-- Popup chi tiết dùng CHUNG cho cả ba kiểu — chỉ đổi lớp vỏ nhắc, luồng trả tiền y nguyên.

BEGIN;

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS debt_banner text NOT NULL DEFAULT 'slim';

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_debt_banner_chk;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_debt_banner_chk
  CHECK (debt_banner IN ('slim', 'alert', 'bar', 'off'));

COMMENT ON COLUMN public.clubs.debt_banner IS
  'Kiểu banner nhắc công nợ ở Trang chủ của thành viên: slim | alert | bar | off. '
  'Cài đặt chung của CLB, áp cho mọi thành viên.';

COMMIT;

NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------

   a) Cột có mặt, mặc định đúng:
        SELECT column_name, column_default, is_nullable
          FROM information_schema.columns
         WHERE table_name = 'clubs' AND column_name = 'debt_banner';
        -- mong đợi: 'slim'::text · NO

   b) Giá trị lạ bị chặn:
        UPDATE clubs SET debt_banner = 'xyz' WHERE id = '<club_id>';
        -- mong đợi: lỗi clubs_debt_banner_chk, KHÔNG được thành công
*/
