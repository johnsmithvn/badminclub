-- 0107_games_xo.sql — Cờ X-O 3 × 3 tách khỏi Caro (3 chế độ) · Caro bàn 30 × 30 và luật "đúng 5 quân" (docs/GAMES.md).
--
-- CHẠY SAU 0074, 0075, 0088. Chạy lại được (CREATE OR REPLACE giữ quyền EXECUTE đã cấp; UPDATE dữ liệu chỉ đụng phòng
-- Caro 3 × 3 còn sót). Kiểm trên DB thật: supabase/manual/0107_games_xo_check.sql.
--   1. game_xo_result(room): server tự chấm Cờ X-O (game_finish 0075 tự tìm game_<id>_result, bỏ qua kết quả client
--      báo). Luật y lib/games/xo.js — xo.test.js chấm bằng JS đúng bộ ván mẫu của file kiểm.
--   2. game_caro_result: thêm `exact` (đúng `win` quân; 6 quân liền trở lên không tính). Chép nguyên 0074, chỉ thêm các
--      dòng ghi "0107".
--   3. game_create: Caro nhận cỡ bàn 3..30 (0088: 3..25). Chép nguyên 0088, chỉ đổi dòng ghi "0107".
--   4. DỮ LIỆU: phòng Caro 3 × 3 cũ chuyển sang Cờ X-O chế độ cổ điển (chủ dự án duyệt 2026-11-12 — chưa ai chơi thật).
--      Luật cổ điển chấm y bản Caro 3 × 3 (nước { i }, 3 quân liền thắng, đầy bàn hoà) nên kết quả đã lưu vẫn đúng.
--      Đổi ngược (cả phòng X-O cổ điển tạo sau 0107):
--        UPDATE game_rooms SET game = 'caro', options = (options - 'mode') || '{"size": 3, "win": 3, "blockedEnds": false}'
--         WHERE game = 'xo' AND COALESCE(options ->> 'mode', 'classic') = 'classic';

BEGIN;

/* ---------- 1. Cờ X-O ---------- */

-- Ô 0..8 từ một giá trị jsonb (số nguyên, kể cả dạng 5.0) — khác thì NULL (như `cell` của xo.js: Number.isInteger).
CREATE OR REPLACE FUNCTION public.game_xo_cell(p jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p) IS DISTINCT FROM 'number' THEN NULL
    WHEN (p #>> '{}')::numeric NOT BETWEEN 0 AND 8 OR (p #>> '{}')::numeric <> trunc((p #>> '{}')::numeric) THEN NULL
    ELSE (p #>> '{}')::numeric::int
  END
$$;

CREATE OR REPLACE FUNCTION public.game_xo_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cap    CONSTANT int := 30;  -- lượt mỗi bên tối đa ở chế độ move / vanish (xo.js CAP)
  v_lines  CONSTANT int[] := ARRAY[[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  v_mode   text;
  v_board  smallint[] := array_fill(NULL::smallint, ARRAY[9]);
  v_q0     int[] := '{}';  -- ô quân từng bên, cũ trước
  v_q1     int[] := '{}';
  v_q      int[];
  v_turn   smallint := 0;
  v_ply    int := 0;
  v_winner smallint;
  v_over   boolean := false;
  v_i      int;
  v_from   int;
  v_to     int;
  v_l      int[];
  m        record;
BEGIN
  SELECT CASE WHEN options ->> 'mode' IN ('move', 'vanish') THEN options ->> 'mode' ELSE 'classic' END
    INTO v_mode FROM game_rooms WHERE id = p_room;

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_over OR m.seat IS DISTINCT FROM v_turn OR jsonb_typeof(m.move) IS DISTINCT FROM 'object' THEN CONTINUE; END IF;
    v_q := CASE WHEN v_turn = 0 THEN v_q0 ELSE v_q1 END;

    IF v_mode = 'move' AND cardinality(v_q) >= 3 THEN
      -- Đủ 3 quân: nhấc một quân của mình sang ô trống.
      v_from := game_xo_cell(m.move -> 'from');
      v_to := game_xo_cell(m.move -> 'to');
      IF v_from IS NULL OR v_to IS NULL OR m.move ? 'i' OR v_board[v_from + 1] IS DISTINCT FROM v_turn OR v_board[v_to + 1] IS NOT NULL THEN
        CONTINUE;
      END IF;
      v_board[v_from + 1] := NULL;
      v_board[v_to + 1] := v_turn;
      v_q := array_remove(v_q, v_from) || v_to;
    ELSE
      v_i := game_xo_cell(m.move -> 'i');
      IF v_i IS NULL OR m.move ? 'from' OR v_board[v_i + 1] IS NOT NULL THEN CONTINUE; END IF;
      -- Chế độ vanish: đã có 3 quân thì quân cũ nhất biến mất (xét ô trống TRƯỚC khi nhấc — không đặt đè lên nó được).
      IF v_mode = 'vanish' AND cardinality(v_q) >= 3 THEN
        v_board[v_q[1] + 1] := NULL;
        v_q := v_q[2:];
      END IF;
      v_board[v_i + 1] := v_turn;
      v_q := v_q || v_i;
    END IF;

    IF v_turn = 0 THEN v_q0 := v_q; ELSE v_q1 := v_q; END IF;
    v_ply := v_ply + 1;
    FOREACH v_l SLICE 1 IN ARRAY v_lines LOOP
      IF v_board[v_l[1] + 1] = v_turn AND v_board[v_l[2] + 1] = v_turn AND v_board[v_l[3] + 1] = v_turn THEN
        v_winner := v_turn;
        EXIT;
      END IF;
    END LOOP;
    v_over := v_winner IS NOT NULL OR v_ply >= CASE WHEN v_mode = 'classic' THEN 9 ELSE 2 * c_cap END;
    v_turn := 1 - v_turn;
  END LOOP;

  IF v_winner IS NOT NULL THEN RETURN jsonb_build_object('winners', jsonb_build_array(v_winner), 'draw', false); END IF;
  IF v_over THEN RETURN jsonb_build_object('winners', '[]'::jsonb, 'draw', true); END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.game_xo_cell(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xo_result(uuid) FROM PUBLIC, anon, authenticated;

/* ---------- 2. Caro: đúng `win` quân ---------- */

CREATE OR REPLACE FUNCTION public.game_caro_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opt     jsonb;
  v_size    int;
  v_win     int;
  v_blocked boolean;
  v_exact   boolean;  -- 0107
  v_board   smallint[];
  v_turn    smallint := 0;
  v_n       int := 0;
  v_winner  smallint;
  m         record;
  v_i       int;
  v_r       int;
  v_c       int;
  d         int[];
  v_len     int;
  v_endA    boolean;
  v_endB    boolean;
  y         int;
  x         int;
  k         int;
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_size := COALESCE((v_opt ->> 'size')::int, 15);
  v_win := COALESCE((v_opt ->> 'win')::int, 5);
  v_blocked := COALESCE((v_opt ->> 'blockedEnds')::boolean, false);
  v_exact := COALESCE((v_opt ->> 'exact')::boolean, false);  -- 0107
  v_board := array_fill(NULL::smallint, ARRAY[v_size * v_size]);

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_winner IS NOT NULL OR v_n >= v_size * v_size OR m.seat <> v_turn THEN CONTINUE; END IF;
    IF jsonb_typeof(m.move -> 'i') IS DISTINCT FROM 'number' OR (m.move ->> 'i') !~ '^[0-9]{1,6}$' THEN CONTINUE; END IF;
    v_i := (m.move ->> 'i')::int;
    IF v_i >= v_size * v_size OR v_board[v_i + 1] IS NOT NULL THEN CONTINUE; END IF;

    v_board[v_i + 1] := m.seat;
    v_n := v_n + 1;
    v_turn := 1 - m.seat;
    v_r := v_i / v_size;
    v_c := v_i % v_size;

    FOREACH d SLICE 1 IN ARRAY ARRAY[[0, 1], [1, 0], [1, 1], [1, -1]] LOOP
      v_len := 1;
      -- Hai chiều của một hướng: k = -1 rồi k = 1.
      FOREACH k IN ARRAY ARRAY[-1, 1] LOOP
        y := v_r + k * d[1];
        x := v_c + k * d[2];
        WHILE y >= 0 AND y < v_size AND x >= 0 AND x < v_size AND v_board[y * v_size + x + 1] = m.seat LOOP
          v_len := v_len + 1;
          y := y + k * d[1];
          x := x + k * d[2];
        END LOOP;
        IF k = -1 THEN
          v_endA := y >= 0 AND y < v_size AND x >= 0 AND x < v_size AND v_board[y * v_size + x + 1] IS NOT NULL;
        ELSE
          v_endB := y >= 0 AND y < v_size AND x >= 0 AND x < v_size AND v_board[y * v_size + x + 1] IS NOT NULL;
        END IF;
      END LOOP;
      -- 0107: `exact` — dài hơn `win` quân không tính.
      IF v_len >= v_win AND NOT (v_exact AND v_len > v_win) AND NOT (v_blocked AND v_endA AND v_endB) THEN
        v_winner := m.seat;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  IF v_winner IS NOT NULL THEN RETURN jsonb_build_object('winners', jsonb_build_array(v_winner), 'draw', false); END IF;
  IF v_n >= v_size * v_size THEN RETURN jsonb_build_object('winners', '[]'::jsonb, 'draw', true); END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.game_caro_result(uuid) FROM PUBLIC, anon, authenticated;

/* ---------- 3. game_create: Caro tới 30 × 30 ---------- */

CREATE OR REPLACE FUNCTION public.game_create(p_club uuid, p_game text, p_options jsonb, p_private boolean, p_from uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   uuid := game_me(p_club);
  v_id   uuid;
  v_code text;
BEGIN
  -- Cỡ bàn Caro do server chặn: game_caro_result dựng mảng size×size, để client gửi size tuỳ ý là tự làm nặng DB.
  IF p_game = 'caro' AND NOT (
    -- 0107: tới bàn 30 × 30 (0088: 3..25).
    COALESCE((p_options ->> 'size')::int, 15) BETWEEN 3 AND 30
    AND COALESCE((p_options ->> 'win')::int, 5) BETWEEN 3 AND COALESCE((p_options ->> 'size')::int, 15)
  ) THEN
    RAISE EXCEPTION 'games.err.badOptions';
  END IF;

  -- Bỏ 0/O/1/I để đọc mã qua miệng không nhầm.
  LOOP
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      INTO v_code FROM generate_series(1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM game_rooms WHERE club_id = p_club AND code = v_code);
  END LOOP;

  INSERT INTO game_rooms (club_id, game, code, host_id, private, options)
  VALUES (p_club, p_game, v_code, v_me, COALESCE(p_private, false), COALESCE(p_options, '{}'::jsonb))
  RETURNING id INTO v_id;
  INSERT INTO game_room_players (room_id, member_id, club_id, seat) VALUES (v_id, v_me, p_club, 0);

  IF p_from IS NOT NULL THEN
    UPDATE game_rooms SET next_room = v_id
     WHERE id = p_from AND club_id = p_club AND next_room IS NULL AND status IN ('finished', 'abandoned')
       AND EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_from AND member_id = v_me);
  END IF;
  RETURN v_id;
END;
$$;

/* ---------- 4. Phòng Caro 3 × 3 cũ → Cờ X-O cổ điển ---------- */

UPDATE game_rooms
   SET game = 'xo', options = (options - 'size' - 'win' - 'blockedEnds' - 'exact') || '{"mode": "classic"}'::jsonb
 WHERE game = 'caro' AND options ->> 'size' = '3';

COMMIT;
