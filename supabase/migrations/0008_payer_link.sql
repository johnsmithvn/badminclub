/* =====================================================================
   0008_payer_link.sql — Người trả là THÀNH VIÊN, không phải chuỗi gõ tay
   TASKS.md Phase 9 · P3.5 (yêu cầu vận hành) · dọn trước một phần cho P5

   Vì sao cần:
   Hoá đơn sân và đợt nhập cầu đang ghi người trả bằng ô text gõ tay. Gõ "Thuý", "Thúy",
   "Thuy" là ba người khác nhau trong báo cáo, và không có cách nào từ khoản chi lần ngược
   về thành viên để biết CLB đang nợ ai.

   Kèm theo, dọn một cái sai sẵn có: lớp map client đang ghi TÊN người trả vào cột
   `shuttle_purchases.funded_by`. Cột đó theo thiết kế là nguồn tiền (`fund` / `member_advance`,
   xem DATABASE.md §8 mục 4). Còn để tên người trong đó thì tới P5 lệnh `ALTER TYPE` sẽ chết.
   Tên cũ KHÔNG bị vứt đi — dồn vào `note` rồi mới xoá khỏi `funded_by`.

   AN TOÀN: chỉ thêm cột và di chuyển dữ liệu, không xoá dòng nào. CHẠY LẠI ĐƯỢC nhiều lần.
   ===================================================================== */

/* ---------- 1. Hoá đơn sân trỏ về thành viên ---------- */

ALTER TABLE court_bills
  ADD COLUMN IF NOT EXISTS payer_member_id uuid REFERENCES club_members(id);

COMMENT ON COLUMN court_bills.payer IS
  'CHỈ còn dùng cho dữ liệu cũ nhập tay. Bản ghi mới dùng payer_member_id.';

/* ---------- 2. Đợt nhập cầu: trả tên về đúng chỗ ---------- */

/* Dồn tên gõ tay vào note. Chỉ đụng dòng nào `funded_by` KHÔNG phải giá trị hợp lệ của nguồn
   tiền — chạy lại lần hai thì không còn dòng nào khớp, nên không nhân đôi ghi chú. */

UPDATE shuttle_purchases
   SET note = coalesce(nullif(trim(note), '') || ' · ', '') || 'Người trả (nhập tay): ' || funded_by,
       funded_by = NULL
 WHERE funded_by IS NOT NULL
   AND btrim(funded_by) <> ''
   AND funded_by NOT IN ('fund', 'member_advance');

COMMENT ON COLUMN shuttle_purchases.funded_by IS
  'Nguồn tiền: fund = quỹ trả · member_advance = thành viên ứng. KHÔNG phải tên người trả — '
  'người trả nằm ở payer_member_id. P5 sẽ đổi cột này sang enum fund_source.';

/* ---------- Kiểm lại sau khi chạy ----------
   Câu dưới phải trả về 0 dòng:

     SELECT id, funded_by FROM shuttle_purchases
      WHERE funded_by IS NOT NULL AND funded_by NOT IN ('fund','member_advance');
                                                                              */
