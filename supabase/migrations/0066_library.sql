-- 0066_library.sql — Thư viện bài tập: bài viết của CLB, nhúng một hoặc vài video YouTube.
--
-- CHỈ THÊM MỚI: 2 bảng library_* và 3 RPC library_*. Không sửa bảng / hàm / dữ liệu có sẵn.
-- Chạy lại được: CREATE … IF NOT EXISTS · CREATE OR REPLACE · DROP POLICY IF EXISTS trước CREATE POLICY.
--
-- Luật (chốt với chủ dự án 2026-10-16):
--   - Ai trong CLB cũng đăng bài được. Tác giả hoặc chủ CLB (cờ 'settings') sửa / ẩn được bài.
--   - Không xoá cứng: ẩn bài = status 'archived'.
--   - Ghim: chỉ chủ CLB, mỗi lúc một bài — RPC library_pin.
--   - Mở bài = 1 lượt xem, mỗi người tính 1 lần, tác giả không tính. Ai cũng thấy tổng số
--     (library_posts.view_count); chỉ chủ CLB đọc được danh sách ai đã xem (library_marks).
--
-- view_count và pinned_at KHÔNG cấp quyền ghi cho client (chỉ RPC SECURITY DEFINER đổi được):
-- client mà ghi được view_count thì lần sửa bài sau sẽ đè số đã nạp từ trước lên lượt xem mới.
-- Mã lỗi RAISE là key i18n `library.err.*`, client dịch bằng t(e.message).

BEGIN;

/* ---------- 1. BẢNG ---------- */

CREATE TABLE IF NOT EXISTS public.library_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  body        text NOT NULL DEFAULT '',
  -- Kệ = tên do người đăng gõ, không có bảng riêng. Là dữ liệu của CLB như tên nhóm, không phải nhãn app.
  shelf       text NOT NULL CHECK (char_length(btrim(shelf)) BETWEEN 1 AND 40),
  -- [{ "url": text, "start": int giây, "end": int giây | null, "notes": [{ "t": int giây, "text": text }] }]
  videos      jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(videos) = 'array'),
  -- "Dặn xem trước buổi" — đợt 2 mới dùng, thêm sẵn để khỏi một migration nữa.
  session_id  uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  view_count  integer NOT NULL DEFAULT 0,
  pinned_at   timestamptz,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_posts_club_idx ON public.library_posts (club_id, created_at DESC);

-- Một dòng = một người với một bài: đã xem lúc nào, có lưu lại không.
CREATE TABLE IF NOT EXISTS public.library_marks (
  post_id    uuid NOT NULL REFERENCES public.library_posts(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  viewed_at  timestamptz,
  saved      boolean NOT NULL DEFAULT false,
  PRIMARY KEY (post_id, member_id)
);

CREATE INDEX IF NOT EXISTS library_marks_member_idx ON public.library_marks (member_id);

/* ---------- 2. QUYỀN ---------- */

ALTER TABLE public.library_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_marks ENABLE ROW LEVEL SECURITY;

-- Supabase mặc định cấp ALL cho anon/authenticated trên bảng mới → thu hồi rồi cấp đúng cột.
REVOKE ALL ON public.library_posts FROM anon, authenticated;
REVOKE ALL ON public.library_marks FROM anon, authenticated;
GRANT SELECT ON public.library_posts TO authenticated;
GRANT INSERT (id, club_id, author_id, title, body, shelf, videos, session_id) ON public.library_posts TO authenticated;
GRANT UPDATE (title, body, shelf, videos, session_id, status) ON public.library_posts TO authenticated;
-- library_marks: client chỉ đọc, mọi lượt ghi đi qua RPC bên dưới.
GRANT SELECT ON public.library_marks TO authenticated;

DROP POLICY IF EXISTS library_posts_read ON public.library_posts;
CREATE POLICY library_posts_read ON public.library_posts
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

DROP POLICY IF EXISTS library_posts_ins ON public.library_posts;
CREATE POLICY library_posts_ins ON public.library_posts
  FOR INSERT TO authenticated
  WITH CHECK (author_id IN (
    SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = library_posts.club_id AND active
  ));

DROP POLICY IF EXISTS library_posts_upd ON public.library_posts;
CREATE POLICY library_posts_upd ON public.library_posts
  FOR UPDATE TO authenticated
  USING (
    has_club_perm(club_id, 'settings')
    OR author_id IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = library_posts.club_id AND active)
  )
  WITH CHECK (
    has_club_perm(club_id, 'settings')
    OR author_id IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = library_posts.club_id AND active)
  );

-- Dòng của chính mình (để biết bài nào mình đã xem / đã lưu), hoặc chủ CLB (danh sách ai đã xem).
DROP POLICY IF EXISTS library_marks_read ON public.library_marks;
CREATE POLICY library_marks_read ON public.library_marks
  FOR SELECT TO authenticated
  USING (
    has_club_perm(club_id, 'settings')
    OR member_id IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = library_marks.club_id)
  );

/* ---------- 3. RPC ---------- */

-- Bài đang hiện + người gọi trong CLB của bài. Không phải thành viên / bài đã ẩn → lỗi.
CREATE OR REPLACE FUNCTION public.library_caller(p_post uuid, OUT o_club uuid, OUT o_member uuid, OUT o_author uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT club_id, author_id INTO o_club, o_author FROM library_posts WHERE id = p_post AND status = 'active';
  IF o_club IS NULL THEN RAISE EXCEPTION 'library.err.notFound'; END IF;
  SELECT id INTO o_member FROM club_members WHERE club_id = o_club AND user_id = auth.uid() AND active LIMIT 1;
  IF o_member IS NULL THEN RAISE EXCEPTION 'library.err.notMember'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.library_caller(uuid) FROM PUBLIC, anon, authenticated;

-- Mở bài → ghi lượt xem. Chỉ lần ĐẦU của mỗi người mới cộng view_count; tác giả không tính.
-- Trả về view_count sau khi ghi.
CREATE OR REPLACE FUNCTION public.library_view(p_post uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_new int;
  v_count int;
BEGIN
  SELECT * INTO c FROM library_caller(p_post);
  IF c.o_member IS NOT DISTINCT FROM c.o_author THEN
    SELECT view_count INTO v_count FROM library_posts WHERE id = p_post;
    RETURN v_count;
  END IF;

  -- Dòng có sẵn vì đã bấm Lưu trước khi xem → vẫn là lần xem đầu.
  INSERT INTO library_marks (post_id, member_id, club_id, viewed_at)
  VALUES (p_post, c.o_member, c.o_club, now())
  ON CONFLICT (post_id, member_id) DO UPDATE SET viewed_at = now()
    WHERE library_marks.viewed_at IS NULL;
  GET DIAGNOSTICS v_new = ROW_COUNT;

  IF v_new > 0 THEN
    UPDATE library_posts SET view_count = view_count + 1 WHERE id = p_post RETURNING view_count INTO v_count;
  ELSE
    SELECT view_count INTO v_count FROM library_posts WHERE id = p_post;
  END IF;
  RETURN v_count;
END;
$$;

-- Lưu / bỏ lưu một bài cho chính mình.
CREATE OR REPLACE FUNCTION public.library_save(p_post uuid, p_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM library_caller(p_post);
  INSERT INTO library_marks (post_id, member_id, club_id, saved)
  VALUES (p_post, c.o_member, c.o_club, COALESCE(p_on, false))
  ON CONFLICT (post_id, member_id) DO UPDATE SET saved = EXCLUDED.saved;
END;
$$;

-- Ghim / gỡ ghim. Chỉ chủ CLB. Ghim bài mới thì gỡ bài đang ghim — mỗi lúc một bài.
CREATE OR REPLACE FUNCTION public.library_pin(p_post uuid, p_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM library_caller(p_post);
  IF NOT has_club_perm(c.o_club, 'settings') THEN RAISE EXCEPTION 'library.err.pinOwnerOnly'; END IF;
  IF COALESCE(p_on, false) THEN
    UPDATE library_posts SET pinned_at = NULL WHERE club_id = c.o_club AND pinned_at IS NOT NULL AND id <> p_post;
    UPDATE library_posts SET pinned_at = now() WHERE id = p_post;
  ELSE
    UPDATE library_posts SET pinned_at = NULL WHERE id = p_post;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.library_view(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.library_save(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.library_pin(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.library_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_save(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_pin(uuid, boolean) TO authenticated;

COMMIT;
