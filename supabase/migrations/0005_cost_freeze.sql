/* =====================================================================
   0005_cost_freeze.sql — Đóng băng giá thành buổi + khoá kiểm kho theo tháng
   Đặc tả: docs/DATABASE.md §3 (hai tầng) · §8 mục 5 và 6 · TASKS.md Phase 9 · P2

   Vì sao cần:
   Giá thành buổi đang tính LIVE từ giá sân và giá cầu bình quân HIỆN TẠI. Mua thêm một đợt
   cầu giá khác là mọi buổi trong quá khứ đổi con số — buổi 03/08 không có gì thay đổi nhưng
   tiền cầu nhảy từ 935.000 lên 977.500. Sang năm mở lại tháng cũ, user thấy số khác số họ đã
   đọc hôm nay và không ai giải thích được.

   Nguyên tắc: DỮ LIỆU ĐÃ CHỐT THÌ LƯU LẠI, KHÔNG BAO GIỜ TÍNH LẠI QUÁ KHỨ TỪ GIÁ HIỆN TẠI.

   AN TOÀN:
   - KHÔNG xoá, KHÔNG sửa dữ liệu đang có. Chỉ thêm cột (NULL được) và một ràng buộc.
   - CHẠY LẠI ĐƯỢC nhiều lần. Dán vào SQL editor của Supabase cloud mà lỡ chạy hai lần thì
     lần sau không báo lỗi, không đổi gì thêm.
   ===================================================================== */

/* ---------- 1. Ảnh chụp giá thành tại thời điểm chốt buổi ---------- */

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS cost_court        bigint,   -- courtNet lúc chốt (đã loại sân bán)
  ADD COLUMN IF NOT EXISTS cost_shuttle_unit bigint,   -- giá bình quân MỘT QUẢ lúc đó
  ADD COLUMN IF NOT EXISTS cost_shuttle      bigint,   -- shuttle_used × cost_shuttle_unit
  ADD COLUMN IF NOT EXISTS cost_total        bigint,   -- cost_court + cost_shuttle
  ADD COLUMN IF NOT EXISTS cost_guest_rev    bigint,   -- thu khách chốt tại buổi
  ADD COLUMN IF NOT EXISTS cost_heads        int,      -- số có mặt + số khách
  ADD COLUMN IF NOT EXISTS cost_frozen_at    date;     -- NULL = chưa đóng băng

COMMENT ON COLUMN sessions.cost_frozen_at IS
  'NULL = chưa đóng băng, đọc số tính live. Có giá trị = ĐỌC cost_*, KHÔNG tính lại. '
  'Kiểu date chứ không phải timestamptz vì client chỉ giữ tới ngày — timestamptz đi qua lớp map '
  'client sẽ lệch múi giờ mỗi vòng đọc-ghi. Đổi sang timestamptz khi nào RPC phía server sở hữu '
  'việc đóng băng (Phase 9 · P6).';

COMMENT ON COLUMN sessions.cost_shuttle_unit IS
  'Lưu riêng là có chủ ý: để sau còn giải thích được con số — "buổi này tính theo 27.500 đ/quả, '
  'giá bình quân lúc đó".';

/* Ba trạng thái của một con số giá thành, đọc bằng hai cờ:
     cost_frozen_at NULL                   → buổi chưa chốt, đang tính live
     cost_frozen_at có · shuttle_est true  → đóng băng TẠM, chờ kiểm kho
     cost_frozen_at có · shuttle_est false → SỐ CHỐT, không đổi nữa                */

/* ---------- 2. Mỗi tháng chỉ một lần kiểm kho ---------- */

/* Kiểm kho chia phần lệch vào các buổi còn cờ ước lượng rồi tắt cờ đó đi. Chạy hai lần trong
   cùng một tháng thì lần hai không còn buổi nào để chia, hoặc tệ hơn là chia chồng lên phần
   đã chia. App đã chặn ở tầng action; đây là chốt chặn cuối ở DB.

   Nếu DB đang có sẵn hai lần kiểm kho cùng một tháng thì khối dưới BÁO LỖI và dừng — đúng như
   mong muốn, đừng tự xoá bớt. Xem lại dữ liệu, giữ lần kiểm đúng, rồi chạy lại:
     SELECT club_id, month, count(*) FROM stock_checks GROUP BY 1,2 HAVING count(*) > 1;      */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_check_month' AND conrelid = 'public.stock_checks'::regclass
  ) THEN
    ALTER TABLE stock_checks ADD CONSTRAINT uq_check_month UNIQUE (club_id, month);
  END IF;
END $$;
