-- 0112_games_next.sql — "Ván tiếp" một bước (chủ dự án duyệt 2026-11-17, docs/GAMES.md §7c).
--
-- game_next(p_from, p_max): người của ván vừa xong gọi để sang ván sau cùng bàn.
--   - Ván sau chưa có (next_room NULL) → tạo phòng mới cùng game / luật / riêng tư (game_create, người gọi là chủ phòng).
--   - Đã có → vào ghế phòng đó (game_join) và bật Sẵn sàng luôn — không phải bấm thêm.
-- Khoá phòng cũ FOR UPDATE nên nhiều người bấm cùng lúc vẫn chỉ ra MỘT phòng (người sau chờ khoá rồi thấy next_room).
-- Mọi luật cũ vẫn chạy qua game_create / game_join + trigger: mức cược, ví xu, một người một phòng (0111), bị mời ra.
-- Chạy lại được: CREATE OR REPLACE. Chạy sau 0111.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_next(p_from uuid, p_max int)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r    game_rooms;
  v_me uuid;
  v_id uuid;
BEGIN
  SELECT * INTO r FROM game_rooms WHERE id = p_from FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'games.err.notFound'; END IF;
  v_me := game_me(r.club_id);
  IF r.status NOT IN ('finished', 'abandoned') THEN RAISE EXCEPTION 'games.err.notOver'; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_from AND member_id = v_me) THEN
    RAISE EXCEPTION 'games.err.notSeated';
  END IF;

  IF r.next_room IS NULL THEN
    RETURN game_create(r.club_id, r.game, r.options, r.private, p_from);
  END IF;

  v_id := r.next_room;
  PERFORM game_join(v_id, p_max);
  UPDATE game_room_players SET ready = true WHERE room_id = v_id AND member_id = v_me AND left_at IS NULL AND NOT ready;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.game_next(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_next(uuid, int) TO authenticated;

COMMIT;
