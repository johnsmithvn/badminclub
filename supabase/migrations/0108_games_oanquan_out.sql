-- 0108_games_oanquan_out.sql — Ô ăn quan bàn 3 quan: người rời ván ({ out: true }) thì ván chơi tiếp, không kẹt.
--
-- LỖI: game_leave / game_claim (0078 / 0085) ghi nước { out: true } khi bàn còn ≥ 2 người, nhưng luật Ô ăn quan (0104 và
-- lib/games/oanquan.js) không biết nước đó → bị bỏ qua, lượt đứng mãi ở ghế đã rời. Phòng không đồng hồ thì kẹt hẳn: ghế
-- đã rời không còn "ngồi" nên không ai đòi xử được; hai người còn lại chỉ thoát bằng cách một người đầu hàng.
--
-- SỬA (chép lib/games/oanquan.js — validate / apply nhánh `out`, nextSeat, sweep; đổi luật thì sửa cả hai):
--   - { out: true } chỉ server ghi; máy khách gửi → games.err.badMove. Ghế rời: mất lượt từ đó, không được tính thắng.
--     Ô dân của họ vẫn nằm trên bàn (người khác rải qua / ăn được), hết ván dân còn bên đó vẫn cộng vào điểm của họ.
--   - Đang tới lượt người rời → lượt sang ghế kế CÒN trong ván, tính giờ lại từ nước { out } (như một nước đi); người kế
--     hết dân thì rải lại / hết ván như thường. Không phải lượt họ → lượt và hạn giờ giữ nguyên. Số nước (ply) không đổi.
--   - Sau mỗi nước, lượt sang ghế kế còn trong ván (trước: (ghế + 1) % số quan).
--   - Chấm: thắng = điểm cao nhất trong những người còn trong ván. Cả bàn bằng điểm (không ai rời) = hoà; đã có người rời
--     thì những người còn lại bằng điểm nhau là cùng thắng — người rời thua (0101: mất mức cược).
--
-- CHẠY SAU 0104. Chạy lại được. CHỈ THAY HÀM — không đổi bảng, không đổi dữ liệu, không đụng Elo / điểm mùa / sổ quỹ.
-- game_oanquan_run thêm cột ra o_out = đổi kiểu trả về → phải DROP rồi tạo lại; _result / _check / _fill (gọi _run) tạo
-- lại, thân như 0104 trừ _result đọc o_out. game_oanquan_deal của 0104 giữ nguyên.
-- Bàn 2 quan không bao giờ có nước { out } (còn 1 người là server xử thắng ngay) → chấm y hệt 0104.
-- Phần chép từ 0104 giữ nguyên từng dòng; chỗ mới ghi chú "0108".

BEGIN;

DROP FUNCTION IF EXISTS public.game_oanquan_run(uuid, int, jsonb);

CREATE FUNCTION public.game_oanquan_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_over boolean, OUT o_score int[], OUT o_turn int, OUT o_side int[], OUT o_quans int, OUT o_out boolean[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_quan  CONSTANT int := 10;      -- = QUAN_VALUE
  c_max   CONSTANT int := 2000;    -- = MAX_STEPS
  c_non   CONSTANT int := 5;       -- = QUAN_NON
  v_opt   jsonb;
  v_p     int;                     -- số quan = số người
  v_r     int;                     -- ô dân mỗi hàng
  v_w     int;                     -- R + 1: quan k ở ô k·v_w
  v_n     int;                     -- số ô cả vòng
  v_nhon  boolean;
  v_time  bigint;                  -- giây mỗi nước, 0 = không giới hạn
  v_st    int[];
  v_q     boolean[];
  v_score int[];
  v_out   boolean[];               -- 0108: ghế đã rời ván
  v_turn  int := 0;
  v_ply   int := 0;
  v_over  boolean := false;
  v_since bigint;                  -- giờ server (ms) của nước hợp lệ gần nhất
  v_err   text;
  m       record;
  v_cell  numeric;
  v_dir   numeric;
  v_seat  int;
  v_d     int;
  v_i     int;
  v_nx    int;
  v_m     int;
  v_hand  int;
  v_steps int;
  v_base  int;
  k       int;
  y       int;
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_p := CASE WHEN v_opt -> 'quans' = '3'::jsonb THEN 3 ELSE 2 END;
  v_r := CASE WHEN v_opt -> 'rows' IN ('6'::jsonb, '7'::jsonb) THEN (v_opt ->> 'rows')::numeric::int ELSE 5 END;
  v_nhon := coalesce(v_opt -> 'nhon' = 'true'::jsonb, false);
  v_time := CASE WHEN v_opt -> 'time' IN ('20'::jsonb, '30'::jsonb, '50'::jsonb) THEN (v_opt ->> 'time')::numeric::int ELSE 0 END;
  v_w := v_r + 1;
  v_n := v_p * v_w;
  v_st := array_fill(CASE WHEN v_opt -> 'stones' IN ('6'::jsonb, '7'::jsonb) THEN (v_opt ->> 'stones')::numeric::int ELSE 5 END, ARRAY[v_n]);
  v_q := array_fill(false, ARRAY[v_n]);
  v_score := array_fill(0, ARRAY[v_p]);
  v_out := array_fill(false, ARRAY[v_p]);  -- 0108
  FOR k IN 0 .. v_p - 1 LOOP v_st[k * v_w + 1] := 0; v_q[k * v_w + 1] := true; END LOOP;

  -- Log + (nếu có) nước đang kiểm ở cuối (probe): cùng một đường kiểm như JS validate.
  FOR m IN
    SELECT q.seat, q.move, q.at, q.probe FROM (
      SELECT g.seq, g.seat::int AS seat, g.move, (extract(epoch FROM g.created_at) * 1000)::bigint AS at, false AS probe
        FROM game_moves g WHERE g.room_id = p_room
      UNION ALL
      SELECT NULL, p_seat, p_move, (extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) q ORDER BY q.probe, q.seq
  LOOP
    v_err := NULL;
    v_seat := m.seat;
    IF v_over THEN
      v_err := 'games.err.over';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      -- 0108: chỉ server ghi (game_leave / game_claim); máy khách gửi thì từ chối. Ghế còn trong ván mới rời được.
      IF m.probe OR v_seat IS NULL OR v_seat < 0 OR v_seat >= v_p OR v_out[v_seat + 1] THEN v_err := 'games.err.badMove'; END IF;
    ELSIF m.move -> 'start' = 'true'::jsonb THEN
      -- Chỉ server ghi (game_oanquan_deal); máy khách gửi thì từ chối.
      IF m.probe OR v_ply > 0 OR v_since IS NOT NULL THEN v_err := 'games.err.badMove'; END IF;
    ELSIF m.move -> 'timeout' = 'true'::jsonb AND NOT (m.move ? 'cell') THEN
      -- Báo hết giờ trơn: trong log thì không làm gì (JS cũng bỏ qua); đang kiểm thì xét giờ.
      IF NOT m.probe THEN CONTINUE; END IF;
      IF v_time = 0 THEN v_err := 'games.err.badMove';
      ELSIF v_since IS NULL OR m.at < v_since + v_time * 1000 THEN v_err := 'games.err.notYet';
      END IF;
    ELSE
      IF m.move -> 'timeout' = 'true'::jsonb THEN v_seat := v_turn; END IF;
      v_base := v_seat * v_w;
      IF v_seat IS DISTINCT FROM v_turn THEN
        v_err := 'games.err.notYourTurn';
      ELSIF jsonb_typeof(m.move -> 'cell') IS DISTINCT FROM 'number' THEN
        v_err := 'games.err.notYourCell';
      ELSE
        v_cell := (m.move ->> 'cell')::numeric;
        IF v_cell <> trunc(v_cell) OR v_cell < v_base + 1 OR v_cell > v_base + v_r THEN
          v_err := 'games.err.notYourCell';
        ELSIF jsonb_typeof(m.move -> 'dir') IS DISTINCT FROM 'number' OR (m.move ->> 'dir')::numeric NOT IN (1, -1) THEN
          v_err := 'games.err.badMove';
        ELSIF v_st[v_cell::int + 1] = 0 THEN
          v_err := 'games.err.emptyCell';
        END IF;
      END IF;
    END IF;

    IF m.probe THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;
    IF m.move -> 'start' = 'true'::jsonb THEN v_since := m.at; CONTINUE; END IF;

    IF m.move -> 'out' = 'true'::jsonb THEN
      -- 0108: người rời ván. Còn ≤ 1 người → hết ván (thu quân bên dưới). Không phải lượt họ → lượt và giờ giữ nguyên.
      v_out[v_seat + 1] := true;
      IF (SELECT count(*) FROM unnest(v_out) o WHERE NOT o) <= 1 THEN
        v_over := true;
      ELSIF v_seat <> v_turn THEN
        CONTINUE;
      END IF;
    ELSE
      v_i := v_cell::int;
      v_dir := (m.move ->> 'dir')::numeric;
      v_d := v_dir::int;
      v_hand := v_st[v_i + 1];
      v_st[v_i + 1] := 0;
      v_steps := 0;
      LOOP
        WHILE v_hand > 0 LOOP
          v_i := (v_i + v_d + v_n) % v_n;
          v_st[v_i + 1] := v_st[v_i + 1] + 1;
          v_hand := v_hand - 1;
          v_steps := v_steps + 1;
        END LOOP;
        v_nx := (v_i + v_d + v_n) % v_n;
        IF v_st[v_nx + 1] > 0 OR v_q[v_nx + 1] THEN
          EXIT WHEN v_steps > c_max;
          IF v_nx % v_w = 0 THEN
            -- Nhón: ô quan có dân → lấy 1 DÂN (v_st; quan v_q không bao giờ bị nhón), rơi xuống ô ngay sau quan, xét tiếp.
            -- Ô quan không còn dân → không nhón được, dừng như luật thường.
            EXIT WHEN NOT v_nhon OR v_st[v_nx + 1] = 0;
            v_st[v_nx + 1] := v_st[v_nx + 1] - 1;
            v_hand := 1;
            v_i := v_nx;
            CONTINUE;
          END IF;
          v_hand := v_st[v_nx + 1];
          v_st[v_nx + 1] := 0;
          v_i := v_nx;
          CONTINUE;
        END IF;
        v_m := (v_nx + v_d + v_n) % v_n;
        -- eatable(): dân còn sỏi, hoặc quan đủ c_non dân.
        WHILE v_st[v_nx + 1] = 0 AND NOT v_q[v_nx + 1]
              AND CASE WHEN v_q[v_m + 1] THEN v_st[v_m + 1] >= c_non ELSE v_st[v_m + 1] > 0 END LOOP
          v_score[v_seat + 1] := v_score[v_seat + 1] + v_st[v_m + 1] + CASE WHEN v_q[v_m + 1] THEN c_quan ELSE 0 END;
          v_st[v_m + 1] := 0;
          v_q[v_m + 1] := false;
          v_nx := (v_m + v_d + v_n) % v_n;
          v_m := (v_nx + v_d + v_n) % v_n;
        END LOOP;
        EXIT;
      END LOOP;

      v_ply := v_ply + 1;
    END IF;

    v_since := m.at;
    IF NOT v_over THEN
      -- 0108: lượt sang ghế kế CÒN trong ván (nextSeat của JS), rồi xét đầu lượt như startTurn của JS.
      FOR k IN 1 .. v_p LOOP
        y := (v_seat + k) % v_p;
        IF NOT v_out[y + 1] THEN v_turn := y; EXIT; END IF;
      END LOOP;
      v_base := v_turn * v_w;
      IF NOT EXISTS (SELECT 1 FROM generate_series(0, v_p - 1) q WHERE v_st[q * v_w + 1] > 0 OR v_q[q * v_w + 1]) THEN
        v_over := true;                            -- hết quan
      ELSIF (SELECT sum(v_st[x]) FROM generate_series(v_base + 2, v_base + v_r + 1) x) = 0 THEN
        IF v_score[v_turn + 1] < v_r THEN
          v_over := true;                          -- hết dân mà không đủ điểm rải lại
        ELSE
          v_score[v_turn + 1] := v_score[v_turn + 1] - v_r;
          FOR k IN v_base + 2 .. v_base + v_r + 1 LOOP v_st[k] := 1; END LOOP;
        END IF;
      END IF;
    END IF;

    IF v_over THEN                               -- hết quan, tàn dân: dân còn bên nào về bên đó
      FOR y IN 0 .. v_p - 1 LOOP
        FOR k IN y * v_w + 2 .. y * v_w + v_r + 1 LOOP v_score[y + 1] := v_score[y + 1] + v_st[k]; v_st[k] := 0; END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  o_over := v_over;
  o_score := v_score;
  o_turn := v_turn;
  o_quans := v_p;
  o_out := v_out;  -- 0108
  o_side := ARRAY(SELECT x FROM generate_series(v_turn * v_w + 1, v_turn * v_w + v_r) x WHERE v_st[x + 1] > 0);
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

/* ---------- Chấm (game_finish 0075) ---------- */
-- 0108: thắng = điểm cao nhất trong những người CÒN trong ván (sweep của JS). Cả bàn cùng điểm = hoà; đã có người rời thì
-- số người đứng đầu luôn ít hơn số quan → không bao giờ hoà, người rời thua.
CREATE OR REPLACE FUNCTION public.game_oanquan_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r     record;
  v_top int;
  v_win jsonb;
BEGIN
  SELECT * INTO r FROM game_oanquan_run(p_room, NULL, NULL);
  IF NOT r.o_over THEN RETURN NULL; END IF;
  SELECT max(r.o_score[i]) INTO v_top FROM generate_subscripts(r.o_score, 1) i WHERE NOT r.o_out[i];
  SELECT jsonb_agg(i - 1 ORDER BY i) INTO v_win
    FROM generate_subscripts(r.o_score, 1) i WHERE NOT r.o_out[i] AND r.o_score[i] = v_top;
  IF v_win IS NULL OR jsonb_array_length(v_win) = r.o_quans THEN
    RETURN jsonb_build_object('winners', '[]'::jsonb, 'draw', true);
  END IF;
  RETURN jsonb_build_object('winners', v_win, 'draw', false);
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_result(uuid) FROM PUBLIC, anon, authenticated;

/* ---------- Kiểm nước (game_move 0078) — y 0104 ---------- */
CREATE OR REPLACE FUNCTION public.game_oanquan_check(p_room uuid, p_seat integer, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o_err FROM public.game_oanquan_run(p_room, p_seat, p_move)
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_check(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

/* ---------- Hết giờ: đi thay người tới lượt — y 0104 ---------- */
CREATE OR REPLACE FUNCTION public.game_oanquan_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF p_move -> 'timeout' IS DISTINCT FROM 'true'::jsonb THEN RETURN p_move; END IF;
  SELECT * INTO r FROM game_oanquan_run(p_room, NULL, NULL);
  RETURN jsonb_build_object(
    'cell', r.o_side[1 + floor(random() * cardinality(r.o_side))::int],
    'dir', CASE WHEN random() < 0.5 THEN 1 ELSE -1 END,
    'timeout', true);
END;
$$;
REVOKE ALL ON FUNCTION public.game_oanquan_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
