-- 0039_member_self_attendance.sql
-- Cho phép thành viên tự điểm danh (Self Check-in / RSVP) và gửi thông báo tới Chủ CLB

BEGIN;

-- 1. Cập nhật RLS policies cho bảng attendances
-- Cho phép thành viên tự thêm/sửa/xóa dòng điểm danh của chính mình khi buổi tập chưa chốt (status != 'closed')

DROP POLICY IF EXISTS attendances_ins ON public.attendances;
CREATE POLICY attendances_ins ON public.attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    has_club_perm(club_of_session(session_id), 'sessions')
    OR (
      member_id IN (
        SELECT id FROM public.club_members
        WHERE user_id = auth.uid() AND club_id = club_of_session(session_id)
      )
      AND EXISTS (
        SELECT 1 FROM public.sessions WHERE id = session_id AND status != 'closed'
      )
    )
  );

DROP POLICY IF EXISTS attendances_upd ON public.attendances;
CREATE POLICY attendances_upd ON public.attendances
  FOR UPDATE TO authenticated
  USING (
    has_club_perm(club_of_session(session_id), 'sessions')
    OR (
      member_id IN (
        SELECT id FROM public.club_members
        WHERE user_id = auth.uid() AND club_id = club_of_session(session_id)
      )
      AND EXISTS (
        SELECT 1 FROM public.sessions WHERE id = session_id AND status != 'closed'
      )
    )
  )
  WITH CHECK (
    has_club_perm(club_of_session(session_id), 'sessions')
    OR (
      member_id IN (
        SELECT id FROM public.club_members
        WHERE user_id = auth.uid() AND club_id = club_of_session(session_id)
      )
      AND EXISTS (
        SELECT 1 FROM public.sessions WHERE id = session_id AND status != 'closed'
      )
    )
  );

DROP POLICY IF EXISTS attendances_del ON public.attendances;
CREATE POLICY attendances_del ON public.attendances
  FOR DELETE TO authenticated
  USING (
    has_club_perm(club_of_session(session_id), 'sessions')
    OR (
      member_id IN (
        SELECT id FROM public.club_members
        WHERE user_id = auth.uid() AND club_id = club_of_session(session_id)
      )
      AND EXISTS (
        SELECT 1 FROM public.sessions WHERE id = session_id AND status != 'closed'
      )
    )
  );

-- 2. Hàm RPC member_self_checkin để hỗ trợ tự điểm danh 1 chạm an toàn
CREATE OR REPLACE FUNCTION public.member_self_checkin(
  p_session_id uuid,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_session_status text;
  v_member_id uuid;
  v_res jsonb;
BEGIN
  -- Kiểm tra đăng nhập
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Kiểm tra buổi tập
  SELECT club_id, status INTO v_club_id, v_session_status
  FROM public.sessions
  WHERE id = p_session_id;

  IF v_club_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session_status = 'closed' THEN
    RAISE EXCEPTION 'Session is closed';
  END IF;

  -- Xác định thành viên trong CLB
  SELECT id INTO v_member_id
  FROM public.club_members
  WHERE user_id = auth.uid() AND club_id = v_club_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this club';
  END IF;

  -- Kiểm tra trạng thái hợp lệ
  IF p_status NOT IN ('present', 'absent', 'extra') THEN
    RAISE EXCEPTION 'Invalid attendance status: %', p_status;
  END IF;

  -- Cập nhật bản ghi điểm danh
  INSERT INTO public.attendances (session_id, member_id, status, marked_at, marked_by)
  VALUES (p_session_id, v_member_id, p_status::attend_state, now(), auth.uid())
  ON CONFLICT (session_id, member_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    marked_at = EXCLUDED.marked_at,
    marked_by = EXCLUDED.marked_by;

  -- Nếu không có mặt thì gỡ khỏi danh sách xếp sân đang chờ (nếu có)
  IF p_status != 'present' THEN
    DELETE FROM public.session_lineups
    WHERE session_id = p_session_id AND player_key = v_member_id::text;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'member_id', v_member_id,
    'status', p_status
  );
END;
$$;

COMMIT;
