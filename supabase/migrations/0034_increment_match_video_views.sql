-- 0034_increment_match_video_views.sql
-- Hàm RPC tăng lượt xem video trận đấu một cách an toàn và nguyên tử (atomic increment).
-- Cho phép cả thành viên thường (member) và khách (anon/guest) ghi nhận lượt xem mà không bị chặn bởi RLS của bảng matches.

CREATE OR REPLACE FUNCTION public.increment_match_video_views(
  p_match_id uuid,
  p_viewer_id text DEFAULT 'guest'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := COALESCE(NULLIF(TRIM(p_viewer_id), ''), 'guest');
BEGIN
  UPDATE public.matches
  SET
    video_views = COALESCE(video_views, 0) + 1,
    video_viewers = jsonb_set(
      COALESCE(video_viewers, '{}'::jsonb),
      ARRAY[v_key],
      to_jsonb(COALESCE((video_viewers->>v_key)::int, 0) + 1)
    )
  WHERE id = p_match_id;
END;
$$;

-- Cấp quyền gọi hàm cho người dùng đã đăng nhập (authenticated) và khách (anon)
GRANT EXECUTE ON FUNCTION public.increment_match_video_views(uuid, text) TO authenticated, anon;

COMMENT ON FUNCTION public.increment_match_video_views IS 'Tăng số lượt xem video trận đấu nguyên tử, an toàn trước RLS';
