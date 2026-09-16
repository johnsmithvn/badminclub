-- Migration 0033: Cho phép thành viên tự cập nhật ảnh đại diện (avatar_url) trong club_members.
--
-- CẬP NHẬT:
--   Bổ sung 'avatar_url' vào danh sách các trường được phép tự cập nhật mà không cần quyền 'members',
--   bên cạnh 'name' và 'full_name'. Trình độ, SĐT và vai trò vẫn phải qua phê duyệt của chủ CLB.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_member_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF has_club_perm(NEW.club_id, 'members') THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'name' - 'full_name' - 'avatar_url') IS DISTINCT FROM (to_jsonb(OLD) - 'name' - 'full_name' - 'avatar_url') THEN
    RAISE EXCEPTION 'Bạn chỉ đổi được tên hiển thị, tên đầy đủ và ảnh đại diện của mình. Trình độ, số điện thoại và vai trò phải nhờ chủ CLB duyệt.';
  END IF;
  IF length(coalesce(trim(NEW.name), '')) = 0 THEN
    RAISE EXCEPTION 'Tên hiển thị không được để trống';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
