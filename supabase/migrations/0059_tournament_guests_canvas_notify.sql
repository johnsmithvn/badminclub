-- 0059_tournament_guests_canvas_notify.sql — Module Giải đấu, Phase 6 (docs/TOURNAMENT_PLAN.md §7)
--
-- 1. tournament_guests: người ngoài CLB thi giải — danh sách RIÊNG của CLB (không lẫn vào `guests` khách giao lưu).
--    Trong tournament_registrations: player_type = 'guest' ⇒ player_id trỏ tournament_guests.id
--    (enum player_kind giữ nguyên 2 giá trị; bảng giải không nối sang `matches` — D1 — nên không ai khác đọc
--    player_type của bảng này). Trigger kiểm người có thật và cùng CLB, thay cho FK (player_id trỏ 2 bảng).
-- 2. tournament_stages.canvas_x / canvas_y: toạ độ khối trên canvas sơ đồ (plan §2.1 "Phase 6 thêm bằng ADD COLUMN").
-- 3. Chuông thông báo "trận của bạn sắp tới lượt" (chỉ trong app, không push): trigger trên tournament_matches.
--
-- Không đụng Elo / điểm mùa (D1) → không cần backtest. Không đụng transactions (D2: tiền vẫn tượng trưng).

BEGIN;

/* 1. Khách ngoài CLB ======================================================= */

CREATE TABLE IF NOT EXISTS public.tournament_guests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (btrim(name) <> ''),
  gender      public.gender NOT NULL,
  level       text,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS ix_tournament_guests_club ON public.tournament_guests (club_id);

ALTER TABLE public.tournament_guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tournament_guests_read ON public.tournament_guests;
CREATE POLICY tournament_guests_read ON public.tournament_guests
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));
DROP POLICY IF EXISTS tournament_guests_write ON public.tournament_guests;
CREATE POLICY tournament_guests_write ON public.tournament_guests
  FOR ALL TO authenticated
  USING (public.has_club_perm(club_id, 'sessions')) WITH CHECK (public.has_club_perm(club_id, 'sessions'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_guests TO authenticated;

-- Người đăng ký phải có thật và cùng CLB với giải: thành viên → club_members, khách → tournament_guests.
CREATE OR REPLACE FUNCTION public.tournament_registration_player_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.player_type = 'member' THEN
    IF NOT EXISTS (SELECT 1 FROM club_members WHERE id = NEW.player_id AND club_id = NEW.club_id) THEN
      RAISE EXCEPTION 'tournament.err.playerNotFound';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM tournament_guests WHERE id = NEW.player_id AND club_id = NEW.club_id) THEN
    RAISE EXCEPTION 'tournament.err.playerNotFound';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_registration_player ON public.tournament_registrations;
CREATE TRIGGER trg_tournament_registration_player
  BEFORE INSERT OR UPDATE OF player_type, player_id, club_id ON public.tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION public.tournament_registration_player_check();

/* 2. Toạ độ canvas ========================================================= */

ALTER TABLE public.tournament_stages
  ADD COLUMN IF NOT EXISTS canvas_x int,
  ADD COLUMN IF NOT EXISTS canvas_y int;

/* 3. Chuông "sắp tới lượt" ================================================= */
-- Gửi cho THÀNH VIÊN của 2 đội (khách ngoài không có tài khoản → bỏ qua) khi:
--   · trận vừa đủ 2 đội: pending → ready (không tính undo done → ready, không tính lúc sinh lịch — sinh lịch
--     mà báo cả loạt trận vòng 1 cùng lúc là nhiễu);
--   · trận chưa đánh vừa được xếp sân (court_label đổi sang giá trị khác rỗng).
-- SECURITY DEFINER: người ghi kết quả không có quyền INSERT notifications của người khác.

CREATE OR REPLACE FUNCTION public.tournament_notify_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_kind text;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'ready' THEN
    v_type := 'tournament_match_ready';
  ELSIF NEW.status = 'ready' AND coalesce(NEW.court_label, '') <> ''
        AND NEW.court_label IS DISTINCT FROM OLD.court_label THEN
    v_type := 'tournament_match_court';
  ELSE
    RETURN NEW;
  END IF;

  SELECT kind INTO v_kind FROM tournament_events WHERE id = NEW.event_id;

  INSERT INTO notifications (club_id, member_id, type, payload, ref_type, ref_id)
  SELECT NEW.club_id, r.player_id, v_type,
         jsonb_build_object('tournamentId', NEW.tournament_id, 'eventId', NEW.event_id, 'kind', v_kind,
                            'court', NEW.court_label, 'matchId', NEW.id),
         'tournament', NEW.tournament_id
    FROM tournament_team_players tp
    JOIN tournament_registrations r ON r.id = tp.registration_id
   WHERE tp.team_id IN (NEW.team_a_id, NEW.team_b_id)
     AND r.player_type = 'member'
     AND r.status = 'registered';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tournament_notify_match() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tournament_notify_match ON public.tournament_matches;
CREATE TRIGGER trg_tournament_notify_match
  AFTER UPDATE OF status, court_label ON public.tournament_matches
  FOR EACH ROW EXECUTE FUNCTION public.tournament_notify_match();

COMMIT;
