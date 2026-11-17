-- 0112_games_masoi_night.sql — Ma sói: server không cho sang bước đêm / Phù thủy trước đủ 45 giây (docs/GAMES.md §5.2
-- "Nhịp đêm không được lộ vai"). Từ 2026-11-12 máy khách đã tự chờ đủ 45 giây (masoi.js advanceAt); bản này bắt cả server
-- chờ, để máy khách sửa code cũng không làm đêm ngắn đi được (bước Phù thủy xong trong vài giây = Phù thủy đã chết).
--
-- CHẠY SAU 0084 (0086, 0087 không đụng hàm này). Chạy lại được (CREATE OR REPLACE giữ quyền đã thu ở 0084).
-- Chép nguyên game_masoi_run của 0084, chỉ đổi khối `done :=` (ghi "0112"). Nước trong log không bị kiểm lại — chỉ nước
-- { next } đang xin ghi. Sớm → games.err.notYet như khi chưa đủ người (máy khách im lặng thử lại).
-- Kiểm trên DB thật: supabase/manual/0112_games_masoi_night_check.sql. Lưu ý: bước 4 của 0087_games_masoi_roles_check.sql
-- (bấm sang bước ngay sau khi cả làng bấm) sẽ báo notYet sau bản này — đúng ý, file đó viết cho 0087.

BEGIN;

CREATE OR REPLACE FUNCTION public.game_masoi_run(p_room uuid, p_seat int, p_move jsonb,
  OUT o_err text, OUT o_n int, OUT o_phase text, OUT o_night int, OUT o_alive boolean[], OUT o_acted boolean[],
  OUT o_votes int[], OUT o_hunter int, OUT o_shot int, OUT o_after text, OUT o_settle boolean, OUT o_over jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m    record;
  mv   jsonb;
  s    int;
  t    int;
  nx   text;
  i    int;
  done boolean;
  v_opt   jsonb;
  v_time  bigint;
  v_since bigint;
BEGIN
  o_settle := false;
  -- Đọc options như optsOf ở JS. CASE lồng nhau: chỉ ép kiểu số khi đúng là số.
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (0, 60, 120, 180, 300) THEN (v_opt ->> 'time')::numeric::int ELSE 120 END
                        ELSE 120 END;
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

    /* Nước đang xin ghi (máy khách gửi) — như validate ở JS. */
    IF m.cand THEN
      IF o_over IS NOT NULL THEN o_err := 'games.err.over'; RETURN; END IF;
      IF o_n IS NULL OR jsonb_typeof(mv) IS DISTINCT FROM 'object' OR mv ? 'deal' OR mv ? 'out'
         OR s IS NULL OR s < 0 OR s >= o_n THEN
        o_err := 'games.err.badMove'; RETURN;
      END IF;
      IF mv ? 'next' THEN
        -- 0112: bước đêm / Phù thủy LUÔN chờ đủ 45 giây kể từ lúc mở bước, kể cả khi cả làng đã bấm — xong sớm là lộ vai
        -- (Phù thủy chết thì bước Phù thủy ngắn hẳn). Phòng tắt giờ: đủ 45 giây VÀ cả làng đã bấm. Ngày / Thợ săn như 0084.
        done := o_settle
          OR (o_phase IN ('night', 'witch') AND m.at >= v_since + 45000
              AND (v_time > 0 OR NOT EXISTS (SELECT 1 FROM generate_series(1, o_n) j WHERE o_alive[j] AND NOT o_acted[j])))
          OR (o_phase = 'day' AND (NOT EXISTS (SELECT 1 FROM generate_series(1, o_n) j WHERE o_alive[j] AND o_votes[j] IS NULL)
                                   OR (v_time > 0 AND m.at >= v_since + v_time)))
          OR (o_phase = 'hunter' AND (o_shot IS NOT NULL OR (v_time > 0 AND m.at >= v_since + 45000)));
        IF mv -> 'next' IS DISTINCT FROM 'true'::jsonb THEN o_err := 'games.err.badMove';
        ELSIF NOT done THEN o_err := 'games.err.notYet';
        END IF;
        RETURN;
      END IF;
      IF mv ? 'night' THEN
        IF COALESCE(o_phase, '') NOT IN ('night', 'witch') THEN o_err := 'games.err.badMove';
        ELSIF NOT o_alive[s + 1] THEN o_err := 'games.err.dead';
        ELSIF o_acted[s + 1] THEN o_err := 'games.err.acted';
        END IF;
        RETURN;
      END IF;
      IF mv ? 'vote' THEN
        t := game_masoi_pick(mv -> 'vote');
        IF COALESCE(o_phase, '') <> 'day' THEN o_err := 'games.err.badMove';
        ELSIF NOT o_alive[s + 1] THEN o_err := 'games.err.dead';
        ELSIF o_votes[s + 1] IS NOT NULL THEN o_err := 'games.err.acted';
        ELSIF t IS NULL OR (t <> -1 AND (t >= o_n OR t = s OR NOT o_alive[t + 1])) THEN o_err := 'games.err.badTarget';
        END IF;
        RETURN;
      END IF;
      IF mv ? 'shoot' THEN
        t := game_masoi_pick(mv -> 'shoot');
        IF COALESCE(o_phase, '') <> 'hunter' OR s IS DISTINCT FROM o_hunter OR o_shot IS NOT NULL THEN o_err := 'games.err.badMove';
        ELSIF t IS NULL OR (t <> -1 AND (t >= o_n OR t = s OR NOT o_alive[t + 1])) THEN o_err := 'games.err.badTarget';
        END IF;
        RETURN;
      END IF;
      o_err := 'games.err.badMove';
      RETURN;
    END IF;

    /* Nước đã ghi (server đã kiểm lúc ghi). */
    IF mv ? 'deal' THEN
      o_n := (mv -> 'deal' ->> 'n')::int;
      o_alive := array_fill(true, ARRAY[o_n]);
      o_acted := array_fill(false, ARRAY[o_n]);
      o_votes := array_fill(NULL::int, ARRAY[o_n]);
      o_phase := 'night';
      o_night := 1;
      v_since := m.at;
      CONTINUE;
    END IF;
    IF o_n IS NULL OR o_over IS NOT NULL THEN CONTINUE; END IF;

    IF mv -> 'out' = 'true'::jsonb THEN
      IF o_phase = 'hunter' AND o_hunter = s AND o_shot IS NULL THEN o_shot := -1; END IF;
      IF o_alive[s + 1] THEN
        o_alive[s + 1] := false;
        o_votes[s + 1] := NULL;
        o_settle := true;
      END IF;
    ELSIF mv ? 'night' THEN
      o_acted[s + 1] := true;
    ELSIF mv ? 'vote' THEN
      o_votes[s + 1] := (mv ->> 'vote')::int;
    ELSIF mv ? 'shoot' THEN
      o_shot := (mv ->> 'shoot')::int;
    ELSIF mv ? 'next' THEN
      nx := mv ->> 'next';
      IF nx <> 'settle' THEN v_since := m.at; END IF;
      FOR t IN SELECT (e)::int FROM jsonb_array_elements_text(COALESCE(mv -> 'dead', '[]'::jsonb)) e LOOP
        o_alive[t + 1] := false;
      END LOOP;
      FOR i IN 1 .. o_n LOOP
        IF NOT o_alive[i] THEN o_votes[i] := NULL; END IF;
      END LOOP;
      IF nx = 'over' THEN
        o_over := mv -> 'over';
        o_phase := NULL;
        o_settle := false;
      ELSIF nx = 'settle' THEN
        o_settle := false;
      ELSIF nx = 'witch' THEN
        o_phase := 'witch';
        o_acted := array_fill(false, ARRAY[o_n]);
      ELSIF nx = 'hunter' THEN
        o_after := CASE WHEN o_phase = 'day' THEN 'night' ELSE 'day' END;
        o_phase := 'hunter';
        o_hunter := (mv ->> 'hunter')::int;
        o_shot := NULL;
      ELSIF nx = 'day' THEN
        o_phase := 'day';
        o_votes := array_fill(NULL::int, ARRAY[o_n]);
      ELSE
        o_phase := 'night';
        o_night := o_night + 1;
        o_acted := array_fill(false, ARRAY[o_n]);
        o_votes := array_fill(NULL::int, ARRAY[o_n]);
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.game_masoi_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
