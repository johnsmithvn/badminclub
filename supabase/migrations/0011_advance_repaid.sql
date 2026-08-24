/* 0011 · Thành viên ứng tiền — Issue 4 của 07-hoi-dap-dong-tien.md, theo LUẬT NGƯỜI GIỮ QUỸ.
 *
 * LUẬT (user chốt 2026-08-24): chỉ tiền đi qua tay chủ CLB (vai owner / treasurer) mới là
 * thu / chi. Thành viên khác bỏ tiền túi ra trả hộ thì QUỸ CHƯA MẤT ĐỒNG NÀO — CLB đang nợ
 * người đó. Khoản chi chỉ vào sổ khi CLB trả lại tiền cho họ.
 *
 * VÌ SAO KHÔNG CÓ BẢNG member_payables (đặc tả Issue 4 đề xuất):
 * khoản nợ CHÍNH LÀ bản ghi mua cầu / hoá đơn sân đã có sẵn, với `payer_member_id` trỏ về người
 * ứng. Chép nó sang bảng thứ hai là lưu cùng một sự thật ở hai chỗ — chỗ để lệch. Thiếu đúng
 * một thứ: ngày CLB trả lại người ta.
 *
 * VÌ SAO KHÔNG `ALTER TYPE funded_by → enum fund_source` (đặc tả cũng đề xuất):
 * "tiền quỹ trả hay thành viên ứng" suy ra được từ `payer_member_id` + vai của người đó. Lưu
 * thêm một cột nói cùng điều đó là tự tạo ra khả năng hai cột chỏi nhau. Cột `funded_by` giữ
 * nguyên, không dùng nữa (0008 đã dọn sạch tên gõ tay khỏi nó).
 *
 * Chạy lại nhiều lần được — xem DATABASE.md §6.
 */

ALTER TABLE shuttle_purchases ADD COLUMN IF NOT EXISTS repaid_at date;
ALTER TABLE court_bills       ADD COLUMN IF NOT EXISTS repaid_at date;

COMMENT ON COLUMN shuttle_purchases.repaid_at IS
  'Ngày CLB trả lại tiền cho người ứng. NULL + người trả không phải owner/treasurer = quỹ đang nợ người đó, khoản chi CHƯA vào sổ. Người trả là owner/treasurer (hoặc để trống) thì cột này không dùng đến: chi vào sổ ngay theo `date`.';

COMMENT ON COLUMN court_bills.repaid_at IS
  'Ngày CLB trả lại tiền cho người ứng — cùng luật với shuttle_purchases.repaid_at.';
