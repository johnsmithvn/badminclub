-- Migration 0026: Bổ sung avatar và thông tin tài khoản ngân hàng vào RPC club_pending_requests.
--
-- VẤN ĐỀ:
-- Migration 0015 đã thêm `avatar_url`, `qr_url`, `bank_holder`, `bank_no`, `bank_name`, `bank_accounts`
-- vào `profiles` và cho phép `approve_join_request` chép các trường này sang `club_members`.
-- Tuy nhiên RPC `club_pending_requests` chưa được cập nhật danh sách cột trả về, khiến chủ CLB
-- khi duyệt không nhận được avatar và thông tin ngân hàng của người xin vào, bảng ghép báo
-- "Hồ sơ tài khoản để trống" và không thể tick chọn để đồng bộ sang bản ghi thành viên.

BEGIN;

DROP FUNCTION IF EXISTS public.club_pending_requests(uuid);

CREATE OR REPLACE FUNCTION public.club_pending_requests(p_club uuid)
RETURNS TABLE (
  id uuid, user_id uuid, note text, created_at timestamptz,
  name text, nick text, phone text, email text, gender gender, level text,
  avatar_url text, qr_url text, bank_holder text, bank_no text, bank_name text, bank_accounts jsonb
)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.user_id, r.note, r.created_at,
         p.name, p.nick, p.phone, p.email::text, p.gender, p.level,
         p.avatar_url, p.qr_url, p.bank_holder, p.bank_no, p.bank_name, COALESCE(p.bank_accounts, '[]'::jsonb)
    FROM club_join_requests r JOIN profiles p ON p.id = r.user_id
   WHERE r.club_id = p_club AND r.status = 'pending'
     AND has_club_perm(p_club, 'members')
   ORDER BY r.created_at;
$$;

COMMENT ON FUNCTION public.club_pending_requests(uuid) IS
  'Danh sách yêu cầu vào CLB đang chờ duyệt kèm đầy đủ hồ sơ tài khoản (tên, SĐT, email, trình độ, avatar, ngân hàng/QR) để phục vụ duyệt và ghép thành viên.';

GRANT EXECUTE ON FUNCTION public.club_pending_requests(uuid) TO authenticated;

COMMIT;
