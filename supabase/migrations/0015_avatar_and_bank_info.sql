-- Migration 0015: Avatar & Thông tin tài khoản ngân hàng / QR chuyển khoản cho CLB, Profile và Thành viên.
--
-- BỐN VIỆC:
--   1. `clubs` có thêm `avatar_url`, `bank_qr_url`, `bank_accounts` (jsonb).
--   2. `profiles` có thêm `avatar_url`, `qr_url`, `bank_accounts` (jsonb), `bank_holder`, `bank_no`, `bank_name`.
--   3. `club_members` có thêm `avatar_url`, `qr_url`, `bank_accounts` (jsonb), `bank_holder`, `bank_no`, `bank_name`.
--   4. Cập nhật `approve_join_request` để khi ghép tài khoản có thể tick chọn chuyển Avatar & Thông tin ngân hàng/QR sang hồ sơ thành viên.

BEGIN;

/* ==================== 1. Thêm cột cho clubs ==================== */
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS bank_qr_url text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clubs.avatar_url IS 'URL ảnh đại diện / logo của CLB';
COMMENT ON COLUMN public.clubs.bank_qr_url IS 'URL ảnh QR nhận tiền quỹ của CLB';
COMMENT ON COLUMN public.clubs.bank_accounts IS 'Danh sách tài khoản ngân hàng và QR của CLB';

/* ==================== 2. Thêm cột cho profiles ==================== */
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS qr_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_holder text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_no text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_name text;

COMMENT ON COLUMN public.profiles.avatar_url IS 'URL ảnh đại diện cá nhân của tài khoản';
COMMENT ON COLUMN public.profiles.qr_url IS 'URL ảnh mã QR nhận tiền cá nhân';
COMMENT ON COLUMN public.profiles.bank_accounts IS 'Danh sách tài khoản ngân hàng của cá nhân';

/* ==================== 3. Thêm cột cho club_members ==================== */
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS qr_url text;
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS bank_accounts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS bank_holder text;
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS bank_no text;
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS bank_name text;

COMMENT ON COLUMN public.club_members.avatar_url IS 'URL ảnh đại diện của thành viên trong CLB';
COMMENT ON COLUMN public.club_members.qr_url IS 'URL ảnh mã QR nhận tiền hoàn của thành viên';
COMMENT ON COLUMN public.club_members.bank_accounts IS 'Danh sách tài khoản ngân hàng của thành viên trong CLB';

/* ==================== 4. Cập nhật approve_join_request ==================== */
CREATE OR REPLACE FUNCTION public.approve_join_request(
  p_request   uuid,
  p_member_id uuid   DEFAULT NULL,
  p_fields    text[] DEFAULT '{}'
)
RETURNS club_members
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE req club_join_requests; u profiles; m club_members; c clubs; f text[];
BEGIN
  SELECT * INTO req FROM club_join_requests WHERE id = p_request AND status = 'pending';
  IF req.id IS NULL THEN RAISE EXCEPTION 'Yêu cầu không tồn tại hoặc đã xử lý'; END IF;
  IF NOT has_club_perm(req.club_id, 'members') THEN RAISE EXCEPTION 'Không có quyền duyệt thành viên'; END IF;

  SELECT * INTO u FROM profiles WHERE id = req.user_id;
  SELECT * INTO c FROM clubs WHERE id = req.club_id;
  IF u.id IS NULL AND p_member_id IS NULL THEN
    RAISE EXCEPTION 'Người xin vào chưa có hồ sơ. Ghép họ vào một bản ghi thành viên có sẵn, hoặc bảo họ đăng nhập lại một lượt.';
  END IF;

  f := COALESCE(p_fields, '{}');

  IF p_member_id IS NOT NULL THEN
    UPDATE club_members SET user_id = NULL
     WHERE club_id = req.club_id AND user_id = req.user_id AND id <> p_member_id;

    UPDATE club_members SET
      user_id       = req.user_id,
      linked_at     = now(),
      name          = CASE WHEN 'name' = ANY (f) AND COALESCE(NULLIF(u.nick, ''), NULLIF(u.name, '')) IS NOT NULL
                           THEN COALESCE(NULLIF(u.nick, ''), u.name) ELSE name END,
      phone         = CASE WHEN 'phone' = ANY (f) AND NULLIF(u.phone, '') IS NOT NULL
                           THEN u.phone ELSE phone END,
      email         = CASE WHEN 'email' = ANY (f) AND u.email IS NOT NULL
                           THEN u.email ELSE email END,
      full_name     = CASE WHEN 'fullName' = ANY (f) AND NULLIF(u.name, '') IS NOT NULL
                           THEN u.name ELSE full_name END,
      gender        = CASE WHEN 'gender' = ANY (f) AND u.gender IS NOT NULL
                           THEN u.gender ELSE gender END,
      level         = CASE WHEN 'level' = ANY (f) AND u.level = ANY (c.levels)
                           THEN u.level ELSE level END,
      avatar_url    = CASE WHEN 'avatarUrl' = ANY (f) AND NULLIF(u.avatar_url, '') IS NOT NULL
                           THEN u.avatar_url ELSE avatar_url END,
      qr_url        = CASE WHEN 'qrUrl' = ANY (f) AND NULLIF(u.qr_url, '') IS NOT NULL
                           THEN u.qr_url ELSE qr_url END,
      bank_holder   = CASE WHEN 'bankHolder' = ANY (f) AND NULLIF(u.bank_holder, '') IS NOT NULL
                           THEN u.bank_holder ELSE bank_holder END,
      bank_no       = CASE WHEN 'bankNo' = ANY (f) AND NULLIF(u.bank_no, '') IS NOT NULL
                           THEN u.bank_no ELSE bank_no END,
      bank_name     = CASE WHEN 'bankName' = ANY (f) AND NULLIF(u.bank_name, '') IS NOT NULL
                           THEN u.bank_name ELSE bank_name END,
      bank_accounts = CASE WHEN 'bankAccounts' = ANY (f) AND u.bank_accounts IS NOT NULL AND jsonb_array_length(u.bank_accounts) > 0
                           THEN COALESCE(club_members.bank_accounts, '[]'::jsonb) || u.bank_accounts
                           ELSE bank_accounts END
     WHERE id = p_member_id AND club_id = req.club_id
    RETURNING * INTO m;

    IF m.id IS NULL THEN RAISE EXCEPTION 'Bản ghi thành viên không thuộc CLB này'; END IF;
  ELSE
    INSERT INTO club_members (
      club_id, user_id, role, name, full_name, phone, email, gender, level,
      avatar_url, qr_url, bank_holder, bank_no, bank_name, bank_accounts, joined_at, linked_at
    )
    VALUES (
      req.club_id, u.id, 'member',
      COALESCE(NULLIF(u.nick, ''), u.name), u.name, u.phone, u.email,
      COALESCE(u.gender, 'nam'),
      CASE WHEN u.level = ANY (c.levels) THEN u.level ELSE c.levels[1] END,
      u.avatar_url, u.qr_url, u.bank_holder, u.bank_no, u.bank_name, COALESCE(u.bank_accounts, '[]'::jsonb),
      CURRENT_DATE, now()
    )
    RETURNING * INTO m;
  END IF;

  UPDATE club_join_requests
     SET status = 'approved', matched_member_id = m.id, reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_request;
  RETURN m;
END;
$$;

COMMIT;
