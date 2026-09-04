-- 0021_challenge_and_rating.sql
-- Tích hợp hệ thống Kèo đấu (Challenge), Xếp hạng Elo & Độ tin cậy (Rating Confidence),
-- Lịch sử tỷ số trận đấu và Bảng kiểm toán (Match Edits Audit Log).

-- 1. Bảng challenges (Kèo đấu giữa các thành viên CLB)
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'oncourt', 'played', 'cancelled')),
  court_id uuid REFERENCES public.courts(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  best_of integer NOT NULL DEFAULT 3 CHECK (best_of IN (1, 3, 5)),
  rating_enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  match_id uuid, -- Sẽ được trỏ tới matches sau khi tạo
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_club ON public.challenges(club_id);
CREATE INDEX IF NOT EXISTS idx_challenges_session ON public.challenges(session_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);

-- 2. Bảng challenge_players (Thành viên tham gia kèo - chỉ club_members)
CREATE TABLE IF NOT EXISTS public.challenge_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  team text NOT NULL CHECK (team IN ('A', 'B')),
  CONSTRAINT uq_challenge_member UNIQUE (challenge_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_players_member ON public.challenge_players(member_id);

-- 3. Mở rộng bảng matches để lưu kết quả tỷ số, nguồn trận và cờ xếp hạng
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'session' CHECK (source_type IN ('session', 'challenge')),
  ADD COLUMN IF NOT EXISTS challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rating_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rating_algorithm text NOT NULL DEFAULT 'ELO_V1',
  ADD COLUMN IF NOT EXISTS match_policy text NOT NULL DEFAULT 'official' CHECK (match_policy IN ('official', 'casual')),
  ADD COLUMN IF NOT EXISTS sets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS winner_team text CHECK (winner_team IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS score_text text;

-- Khóa ngoại từ challenges trỏ sang matches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_challenges_match' AND table_name = 'challenges'
  ) THEN
    ALTER TABLE public.challenges
      ADD CONSTRAINT fk_challenges_match FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Bảng match_edits (Kiểm toán chỉnh sửa tỷ số và cascade recalculation)
CREATE TABLE IF NOT EXISTS public.match_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  edited_by uuid REFERENCES public.club_members(id) ON DELETE SET NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  rating_recalc_from_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_match_edits_match ON public.match_edits(match_id);
CREATE INDEX IF NOT EXISTS idx_match_edits_club ON public.match_edits(club_id);

-- 5. Bảng player_ratings (Điểm Elo và độ tin cậy của từng thành viên trong CLB)
CREATE TABLE IF NOT EXISTS public.player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  rating numeric NOT NULL DEFAULT 0,
  games_count integer NOT NULL DEFAULT 0,
  wins_count integer NOT NULL DEFAULT 0,
  losses_count integer NOT NULL DEFAULT 0,
  rating_deviation numeric NOT NULL DEFAULT 350,
  confidence_label text NOT NULL DEFAULT 'low' CHECK (confidence_label IN ('low', 'medium', 'high', 'very_high')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_club_player_rating UNIQUE (club_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_player_ratings_member ON public.player_ratings(member_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_club ON public.player_ratings(club_id);

-- 6. Bảng player_rating_context (Phân tích bối cảnh: vs Nam/Nữ, Đôi/Đơn)
CREATE TABLE IF NOT EXISTS public.player_rating_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  context_type text NOT NULL CHECK (context_type IN ('overall', 'doubles', 'singles', 'vs_male', 'vs_female')),
  games integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  rating_estimate numeric NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0,
  CONSTRAINT uq_club_player_context UNIQUE (club_id, member_id, context_type)
);

CREATE INDEX IF NOT EXISTS idx_player_rating_context_member ON public.player_rating_context(member_id);

-- 7. Bảng club_calibration (Hệ số hiệu chỉnh chéo giới tính học từ dữ liệu đấu của CLB)
CREATE TABLE IF NOT EXISTS public.club_calibration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  calibration_type text NOT NULL DEFAULT 'cross_gender',
  bucket text NOT NULL, -- e.g. '<100', '100-300', '>300'
  sample_size integer NOT NULL DEFAULT 0,
  observed_win_rate numeric NOT NULL DEFAULT 0,
  learned_adjustment numeric NOT NULL DEFAULT 0,
  last_recomputed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_club_calibration UNIQUE (club_id, calibration_type, bucket)
);

CREATE INDEX IF NOT EXISTS idx_club_calibration_club ON public.club_calibration(club_id);

-- 8. Kích hoạt Row-Level Security (RLS) cho tất cả các bảng mới
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_rating_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_calibration ENABLE ROW LEVEL SECURITY;

-- Helper check membership
CREATE OR REPLACE FUNCTION public.is_club_member(p_club uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club AND user_id = auth.uid() AND active = true
  );
$$;

-- RLS Policies cho challenges
DROP POLICY IF EXISTS challenges_select ON public.challenges;
CREATE POLICY challenges_select ON public.challenges
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

DROP POLICY IF EXISTS challenges_insert ON public.challenges;
CREATE POLICY challenges_insert ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (is_club_member(club_id));

DROP POLICY IF EXISTS challenges_update ON public.challenges;
CREATE POLICY challenges_update ON public.challenges
  FOR UPDATE TO authenticated
  USING (is_club_member(club_id))
  WITH CHECK (is_club_member(club_id));

DROP POLICY IF EXISTS challenges_delete ON public.challenges;
CREATE POLICY challenges_delete ON public.challenges
  FOR DELETE TO authenticated
  USING (is_club_member(club_id));

-- RLS Policies cho challenge_players
DROP POLICY IF EXISTS challenge_players_select ON public.challenge_players;
CREATE POLICY challenge_players_select ON public.challenge_players
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND is_club_member(c.club_id)
  ));

DROP POLICY IF EXISTS challenge_players_all ON public.challenge_players;
CREATE POLICY challenge_players_all ON public.challenge_players
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND is_club_member(c.club_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND is_club_member(c.club_id)
  ));

-- RLS Policies cho match_edits
DROP POLICY IF EXISTS match_edits_select ON public.match_edits;
CREATE POLICY match_edits_select ON public.match_edits
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

DROP POLICY IF EXISTS match_edits_insert ON public.match_edits;
CREATE POLICY match_edits_insert ON public.match_edits
  FOR INSERT TO authenticated
  WITH CHECK (is_club_member(club_id));

-- RLS Policies cho player_ratings
DROP POLICY IF EXISTS player_ratings_select ON public.player_ratings;
CREATE POLICY player_ratings_select ON public.player_ratings
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

DROP POLICY IF EXISTS player_ratings_write ON public.player_ratings;
CREATE POLICY player_ratings_write ON public.player_ratings
  FOR ALL TO authenticated
  USING (is_club_member(club_id))
  WITH CHECK (is_club_member(club_id));

-- RLS Policies cho player_rating_context
DROP POLICY IF EXISTS player_rating_context_select ON public.player_rating_context;
CREATE POLICY player_rating_context_select ON public.player_rating_context
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

DROP POLICY IF EXISTS player_rating_context_write ON public.player_rating_context;
CREATE POLICY player_rating_context_write ON public.player_rating_context
  FOR ALL TO authenticated
  USING (is_club_member(club_id))
  WITH CHECK (is_club_member(club_id));

-- RLS Policies cho club_calibration
DROP POLICY IF EXISTS club_calibration_select ON public.club_calibration;
CREATE POLICY club_calibration_select ON public.club_calibration
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

DROP POLICY IF EXISTS club_calibration_write ON public.club_calibration;
CREATE POLICY club_calibration_write ON public.club_calibration
  FOR ALL TO authenticated
  USING (is_club_member(club_id))
  WITH CHECK (is_club_member(club_id));

-- 9. Cấp quyền GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_players TO authenticated;
GRANT SELECT, INSERT ON public.match_edits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_rating_context TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_calibration TO authenticated;

-- Cho phép anon select khi xem công khai nếu cần
GRANT SELECT ON public.challenges TO anon;
GRANT SELECT ON public.player_ratings TO anon;
GRANT SELECT ON public.club_calibration TO anon;
