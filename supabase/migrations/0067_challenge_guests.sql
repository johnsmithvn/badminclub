-- 0067_challenge_guests.sql — Khách giao lưu đánh kèo.
--
-- `challenge_players.member_id` trỏ cứng `club_members`, nên trước đây khách chọn vào kèo bị
-- dbmap lặng lẽ bỏ khi lưu. Khách đi bảng RIÊNG (đúng khuôn `tournament_guests`) thay vì cho
-- `member_id` NULL: lớp đồng bộ ghi `challenge_players` bằng upsert theo (challenge_id, member_id)
-- — dòng NULL không bao giờ khớp ON CONFLICT, mỗi lần đồng bộ lại chèn thêm một dòng trùng.
-- Các policy 0022/0052 và RPC dự đoán (0042/0047/0064) JOIN `challenge_players` → `club_members`
-- cũng giữ nguyên được.
--
-- Không có Elo/điểm mùa gì ở đây: trận của kèo vẫn lưu khách bằng match_players.player_type
-- = 'guest' như trận chia sân, khách đứng yên ở seed, thành viên tính bình thường.
--
-- CHỈ THÊM MỚI, chạy lại được.

BEGIN;

CREATE TABLE IF NOT EXISTS public.challenge_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  team text NOT NULL CHECK (team IN ('A', 'B')),
  CONSTRAINT uq_challenge_guest UNIQUE (challenge_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_guests_guest ON public.challenge_guests(guest_id);

ALTER TABLE public.challenge_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS challenge_guests_select ON public.challenge_guests;
CREATE POLICY challenge_guests_select ON public.challenge_guests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND is_club_member(c.club_id)
  ));

-- Ghi: admin hoặc người tạo kèo — khách chỉ được chọn lúc TẠO kèo, không ai tự ghi tên khách
-- vào kèo mở. INSERT và UPDATE cùng một điều kiện vì đồng bộ ghi bằng upsert (chạm cả hai,
-- xem `__tests__/sync/rls_challenges.test.js`). Khách phải cùng CLB với kèo.
DROP POLICY IF EXISTS challenge_guests_ins ON public.challenge_guests;
CREATE POLICY challenge_guests_ins ON public.challenge_guests
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.challenges c
    JOIN public.guests g ON g.id = guest_id AND g.club_id = c.club_id
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
    )
  ));

DROP POLICY IF EXISTS challenge_guests_upd ON public.challenge_guests;
CREATE POLICY challenge_guests_upd ON public.challenge_guests
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
    JOIN public.guests g ON g.id = guest_id AND g.club_id = c.club_id
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
    )
  ));

DROP POLICY IF EXISTS challenge_guests_del ON public.challenge_guests;
CREATE POLICY challenge_guests_del ON public.challenge_guests
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND (
      has_club_perm(c.club_id, 'assign')
      OR c.created_by IN (SELECT id FROM public.club_members WHERE user_id = auth.uid() AND club_id = c.club_id)
    )
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_guests TO authenticated;

COMMIT;

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------
     SELECT to_regclass('public.challenge_guests');                       -- khác NULL
     SELECT count(*) FROM pg_policies WHERE tablename = 'challenge_guests'; -- 4
*/
