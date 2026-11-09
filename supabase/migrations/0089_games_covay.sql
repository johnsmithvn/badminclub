-- 0089_games_covay.sql — server chấm Cờ vây (docs/GAMES.md §5.1, §12). Chạy sau 0075.
--
-- Chỉ THÊM hàm: game_finish (0075) tự tìm public.game_<id>_result(uuid) nên không phải sửa.
--   - game_covay_group:  nhóm quân chứa một giao điểm + số khí (thuần, dùng nội bộ).
--   - game_covay_area:   điểm vùng hai bên khi hết ván — quân trên bàn + đất trống chỉ giáp quân một màu.
--   - game_covay_result: luật Cờ vây chép từ lib/games/covay.js — đổi một bên là phải đổi bên kia. covay.test.js chấm
--                        lại bằng JS đúng bộ ván mẫu trong supabase/manual/0089_games_covay_check.sql.
-- Không đổi bảng, không đụng Elo / điểm mùa / sổ quỹ. Chạy lại được (CREATE OR REPLACE).

BEGIN;

-- Nhóm quân chứa giao điểm p_i (i = hàng * n + cột) và số khí của nhóm. Mảng p_b: NULL trống · 0 Đen · 1 Trắng.
CREATE OR REPLACE FUNCTION public.game_covay_group(p_b smallint[], p_n int, p_i int, OUT o_stones int[], OUT o_libs int)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_c     smallint := p_b[p_i + 1];
  v_stack int[] := ARRAY[p_i];
  v_seen  boolean[] := array_fill(false, ARRAY[p_n * p_n]);
  v_lib   boolean[] := array_fill(false, ARRAY[p_n * p_n]);
  x       int;
  y       int;
BEGIN
  o_stones := '{}';
  o_libs := 0;
  v_seen[p_i + 1] := true;
  WHILE cardinality(v_stack) > 0 LOOP
    x := v_stack[cardinality(v_stack)];
    v_stack := v_stack[1:cardinality(v_stack) - 1];
    o_stones := o_stones || x;
    -- Kề trên, dưới, trái, phải (NULL = ra ngoài bàn).
    FOREACH y IN ARRAY ARRAY[CASE WHEN x >= p_n THEN x - p_n END, CASE WHEN x < p_n * (p_n - 1) THEN x + p_n END,
                             CASE WHEN x % p_n > 0 THEN x - 1 END, CASE WHEN x % p_n < p_n - 1 THEN x + 1 END] LOOP
      CONTINUE WHEN y IS NULL;
      IF p_b[y + 1] IS NULL THEN
        IF NOT v_lib[y + 1] THEN
          v_lib[y + 1] := true;
          o_libs := o_libs + 1;
        END IF;
      ELSIF p_b[y + 1] = v_c AND NOT v_seen[y + 1] THEN
        v_seen[y + 1] := true;
        v_stack := v_stack || y;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Điểm vùng như areaOf: mỗi quân 1 điểm cho màu của nó; mỗi vùng trống chỉ giáp một màu tính cho màu đó; vùng giáp
-- cả hai màu (hoặc bàn trống) không của ai.
CREATE OR REPLACE FUNCTION public.game_covay_area(p_b smallint[], p_n int, OUT o_b int, OUT o_w int)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_seen  boolean[] := array_fill(false, ARRAY[p_n * p_n]);
  v_stack int[];
  v_size  int;
  v_t0    boolean;
  v_t1    boolean;
  i       int;
  x       int;
  y       int;
BEGIN
  o_b := 0;
  o_w := 0;
  FOR i IN 0 .. p_n * p_n - 1 LOOP
    IF p_b[i + 1] = 0 THEN o_b := o_b + 1; CONTINUE; END IF;
    IF p_b[i + 1] = 1 THEN o_w := o_w + 1; CONTINUE; END IF;
    CONTINUE WHEN v_seen[i + 1];
    v_seen[i + 1] := true;
    v_stack := ARRAY[i];
    v_size := 0;
    v_t0 := false;
    v_t1 := false;
    WHILE cardinality(v_stack) > 0 LOOP
      x := v_stack[cardinality(v_stack)];
      v_stack := v_stack[1:cardinality(v_stack) - 1];
      v_size := v_size + 1;
      FOREACH y IN ARRAY ARRAY[CASE WHEN x >= p_n THEN x - p_n END, CASE WHEN x < p_n * (p_n - 1) THEN x + p_n END,
                               CASE WHEN x % p_n > 0 THEN x - 1 END, CASE WHEN x % p_n < p_n - 1 THEN x + 1 END] LOOP
        CONTINUE WHEN y IS NULL;
        IF p_b[y + 1] = 0 THEN v_t0 := true;
        ELSIF p_b[y + 1] = 1 THEN v_t1 := true;
        ELSIF NOT v_seen[y + 1] THEN
          v_seen[y + 1] := true;
          v_stack := v_stack || y;
        END IF;
      END LOOP;
    END LOOP;
    IF v_t0 AND NOT v_t1 THEN o_b := o_b + v_size;
    ELSIF v_t1 AND NOT v_t0 THEN o_w := o_w + v_size;
    END IF;
  END LOOP;
END;
$$;

-- Cờ vây: luật chép từ lib/games/covay.js.
--   cỡ bàn options.size ∈ {9, 13, 19} (kể cả viết 13.0), khác thì 9; Đen = ghế 0 đi trước, thay phiên;
--   nước sai (ván xong, sai lượt, không phải object, i không phải số nguyên trong bàn, giao điểm có quân, ăn lại ko
--   ngay, tự sát) bị BỎ QUA như replay(); { pass: true } là bỏ lượt (xoá ko);
--   đặt quân → nhấc mọi nhóm đối phương hết khí → nhóm mình hết khí thì là tự sát (bỏ qua) → ko nếu ăn đúng một quân
--   bằng một quân đơn còn một khí;
--   hai lần bỏ lượt liền nhau hoặc đủ 3 × số giao điểm nước hợp lệ → hết ván, chấm điểm vùng, Trắng cộng 7,5.
-- Trả { winners: [ghế], draw: false, scores: { "0": Đen, "1": Trắng đã cộng komi } } · NULL khi ván chưa xong.
CREATE OR REPLACE FUNCTION public.game_covay_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_komi CONSTANT numeric := 7.5;  -- = KOMI
  c_cap  CONSTANT int := 3;        -- = CAP_PER_POINT
  v_opt  jsonb;
  v_n    int := 9;
  v_b    smallint[];
  v_try  smallint[];
  v_turn int := 0;
  v_ko   int := -1;
  v_pass int := 0;
  v_ply  int := 0;
  v_over boolean := false;
  v_num  numeric;
  v_i    int;
  v_dead int;
  v_one  int;
  g      record;
  a      record;
  m      record;
  y      int;
  k      int;
BEGIN
  SELECT options -> 'size' INTO v_opt FROM game_rooms WHERE id = p_room;
  IF jsonb_typeof(v_opt) = 'number' AND (v_opt #>> '{}')::numeric IN (9, 13, 19) THEN
    v_n := (v_opt #>> '{}')::numeric::int;
  END IF;
  v_b := array_fill(NULL::smallint, ARRAY[v_n * v_n]);

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_over OR m.seat IS DISTINCT FROM v_turn OR jsonb_typeof(m.move) IS DISTINCT FROM 'object' THEN CONTINUE; END IF;
    IF m.move -> 'pass' = 'true'::jsonb THEN
      v_pass := v_pass + 1;
      v_ko := -1;
    ELSE
      IF jsonb_typeof(m.move -> 'i') IS DISTINCT FROM 'number' THEN CONTINUE; END IF;
      v_num := (m.move ->> 'i')::numeric;
      IF v_num <> trunc(v_num) OR v_num < 0 OR v_num >= v_n * v_n THEN CONTINUE; END IF;
      v_i := v_num::int;
      IF v_b[v_i + 1] IS NOT NULL OR v_i = v_ko THEN CONTINUE; END IF;

      v_try := v_b;
      v_try[v_i + 1] := v_turn;
      v_dead := 0;
      FOREACH y IN ARRAY ARRAY[CASE WHEN v_i >= v_n THEN v_i - v_n END, CASE WHEN v_i < v_n * (v_n - 1) THEN v_i + v_n END,
                               CASE WHEN v_i % v_n > 0 THEN v_i - 1 END, CASE WHEN v_i % v_n < v_n - 1 THEN v_i + 1 END] LOOP
        -- Nhóm đã bị nhấc qua một hướng khác thì giờ là ô trống — bỏ qua.
        CONTINUE WHEN y IS NULL OR v_try[y + 1] IS DISTINCT FROM (1 - v_turn)::smallint;
        SELECT * INTO g FROM game_covay_group(v_try, v_n, y);
        CONTINUE WHEN g.o_libs > 0;
        FOREACH k IN ARRAY g.o_stones LOOP
          v_try[k + 1] := NULL;
        END LOOP;
        v_dead := v_dead + cardinality(g.o_stones);
        v_one := g.o_stones[1];
      END LOOP;
      SELECT * INTO g FROM game_covay_group(v_try, v_n, v_i);
      CONTINUE WHEN g.o_libs = 0;  -- tự sát: nước sai, bỏ qua
      v_ko := CASE WHEN v_dead = 1 AND cardinality(g.o_stones) = 1 AND g.o_libs = 1 THEN v_one ELSE -1 END;
      v_b := v_try;
      v_pass := 0;
    END IF;
    v_turn := 1 - v_turn;
    v_ply := v_ply + 1;
    IF v_pass >= 2 OR v_ply >= c_cap * v_n * v_n THEN v_over := true; END IF;
  END LOOP;

  IF NOT v_over THEN RETURN NULL; END IF;
  SELECT * INTO a FROM game_covay_area(v_b, v_n);
  RETURN jsonb_build_object(
    'winners', jsonb_build_array(CASE WHEN a.o_b > a.o_w + c_komi THEN 0 ELSE 1 END),
    'draw', false,
    'scores', jsonb_build_object('0', a.o_b, '1', a.o_w + c_komi));
END;
$$;

REVOKE ALL ON FUNCTION public.game_covay_group(smallint[], int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_covay_area(smallint[], int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_covay_result(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
