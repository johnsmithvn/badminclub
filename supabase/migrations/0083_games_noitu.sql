-- 0083_games_noitu.sql — Nối từ: xáo thứ tự lượt, kiểm từ, hạn giờ theo đồng hồ SERVER (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (cần game_start / game_move bản 0078 gọi game_<id>_deal / game_<id>_check).
-- CHỈ THÊM HÀM. Chạy lại được. Không có thông tin ẩn — không dùng game_hands.
--
-- Giờ của mỗi nước = game_moves.created_at (máy khách đọc cùng cột này qua registry.replay). Hết giờ lượt / hết 8 giây
-- duyệt từ do máy bất kỳ báo bằng { timeout } / { close }; hàm check chỉ nhận khi đã đúng là hết giờ theo now() của
-- server, không thì trả games.err.notYet (máy khách im lặng thử lại).
--
-- game_noitu_deal   — (game_start gọi) xáo thứ tự lượt, ghi nước 1 { deal: { order } }.
-- game_noitu_run    — dựng lại ván từ log; có p_move thì kiểm nước đó → o_err; hết ván → o_winner.
-- game_noitu_check  — (game_move gọi) mã lỗi hoặc NULL.
-- game_noitu_result — người cuối cùng còn trụ; game_finish 0075 dùng hàm này, bỏ kết quả client.
-- Chép luật lib/games/noitu.js (đọc options, mẫu chữ, phần nối, chốt phiếu) — đổi luật thì sửa cả hai.

CREATE OR REPLACE FUNCTION public.game_noitu_deal(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order int[];
  v_club  uuid;
BEGIN
  SELECT club_id INTO v_club FROM game_rooms WHERE id = p_room;
  v_order := ARRAY(SELECT seat::int FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY random());
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  VALUES (p_room, 1, v_club, v_order[1], jsonb_build_object('deal', jsonb_build_object('order', to_jsonb(v_order))));
END;
$$;

CREATE OR REPLACE FUNCTION public.game_noitu_run(p_room uuid, p_seat int, p_move jsonb, OUT o_err text, OUT o_winner int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_vote  CONSTANT bigint := 8000;  -- = VOTE_MS
  c_bonus CONSTANT bigint := 3000;  -- = BONUS_MS
  c_grace CONSTANT bigint := 1500;  -- từ tới trễ ngần ấy ms sau hạn vẫn nhận (độ trễ mạng)
  c_asks  CONSTANT int := 2;        -- = ASKS
  c_vi    CONSTANT text := '^[a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]{1,10} '
                           '[a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]{1,10}$';
  c_en    CONSTANT text := '^[a-z]{2,24}$';
  v_opt    jsonb;
  v_lang   text;
  v_link   int;
  v_time   bigint;
  v_order  int[];
  v_alive  boolean[];
  v_n      int;
  v_turn   int;
  v_dead   bigint;            -- hạn lượt hiện tại (ms)
  v_fresh  boolean := true;   -- từ tự do, không cần nối
  v_asks   int := 0;
  v_prev   text;              -- từ được nhận gần nhất
  v_used   text[] := '{}';
  v_vword  text;              -- từ đang duyệt (NULL = không có)
  v_vseat  int;
  v_vat    bigint;
  v_vleft  bigint;
  v_yes    int[];
  v_no     int[];
  v_over   boolean := false;
  v_elim   int;
  v_dec    boolean;
  v_close  boolean;
  v_voters int;
  v_cy     int;
  v_cn     int;
  v_ok     boolean;
  v_lk     text;
  m        record;
  mv       jsonb;
  s        int;
  w        text;
  i        int;
  k        int;
  y        int;
BEGIN
  -- Đọc options như optsOf ở JS.
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_lang := CASE WHEN v_opt ->> 'lang' = 'en' THEN 'en' ELSE 'vi' END;
  -- CASE lồng nhau: chỉ ép kiểu số khi đúng là số (AND không chắc được tính trái sang phải).
  v_link := CASE WHEN jsonb_typeof(v_opt -> 'link') = 'number' THEN CASE WHEN (v_opt ->> 'link')::numeric = 2 THEN 2 ELSE 1 END ELSE 1 END;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (15, 20, 30) THEN (v_opt ->> 'time')::numeric::int ELSE 20 END
                        ELSE 20 END;

  FOR m IN
    SELECT x.seat, x.move, x.at, x.cand FROM (
      SELECT seq, seat::int AS seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at, false AS cand
        FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT 2147483647, p_seat, p_move, floor(extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    mv := m.move;
    s := m.seat;
    v_elim := NULL;
    v_dec := false;
    v_close := false;

    /* Nước đang xin ghi — như validate ở JS, thêm phần giờ. */
    IF m.cand THEN
      IF v_n IS NULL THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF v_over THEN o_err := 'games.err.over'; RETURN; END IF;
      IF jsonb_typeof(mv) IS DISTINCT FROM 'object' OR s IS NULL OR s < 0 OR s >= v_n OR NOT v_alive[s + 1]
         OR mv ? 'out' OR mv ? 'deal' THEN
        o_err := 'games.err.badMove'; RETURN;
      END IF;
      IF mv -> 'close' = 'true'::jsonb THEN
        IF v_vword IS NULL THEN o_err := 'games.err.noVote';
        ELSIF m.at < v_vat + c_vote THEN o_err := 'games.err.notYet';
        END IF;
        RETURN;
      END IF;
      IF mv ? 'vote' THEN
        IF v_vword IS NULL THEN o_err := 'games.err.noVote';
        ELSIF jsonb_typeof(mv -> 'vote') IS DISTINCT FROM 'boolean' OR s = v_vseat THEN o_err := 'games.err.badMove';
        ELSIF s = ANY(v_yes) OR s = ANY(v_no) THEN o_err := 'games.err.voted';
        END IF;
        RETURN;
      END IF;
      IF v_vword IS NOT NULL THEN o_err := 'games.err.voting'; RETURN; END IF;
      IF mv -> 'timeout' = 'true'::jsonb THEN
        IF m.at < v_dead THEN o_err := 'games.err.notYet'; END IF;
        RETURN;
      END IF;
      IF s <> v_turn THEN o_err := 'games.err.notYourTurn'; RETURN; END IF;
      IF mv -> 'giveup' = 'true'::jsonb THEN RETURN; END IF;
      IF NOT mv ? 'word' THEN o_err := 'games.err.badMove'; RETURN; END IF;
      IF m.at > v_dead + c_grace THEN o_err := 'games.err.late'; RETURN; END IF;
      IF v_asks >= c_asks THEN o_err := 'games.err.noAsks'; RETURN; END IF;
      IF jsonb_typeof(mv -> 'word') IS DISTINCT FROM 'string' THEN o_err := 'games.err.badWord'; RETURN; END IF;
      w := mv ->> 'word';
      IF w !~ (CASE WHEN v_lang = 'vi' THEN c_vi ELSE c_en END) THEN o_err := 'games.err.badWord'; RETURN; END IF;
      IF NOT v_fresh AND v_prev IS NOT NULL THEN
        v_lk := CASE WHEN v_lang = 'vi' THEN split_part(v_prev, ' ', 2) || ' ' ELSE right(v_prev, v_link) END;
        IF left(w, length(v_lk)) <> v_lk OR length(w) <= length(v_lk) THEN o_err := 'games.err.noLink'; RETURN; END IF;
      END IF;
      IF w = ANY(v_used) THEN o_err := 'games.err.usedWord'; END IF;
      RETURN;
    END IF;

    /* Nước trong log — đã kiểm lúc ghi, chỉ áp (như apply ở JS). */
    IF v_n IS NULL THEN
      IF jsonb_typeof(mv #> '{deal,order}') IS DISTINCT FROM 'array' THEN CONTINUE; END IF;
      v_order := ARRAY(SELECT (e)::int FROM jsonb_array_elements_text(mv #> '{deal,order}') e);
      v_n := cardinality(v_order);
      v_alive := array_fill(true, ARRAY[v_n]);
      v_turn := v_order[1];
      v_dead := m.at + v_time;
      CONTINUE;
    END IF;
    IF v_over OR s < 0 OR s >= v_n OR NOT v_alive[s + 1] THEN CONTINUE; END IF;

    IF mv -> 'out' = 'true'::jsonb THEN
      IF v_vword IS NOT NULL AND v_vseat <> s THEN
        -- Người duyệt rời bàn: bớt một phiếu, có thể chốt luôn.
        v_alive[s + 1] := false;
        IF (SELECT count(*) FROM unnest(v_alive) a WHERE a) <= 1 THEN v_alive[s + 1] := true; v_elim := s;
        ELSE v_dec := true;
        END IF;
      ELSIF v_vword IS NOT NULL OR v_turn = s THEN
        v_elim := s;
      ELSE
        v_alive[s + 1] := false;
        IF (SELECT count(*) FROM unnest(v_alive) a WHERE a) <= 1 THEN v_alive[s + 1] := true; v_elim := s; END IF;
      END IF;
    ELSIF mv ? 'word' THEN
      v_asks := v_asks + 1;
      v_vword := mv ->> 'word';
      v_vseat := s;
      v_vat := m.at;
      v_vleft := GREATEST(0, v_dead - m.at);
      v_yes := '{}';
      v_no := '{}';
    ELSIF mv ? 'vote' THEN
      IF mv -> 'vote' = 'true'::jsonb THEN v_yes := v_yes || s; ELSE v_no := v_no || s; END IF;
      v_dec := true;
    ELSIF mv -> 'close' = 'true'::jsonb THEN
      v_dec := true;
      v_close := true;
    ELSIF mv -> 'giveup' = 'true'::jsonb OR mv -> 'timeout' = 'true'::jsonb THEN
      v_elim := v_turn;
    END IF;

    IF v_elim IS NOT NULL THEN
      -- Loại một người; còn một là hết ván, không thì người kế tiếp bắt đầu lại bằng từ tự do.
      v_alive[v_elim + 1] := false;
      v_vword := NULL;
      IF (SELECT count(*) FROM unnest(v_alive) a WHERE a) <= 1 THEN
        v_over := true;
        o_winner := (SELECT g - 1 FROM generate_subscripts(v_alive, 1) g WHERE v_alive[g] ORDER BY g LIMIT 1);
      ELSE
        i := array_position(v_order, v_elim);
        FOR k IN 1..v_n LOOP y := v_order[((i - 1 + k) % v_n) + 1]; IF v_alive[y + 1] THEN v_turn := y; EXIT; END IF; END LOOP;
        v_dead := m.at + v_time;
        v_fresh := true;
        v_asks := 0;
      END IF;
    ELSIF v_dec THEN
      -- Chốt phiếu khi đã rõ (hoặc hết 8 giây: tính theo phiếu đang có). Không ai phản đối là được.
      SELECT count(*) INTO v_voters FROM unnest(v_order) x WHERE v_alive[x + 1] AND x <> v_vseat;
      SELECT count(*) INTO v_cy FROM unnest(v_yes) x WHERE v_alive[x + 1] AND x <> v_vseat;
      SELECT count(*) INTO v_cn FROM unnest(v_no) x WHERE v_alive[x + 1] AND x <> v_vseat;
      v_ok := CASE WHEN v_close THEN v_cn <= v_cy ELSE v_cy >= v_cn + (v_voters - v_cy - v_cn) END;
      IF v_ok OR v_close OR v_cn > v_cy + (v_voters - v_cy - v_cn) THEN
        v_used := v_used || v_vword;
        IF v_ok THEN
          v_prev := v_vword;
          i := array_position(v_order, v_vseat);
          FOR k IN 1..v_n LOOP y := v_order[((i - 1 + k) % v_n) + 1]; IF v_alive[y + 1] THEN v_turn := y; EXIT; END IF; END LOOP;
          v_dead := m.at + v_time;
          v_fresh := false;
          v_asks := 0;
        ELSE
          v_dead := m.at + v_vleft + c_bonus;
        END IF;
        v_vword := NULL;
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.game_noitu_check(p_room uuid, p_seat int, p_move jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT o_err FROM public.game_noitu_run(p_room, p_seat, p_move) $$;

CREATE OR REPLACE FUNCTION public.game_noitu_result(p_room uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN o_winner IS NOT NULL THEN jsonb_build_object('winners', jsonb_build_array(o_winner), 'draw', false) END
    FROM public.game_noitu_run(p_room, NULL, NULL)
$$;

REVOKE ALL ON FUNCTION public.game_noitu_deal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_noitu_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_noitu_check(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_noitu_result(uuid) FROM PUBLIC, anon, authenticated;
