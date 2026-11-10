-- 0075_games_results.sql — Server tự chấm thêm game (sau Caro ở 0074). Thiết kế: docs/GAMES.md §5.1.
--
-- CHỈ THÊM HÀM: không đổi bảng, không đụng dữ liệu. Chạy sau 0074, chạy lại được (CREATE OR REPLACE).
--   - game_oanquan_result: luật Ô ăn quan chép từ lib/games/oanquan.js.
--   - game_coganh_result: luật Cờ gánh chép từ lib/games/coganh.js.
--   - game_finish: thay bản 0074. Thay vì liệt kê tên game, tự tìm hàm game_<id>_result(uuid) —
--     có thì server tự chấm (bỏ qua kết quả client gửi), chưa có thì nhận kết quả client như cũ.
--     Thêm game có bản chấm = chỉ thêm một hàm game_<id>_result, không phải sửa game_finish nữa.
-- Kiểm tay: supabase/manual/0075_games_results_check.sql (dùng chung bộ ván mẫu với oanquan.test.js, coganh.test.js).

BEGIN;

-- Luật Ô ăn quan ở SERVER. PHẢI khớp lib/games/oanquan.js từng chi tiết:
--   vòng 12 ô theo chiều +1: 0 = quan trái · 1..5 = dân ghế 0 · 6 = quan phải · 7..11 = dân ghế 1;
--   mỗi ô dân 5 viên, quan = 10 điểm (QUAN_VALUE, START_STONES) — không có tuỳ chọn phòng;
--   nước sai (ván xong, sai lượt, không phải ô dân của mình, chiều khác ±1, ô hết sỏi) bị BỎ QUA như replay();
--   rải xong: ô kế là dân còn sỏi → bốc rải tiếp · là ô quan còn quân → dừng ·
--   trống → ăn ô sau nó, rồi cứ "trống – ăn được" là ăn tiếp; quá MAX_STEPS viên rải thì dừng;
--   quan non (còn quan mà dưới QUAN_NON = 5 dân) chưa ăn được — gặp là dừng, mất lượt;
--   hết hai quan → thu dân về hai bên, hết ván; người sắp đi hết dân → trừ 5 điểm rải lại, thiếu thì hết ván.
-- Mảng plpgsql đánh số từ 1: ô i nằm ở phần tử [i + 1].
-- Trả { winners: [seat], draw: false } · { winners: [], draw: true } · NULL khi ván chưa xong.
CREATE OR REPLACE FUNCTION public.game_oanquan_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_quan  CONSTANT int := 10;      -- = QUAN_VALUE
  c_start CONSTANT int := 5;       -- = START_STONES
  c_max   CONSTANT int := 2000;    -- = MAX_STEPS
  c_non   CONSTANT int := 5;       -- = QUAN_NON
  v_st    int[];
  v_q     boolean[];
  v_score int[] := ARRAY[0, 0];
  v_turn  int := 0;
  v_over  boolean := false;
  m       record;
  v_cell  numeric;
  v_dir   numeric;
  v_seat  int;
  v_d     int;
  v_i     int;
  v_n     int;
  v_m     int;
  v_hand  int;
  v_steps int;
  v_base  int;
  k       int;
BEGIN
  v_st := array_fill(c_start, ARRAY[12]);
  v_q := array_fill(false, ARRAY[12]);
  v_st[1] := 0; v_st[7] := 0;
  v_q[1] := true; v_q[7] := true;

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_over OR m.seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;
    IF jsonb_typeof(m.move -> 'cell') IS DISTINCT FROM 'number'
       OR jsonb_typeof(m.move -> 'dir') IS DISTINCT FROM 'number' THEN CONTINUE; END IF;
    v_cell := (m.move ->> 'cell')::numeric;
    v_dir := (m.move ->> 'dir')::numeric;
    v_base := 6 * m.seat;                        -- sideOf: ghế 0 → 1..5, ghế 1 → 7..11
    IF v_cell <> trunc(v_cell) OR v_cell < v_base + 1 OR v_cell > v_base + 5 OR v_dir NOT IN (1, -1) THEN CONTINUE; END IF;
    v_i := v_cell::int;
    IF v_st[v_i + 1] = 0 THEN CONTINUE; END IF;

    v_seat := m.seat;
    v_d := v_dir::int;
    v_hand := v_st[v_i + 1];
    v_st[v_i + 1] := 0;
    v_steps := 0;
    LOOP
      WHILE v_hand > 0 LOOP
        v_i := (v_i + v_d + 12) % 12;
        v_st[v_i + 1] := v_st[v_i + 1] + 1;
        v_hand := v_hand - 1;
        v_steps := v_steps + 1;
      END LOOP;
      v_n := (v_i + v_d + 12) % 12;
      IF v_st[v_n + 1] > 0 OR v_q[v_n + 1] THEN
        EXIT WHEN v_n IN (0, 6) OR v_steps > c_max;
        v_hand := v_st[v_n + 1];
        v_st[v_n + 1] := 0;
        v_i := v_n;
        CONTINUE;
      END IF;
      v_m := (v_n + v_d + 12) % 12;
      -- eatable(): dân còn sỏi, hoặc quan đủ c_non dân.
      WHILE v_st[v_n + 1] = 0 AND NOT v_q[v_n + 1]
            AND CASE WHEN v_q[v_m + 1] THEN v_st[v_m + 1] >= c_non ELSE v_st[v_m + 1] > 0 END LOOP
        v_score[v_seat + 1] := v_score[v_seat + 1] + v_st[v_m + 1] + CASE WHEN v_q[v_m + 1] THEN c_quan ELSE 0 END;
        v_st[v_m + 1] := 0;
        v_q[v_m + 1] := false;
        v_n := (v_m + v_d + 12) % 12;
        v_m := (v_n + v_d + 12) % 12;
      END LOOP;
      EXIT;
    END LOOP;

    v_turn := 1 - v_seat;
    v_base := 6 * v_turn;
    IF v_st[1] = 0 AND NOT v_q[1] AND v_st[7] = 0 AND NOT v_q[7] THEN
      v_over := true;
    ELSIF v_st[v_base + 2] + v_st[v_base + 3] + v_st[v_base + 4] + v_st[v_base + 5] + v_st[v_base + 6] = 0 THEN
      IF v_score[v_turn + 1] < 5 THEN
        v_over := true;
      ELSE
        v_score[v_turn + 1] := v_score[v_turn + 1] - 5;
        FOR k IN v_base + 2 .. v_base + 6 LOOP v_st[k] := 1; END LOOP;
      END IF;
    END IF;

    IF v_over THEN                               -- hết quan, tàn dân: dân còn bên nào về bên đó
      FOR k IN 2 .. 6 LOOP v_score[1] := v_score[1] + v_st[k]; v_st[k] := 0; END LOOP;
      FOR k IN 8 .. 12 LOOP v_score[2] := v_score[2] + v_st[k]; v_st[k] := 0; END LOOP;
    END IF;
  END LOOP;

  IF NOT v_over THEN RETURN NULL; END IF;
  IF v_score[1] = v_score[2] THEN RETURN jsonb_build_object('winners', '[]'::jsonb, 'draw', true); END IF;
  RETURN jsonb_build_object('winners', jsonb_build_array(CASE WHEN v_score[1] > v_score[2] THEN 0 ELSE 1 END), 'draw', false);
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_result(uuid) FROM PUBLIC, anon, authenticated;

-- Luật Cờ gánh ở SERVER. PHẢI khớp lib/games/coganh.js từng chi tiết:
--   bàn 5×5, điểm i = hàng*5 + cột; đường chéo chỉ ở điểm có (hàng + cột) chẵn; ghế 0 đi trước;
--   xếp quân: ghế 1 ở 0..5, 9, 14 · ghế 0 ở 20..24, 15, 19, 10;
--   nước sai (ván xong, sai lượt, không phải quân mình, đích có quân, không kề theo đường kẻ, không vào điểm
--   mở khi đang bị bắt buộc) bị BỎ QUA như replay();
--   gánh (mọi đường qua điểm đến) → vây (nhóm đối phương không còn điểm trống kề) → xét điểm mở
--   (điểm vừa rời nằm giữa hai quân của người đi) → hết quân thì thua; QUIET_LIMIT nước liền không đổi màu
--   quân nào hoặc đủ MAX_PLY nước → nhiều quân hơn thắng, bằng thì hoà.
-- v_nb[i + 1][k] = điểm kề i theo hướng k (c_dirs), -1 nếu không có. Hướng 2k-1 và 2k ngược nhau (một đường).
-- LƯU Ý: v_b[-1 + 1] ngoài mảng trả NULL = "trống" — luôn kiểm j >= 0 trước khi đọc v_b[j + 1].
CREATE OR REPLACE FUNCTION public.game_coganh_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_quiet CONSTANT int := 40;      -- = QUIET_LIMIT
  c_max   CONSTANT int := 400;     -- = MAX_PLY
  c_dirs  CONSTANT int[] := ARRAY[[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  v_nb    int[];
  v_b     smallint[];
  v_turn  int := 0;
  v_ply   int := 0;
  v_quiet int := 0;
  v_open  int;
  v_over  boolean := false;
  v_win   int;
  m       record;
  v_fn    numeric;
  v_tn    numeric;
  v_from  int;
  v_to    int;
  v_seat  int;
  v_foe   int;
  v_ok    boolean;
  v_flips int;
  v_p     int;
  v_q     int;
  v_seen  boolean[];
  v_group int[];
  v_free  boolean;
  v_n0    int;
  v_n1    int;
  i       int;
  j       int;
  k       int;
  g       int;
  r       int;
  c       int;
BEGIN
  v_nb := array_fill(-1, ARRAY[25, 8]);
  FOR i IN 0 .. 24 LOOP
    FOR k IN 1 .. 8 LOOP
      r := i / 5 + c_dirs[k][1];
      c := i % 5 + c_dirs[k][2];
      IF NOT (c_dirs[k][1] <> 0 AND c_dirs[k][2] <> 0 AND (i / 5 + i % 5) % 2 = 1)
         AND r BETWEEN 0 AND 4 AND c BETWEEN 0 AND 4 THEN
        v_nb[i + 1][k] := r * 5 + c;
      END IF;
    END LOOP;
  END LOOP;

  v_b := array_fill(NULL::smallint, ARRAY[25]);
  FOREACH i IN ARRAY ARRAY[0, 1, 2, 3, 4, 5, 9, 14] LOOP v_b[i + 1] := 1; END LOOP;
  FOREACH i IN ARRAY ARRAY[20, 21, 22, 23, 24, 15, 19, 10] LOOP v_b[i + 1] := 0; END LOOP;

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_over OR m.seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;
    IF jsonb_typeof(m.move -> 'from') IS DISTINCT FROM 'number'
       OR jsonb_typeof(m.move -> 'to') IS DISTINCT FROM 'number' THEN CONTINUE; END IF;
    v_fn := (m.move ->> 'from')::numeric;
    v_tn := (m.move ->> 'to')::numeric;
    IF v_fn <> trunc(v_fn) OR v_tn <> trunc(v_tn) OR v_fn NOT BETWEEN 0 AND 24 OR v_tn NOT BETWEEN 0 AND 24 THEN CONTINUE; END IF;
    v_from := v_fn::int;
    v_to := v_tn::int;
    v_seat := m.seat;
    v_foe := 1 - v_seat;
    IF v_b[v_from + 1] IS DISTINCT FROM v_seat OR v_b[v_to + 1] IS NOT NULL THEN CONTINUE; END IF;
    v_ok := false;
    FOR k IN 1 .. 8 LOOP
      IF v_nb[v_from + 1][k] = v_to THEN v_ok := true; END IF;
    END LOOP;
    IF NOT v_ok THEN CONTINUE; END IF;
    -- Bị mở: có quân kề điểm mở thì chỉ được đi vào điểm đó (forcedFrom).
    IF v_open IS NOT NULL AND v_b[v_open + 1] IS NULL AND v_to <> v_open THEN
      v_ok := true;
      FOR k IN 1 .. 8 LOOP
        j := v_nb[v_open + 1][k];
        IF j >= 0 AND v_b[j + 1] = v_seat THEN v_ok := false; END IF;
      END LOOP;
      IF NOT v_ok THEN CONTINUE; END IF;
    END IF;

    v_b[v_from + 1] := NULL;
    v_b[v_to + 1] := v_seat;
    v_flips := 0;

    -- Gánh: mỗi đường qua điểm đến, hai phía đều là quân đối phương.
    FOR k IN 1 .. 4 LOOP
      v_p := v_nb[v_to + 1][2 * k - 1];
      v_q := v_nb[v_to + 1][2 * k];
      IF v_p >= 0 AND v_q >= 0 AND v_b[v_p + 1] = v_foe AND v_b[v_q + 1] = v_foe THEN
        v_b[v_p + 1] := v_seat;
        v_b[v_q + 1] := v_seat;
        v_flips := v_flips + 2;
      END IF;
    END LOOP;

    -- Vây: loang từng nhóm quân đối phương; nhóm không còn điểm trống kề thì đổi màu cả nhóm.
    v_seen := array_fill(false, ARRAY[25]);
    FOR i IN 0 .. 24 LOOP
      IF v_b[i + 1] IS DISTINCT FROM v_foe OR v_seen[i + 1] THEN CONTINUE; END IF;
      v_group := ARRAY[i];
      v_seen[i + 1] := true;
      v_free := false;
      g := 1;
      WHILE g <= array_length(v_group, 1) LOOP
        FOR k IN 1 .. 8 LOOP
          j := v_nb[v_group[g] + 1][k];
          IF j >= 0 THEN
            IF v_b[j + 1] IS NULL THEN
              v_free := true;
            ELSIF v_b[j + 1] = v_foe AND NOT v_seen[j + 1] THEN
              v_seen[j + 1] := true;
              v_group := v_group || j;
            END IF;
          END IF;
        END LOOP;
        g := g + 1;
      END LOOP;
      IF NOT v_free THEN
        FOREACH j IN ARRAY v_group LOOP v_b[j + 1] := v_seat; END LOOP;
        v_flips := v_flips + array_length(v_group, 1);
      END IF;
    END LOOP;

    -- Điểm vừa rời nằm giữa hai quân của người đi → mở cho bên kia.
    v_open := NULL;
    FOR k IN 1 .. 4 LOOP
      v_p := v_nb[v_from + 1][2 * k - 1];
      v_q := v_nb[v_from + 1][2 * k];
      IF v_p >= 0 AND v_q >= 0 AND v_b[v_p + 1] = v_seat AND v_b[v_q + 1] = v_seat THEN v_open := v_from; END IF;
    END LOOP;

    v_ply := v_ply + 1;
    v_quiet := CASE WHEN v_flips > 0 THEN 0 ELSE v_quiet + 1 END;
    v_turn := v_foe;
    SELECT count(*) FILTER (WHERE x = 0), count(*) FILTER (WHERE x = 1) INTO v_n0, v_n1 FROM unnest(v_b) AS x;
    IF (v_foe = 0 AND v_n0 = 0) OR (v_foe = 1 AND v_n1 = 0) THEN
      v_over := true;
      v_win := v_seat;
    ELSIF v_quiet >= c_quiet OR v_ply >= c_max THEN
      v_over := true;
      v_win := CASE WHEN v_n0 > v_n1 THEN 0 WHEN v_n1 > v_n0 THEN 1 END;
    END IF;
  END LOOP;

  IF NOT v_over THEN RETURN NULL; END IF;
  IF v_win IS NULL THEN RETURN jsonb_build_object('winners', '[]'::jsonb, 'draw', true); END IF;
  RETURN jsonb_build_object('winners', jsonb_build_array(v_win), 'draw', false);
END;
$$;
REVOKE ALL ON FUNCTION public.game_coganh_result(uuid) FROM PUBLIC, anon, authenticated;

-- Kết thúc ván. Chỉ một lần. Thay bản 0074 (giữ nguyên quyền EXECUTE đã cấp ở 0074).
--   Có hàm game_<id>_result(uuid) → server tự chấm, BỎ QUA p_result; chưa xong thì từ chối.
--   Chưa có → tạm nhận kết quả client báo.
-- Tên game đã bị ràng buộc ^[a-z][a-z0-9_]{1,30}$ ở bảng, %I vẫn quote cho chắc.
CREATE OR REPLACE FUNCTION public.game_finish(p_room uuid, p_result jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_fn text;
  v_result jsonb := p_result;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'playing' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL) THEN
    RAISE EXCEPTION 'games.err.notSeated';
  END IF;
  v_fn := 'game_' || (c.o_room).game || '_result';
  IF to_regprocedure('public.' || v_fn || '(uuid)') IS NOT NULL THEN
    EXECUTE format('SELECT public.%I($1)', v_fn) INTO v_result USING p_room;
    IF v_result IS NULL THEN RAISE EXCEPTION 'games.err.notOver'; END IF;
  ELSIF jsonb_typeof(p_result -> 'winners') IS DISTINCT FROM 'array' OR pg_column_size(p_result) > 2000 THEN
    RAISE EXCEPTION 'games.err.badResult';
  END IF;
  UPDATE game_rooms SET status = 'finished', ended_at = now(), result = v_result WHERE id = p_room;
END;
$$;

COMMIT;
