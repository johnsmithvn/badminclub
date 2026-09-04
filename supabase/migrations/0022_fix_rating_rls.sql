-- 0022_fix_rating_rls.sql
-- Khắc phục các lỗ hổng bảo mật và toàn vẹn dữ liệu từ đợt rà soát:
-- 1. Phục hồi nguyên văn public.is_club_member có SECURITY DEFINER SET search_path = public (S1)
-- 2. Siết chặt Row-Level Security (RLS) cho player_ratings, club_calibration, match_edits (S2)
-- 3. Thu hồi quyền SELECT công khai của anon trên các bảng mới (S3)
-- 4. Bổ sung các cột tỷ số/rating còn thiếu cho matches (B4)
-- 5. Bổ sung ràng buộc UNIQUE (club_id, code) cho challenges (B7)

-- 1. Phục hồi is_club_member đúng nguyên văn 0001_init.sql:769-778
CREATE OR REPLACE FUNCTION public.is_club_member(p_club uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = p_club AND user_id = auth.uid() AND active
  );
$$;

-- 2. Thu hồi quyền anon trên các bảng mới (S3)
REVOKE SELECT ON public.challenges FROM anon;
REVOKE SELECT ON public.player_ratings FROM anon;
REVOKE SELECT ON public.club_calibration FROM anon;

-- 3. Cập nhật RLS Policies (S2)
-- 3a. player_ratings: Chỉ ai có quyền assign mới được ghi (INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS player_ratings_write ON public.player_ratings;
DROP POLICY IF EXISTS player_ratings_select ON public.player_ratings;

CREATE POLICY player_ratings_read ON public.player_ratings
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

CREATE POLICY player_ratings_ins ON public.player_ratings
  FOR INSERT TO authenticated
  WITH CHECK (has_club_perm(club_id, 'assign'));

CREATE POLICY player_ratings_upd ON public.player_ratings
  FOR UPDATE TO authenticated
  USING (has_club_perm(club_id, 'assign'))
  WITH CHECK (has_club_perm(club_id, 'assign'));

CREATE POLICY player_ratings_del ON public.player_ratings
  FOR DELETE TO authenticated
  USING (has_club_perm(club_id, 'assign'));

-- 3b. player_rating_context
DROP POLICY IF EXISTS player_rating_context_write ON public.player_rating_context;
DROP POLICY IF EXISTS player_rating_context_select ON public.player_rating_context;

CREATE POLICY player_rating_context_read ON public.player_rating_context
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

CREATE POLICY player_rating_context_ins ON public.player_rating_context
  FOR INSERT TO authenticated
  WITH CHECK (has_club_perm(club_id, 'assign'));

CREATE POLICY player_rating_context_upd ON public.player_rating_context
  FOR UPDATE TO authenticated
  USING (has_club_perm(club_id, 'assign'))
  WITH CHECK (has_club_perm(club_id, 'assign'));

CREATE POLICY player_rating_context_del ON public.player_rating_context
  FOR DELETE TO authenticated
  USING (has_club_perm(club_id, 'assign'));

-- 3c. club_calibration
DROP POLICY IF EXISTS club_calibration_write ON public.club_calibration;
DROP POLICY IF EXISTS club_calibration_select ON public.club_calibration;

CREATE POLICY club_calibration_read ON public.club_calibration
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

CREATE POLICY club_calibration_ins ON public.club_calibration
  FOR INSERT TO authenticated
  WITH CHECK (has_club_perm(club_id, 'assign'));

CREATE POLICY club_calibration_upd ON public.club_calibration
  FOR UPDATE TO authenticated
  USING (has_club_perm(club_id, 'assign'))
  WITH CHECK (has_club_perm(club_id, 'assign'));

CREATE POLICY club_calibration_del ON public.club_calibration
  FOR DELETE TO authenticated
  USING (has_club_perm(club_id, 'assign'));

-- 3d. match_edits: Ghi audit log yêu cầu quyền assign
DROP POLICY IF EXISTS match_edits_insert ON public.match_edits;
CREATE POLICY match_edits_ins ON public.match_edits
  FOR INSERT TO authenticated
  WITH CHECK (has_club_perm(club_id, 'assign'));

-- 3e. challenges & challenge_players
DROP POLICY IF EXISTS challenges_insert ON public.challenges;
DROP POLICY IF EXISTS challenges_update ON public.challenges;
DROP POLICY IF EXISTS challenges_delete ON public.challenges;

CREATE POLICY challenges_ins ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    has_club_perm(club_id, 'assign')
    OR created_by IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = challenges.club_id
    )
  );

CREATE POLICY challenges_upd ON public.challenges
  FOR UPDATE TO authenticated
  USING (
    has_club_perm(club_id, 'assign')
    OR created_by IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = challenges.club_id
    )
    OR EXISTS (
      SELECT 1 FROM public.challenge_players cp
      JOIN public.club_members cm ON cm.id = cp.member_id
      WHERE cp.challenge_id = challenges.id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_club_perm(club_id, 'assign')
    OR created_by IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = challenges.club_id
    )
    OR EXISTS (
      SELECT 1 FROM public.challenge_players cp
      JOIN public.club_members cm ON cm.id = cp.member_id
      WHERE cp.challenge_id = challenges.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY challenges_del ON public.challenges
  FOR DELETE TO authenticated
  USING (has_club_perm(club_id, 'assign') OR created_by IN (
    SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = challenges.club_id
  ));

DROP POLICY IF EXISTS challenge_players_all ON public.challenge_players;

CREATE POLICY challenge_players_ins ON public.challenge_players
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
    )
  ));

CREATE POLICY challenge_players_upd ON public.challenge_players
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
    )
  ));

CREATE POLICY challenge_players_del ON public.challenge_players
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
    )
  ));

-- 4. Bổ sung các cột thiếu cho matches (B4)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS initial_rating_a numeric,
  ADD COLUMN IF NOT EXISTS initial_rating_b numeric,
  ADD COLUMN IF NOT EXISTS elo_delta integer;

-- 5. Bổ sung ràng buộc UNIQUE (club_id, code) cho challenges (B7)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_challenges_club_code' AND table_name = 'challenges'
  ) THEN
    ALTER TABLE public.challenges
      ADD CONSTRAINT uq_challenges_club_code UNIQUE (club_id, code);
  END IF;
END $$;
