/* =====================================================================
   0010_unit_override.sql — Đơn giá MỘT BUỔI do CLB tự đặt
   TASKS.md Phase 9 · P4.6

   Vì sao cần:
   Hôm nay đơn giá một buổi luôn được suy ra: `quỹ tháng người đó đóng ÷ số buổi của nhóm`.
   Nhiều CLB không chia kiểu đó — họ chốt thẳng "một buổi tính 60.000", không quan tâm tháng
   có 4 hay 5 buổi. Khi ấy con số app tự chia sẽ lệch với con số CLB thực sự dùng để trả lại
   người nghỉ và thu người đi lẻ.

   Điền số vào đây thì đối chiếu buổi ưu tiên dùng nó. Để trống (NULL hoặc 0) thì app tự chia
   như cũ — không đổi hành vi của CLB nào đang chạy ổn.

   Tách nam / nữ cho khớp `fee_male` / `fee_female` đang có: CLB nào thu quỹ khác nhau theo giới
   thì đơn giá buổi cũng thường khác nhau. Muốn dùng chung một giá thì điền hai ô giống nhau.

   AN TOÀN: chỉ thêm cột NULL được, không đụng dữ liệu. CHẠY LẠI ĐƯỢC nhiều lần.
   ===================================================================== */

ALTER TABLE member_groups
  ADD COLUMN IF NOT EXISTS unit_male   bigint,
  ADD COLUMN IF NOT EXISTS unit_female bigint;

COMMENT ON COLUMN member_groups.unit_male IS
  'Đơn giá MỘT BUỔI cho nam do CLB tự đặt. NULL/0 = để app tự chia (quỹ tháng ÷ số buổi). '
  'Chỉ dùng cho ĐỐI CHIẾU (trả lại người nghỉ, thu người đi lẻ) — quỹ tháng vẫn thu trọn gói '
  'theo fee_male.';

COMMENT ON COLUMN member_groups.unit_female IS
  'Như unit_male, cho nữ.';
