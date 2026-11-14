-- 0109_games_xo_time.sql — Cờ X-O 3 × 3: ĐỒNG HỒ LƯỢT, hết giờ thì MẤT LƯỢT (docs/GAMES.md §12). Chủ dự án chốt 2026-11-13.
--
-- Tuỳ chọn phòng options.time = 3 | 5 | 10 giây mỗi nước (khác = 0 = không tính giờ — mọi phòng tạo trước file này).
-- Hạn lượt = giờ ghi (created_at) của lượt hợp lệ gần nhất + time. Nước ĐẦU ván không tính giờ (chưa có lượt nào để tính
-- từ đó). Hết giờ: máy bất kỳ đang ngồi bàn gửi { timeout: true } →
--   game_xo_check — chỉ nhận khi now() đã qua hạn (sớm → games.err.notYet, máy khách im lặng thử lại; phòng không tính
--                   giờ / chưa có nước đầu → games.err.badMove; ván đã xong → games.err.over). Nước thường KHÔNG kiểm ở
--                   đây — như trước (§5.1): nước sai vẫn vào log, mọi máy và hàm chấm bỏ qua.
--   game_xo_fill  — đóng dấu { timeout: true, skip: true }. Chỉ dòng có `skip` mới làm mất lượt khi dựng lại; máy khách tự
--                   gửi `skip` bị game_xo_check từ chối.
-- Mất lượt: không đặt quân nào, lượt sang đối thủ, tính giờ lại từ dòng đó. Lượt bị mất vẫn tính vào số lượt → hai bên
-- cùng bỏ mặc thì ván vẫn hết (hoà) sau 2 × c_cap lượt.
-- Luật hoà đổi cách viết (KHÔNG đổi kết quả ván không có lượt bị mất): đầy bàn HOẶC đủ 2 × c_cap lượt. Cổ điển không mất
-- lượt thì đầy bàn đúng ở lượt thứ 9 như 0107; move / vanish không bao giờ đầy bàn nên vẫn là 2 × c_cap.
--
-- CHẠY SAU 0107. Chạy lại được (CREATE OR REPLACE). CHỈ THÊM / THAY HÀM — không đổi bảng, không đổi dữ liệu, không đụng
-- Elo / điểm mùa / sổ quỹ.
--   THÊM: game_xo_run (dựng lại ván — thân chép game_xo_result của 0107, chỗ mới ghi chú "0109") · game_xo_check ·
--         game_xo_fill (game_move 0078 tự tìm theo tên).
--   THAY: game_xo_result — giờ chỉ đọc game_xo_run.
-- Chép luật lib/games/xo.js (TIMES, optsOf, deadlineOf, validate / apply nhánh timeout, luật hoà) — đổi một bên phải đổi
-- bên kia. Bộ ván mẫu của supabase/manual/0107_games_xo_check.sql vẫn chạy được với bản này và phải ra đúng kết quả cũ.

BEGIN;

/* ---------- 1. Dựng lại ván ---------- */
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
  m        record;
BEGIN
  -- 0109: options.time — đúng số JSON 3 / 5 / 10 mới tính giờ (chuỗi "3", số khác → 0).
  SELECT CASE WHEN options ->> 'mode' IN ('move', 'vanish') THEN options ->> 'mode' ELSE 'classic' END,
         CASE WHEN options -> 'time' IN ('3'::jsonb, '5'::jsonb, '10'::jsonb) THEN (options ->> 'time')::numeric::int ELSE 0 END
    INTO v_mode, v_time FROM game_rooms WHERE id = p_room;

  FOR m IN SELECT seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at
             FROM game_moves WHERE room_id = p_room ORDER BY seq LOOP
    IF v_over OR jsonb_typeof(m.move) IS DISTINCT FROM 'object' THEN CONTINUE; END IF;

    /* ----- 0109: hết giờ → mất lượt (chỉ dòng server đã đóng dấu skip; ghế của dòng là máy báo, không xét) ----- */
    IF m.move -> 'timeout' = 'true'::jsonb THEN
      IF m.move -> 'skip' = 'true'::jsonb AND v_time > 0 AND v_since IS NOT NULL THEN
        v_ply := v_ply + 1;
        v_since := m.at;
        v_over := v_ply >= 2 * c_cap;
        v_turn := 1 - v_turn;
      END IF;
      CONTINUE;
    END IF;

    IF m.seat IS DISTINCT FROM v_turn THEN CONTINUE; END IF;
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

/* ---------- 2. Chấm (game_finish 0075) ---------- */
CREATE OR REPLACE FUNCTION public.game_xo_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN o_winner IS NOT NULL THEN jsonb_build_object('winners', jsonb_build_array(o_winner), 'draw', false)
              WHEN o_over THEN jsonb_build_object('winners', '[]'::jsonb, 'draw', true) END
    FROM public.game_xo_run(p_room)
$$;

/* ---------- 3. Kiểm nước (game_move 0078) — chỉ kiểm báo hết giờ ---------- */
CREATE OR REPLACE FUNCTION public.game_xo_check(p_room uuid, p_seat integer, p_move jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF jsonb_typeof(p_move) IS DISTINCT FROM 'object' THEN RETURN NULL; END IF;   -- nước rác: vào log, bị bỏ qua (như trước)
  IF p_move ? 'skip' THEN RETURN 'games.err.badMove'; END IF;                  -- dấu mất lượt chỉ server đóng
  IF NOT (p_move ? 'timeout') THEN RETURN NULL; END IF;                         -- nước thường: luật ở máy khách + hàm chấm
  IF p_move <> '{"timeout": true}'::jsonb THEN RETURN 'games.err.badMove'; END IF;
  SELECT * INTO r FROM game_xo_run(p_room);
  IF r.o_over THEN RETURN 'games.err.over'; END IF;
  IF r.o_time = 0 OR r.o_since IS NULL THEN RETURN 'games.err.badMove'; END IF;
  IF floor(extract(epoch FROM now()) * 1000)::bigint < r.o_since + r.o_time * 1000 THEN RETURN 'games.err.notYet'; END IF;
  RETURN NULL;
END;
$$;

/* ---------- 4. Điền nước (game_move 0078, gọi sau _check) ---------- */
CREATE OR REPLACE FUNCTION public.game_xo_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_move = '{"timeout": true}'::jsonb THEN '{"timeout": true, "skip": true}'::jsonb ELSE p_move END
$$;

REVOKE ALL ON FUNCTION public.game_xo_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xo_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xo_check(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_xo_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
