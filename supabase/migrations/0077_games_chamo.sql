-- 0077_games_chamo.sql — server chấm Chấm ô (docs/GAMES.md §5.1, §12). Chạy sau 0075.
--
-- Chỉ THÊM một hàm: game_finish (0075) tự tìm public.game_<id>_result(uuid) nên không phải sửa.
-- Không đổi bảng, không đụng Elo / điểm mùa / sổ quỹ.
-- game_create không chặn cỡ bàn Chấm ô (khác Caro ở 0074): cỡ bậy thì luật — cả JS lẫn hàm dưới — tự về cỡ mặc
-- định, nên mảng ở đây không bao giờ quá 8 × 8 ô, và hai bên không bao giờ hiểu cỡ bàn khác nhau.

-- Chấm ô: luật chép từ lib/games/chamo.js.
--   cỡ n = options.size nếu là số nguyên c_min..c_max, không thì c_def (sizeOf);
--   nét: ngang trước (hàng chấm r, cột c → r*n + c), rồi dọc (hàng ô r, cột chấm c → H + r*(n+1) + c), H = n*(n+1);
--   nước sai (ván xong, sai lượt, nét không phải số nguyên 0..2H-1, nét đã nối) bị BỎ QUA như replay();
--   nét khép kín ô nào (đủ 4 cạnh) thì ô đó của người nối và người đó đi tiếp, không khép ô nào thì đổi lượt;
--   hết ô (= hết nét) → nhiều ô hơn thắng, bằng thì hoà. Kết quả kèm số ô (`scores`) như JS.
-- Mảng plpgsql đánh số từ 1: nét i ở v_line[i + 1], ô b ở v_box[b + 1].
CREATE OR REPLACE FUNCTION public.game_chamo_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min  CONSTANT int := 2;      -- = SIZE_MIN
  c_max  CONSTANT int := 8;      -- = SIZE_MAX
  c_def  CONSTANT int := 5;      -- = SIZE_DEFAULT
  v_opt  jsonb;
  v_sz   numeric;
  n      int;
  v_h    int;
  v_line boolean[];
  v_box  smallint[];
  v_left int;
  v_turn int := 0;
  v_won  int;
  m      record;
  v_ln   numeric;
  v_i    int;
  v_adj  int[];
  b      int;
  r      int;
  c      int;
  v_n0   int;
  v_n1   int;
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  IF jsonb_typeof(v_opt -> 'size') = 'number' THEN v_sz := (v_opt ->> 'size')::numeric; END IF;
  -- v_sz NULL (không có / không phải số) → điều kiện ra NULL → về mặc định.
  n := CASE WHEN v_sz = trunc(v_sz) AND v_sz BETWEEN c_min AND c_max THEN v_sz::int ELSE c_def END;
  v_h := n * (n + 1);
  v_line := array_fill(false, ARRAY[2 * v_h]);
  v_box := array_fill(NULL::smallint, ARRAY[n * n]);
  v_left := n * n;

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_left = 0 OR m.seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;
    IF jsonb_typeof(m.move -> 'line') IS DISTINCT FROM 'number' THEN CONTINUE; END IF;
    v_ln := (m.move ->> 'line')::numeric;
    IF v_ln <> trunc(v_ln) OR v_ln < 0 OR v_ln >= 2 * v_h THEN CONTINUE; END IF;
    v_i := v_ln::int;
    IF v_line[v_i + 1] THEN CONTINUE; END IF;
    v_line[v_i + 1] := true;

    -- Ô kề nét (boxesOf): nét ngang kề ô trên / dưới, nét dọc kề ô trái / phải; NULL = phía đó là ngoài bàn.
    IF v_i < v_h THEN
      r := v_i / n;
      c := v_i % n;
      v_adj := ARRAY[CASE WHEN r > 0 THEN (r - 1) * n + c END, CASE WHEN r < n THEN r * n + c END];
    ELSE
      r := (v_i - v_h) / (n + 1);
      c := (v_i - v_h) % (n + 1);
      v_adj := ARRAY[CASE WHEN c > 0 THEN r * n + c - 1 END, CASE WHEN c < n THEN r * n + c END];
    END IF;

    v_won := 0;
    FOREACH b IN ARRAY v_adj LOOP
      CONTINUE WHEN b IS NULL;
      r := b / n;
      c := b % n;
      -- Bốn cạnh của ô (edgesOf): trên, dưới, trái, phải.
      IF v_line[r * n + c + 1] AND v_line[(r + 1) * n + c + 1]
         AND v_line[v_h + r * (n + 1) + c + 1] AND v_line[v_h + r * (n + 1) + c + 2] THEN
        v_box[b + 1] := v_turn;
        v_won := v_won + 1;
      END IF;
    END LOOP;

    v_left := v_left - v_won;
    IF v_won = 0 THEN v_turn := 1 - v_turn; END IF;   -- khép được ô thì đi tiếp
  END LOOP;

  IF v_left > 0 THEN RETURN NULL; END IF;
  SELECT count(*) FILTER (WHERE x = 0), count(*) FILTER (WHERE x = 1) INTO v_n0, v_n1 FROM unnest(v_box) AS x;
  RETURN jsonb_build_object(
    'winners', CASE WHEN v_n0 = v_n1 THEN '[]'::jsonb ELSE jsonb_build_array(CASE WHEN v_n0 > v_n1 THEN 0 ELSE 1 END) END,
    'draw', v_n0 = v_n1,
    'scores', jsonb_build_object('0', v_n0, '1', v_n1));
END;
$$;
REVOKE ALL ON FUNCTION public.game_chamo_result(uuid) FROM PUBLIC, anon, authenticated;
