-- 0110_games_season_points.sql — Cược ĐIỂM MÙA trong mini-game (chủ dự án duyệt 2026-11-16, docs/GAMES.md §4c).
--
-- Điểm mùa CHUYỂN giữa người chơi, không sinh ra: mỗi người bỏ `options.sp` điểm (1..20) vào hũ, người thua mất đúng
-- mức đó, người thắng chia đều hũ (chia nguyên, lẻ bỏ — điểm chỉ có thể mất bớt, không bao giờ sinh thêm). Hoà / không
-- ai thắng / không ai thua / ván bỏ (abandoned) → không ai mất gì.
--
-- THÊM: bảng sổ `game_season_points` (mỗi người mỗi phòng một dòng, máy khách chỉ đọc) · `game_sp(options)` ·
-- 2 trigger trên game_rooms. KHÔNG sửa RPC game_* nào, KHÔNG đụng ví xu (0093 / 0101).
--
-- Điểm mùa là số DẪN XUẤT (src/lib/season.js tính lại từ trận), server KHÔNG biết số dư → không chặn được người cược
-- quá số đang có. Chặn số dư nằm ở máy khách (gameActions), y như cược kèo cầu lông (0047). Server chỉ giữ: trần 20,
-- đúng danh sách game, không cược xu và điểm mùa cùng lúc.
--
-- ponytail: Cờ vua / Cờ tướng / Cờ úp chưa có bản chấm server — kết quả do máy khách báo, người biết lập trình gọi
-- thẳng game_finish bịa người thắng được. Chủ dự án chấp nhận (CLB người quen). Bịt sau: chỉ nhận kết quả 3 game này
-- khi người báo KHÔNG nằm trong danh sách thắng (docs/TASKS.md).
--
-- Danh sách game + số 20 PHẢI khớp src/lib/games/registry.js (SP_GAMES, SP_MAX) — season_points.test.js gác.
-- Chạy lại được: CREATE … IF NOT EXISTS · CREATE OR REPLACE · DROP … IF EXISTS. Chạy sau 0109.

BEGIN;

/* ---------- 1. Bảng sổ ---------- */

CREATE TABLE IF NOT EXISTS public.game_season_points (
  room_id    uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  game       text NOT NULL,
  delta      int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, member_id)
);
CREATE INDEX IF NOT EXISTS game_season_points_club_idx ON public.game_season_points (club_id);

ALTER TABLE public.game_season_points ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_season_points FROM anon, authenticated;
GRANT SELECT ON public.game_season_points TO authenticated;
DROP POLICY IF EXISTS game_season_points_read ON public.game_season_points;
CREATE POLICY game_season_points_read ON public.game_season_points FOR SELECT TO authenticated USING (is_club_member(club_id));

/* ---------- 2. Mức cược điểm mùa của phòng: số nguyên 1..20, khác → 0 ---------- */

CREATE OR REPLACE FUNCTION public.game_sp(p_options jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN jsonb_typeof(p_options -> 'sp') = 'number'
               AND (p_options ->> 'sp')::numeric = trunc((p_options ->> 'sp')::numeric)
               AND (p_options ->> 'sp')::numeric BETWEEN 1 AND 20
              THEN (p_options ->> 'sp')::int ELSE 0 END
$$;

/* ---------- 3. Chặn lúc tạo phòng / sửa luật ---------- */

CREATE OR REPLACE FUNCTION public.game_rooms_sp_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.options ? 'sp' AND NEW.options -> 'sp' <> '0'::jsonb AND (
    game_sp(NEW.options) = 0
    OR game_stake(NEW.options) > 0
    OR NEW.game NOT IN ('caro', 'oanquan', 'coganh', 'colat', 'chamo', 'covay', 'bantau', 'noitu', 'baibip',
                        'tienlen', 'phom', 'covua', 'cotuong', 'coup')
  ) THEN
    RAISE EXCEPTION 'games.err.badOptions';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS game_rooms_sp_guard ON public.game_rooms;
CREATE TRIGGER game_rooms_sp_guard BEFORE INSERT OR UPDATE OF options ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.game_rooms_sp_guard();

/* ---------- 4. Hết ván → chuyển điểm (một lần: PK chặn trùng) ---------- */

CREATE OR REPLACE FUNCTION public.game_sp_settle(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        game_rooms;
  v_sp     int;
  v_wins   int[];
  v_nwin   int;
  v_nlose  int;
  v_share  int;
BEGIN
  SELECT * INTO r FROM game_rooms WHERE id = p_room;
  v_sp := game_sp(r.options);
  IF r.id IS NULL OR v_sp = 0 OR r.status <> 'finished' OR r.started_at IS NULL THEN RETURN; END IF;
  IF COALESCE(r.result ->> 'draw', 'false') = 'true' OR jsonb_typeof(r.result -> 'winners') IS DISTINCT FROM 'array' THEN RETURN; END IF;

  -- Kết quả Cờ vua / Cờ tướng / Cờ úp do máy khách gửi: đọc phòng thủ, phần tử không phải số ghế thì bỏ.
  SELECT array_agg(DISTINCT x::int) INTO v_wins
    FROM jsonb_array_elements_text(r.result -> 'winners') AS x
   WHERE x ~ '^[0-9]{1,3}$';

  -- Người của ván như game_board (0091) / ví xu: còn ngồi hoặc rời SAU khi ván bắt đầu (người bỏ giữa ván thua cược).
  SELECT count(*) FILTER (WHERE gp.seat = ANY (COALESCE(v_wins, '{}'))),
         count(*) FILTER (WHERE NOT gp.seat = ANY (COALESCE(v_wins, '{}')))
    INTO v_nwin, v_nlose
    FROM game_room_players gp
   WHERE gp.room_id = p_room AND (gp.left_at IS NULL OR gp.left_at >= r.started_at);
  IF v_nwin = 0 OR v_nlose = 0 THEN RETURN; END IF;

  v_share := (v_sp * v_nlose) / v_nwin;
  INSERT INTO game_season_points (room_id, member_id, club_id, game, delta)
  SELECT p_room, gp.member_id, r.club_id, r.game,
         CASE WHEN gp.seat = ANY (v_wins) THEN v_share ELSE -v_sp END
    FROM game_room_players gp
   WHERE gp.room_id = p_room AND (gp.left_at IS NULL OR gp.left_at >= r.started_at)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_rooms_sp_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'playing' AND NEW.status = 'finished' THEN
    PERFORM game_sp_settle(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS game_rooms_sp_settle ON public.game_rooms;
CREATE TRIGGER game_rooms_sp_settle AFTER UPDATE OF status ON public.game_rooms
  FOR EACH ROW EXECUTE FUNCTION public.game_rooms_sp_settle();

REVOKE ALL ON FUNCTION public.game_sp_settle(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_rooms_sp_settle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_rooms_sp_guard() FROM PUBLIC, anon, authenticated;

COMMIT;
