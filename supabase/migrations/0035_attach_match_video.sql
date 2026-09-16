-- 0035_attach_match_video.sql
-- Hàm RPC cho phép gắn hoặc sửa link video trận đấu an toàn.
-- Quy tắc:
-- 1. Mọi thành viên trong CLB đều có thể gắn video mới hoặc sửa mốc thời gian / ghi chú.
-- 2. Chỉ Quản trị viên (Owner / Treasurer có quyền 'assign') mới được quyền XOÁ / GỠ video.

CREATE OR REPLACE FUNCTION public.attach_match_video(
  p_match_id uuid,
  p_video_url text DEFAULT NULL,
  p_video_timestamp text DEFAULT NULL,
  p_video_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_club_id uuid;
  v_new_url text := NULLIF(TRIM(p_video_url), '');
  v_new_ts text := NULLIF(TRIM(p_video_timestamp), '');
  v_new_note text := NULLIF(TRIM(p_video_note), '');
BEGIN
  -- Lấy thông tin trận đấu và CLB tương ứng
  SELECT m.*, s.club_id INTO v_match
  FROM public.matches m
  LEFT JOIN public.sessions s ON s.id = m.session_id
  WHERE m.id = p_match_id;

  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy trận đấu';
  END IF;

  v_club_id := v_match.club_id;

  -- Nếu hành động là XOÁ / GỠ video (v_new_url rỗng mà trận trước đó đang có video)
  IF v_new_url IS NULL AND v_match.video_url IS NOT NULL THEN
    IF NOT has_club_perm(v_club_id, 'assign') THEN
      RAISE EXCEPTION 'Chỉ quản trị viên mới có quyền xoá video trận đấu';
    END IF;
  END IF;

  -- Cập nhật thông tin video của trận đấu
  UPDATE public.matches
  SET
    video_url = v_new_url,
    video_timestamp = v_new_ts,
    video_note = v_new_note
  WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_match_video(uuid, text, text, text) TO authenticated, anon;

COMMENT ON FUNCTION public.attach_match_video IS 'Gắn / sửa video cho trận đấu; chỉ quản trị viên mới được xoá video';
