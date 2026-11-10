-- 0076_games_colat.sql — server chấm Cờ lật (docs/GAMES.md §5.1, §12). Chạy sau 0075.
--
-- Chỉ THÊM hàm: game_finish (0075) tự tìm public.game_<id>_result(uuid) nên không phải sửa.
--   - game_colat_flips: các ô bị lật nếu một bên đặt quân vào một ô (thuần, dùng nội bộ).
--   - game_colat_result: luật Cờ lật chép từ lib/games/colat.js.
-- Không đổi bảng, không đụng Elo / điểm mùa / sổ quỹ.

-- Ô bị lật khi `p_seat` đặt vào ô p_i (0..63, i = hàng * 8 + cột) — mảng rỗng = không đặt được.
-- Đi theo hàng / cột (r, c) chứ không cộng chỉ số, nên không tràn từ cuối hàng này sang đầu hàng kia.
-- Lưu ý: p_b[...] ngoài mảng trả NULL, và "r BETWEEN 0 AND 7 AND ..." sai thì cả biểu thức sai — không cần thứ tự tính.
CREATE OR REPLACE FUNCTION public.game_colat_flips(p_b smallint[], p_i int, p_seat int)
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_dirs CONSTANT int[] := ARRAY[[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  v_out  int[] := '{}';
  v_line int[];
  k      int;
  r      int;
  c      int;
BEGIN
  IF p_b[p_i + 1] IS NOT NULL THEN RETURN v_out; END IF;
  FOR k IN 1 .. 8 LOOP
    v_line := '{}';
    r := p_i / 8 + c_dirs[k][1];
    c := p_i % 8 + c_dirs[k][2];
    WHILE r BETWEEN 0 AND 7 AND c BETWEEN 0 AND 7 AND p_b[r * 8 + c + 1] = 1 - p_seat LOOP
      v_line := v_line || (r * 8 + c);
      r := r + c_dirs[k][1];
      c := c + c_dirs[k][2];
    END LOOP;
    IF r BETWEEN 0 AND 7 AND c BETWEEN 0 AND 7 AND p_b[r * 8 + c + 1] = p_seat THEN   -- v_line rỗng thì nối không đổi gì
      v_out := v_out || v_line;
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.game_colat_flips(smallint[], int, int) FROM PUBLIC, anon, authenticated;

-- Cờ lật: luật chép từ lib/games/colat.js.
--   xếp quân: ghế 1 (trắng) ở 27, 36 · ghế 0 (đen, đi trước) ở 28, 35;
--   nước sai (ván xong, sai lượt, ô không phải số nguyên 0..63, ô có quân, không kẹp được quân nào) bị BỎ QUA
--   như replay();
--   đặt quân → lật mọi hàng bị kẹp → lượt sang đối phương nếu họ có nước, không thì người vừa đi đi tiếp,
--   cả hai không có nước → hết ván: nhiều quân hơn thắng, bằng thì hoà. Kết quả kèm số quân (`scores`) như JS.
CREATE OR REPLACE FUNCTION public.game_colat_result(p_room uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b    smallint[];
  v_turn int := 0;
  v_over boolean := false;
  m      record;
  v_cn   numeric;
  v_cell int;
  v_flip int[];
  v_n0   int;
  v_n1   int;
  i      int;
BEGIN
  v_b := array_fill(NULL::smallint, ARRAY[64]);
  FOREACH i IN ARRAY ARRAY[27, 36] LOOP v_b[i + 1] := 1; END LOOP;
  FOREACH i IN ARRAY ARRAY[28, 35] LOOP v_b[i + 1] := 0; END LOOP;

  FOR m IN SELECT seat, move FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_over OR m.seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;
    IF jsonb_typeof(m.move -> 'cell') IS DISTINCT FROM 'number' THEN CONTINUE; END IF;
    v_cn := (m.move ->> 'cell')::numeric;
    IF v_cn <> trunc(v_cn) OR v_cn NOT BETWEEN 0 AND 63 THEN CONTINUE; END IF;
    v_cell := v_cn::int;
    v_flip := game_colat_flips(v_b, v_cell, v_turn);   -- ô có quân cũng ra rỗng
    IF cardinality(v_flip) = 0 THEN CONTINUE; END IF;

    v_b[v_cell + 1] := v_turn;
    FOREACH i IN ARRAY v_flip LOOP v_b[i + 1] := v_turn; END LOOP;

    IF EXISTS (SELECT 1 FROM generate_series(0, 63) AS x WHERE cardinality(game_colat_flips(v_b, x, 1 - v_turn)) > 0) THEN
      v_turn := 1 - v_turn;
    ELSIF NOT EXISTS (SELECT 1 FROM generate_series(0, 63) AS x WHERE cardinality(game_colat_flips(v_b, x, v_turn)) > 0) THEN
      v_over := true;
    END IF;
  END LOOP;

  IF NOT v_over THEN RETURN NULL; END IF;
  SELECT count(*) FILTER (WHERE x = 0), count(*) FILTER (WHERE x = 1) INTO v_n0, v_n1 FROM unnest(v_b) AS x;
  RETURN jsonb_build_object(
    'winners', CASE WHEN v_n0 = v_n1 THEN '[]'::jsonb ELSE jsonb_build_array(CASE WHEN v_n0 > v_n1 THEN 0 ELSE 1 END) END,
    'draw', v_n0 = v_n1,
    'scores', jsonb_build_object('0', v_n0, '1', v_n1));
END;
$$;
REVOKE ALL ON FUNCTION public.game_colat_result(uuid) FROM PUBLIC, anon, authenticated;
