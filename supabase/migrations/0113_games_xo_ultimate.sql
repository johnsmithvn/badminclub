-- 0113_games_xo_ultimate.sql — Cờ X-O: thêm chế độ X-O LỒNG (options.mode = 'ultimate', docs/GAMES.md §12). Chủ dự án
-- chốt 2026-11-16 ("thêm vào xo hiện tại" — chế độ thứ 4 của Cờ X-O, không phải game riêng).
--
-- Luật (lib/games/xo.js applyUlt): bàn lớn 3 × 3 gồm 9 bàn con 3 × 3 — ô i = bàn con × 9 + ô trong bàn con (0..80).
--   Thắng bàn con (3 quân liền) là chiếm ô đó của bàn lớn; bàn con đầy không ai thắng là ô hoà. 3 ô bàn lớn liền là
--   thắng ván; mọi bàn con đã xong mà chưa ai thắng thì hoà. Đánh ô k → đối thủ phải đánh bàn con k; bàn đó đã xong thì
--   tự do. Đủ 2 × c_ucap lượt (gồm lượt bị mất vì hết giờ) thì hoà. Mất lượt thì bàn con bắt buộc giữ nguyên.
--
-- CHẠY SAU 0109. Chạy lại được (CREATE OR REPLACE). CHỈ THÊM / THAY HÀM — không đổi bảng, không đổi dữ liệu, không đụng
-- Elo / điểm mùa / sổ quỹ. Phòng cũ (classic / move / vanish) chấm y như 0109 — nhánh mới chỉ chạy khi mode = 'ultimate'.
--   THÊM: game_xo_ucell (đọc ô 0..80, như game_xo_cell của 0107).
--   THAY: game_xo_run — thân chép nguyên 0109, chỗ mới ghi chú "0113". game_xo_result / _check / _fill của 0109 giữ
--         nguyên (cùng đọc game_xo_run).
-- Chép luật lib/games/xo.js — đổi một bên phải đổi bên kia. Kiểm: supabase/manual/0113_games_xo_ultimate_check.sql
-- (bộ ván mẫu X-O lồng) + chạy lại 0107_games_xo_check.sql (ván cũ phải ra đúng kết quả cũ).

BEGIN;

/* ---------- 1. Đọc ô X-O lồng ---------- */
CREATE OR REPLACE FUNCTION public.game_xo_ucell(p jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p) IS DISTINCT FROM 'number' THEN NULL
    WHEN (p #>> '{}')::numeric NOT BETWEEN 0 AND 80 OR (p #>> '{}')::numeric <> trunc((p #>> '{}')::numeric) THEN NULL
    ELSE (p #>> '{}')::numeric::int
  END
$$;

/* ---------- 2. Dựng lại ván ---------- */
-- o_since = giờ (ms) của lượt hợp lệ gần nhất (NULL = chưa có nước đầu) · o_time = giây mỗi nước (0 = không tính giờ).
CREATE OR REPLACE FUNCTION public.game_xo_run(p_room uuid,
  OUT o_over boolean, OUT o_winner smallint, OUT o_since bigint, OUT o_time int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cap    CONSTANT int := 30;  -- lượt mỗi bên tối đa (xo.js CAP)
  c_ucap   CONSTANT int := 60;  -- 0113: X-O lồng, lượt mỗi bên tối đa (xo.js ULT_CAP)
  v_lines  CONSTANT int[] := ARRAY[[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  v_mode   text;
  v_time   int;     -- 0109: giây mỗi nước, 0 = không tính giờ (như optsOf của JS)
  v_since  bigint;  -- 0109: giờ (ms) của lượt hợp lệ gần nhất
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
  v_big    smallint[] := array_fill(NULL::smallint, ARRAY[9]);  -- 0113: X-O lồng — bàn lớn (NULL | 0 | 1 | 2 = bàn con hoà)
  v_next   int := -1;  -- 0113: bàn con bắt buộc, -1 = tự do
  v_b      int;        -- 0113
  m        record;
BEGIN
  -- 0109: options.time — đúng số JSON 3 / 5 / 10 mới tính giờ (chuỗi "3", số khác → 0).
  SELECT CASE WHEN options ->> 'mode' IN ('move', 'vanish', 'ultimate') THEN options ->> 'mode' ELSE 'classic' END,  -- 0113: + ultimate
         CASE WHEN options -> 'time' IN ('3'::jsonb, '5'::jsonb, '10'::jsonb) THEN (options ->> 'time')::numeric::int ELSE 0 END
    INTO v_mode, v_time FROM game_rooms WHERE id = p_room;
  IF v_mode = 'ultimate' THEN v_board := array_fill(NULL::smallint, ARRAY[81]); END IF;  -- 0113

  FOR m IN SELECT seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at
             FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_over OR jsonb_typeof(m.move) IS DISTINCT FROM 'object' THEN CONTINUE; END IF;

    /* ----- 0109: hết giờ → mất lượt (chỉ dòng server đã đóng dấu skip; ghế của dòng là máy báo, không xét) ----- */
    IF m.move -> 'timeout' = 'true'::jsonb THEN
      IF m.move -> 'skip' = 'true'::jsonb AND v_time > 0 AND v_since IS NOT NULL THEN
        v_ply := v_ply + 1;
        v_since := m.at;
        v_over := v_ply >= 2 * CASE WHEN v_mode = 'ultimate' THEN c_ucap ELSE c_cap END;  -- 0113; X-O lồng giữ nguyên v_next
        v_turn := 1 - v_turn;
      END IF;
      CONTINUE;
    END IF;

    IF m.seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;

    /* ----- 0113: X-O lồng — ô i = bàn con × 9 + ô trong bàn con; đánh ô k thì đối thủ phải đánh bàn con k ----- */
    IF v_mode = 'ultimate' THEN
      v_i := game_xo_ucell(m.move -> 'i');
      IF v_i IS NULL OR m.move ? 'from' OR v_board[v_i + 1] IS NOT NULL THEN CONTINUE; END IF;
      v_b := v_i / 9;
      IF v_big[v_b + 1] IS NOT NULL OR (v_next >= 0 AND v_b <> v_next) THEN CONTINUE; END IF;
      v_board[v_i + 1] := v_turn;
      FOREACH v_l SLICE 1 IN ARRAY v_lines LOOP
        IF v_board[v_b * 9 + v_l[1] + 1] = v_turn AND v_board[v_b * 9 + v_l[2] + 1] = v_turn AND v_board[v_b * 9 + v_l[3] + 1] = v_turn THEN
          v_big[v_b + 1] := v_turn;
          EXIT;
        END IF;
      END LOOP;
      IF v_big[v_b + 1] IS NULL AND NOT EXISTS (SELECT 1 FROM generate_series(1, 9) k WHERE v_board[v_b * 9 + k] IS NULL) THEN
        v_big[v_b + 1] := 2;  -- bàn con đầy, không ai thắng
      END IF;
      IF v_big[v_b + 1] = v_turn THEN
        FOREACH v_l SLICE 1 IN ARRAY v_lines LOOP
          IF v_big[v_l[1] + 1] = v_turn AND v_big[v_l[2] + 1] = v_turn AND v_big[v_l[3] + 1] = v_turn THEN
            v_winner := v_turn;
            EXIT;
          END IF;
        END LOOP;
      END IF;
      v_next := CASE WHEN v_big[v_i % 9 + 1] IS NULL THEN v_i % 9 ELSE -1 END;
      v_ply := v_ply + 1;
      v_since := m.at;
      v_over := v_winner IS NOT NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_big) x WHERE x IS NULL) OR v_ply >= 2 * c_ucap;
      v_turn := 1 - v_turn;
      CONTINUE;
    END IF;

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
    v_since := m.at;  -- 0109
    FOREACH v_l SLICE 1 IN ARRAY v_lines LOOP
      IF v_board[v_l[1] + 1] = v_turn AND v_board[v_l[2] + 1] = v_turn AND v_board[v_l[3] + 1] = v_turn THEN
        v_winner := v_turn;
        EXIT;
      END IF;
    END LOOP;
    -- 0109: đầy bàn (chỉ cổ điển tới được) hoặc đủ 2 × c_cap lượt — như luật hoà của xo.js.
    v_over := v_winner IS NOT NULL OR NOT EXISTS (SELECT 1 FROM unnest(v_board) x WHERE x IS NULL) OR v_ply >= 2 * c_cap;
    v_turn := 1 - v_turn;
  END LOOP;

  o_over := v_over;
  o_winner := v_winner;
  o_since := v_since;
  o_time := v_time;
END;
$$;

REVOKE ALL ON FUNCTION public.game_xo_ucell(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xo_run(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
