-- 0065_match_videos.sql
-- Một trận có thể có NHIỀU link video — video bị cắt thành nhiều phần (Part 1, Part 2…).
--
-- CHỈ THÊM MỚI, chạy lại được bao nhiêu lần cũng được:
--   1. Cột `matches.videos` jsonb: [{ "url": text, "start": text|null }] theo đúng thứ tự phần.
--   2. Chép link cũ (video_url / video_timestamp) sang làm Part 1 cho trận chưa có danh sách.
--   3. RPC `attach_match_videos` thay cho `attach_match_video` (vẫn GIỮ hàm cũ cho app cũ trong cache).
--
-- Không xoá cột cũ: RPC mới luôn ghi video_url / video_timestamp = Part 1, nên bản app chưa cập nhật
-- vẫn đọc được link đầu tiên.
--
-- Kiểm tra sau khi chạy: supabase/manual/0065_match_videos_check.sql (tự huỷ, không để lại dữ liệu).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS videos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.matches.videos IS
  'Các phần video của trận theo thứ tự (Part 1, Part 2…): [{"url": text, "start": text|null}]. Phần tử đầu luôn trùng video_url / video_timestamp.';

-- Link cũ thành Part 1. Chỉ đụng trận CHƯA có danh sách nên chạy lại không ghi đè gì.
UPDATE public.matches
   SET videos = jsonb_build_array(jsonb_build_object(
         'url', btrim(video_url),
         'start', NULLIF(btrim(COALESCE(video_timestamp, '')), '')
       ))
 WHERE NULLIF(btrim(COALESCE(video_url, '')), '') IS NOT NULL
   AND videos = '[]'::jsonb;

-- Gắn / sửa các phần video của một trận.
-- Luật giữ nguyên như attach_match_video (0035):
--   - Mọi thành viên được gắn thêm phần, đổi link, đổi mốc bắt đầu, sửa ghi chú.
--   - BỚT phần (kể cả gỡ hết) = xoá video → chỉ người có cờ 'assign' (chủ CLB / thủ quỹ).
CREATE OR REPLACE FUNCTION public.attach_match_videos(
  p_match_id uuid,
  p_videos jsonb DEFAULT '[]'::jsonb,
  p_video_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_club_id uuid;
  v_old_videos jsonb;
  v_old_url text;
  v_clean jsonb;
  v_new_count int;
  v_old_count int;
BEGIN
  SELECT m.id, s.club_id, m.videos, m.video_url
    INTO v_match_id, v_club_id, v_old_videos, v_old_url
    FROM public.matches m
    LEFT JOIN public.sessions s ON s.id = m.session_id
   WHERE m.id = p_match_id;

  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy trận đấu';
  END IF;

  -- Chuẩn hoá: bỏ phần có link rỗng, cắt khoảng trắng, mốc rỗng thành null, GIỮ thứ tự.
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'url', btrim(e->>'url'),
               'start', NULLIF(btrim(COALESCE(e->>'start', '')), '')
             ) ORDER BY ord
           ),
           '[]'::jsonb
         )
    INTO v_clean
    FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(p_videos) = 'array' THEN p_videos ELSE '[]'::jsonb END
         ) WITH ORDINALITY AS t(e, ord)
   WHERE NULLIF(btrim(COALESCE(e->>'url', '')), '') IS NOT NULL;

  v_new_count := jsonb_array_length(v_clean);
  v_old_count := CASE
    WHEN jsonb_array_length(COALESCE(v_old_videos, '[]'::jsonb)) > 0 THEN jsonb_array_length(v_old_videos)
    WHEN NULLIF(btrim(COALESCE(v_old_url, '')), '') IS NOT NULL THEN 1
    ELSE 0
  END;

  IF v_new_count < v_old_count AND NOT has_club_perm(v_club_id, 'assign') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên mới có quyền xoá video trận đấu';
  END IF;

  UPDATE public.matches
     SET videos = v_clean,
         video_url = v_clean->0->>'url',
         video_timestamp = v_clean->0->>'start',
         video_note = NULLIF(btrim(COALESCE(p_video_note, '')), '')
   WHERE id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_match_videos(uuid, jsonb, text) TO authenticated, anon;

COMMENT ON FUNCTION public.attach_match_videos IS
  'Gắn / sửa các phần video (Part 1, Part 2…) của trận; bớt phần = xoá, chỉ quản trị viên. Giữ video_url/video_timestamp = Part 1.';
