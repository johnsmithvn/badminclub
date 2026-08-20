/* =====================================================================
   0009_paid_amount.sql — Ghi được trường hợp ĐÓNG THIẾU
   Đặc tả: docs/DATABASE.md §8 mục 3 · TASKS.md Phase 9 · P4

   Vì sao cần:
   Anh A phải đóng 250.000, đưa trước 150.000. Cột `paid` là boolean nên chỉ có hai lựa chọn,
   cả hai đều sai:

     Tick        → sổ quỹ ghi thu 250.000   → THỪA 100.000
     Không tick  → sổ quỹ ghi thu 0         → THIẾU 150.000

   Đóng trước một phần là chuyện thường ngày của CLB, không phải trường hợp hiếm.

   Sau bản này trạng thái SUY RA từ số tiền, không giữ cờ riêng:
     paid_amount = 0            → chưa đóng
     0 < paid_amount < amount   → đóng thiếu, còn nợ (amount − paid_amount)
     paid_amount >= amount      → đủ

   AN TOÀN:
   - KHÔNG drop cột `paid`. Dữ liệu dính tiền thì không xoá cứng (RULES §4), và giữ lại thì
     báo cáo SQL cũ chưa kịp sửa vẫn chạy. App ghi `paid` như một BẢN SAO suy ra từ
     `paid_amount` để cột đó không nói dối — xem `contexts/dbmap.js`.
   - Backfill từ dữ liệu đang có: ai đang `paid = true` thì coi như đã đóng đủ.
   - CHẠY LẠI ĐƯỢC nhiều lần: câu backfill có điều kiện `paid_amount = 0` nên lần hai không
     đụng vào ai đã được sửa số bằng tay.
   ===================================================================== */

ALTER TABLE monthly_dues
  ADD COLUMN IF NOT EXISTS paid_amount bigint NOT NULL DEFAULT 0;

/* Backfill: đã tick = đã đóng đủ. Chỉ đụng dòng còn nguyên 0 nên chạy lại vô hại. */
UPDATE monthly_dues
   SET paid_amount = amount
 WHERE paid = true AND paid_amount = 0;

COMMENT ON COLUMN monthly_dues.paid_amount IS
  'Số tiền THỰC ĐÃ NHẬN. Trạng thái suy ra từ đây: 0 chưa đóng · < amount đóng thiếu · '
  '>= amount đủ. Đây là nguồn sự thật, không phải cột paid.';

COMMENT ON COLUMN monthly_dues.paid IS
  'DEPRECATED — bản sao suy ra từ (paid_amount >= amount), app ghi lại mỗi lần đồng bộ để cột '
  'này không nói dối. Truy vấn mới đọc paid_amount. Sẽ drop khi chắc không còn báo cáo nào dùng.';

/* ---------- Kiểm lại sau khi chạy ----------
   Câu dưới phải trả về 0 dòng — cột paid và paid_amount không được mâu thuẫn nhau:

     SELECT id, amount, paid, paid_amount FROM monthly_dues
      WHERE paid <> (paid_amount >= amount);
                                                                              */
