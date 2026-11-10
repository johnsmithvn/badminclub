-- 0080_games_bantau.sql — Bắn tàu: tàu giấu trong game_hands, server tra trúng / trượt (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (cần bảng game_hands + game_move bản 0078 gọi game_<id>_fill). CHỈ THÊM HÀM. Chạy lại được.
--
-- Xếp tàu: máy khách gửi { place: [[5 ô], [4 ô], [3 ô], [3 ô], [2 ô]] } → kiểm hợp lệ, cất 17 ô (nối theo thứ tự tàu)
--   vào game_hands ở ghế người xếp, ghi vào log chỉ { placed: true }. RLS 0078: đối thủ không đọc được tới hết ván.
-- Bắn: { fire: ô } → kiểm đã xếp đủ hai bên, đúng lượt (dựng lại từ log: trúng thì bắn tiếp), chưa bắn ô đó →
--   ghi { fire, hit, sunk? } (sunk = các ô của tàu vừa chìm). Nước sai bị từ chối, không vào log.
-- Kết quả: game_bantau_result — ai bắn trúng đủ 17 ô thì thắng (game_finish 0075 dùng hàm này, bỏ kết quả client).
-- Chép luật lib/games/bantau.js — đổi luật thì sửa cả hai; bantau.test.js gác vài hằng số.

CREATE OR REPLACE FUNCTION public.game_bantau_fleet_ok(p_cells int[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_ships CONSTANT int[] := ARRAY[5, 4, 3, 3, 2];
  v_off  int := 0;
  v_ship int[];
  v_n    int;
  k      int;
BEGIN
  IF p_cells IS NULL OR cardinality(p_cells) <> 17 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_cells) x WHERE x IS NULL OR x < 0 OR x > 99) THEN RETURN false; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_cells) x) <> 17 THEN RETURN false; END IF;
  FOR k IN 1..5 LOOP
    v_n := c_ships[k];
    v_ship := ARRAY(SELECT x FROM unnest(p_cells[v_off + 1 : v_off + v_n]) x ORDER BY x);
    -- Ngang: liền nhau trên một hàng. Dọc: cách nhau đúng 10.
    IF NOT COALESCE((SELECT bool_and(v_ship[g] = v_ship[1] + g - 1 AND v_ship[g] / 10 = v_ship[1] / 10) FROM generate_series(1, v_n) g), false)
       AND NOT COALESCE((SELECT bool_and(v_ship[g] = v_ship[1] + (g - 1) * 10) FROM generate_series(1, v_n) g), false) THEN
      RETURN false;
    END IF;
    v_off := v_off + v_n;
  END LOOP;
  RETURN true;
END;
$$;

-- Ai bắn trúng đủ 17 ô → { winners: [ghế], draw: false }; chưa ai thì NULL (game_finish báo notOver).
CREATE OR REPLACE FUNCTION public.game_bantau_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('winners', jsonb_build_array(seat), 'draw', false)
    FROM game_moves
   WHERE room_id = p_room AND move ? 'fire' AND move -> 'hit' = 'true'::jsonb
   GROUP BY seat
  HAVING count(DISTINCT (move ->> 'fire')::int) >= 17
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.game_bantau_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_ships CONSTANT int[] := ARRAY[5, 4, 3, 3, 2];
  v_cells int[];
  v_foe   int[];
  v_mine  int[];
  v_ship  int[];
  v_cell  int;
  v_turn  int := 0;
  v_off   int := 0;
  m       record;
  k       int;
BEGIN
  IF jsonb_typeof(p_move) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
  IF game_bantau_result(p_room) IS NOT NULL THEN RAISE EXCEPTION 'games.err.over'; END IF;

  /* Xếp tàu */
  IF p_move ? 'place' THEN
    IF EXISTS (SELECT 1 FROM game_hands WHERE room_id = p_room AND seat = p_seat) THEN RAISE EXCEPTION 'games.err.placed'; END IF;
    IF jsonb_typeof(p_move -> 'place') IS DISTINCT FROM 'array' OR jsonb_array_length(p_move -> 'place') <> 5
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_move -> 'place') WITH ORDINALITY s(v, o)
                   WHERE jsonb_typeof(s.v) <> 'array' OR jsonb_array_length(s.v) <> c_ships[s.o])
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_move -> 'place') s(v), jsonb_array_elements(s.v) e(x)
                   WHERE jsonb_typeof(e.x) <> 'number' OR e.x::text !~ '^[0-9]{1,2}$') THEN
      RAISE EXCEPTION 'games.err.badFleet';
    END IF;
    v_cells := ARRAY(SELECT (e.x)::int FROM jsonb_array_elements(p_move -> 'place') WITH ORDINALITY s(v, o),
                            jsonb_array_elements_text(s.v) WITH ORDINALITY e(x, o2) ORDER BY s.o, e.o2);
    IF NOT game_bantau_fleet_ok(v_cells) THEN RAISE EXCEPTION 'games.err.badFleet'; END IF;
    INSERT INTO game_hands (room_id, seat, member_id, club_id, cards)
    SELECT p_room, p_seat, p.member_id, r.club_id, v_cells
      FROM game_room_players p JOIN game_rooms r ON r.id = p.room_id
     WHERE p.room_id = p_room AND p.seat = p_seat AND p.left_at IS NULL;
    RETURN '{"placed": true}'::jsonb;
  END IF;

  /* Bắn */
  IF NOT (p_move ? 'fire') OR jsonb_typeof(p_move -> 'fire') <> 'number' OR (p_move ->> 'fire') !~ '^[0-9]{1,2}$' THEN
    RAISE EXCEPTION 'games.err.badMove';
  END IF;
  v_cell := (p_move ->> 'fire')::int;
  IF (SELECT count(*) FROM game_hands WHERE room_id = p_room AND seat IN (0, 1)) < 2 THEN RAISE EXCEPTION 'games.err.notReady'; END IF;
  -- Lượt dựng lại từ log (log chỉ có nước đúng): ghế 0 bắn trước, trúng thì bắn tiếp, trượt thì đổi.
  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room AND move ? 'fire' ORDER BY seq LOOP
    v_turn := CASE WHEN m.move -> 'hit' = 'true'::jsonb THEN m.seat ELSE 1 - m.seat END;
  END LOOP;
  IF v_turn <> p_seat THEN RAISE EXCEPTION 'games.err.notYourTurn'; END IF;
  IF EXISTS (SELECT 1 FROM game_moves WHERE room_id = p_room AND seat = p_seat AND move ? 'fire' AND (move ->> 'fire')::int = v_cell) THEN
    RAISE EXCEPTION 'games.err.fired';
  END IF;

  SELECT cards INTO v_foe FROM game_hands WHERE room_id = p_room AND seat = 1 - p_seat;
  IF NOT (v_cell = ANY(v_foe)) THEN RETURN jsonb_build_object('fire', v_cell, 'hit', false); END IF;
  v_mine := ARRAY(SELECT (move ->> 'fire')::int FROM game_moves
                   WHERE room_id = p_room AND seat = p_seat AND move ? 'fire' AND move -> 'hit' = 'true'::jsonb) || v_cell;
  FOR k IN 1..5 LOOP
    v_ship := v_foe[v_off + 1 : v_off + c_ships[k]];
    IF v_cell = ANY(v_ship) THEN
      IF v_ship <@ v_mine THEN RETURN jsonb_build_object('fire', v_cell, 'hit', true, 'sunk', to_jsonb(v_ship)); END IF;
      EXIT;
    END IF;
    v_off := v_off + c_ships[k];
  END LOOP;
  RETURN jsonb_build_object('fire', v_cell, 'hit', true);
END;
$$;

REVOKE ALL ON FUNCTION public.game_bantau_fleet_ok(int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_bantau_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_bantau_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
