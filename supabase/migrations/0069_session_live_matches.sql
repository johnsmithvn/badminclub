-- 0069_session_live_matches.sql — Trận NHÁP trên sân, hai người cùng ghi sân thấy nhau.
--
-- Trước đây "Xếp lên sân" chỉ lưu localStorage của từng máy: người thứ hai ghi sân không bao giờ
-- thấy trận người kia vừa xếp, và hai người cùng ghi một trận thì DB ra hai trận.
--
-- Bây giờ:
--   1. Bấm "Xếp lên sân" = một dòng `session_live_matches` (trận nháp). Cả hai máy cùng thấy.
--   2. Ghi tỉ số = trận thật trong `matches` mang `live_id` = id trận nháp, và dòng nháp bị xoá.
--   3. Unique `matches.live_id`: một trận nháp chỉ ra ĐÚNG MỘT trận thật. Người ghi sau (kể cả
--      bấm cùng một giây) bị 23505 → app nạp lại và báo "đã được X ghi". Cùng 4 người đánh lại
--      thì là trận nháp MỚI — không bao giờ bị chặn nhầm.
--
-- Nháp ở bảng RIÊNG, không nằm trong `matches`: bảng trận được Elo, điểm mùa, đếm số trận, chuỗi
-- thắng, huy hiệu, backtest đọc thẳng — một dòng chưa có thắng thua lẫn vào đó là chỗ nào cũng phải
-- nhớ lọc ra. Không đụng Elo / điểm mùa.
--
-- CHỈ THÊM MỚI, chạy lại được bao nhiêu lần cũng được.
-- Kiểm tra sau khi chạy: supabase/manual/0069_session_live_matches_check.sql (tự huỷ, không để lại dữ liệu).

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_live_matches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  session_id     uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  court_index    int  NOT NULL DEFAULT 0,
  court_label    text,
  -- Khoá người chơi: id thành viên HOẶC id khách (cùng namespace như match_players.player_id).
  team_a         text[] NOT NULL DEFAULT '{}',
  team_b         text[] NOT NULL DEFAULT '{}',
  mode           text NOT NULL DEFAULT 'doubles' CHECK (mode IN ('doubles', 'singles')),
  rating_enabled boolean NOT NULL DEFAULT true,
  challenge_id   uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_session_live_matches_session ON public.session_live_matches(session_id);
CREATE INDEX IF NOT EXISTS idx_session_live_matches_club ON public.session_live_matches(club_id);

ALTER TABLE public.session_live_matches ENABLE ROW LEVEL SECURITY;

-- Đọc: cả CLB (hội viên mở màn chia sân để xem cũng thấy sân đang có ai).
DROP POLICY IF EXISTS session_live_matches_select ON public.session_live_matches;
CREATE POLICY session_live_matches_select ON public.session_live_matches
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

-- Ghi: cờ `assign`, đúng như `matches`. INSERT và UPDATE cùng điều kiện vì đồng bộ ghi bằng upsert.
-- Buổi phải thuộc chính CLB đó — không cho gắn trận nháp sang buổi CLB khác.
DROP POLICY IF EXISTS session_live_matches_ins ON public.session_live_matches;
CREATE POLICY session_live_matches_ins ON public.session_live_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    has_club_perm(club_id, 'assign')
    AND EXISTS (SELECT 1 FROM public.sessions s
                WHERE s.id = session_live_matches.session_id AND s.club_id = session_live_matches.club_id)
  );

DROP POLICY IF EXISTS session_live_matches_upd ON public.session_live_matches;
CREATE POLICY session_live_matches_upd ON public.session_live_matches
  FOR UPDATE TO authenticated
  USING (has_club_perm(club_id, 'assign'))
  WITH CHECK (
    has_club_perm(club_id, 'assign')
    AND EXISTS (SELECT 1 FROM public.sessions s
                WHERE s.id = session_live_matches.session_id AND s.club_id = session_live_matches.club_id)
  );

DROP POLICY IF EXISTS session_live_matches_del ON public.session_live_matches;
CREATE POLICY session_live_matches_del ON public.session_live_matches
  FOR DELETE TO authenticated
  USING (has_club_perm(club_id, 'assign'));

-- Trận thật ghi từ trận nháp nào. Không khoá ngoại: dòng nháp bị xoá ngay khi ghi xong.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS live_id uuid;

COMMENT ON COLUMN public.matches.live_id IS
  'Id trận nháp (session_live_matches) mà trận này được ghi từ đó. Unique: một trận nháp chỉ ra một trận thật — hai máy cùng ghi thì máy sau bị chặn.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_live_id
  ON public.matches (live_id)
  WHERE live_id IS NOT NULL;

COMMIT;
