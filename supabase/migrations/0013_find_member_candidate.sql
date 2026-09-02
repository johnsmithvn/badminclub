-- Migration 0013: tra cứu MỘT tài khoản theo email để ghép vào bản ghi thành viên.
--
-- VÌ SAO CẦN. `db.users` ở client chỉ gồm (a) người đã ghép vào CLB, (b) người đang xin vào
-- (`storage.js`). Nên chủ CLB không có cách nào ghép một bản ghi thành viên với tài khoản của
-- người chưa gửi yêu cầu — dù biết thừa email của họ. Luồng "bảo họ nhập mã CLB rồi duyệt" vẫn
-- là đường chính, nhưng có lúc người ta đã tạo tài khoản rồi mà không chịu gửi yêu cầu.
--
-- ĐÂY KHÔNG PHẢI BẢN HỒI SINH CỦA `search_users_for_club` (tạo ở 0006, bị 0011 xoá vì chưa ai
-- dùng). Hàm cũ có lỗ riêng tư thật, và bản này bịt cả ba:
--
--   cũ: `p_query = ''` trả về 50 profile ĐẦU TIÊN của toàn app
--   →   bắt buộc có email, rỗng thì không trả dòng nào
--
--   cũ: `ILIKE '%' || q || '%'` trên name/phone/email/username — gõ một chữ cái là quét được
--   →   so BẰNG, chuẩn hoá lower+trim. Phải biết chính xác email mới tra ra
--
--   cũ: trả về phone, email, username, gender, level của người lạ
--   →   chỉ trả id + tên hiển thị, đủ để người bấm xác nhận đúng người trước khi ghép
--
-- Vẫn gác `has_club_perm(p_club, 'members')`: không có quyền quản lý thành viên thì không tra.

BEGIN;

CREATE OR REPLACE FUNCTION public.find_member_candidate(p_club uuid, p_email text)
RETURNS TABLE (id uuid, name text, already_in_club boolean)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(NULLIF(btrim(p.nick), ''), p.name) AS name,
         EXISTS (
           SELECT 1 FROM club_members cm
            WHERE cm.club_id = p_club AND cm.user_id = p.id AND cm.active
         ) AS already_in_club
    FROM profiles p
   WHERE has_club_perm(p_club, 'members')
     AND length(btrim(COALESCE(p_email, ''))) > 0
     AND lower(p.email::text) = lower(btrim(p_email))
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.find_member_candidate(uuid, text) IS
  'Tra MỘT tài khoản theo email CHÍNH XÁC để ghép vào bản ghi thành viên. Chỉ trả id + tên hiển '
  'thị (không trả phone/email/username). Gác bằng has_club_perm(club, ''members''). '
  'Cố ý KHÔNG tìm gần đúng: tìm mờ là mở đường quét danh bạ người dùng.';

REVOKE ALL  ON FUNCTION public.find_member_candidate(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_member_candidate(uuid, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------

   a) Hàm có mặt và chỉ một bản:
        SELECT oid::regprocedure FROM pg_proc WHERE proname = 'find_member_candidate';
        -- mong đợi: find_member_candidate(uuid,text)

   b) Email rỗng KHÔNG được trả gì (đây là lỗ của hàm cũ):
        SELECT count(*) FROM find_member_candidate('<club_id>', '');
        -- mong đợi: 0

   c) Tìm gần đúng KHÔNG ăn:
        SELECT count(*) FROM find_member_candidate('<club_id>', 'a');
        -- mong đợi: 0  (trừ khi thật sự có tài khoản email đúng bằng 'a')
*/
