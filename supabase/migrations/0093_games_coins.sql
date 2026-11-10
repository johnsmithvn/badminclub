-- 0093_games_coins.sql — Xu ảo cho mini-game: ví mỗi người, phòng có mức cược, hết ván server tự trả xu.
-- Chủ dự án duyệt 2026-11-09 (docs/GAMES.md §4b). KHÔNG dính tiền thật, KHÔNG đụng Elo / điểm mùa / sổ quỹ cầu lông.
--
-- THÊM: bảng game_coins (sổ xu, mỗi người mỗi phòng một dòng) · game_stake · game_coin_balance · game_wallets ·
-- 3 trigger trên game_rooms / game_room_players. KHÔNG chép lại / sửa RPC game_* nào — mọi luật gắn vào bảng:
--   - Tạo phòng: options.stake chỉ nhận 0 / 10 / 50 / 100; Cờ vua, Cờ tướng, Cá ngựa không được cược (kết quả do máy
--     khách báo — 0075) → 'games.err.badOptions'.
--   - Ngồi ghế (tạo phòng, vào, vào lại) phòng có cược: ví < mức cược → 'games.err.noCoins'. Bắt đầu ván: ai trong
--     phòng đã tụt dưới mức cược (vừa thua phòng khác) → 'games.err.noCoinsSeat'.
--   - Phòng chuyển sang 'finished' (game_finish / game_leave / game_claim — mọi đường) → trả xu một lần (PK chặn trùng):
--       · Phỏm / Tiến lên / Ba cây / Bầu cua / Xì dách có result.scores: xu = điểm × mức cược.
--       · Còn lại (và ván bỏ cuộc không có scores): mỗi người thua mất đúng mức cược, người thắng chia đều phần đó
--         (chia nguyên, lẻ bỏ). Hoà / không ai thắng / không ai thua → không ai mất gì.
--     Người của ván = như game_board (0091): còn ngồi hoặc rời SAU khi ván bắt đầu (người bỏ giữa ván thua cược).
-- Ví = 1000 + tổng sổ, cộng dồn mãi (không làm lại theo tháng). Ván điểm có thể làm ví âm — âm thì không ngồi được
-- phòng có cược nữa, chỉ chơi phòng không cược.
-- Chạy lại được: CREATE … IF NOT EXISTS · CREATE OR REPLACE · DROP … IF EXISTS. Kiểm tay: 0093_games_coins_check.sql.

BEGIN;

/* ---------- 1. Bảng sổ xu ---------- */

CREATE TABLE IF NOT EXISTS public.game_coins (
  room_id    uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  delta      int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, member_id)
);
CREATE INDEX IF NOT EXISTS game_coins_member_idx ON public.game_coins (member_id);
CREATE INDEX IF NOT EXISTS game_coins_club_idx ON public.game_coins (club_id);

ALTER TABLE public.game_coins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_coins FROM anon, authenticated;
GRANT SELECT ON public.game_coins TO authenticated;
DROP POLICY IF EXISTS game_coins_read ON public.game_coins;
CREATE POLICY game_coins_read ON public.game_coins FOR SELECT TO authenticated USING (is_club_member(club_id));

/* ---------- 2. Tiện ích ---------- */

-- Mức cược của phòng: 10 / 50 / 100, khác → 0 (không cược).
CREATE OR REPLACE FUNCTION public.game_stake(p_options jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_options -> 'stake' IN ('10'::jsonb, '50'::jsonb, '100'::jsonb) THEN (p_options ->> 'stake')::int ELSE 0 END
$$;

-- Ví: 1000 xu ban đầu + tổng sổ. Số 1000 phải khớp lib/games/registry.js COIN_START (coins.test.js gác).
CREATE OR REPLACE FUNCTION public.game_coin_balance(p_member uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 1000 + coalesce((SELECT sum(delta) FROM game_coins WHERE member_id = p_member), 0)::int
$$;

-- Ví cả CLB cho BXH xu: chỉ người đã từng chơi phòng có cược. RLS game_coins giới hạn trong CLB của người gọi.
CREATE OR REPLACE FUNCTION public.game_wallets(p_club uuid)
RETURNS TABLE (member_id uuid, balance int, played int, won int, lost int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.member_id, (1000 + sum(c.delta))::int, count(*)::int,
         count(*) FILTER (WHERE c.delta > 0)::int, count(*) FILTER (WHERE c.delta < 0)::int
    FROM game_coins c
   WHERE c.club_id = p_club
   GROUP BY c.member_id
$$;

/* ---------- 3. Chặn ---------- */

-- Tạo phòng: mức cược hợp lệ, game được cược.
CREATE OR REPLACE FUNCTION public.game_rooms_stake_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.options ? 'stake' AND NEW.options -> 'stake' <> '0'::jsonb
     AND (game_stake(NEW.options) = 0 OR NEW.game IN ('covua', 'cotuong', 'cangua', 'coup')) THEN
    RAISE EXCEPTION 'games.err.badOptions';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS game_rooms_stake_guard ON public.game_rooms;
CREATE TRIGGER game_rooms_stake_guard BEFORE INSERT ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.game_rooms_stake_guard();

-- Ngồi ghế phòng có cược: ví phải ≥ mức cược. Bắt cả tạo phòng (ghế chủ phòng), vào, vào lại (left_at về NULL).
CREATE OR REPLACE FUNCTION public.game_players_coin_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stake int;
BEGIN
  IF NEW.left_at IS NULL AND (TG_OP = 'INSERT' OR OLD.left_at IS NOT NULL) THEN
    SELECT game_stake(options) INTO v_stake FROM game_rooms WHERE id = NEW.room_id;
    IF coalesce(v_stake, 0) > 0 AND game_coin_balance(NEW.member_id) < v_stake THEN
      RAISE EXCEPTION 'games.err.noCoins';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS game_players_coin_guard ON public.game_room_players;
CREATE TRIGGER game_players_coin_guard BEFORE INSERT OR UPDATE OF left_at ON public.game_room_players
  FOR EACH ROW EXECUTE FUNCTION public.game_players_coin_guard();

-- Bắt đầu ván: kiểm lại cả phòng (ví có thể tụt vì vừa thua ở phòng khác sau khi vào ghế).
CREATE OR REPLACE FUNCTION public.game_rooms_start_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stake int := game_stake(NEW.options);
BEGIN
  IF OLD.status = 'waiting' AND NEW.status = 'playing' AND v_stake > 0
     AND EXISTS (SELECT 1 FROM game_room_players WHERE room_id = NEW.id AND left_at IS NULL AND game_coin_balance(member_id) < v_stake) THEN
    RAISE EXCEPTION 'games.err.noCoinsSeat';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS game_rooms_start_guard ON public.game_rooms;
CREATE TRIGGER game_rooms_start_guard BEFORE UPDATE OF status ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.game_rooms_start_guard();

/* ---------- 4. Trả xu khi ván xong ---------- */

CREATE OR REPLACE FUNCTION public.game_coins_settle(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       game_rooms;
  v_stake int;
BEGIN
  SELECT * INTO r FROM game_rooms WHERE id = p_room;
  v_stake := game_stake(r.options);
  IF v_stake = 0 OR r.status <> 'finished' OR r.result IS NULL OR r.started_at IS NULL
     OR r.game IN ('covua', 'cotuong', 'cangua', 'coup') THEN
    RETURN;
  END IF;

  -- Game điểm có bảng điểm: xu = điểm × mức cược (bỏ ghế không có điểm dạng số).
  IF r.game IN ('phom', 'tienlen', 'bacay', 'baucua', 'xidach') AND jsonb_typeof(r.result -> 'scores') = 'object' THEN
    INSERT INTO game_coins (room_id, member_id, club_id, delta)
    SELECT p_room, p.member_id, r.club_id, round((r.result -> 'scores' ->> (p.seat::text))::numeric)::int * v_stake
      FROM game_room_players p
     WHERE p.room_id = p_room AND (p.left_at IS NULL OR p.left_at >= r.started_at)
       AND jsonb_typeof(r.result -> 'scores' -> (p.seat::text)) = 'number'
    ON CONFLICT (room_id, member_id) DO NOTHING;
    RETURN;
  END IF;

  -- Thắng / thua: người thua mất mức cược, người thắng chia đều. Hoà thì thôi.
  IF r.result -> 'draw' = 'true'::jsonb THEN RETURN; END IF;
  WITH x AS (
    SELECT p.member_id, coalesce(r.result -> 'winners' @> jsonb_build_array(p.seat), false) AS win
      FROM game_room_players p
     WHERE p.room_id = p_room AND (p.left_at IS NULL OR p.left_at >= r.started_at)
  ), k AS (
    SELECT count(*) FILTER (WHERE win) AS w, count(*) FILTER (WHERE NOT win) AS l FROM x
  )
  INSERT INTO game_coins (room_id, member_id, club_id, delta)
  SELECT p_room, x.member_id, r.club_id, CASE WHEN x.win THEN ((k.l * v_stake) / k.w)::int ELSE -v_stake END
    FROM x CROSS JOIN k
   WHERE k.w > 0 AND k.l > 0
  ON CONFLICT (room_id, member_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_rooms_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished' THEN
    PERFORM game_coins_settle(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS game_rooms_settle ON public.game_rooms;
CREATE TRIGGER game_rooms_settle AFTER UPDATE OF status ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.game_rooms_settle();

/* ---------- 5. Quyền ---------- */

REVOKE ALL ON FUNCTION public.game_coin_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_coins_settle(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_rooms_stake_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_players_coin_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_rooms_start_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_rooms_settle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_wallets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_wallets(uuid) TO authenticated;

COMMIT;
