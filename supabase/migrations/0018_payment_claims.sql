-- Migration 0018: thành viên tự khai đã chuyển tiền, chủ CLB / thủ quỹ duyệt.
--
-- CỐ Ý KHÔNG có bảng mới. Ba nguồn nợ đã tự giữ cờ `paid` của mình rồi; thêm một bảng claim
-- riêng là dựng pattern thứ tư cho cùng một câu hỏi. Mỗi bảng thêm ĐÚNG MỘT cột:
--
--   paid=false, claimed_at IS NULL      -> còn nợ, thành viên thấy nút Trả
--   paid=false, claimed_at IS NOT NULL  -> đang chờ duyệt, thủ quỹ thấy nút Duyệt
--   paid=true                           -> xong
--
-- TỪ CHỐI = đặt lại claimed_at = NULL, khoản nợ tự hiện lại cho thành viên.
-- DUYỆT = bật `paid` bằng đúng nút tick đang có, KHÔNG xoá claimed_at: giữ lại thì
-- `paid AND claimed_at IS NOT NULL` đọc ra được "khoản này do thành viên tự khai rồi được
-- duyệt", dùng cho thông báo và thống kê sau này. Giữ tốn 0 đồng, xoá là mất hẳn.
--
-- Sổ quỹ KHÔNG cần bút toán mới: ledger() dựng dòng thu thẳng từ paid_at của ba bảng này.

BEGIN;

ALTER TABLE public.monthly_dues       ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE public.member_adjustments ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE public.session_guests     ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

COMMENT ON COLUMN public.monthly_dues.claimed_at IS
  'Lúc thành viên tự khai đã chuyển tiền, chờ duyệt. NULL = chưa khai hoặc bị từ chối.';
COMMENT ON COLUMN public.member_adjustments.claimed_at IS
  'Lúc thành viên tự khai đã chuyển tiền, chờ duyệt. Chỉ áp cho amount > 0 (người nợ quỹ).';
COMMENT ON COLUMN public.session_guests.claimed_at IS
  'Lúc thành viên tự khai đã chuyển tiền, chờ duyệt. Chỉ áp cho dòng thu của THÀNH VIÊN.';

/* -------------------------------------------------------------------------
   RPC: thành viên tự khai.

   VÌ SAO PHẢI LÀ RPC. RLS hiện chỉ cho thành viên thường SELECT ba bảng này; ghi thì đòi
   has_club_perm(money/sessions). Mở policy UPDATE cho thành viên thì phải kèm trigger chặn
   cột `paid` trên cả ba bảng, không thì họ tự tick đã trả -- ba cặp policy+trigger, đắt hơn
   hẳn một hàm. Hàm này chỉ chạm đúng một cột và chỉ trên dòng của CHÍNH NGƯỜI GỌI.
   ------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.claim_payments(p_club uuid, p_items jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE me uuid; n int := 0; k int;
BEGIN
  SELECT id INTO me FROM club_members
   WHERE club_id = p_club AND user_id = auth.uid() AND active
   LIMIT 1;
  IF me IS NULL THEN
    RAISE EXCEPTION 'Tài khoản này không phải thành viên đang hoạt động của CLB';
  END IF;

  -- Quỹ tháng. Không cho khai khi đã đóng đủ.
  UPDATE monthly_dues d SET claimed_at = now()
   WHERE d.club_id = p_club AND d.member_id = me
     AND d.claimed_at IS NULL
     AND COALESCE(d.paid_amount, 0) < d.amount
     AND d.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_items) x
                   WHERE x->>'kind' = 'dues');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Đối chiếu buổi. amount > 0 = NGƯỜI NỢ QUỸ; amount < 0 là quỹ nợ người, chiều ngược lại,
  -- không phải thứ thành viên đi trả.
  UPDATE member_adjustments a SET claimed_at = now()
   WHERE a.club_id = p_club AND a.member_id = me
     AND a.claimed_at IS NULL AND NOT a.paid AND a.amount > 0
     AND a.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_items) x
                   WHERE x->>'kind' = 'adjust');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Buổi đột xuất. session_guests không có club_id, lấy qua sessions như policy của nó.
  UPDATE session_guests g SET claimed_at = now()
    FROM sessions s
   WHERE g.session_id = s.id AND s.club_id = p_club
     AND g.member_id = me
     AND g.claimed_at IS NULL AND NOT g.paid
     AND g.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_items) x
                   WHERE x->>'kind' = 'guest');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  RETURN n;
END $$;

COMMENT ON FUNCTION public.claim_payments(uuid, jsonb) IS
  'Thành viên tự khai đã chuyển tiền cho các khoản của CHÍNH MÌNH. p_items = '
  '[{"kind":"dues|adjust|guest","id":"<uuid>"}]. Chỉ ghi cột claimed_at, không bao giờ chạm '
  '`paid` -- duyệt vẫn là việc của vai có quyền money. Trả về số dòng đã khai được.';

REVOKE ALL  ON FUNCTION public.claim_payments(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payments(uuid, jsonb) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------

   a) Ba cột đã có:
        SELECT table_name FROM information_schema.columns
         WHERE column_name = 'claimed_at' AND table_schema = 'public';
        -- mong đợi: monthly_dues, member_adjustments, session_guests

   b) Hàm có mặt và chỉ một bản:
        SELECT oid::regprocedure FROM pg_proc WHERE proname = 'claim_payments';
        -- mong đợi: claim_payments(uuid,jsonb)

   c) Đăng nhập bằng một tài khoản THÀNH VIÊN THƯỜNG, thử khai khoản của NGƯỜI KHÁC:
        SELECT claim_payments('<club_id>', '[{"kind":"dues","id":"<due cua nguoi khac>"}]');
        -- mong đợi: 0  (không phải lỗi -- chỉ đơn giản không khớp member_id)

   d) Vẫn tài khoản đó, thử tự tick đã trả:
        UPDATE monthly_dues SET paid_amount = amount WHERE id = '<due cua chinh minh>';
        -- mong đợi: 0 dòng (RLS chặn), KHÔNG được thành công
*/
