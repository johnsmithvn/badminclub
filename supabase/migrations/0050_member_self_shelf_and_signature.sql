-- 0050_member_self_shelf_and_signature.sql
-- SỬA LỖI: thành viên thường không gắn được danh hiệu lên kệ, và cũng không đổi được châm ngôn.
--
-- ================================ NGUYÊN NHÂN ================================
--
-- Hai lớp gác trên `club_members` có vai khác nhau:
--   * Policy `cm_update_self_name` (0010) gác DÒNG: `user_id = auth.uid()` — chỉ sửa được dòng
--     của chính mình. Lớp này đúng, không đụng tới.
--   * Trigger `cm_guard_self_update` -> `guard_member_self_update()` gác CỘT: ai không có quyền
--     'members' thì chỉ được đổi đúng mấy cột trong danh sách trắng.
--
-- Danh sách trắng đó hiện là `name`, `full_name`, `avatar_url`. Mà `badge_shelf` và `signature`
-- mới thêm ở 0027 — SAU khi hàm guard ra đời ở 0010, và 0036 chỉ bổ sung `avatar_url` chứ không
-- rà lại các cột mới. Nên thành viên bấm gắn danh hiệu là trigger ném:
--   'Bạn chỉ đổi được tên hiển thị, tên đầy đủ và ảnh đại diện của mình...'
--
-- Cả hai đều là dữ liệu trang trí hồ sơ cá nhân, không dính quyền hạn, tiền hay điểm số — đúng
-- loại thứ chủ tài khoản phải tự sửa được. Trình độ, SĐT và vai trò vẫn phải nhờ chủ CLB duyệt.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF has_club_perm(NEW.club_id, 'members') THEN RETURN NEW; END IF;

  -- Danh sách trắng các cột thành viên tự sửa được trên hồ sơ CỦA CHÍNH MÌNH.
  -- Ai thêm cột trang trí mới vào club_members thì phải ghé lại đây, không thì tính năng đó
  -- im lặng hỏng với mọi tài khoản không phải chủ CLB.
  IF (to_jsonb(NEW) - 'name' - 'full_name' - 'avatar_url' - 'badge_shelf' - 'signature')
     IS DISTINCT FROM
     (to_jsonb(OLD) - 'name' - 'full_name' - 'avatar_url' - 'badge_shelf' - 'signature') THEN
    RAISE EXCEPTION 'Bạn chỉ đổi được tên hiển thị, tên đầy đủ, ảnh đại diện, kệ danh hiệu và châm ngôn của mình. Trình độ, số điện thoại và vai trò phải nhờ chủ CLB duyệt.';
  END IF;

  IF length(coalesce(trim(NEW.name), '')) = 0 THEN
    RAISE EXCEPTION 'Tên hiển thị không được để trống';
  END IF;

  RETURN NEW;
END;
$$;

-- Kệ tối đa 3 huy hiệu. Client đã `slice(0, 3)` nhưng đó là phép lịch sự của giao diện, không
-- phải ràng buộc — gọi thẳng API thì nhét bao nhiêu cũng được.
--
-- NOT VALID: chỉ áp cho lượt ghi từ giờ trở đi, KHÔNG quét lại dữ liệu đang có. Cố ý như vậy để
-- migration không thể fail giữa chừng vì một dòng cũ lỡ có 4 huy hiệu, và cũng không tự ý cắt
-- bớt dữ liệu của ai.
ALTER TABLE public.club_members
  DROP CONSTRAINT IF EXISTS club_members_badge_shelf_max3;

ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_badge_shelf_max3
  CHECK (
    badge_shelf IS NULL
    OR (jsonb_typeof(badge_shelf) = 'array' AND jsonb_array_length(badge_shelf) <= 3)
  ) NOT VALID;

COMMENT ON FUNCTION public.guard_member_self_update() IS
  'Gác CỘT cho club_members: không có quyền members thì chỉ đổi được name, full_name, avatar_url, badge_shelf, signature. Gác DÒNG là việc của policy cm_update_self_name.';

COMMIT;
