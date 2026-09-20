-- 0051_member_self_upsert_policy.sql
-- SỬA LỖI: thành viên thường gắn danh hiệu lên kệ bị chặn với
--   new row violates row-level security policy for table "club_members"
--
-- ================================ NGUYÊN NHÂN ================================
--
-- Cùng một cái bẫy với 0049 (`challenges`), ở bảng khác.
--
-- Lớp sync ghi `club_members` bằng UPSERT chứ không phải UPDATE:
--   `dbmap.js` khai `{ table: 'club_members', mode: 'id' }`
--   -> `storage.js` gọi `supabase.upsert(rows, { onConflict: 'id' })`
--   -> Postgres chạy `INSERT ... ON CONFLICT (id) DO UPDATE`
--
-- Câu đó phải lọt qua `WITH CHECK` của policy INSERT trước, rồi mới tới policy UPDATE khi trúng
-- conflict. Mà `cm_write` (0001, chưa ai nới từ đó tới giờ) chỉ có đúng một cửa:
--   `has_club_perm(club_id, 'members')`
-- tức chỉ chủ CLB. Thành viên thường sửa hồ sơ của CHÍNH MÌNH vẫn bị chặn ngay ở cửa này.
--
-- 0010 đã thêm `cm_update_self_name` cho UPDATE và trigger gác cột, nhưng bỏ qua INSERT — nên
-- nửa đường sync vẫn tắc. Đây là chỗ vá nốt.
--
-- ============================ QUAN HỆ VỚI 0050 ==============================
--
-- Hai migration chặn ở hai lớp khác nhau, CẦN CẢ HAI:
--   0051 (file này) — RLS cho phép câu upsert đi qua.
--   0050            — trigger gác cột cho phép `badge_shelf` / `signature` được đổi.
-- Thiếu 0051 thì lỗi là "violates row-level security policy" (tiếng Anh, từ Postgres).
-- Thiếu 0050 thì lỗi là "Bạn chỉ đổi được tên hiển thị..." (tiếng Việt, từ trigger).
--
-- ================================ PHẠM VI NỚI ================================
--
-- CỐ Ý không dùng `user_id = auth.uid()` trần: thế thì ai cũng INSERT được một dòng
-- `club_members` MỚI mang user_id của chính mình vào CLB bất kỳ — tự gia nhập CLB không cần ai
-- duyệt, và tự chọn luôn `role`.
--
-- Nhánh thêm vào hỏi "dòng mang id này đã tồn tại và có phải của tôi không", nên nó chỉ đúng với
-- UPSERT lên dòng sẵn có. INSERT thật (id mới) luôn false, luật kết nạp thành viên giữ nguyên.

BEGIN;

-- Helper SECURITY DEFINER: đọc `club_members` từ trong policy CỦA CHÍNH `club_members` mà không
-- kích hoạt lại RLS của bảng đó (tránh đệ quy). Cùng khuôn với `is_club_member` ở 0022.
CREATE OR REPLACE FUNCTION public.is_my_member_row(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE id = p_id AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_my_member_row(uuid) IS
  'Dòng club_members mang id này đã tồn tại và thuộc về tài khoản đang đăng nhập? Dùng cho WITH CHECK của INSERT để mở đường UPSERT mà không mở đường tự kết nạp.';

REVOKE EXECUTE ON FUNCTION public.is_my_member_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_my_member_row(uuid) TO authenticated;

DROP POLICY IF EXISTS cm_write ON public.club_members;

CREATE POLICY cm_write ON public.club_members
  FOR INSERT
  WITH CHECK (
    has_club_perm(club_id, 'members')
    -- Upsert lên hồ sơ đã có của chính mình. Với INSERT thật thì id chưa tồn tại -> false.
    OR is_my_member_row(id)
  );

COMMENT ON POLICY cm_write ON public.club_members IS
  'Kết nạp thành viên: chỉ người có quyền members. Nhánh is_my_member_row chỉ phục vụ UPSERT lên hồ sơ sẵn có của chính mình (kệ danh hiệu, châm ngôn, avatar) — lúc kết nạp mới nó luôn false.';

COMMIT;
