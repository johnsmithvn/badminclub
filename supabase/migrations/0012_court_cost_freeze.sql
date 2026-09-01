-- 0012_court_cost_freeze.sql
-- Đóng băng tiền của TỪNG DÒNG SÂN lúc chốt buổi.
--
-- VÌ SAO
-- `money.js: rowCost` = số giờ × `courts.price_per_hour` **hiện tại**. Năm hàm tiền sân
-- (`rowCost` · `courtCost` · `courtBase` · `courtExtraCost` · `courtNet`) đều cộng từ đúng một
-- chỗ đó, nên chủ sân tăng giá là mọi buổi quá khứ đổi số — kể cả buổi đã chốt.
--
-- P2 (`0005_cost_freeze.sql`) đã đóng băng ở tầng BUỔI (`sessions.cost_*`), nhưng `lib/ledger.js`
-- ghi dòng chi tiền sân bằng `courtCost()` / `courtExtraCost()` chứ không đọc `sessions.cost_court`
-- → SỔ QUỸ tháng cũ vẫn nhảy trong khi card giá thành ngay cạnh nó thì không. Cùng một lớp lỗi với
-- L1 (`SessionDetail`) và báo cáo Zalo (`copyZalo`) đã sửa ở hai chỗ khác, sót chỗ này.
--
-- VÌ SAO ĐÓNG BĂNG Ở DÒNG CHỨ KHÔNG THÊM CỘT CHO TỪNG HÀM
-- Thêm `cost_court_gross` + `cost_court_extra` vào `sessions` thì mỗi hàm tiền sân mới lại phải
-- thêm một cột nữa, và ba nguồn số (dòng · buổi · sổ) phải tự khớp nhau. Khoá ở `rowCost` thì cả
-- năm hàm đứng yên cùng lúc, `lib/ledger.js` KHÔNG phải sửa dòng nào.
--
-- NULL = chưa đóng băng → đọc giá sống. Chạy lại được nhiều lần (RULES.md §7, DATABASE.md §6).

ALTER TABLE session_courts ADD COLUMN IF NOT EXISTS cost bigint;

COMMENT ON COLUMN session_courts.cost IS
  'Tiền dòng sân này, đóng băng lúc chốt buổi (money.js: freezeCost). '
  'NULL = buổi chưa chốt, tính live theo courts.price_per_hour.';
