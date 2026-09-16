-- 0037_challenge_accepted_players.sql
-- Thêm cột accepted_players để lưu danh sách các đấu thủ đã đồng ý nhận kèo đấu.
-- Kèo đơn (1v1) cần 2 người, kèo đôi (2v2) cần 4 người đồng ý mới chuyển sang status = 'accepted'.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS accepted_players uuid[] NOT NULL DEFAULT '{}';

-- Cập nhật dữ liệu cũ: với những kèo đã accepted, oncourt hoặc played,
-- xem như tất cả các thành viên trong kèo đã đồng ý để giữ tính toàn vẹn dữ liệu lịch sử.
UPDATE public.challenges c
SET accepted_players = ARRAY(
  SELECT cp.member_id
  FROM public.challenge_players cp
  WHERE cp.challenge_id = c.id
)
WHERE c.status IN ('accepted', 'oncourt', 'played')
  AND c.accepted_players = '{}';

-- Cập nhật RLS policies: cho phép thành viên CLB tham gia nhận kèo mở và cập nhật trạng thái kèo khi đang pending
DROP POLICY IF EXISTS challenges_upd ON public.challenges;
CREATE POLICY challenges_upd ON public.challenges
  FOR UPDATE TO authenticated
  USING (
    has_club_perm(club_id, 'assign')
    OR created_by IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = challenges.club_id
    )
    OR is_club_member(club_id)
  )
  WITH CHECK (
    has_club_perm(club_id, 'assign')
    OR created_by IN (
      SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = challenges.club_id
    )
    OR is_club_member(club_id)
  );

DROP POLICY IF EXISTS challenge_players_ins ON public.challenge_players;
CREATE POLICY challenge_players_ins ON public.challenge_players
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
      OR is_club_member(c.club_id)
    )
  ));
