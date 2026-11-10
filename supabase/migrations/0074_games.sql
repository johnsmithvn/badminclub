-- 0074_games.sql — Mini-game trong CLB: phòng chơi, ghế, log nước đi. Thiết kế: docs/GAMES.md.
--
-- CHỈ THÊM MỚI: 3 bảng game_* và 6 RPC game_*. Không sửa bảng / hàm / dữ liệu có sẵn.
-- Không đụng matches / player_ratings / clubs.seasons → không đổi Elo, điểm mùa, sổ quỹ.
-- Chạy lại được: CREATE … IF NOT EXISTS · CREATE OR REPLACE · DROP POLICY IF EXISTS trước CREATE POLICY.
--
-- Luật (chốt với chủ dự án 2026-11-06):
--   - Ai trong CLB cũng tạo / vào phòng được. Cả CLB đọc được mọi phòng (người xem).
--   - Client KHÔNG ghi thẳng bảng nào, mọi lượt ghi qua RPC SECURITY DEFINER bên dưới.
--   - Server KHÔNG hiểu luật game: chỉ giữ thứ tự nước (PK room_id + seq) và ai được ghi.
--     Luật chạy ở client (lib/games/*), state dựng lại từ log, nước sai bị mọi máy bỏ qua.
--   - Kết quả ván: Caro do SERVER tự dựng lại từ log và tự chấm (game_caro_result) — client không
--     bịa được. Game khác (sau này) dùng kết quả client báo cho tới khi có Edge Function.
--   - Mất kết nối: người ngồi ghế gửi nhịp (game_ping → seen_at). Quá 120 giây không thấy nhịp
--     thì người còn lại đòi xử thắng được (game_claim). Số 120 phải khớp app.json → games.reconnectGraceSec.
--   - Không xoá cứng: rời phòng = left_at, phòng bỏ dở = status 'abandoned'.
-- Mã lỗi RAISE là key i18n `games.err.*`, client dịch bằng t(e.message).

BEGIN;

/* ---------- 1. BẢNG ---------- */

CREATE TABLE IF NOT EXISTS public.game_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  game        text NOT NULL CHECK (game ~ '^[a-z][a-z0-9_]{1,30}$'),   -- key trong lib/games/registry.js
  code        char(6) NOT NULL,                                       -- mã mời, unique theo CLB
  host_id     uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'abandoned')),
  private     boolean NOT NULL DEFAULT false,                         -- true = không hiện ở sảnh, vào bằng mã / link
  options     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(options) = 'object' AND pg_column_size(options) < 2000),
  seed        text,                                                   -- sinh lúc bắt đầu ván
  result      jsonb,                                                  -- { winners: [seat], draw, forfeit? }
  next_room   uuid REFERENCES public.game_rooms(id) ON DELETE SET NULL, -- "Chơi lại" → phòng mới
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  ended_at    timestamptz,
  UNIQUE (club_id, code)
);

CREATE INDEX IF NOT EXISTS game_rooms_club_idx ON public.game_rooms (club_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.game_room_players (
  room_id    uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  seat       smallint NOT NULL CHECK (seat BETWEEN 0 AND 15),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz,
  seen_at    timestamptz NOT NULL DEFAULT now(),                    -- nhịp gần nhất (game_ping / game_move)
  PRIMARY KEY (room_id, member_id)
);

-- Một ghế chỉ một người ĐANG ngồi; người đã rời không giữ ghế.
CREATE UNIQUE INDEX IF NOT EXISTS game_room_players_seat_uq ON public.game_room_players (room_id, seat) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS game_room_players_member_idx ON public.game_room_players (member_id);

CREATE TABLE IF NOT EXISTS public.game_moves (
  room_id    uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  seq        int NOT NULL CHECK (seq > 0),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  seat       smallint NOT NULL,
  move       jsonb NOT NULL CHECK (pg_column_size(move) < 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Hai máy gửi cùng một seq → máy sau nhận 23505 → client nạp lại log.
  PRIMARY KEY (room_id, seq)
);

/* ---------- 2. QUYỀN ---------- */

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;

-- Supabase mặc định cấp ALL cho anon/authenticated trên bảng mới → thu hồi, chỉ cho đọc.
REVOKE ALL ON public.game_rooms FROM anon, authenticated;
REVOKE ALL ON public.game_room_players FROM anon, authenticated;
REVOKE ALL ON public.game_moves FROM anon, authenticated;
GRANT SELECT ON public.game_rooms TO authenticated;
GRANT SELECT ON public.game_room_players TO authenticated;
GRANT SELECT ON public.game_moves TO authenticated;

DROP POLICY IF EXISTS game_rooms_read ON public.game_rooms;
CREATE POLICY game_rooms_read ON public.game_rooms FOR SELECT TO authenticated USING (is_club_member(club_id));

DROP POLICY IF EXISTS game_room_players_read ON public.game_room_players;
CREATE POLICY game_room_players_read ON public.game_room_players FOR SELECT TO authenticated USING (is_club_member(club_id));

DROP POLICY IF EXISTS game_moves_read ON public.game_moves;
CREATE POLICY game_moves_read ON public.game_moves FOR SELECT TO authenticated USING (is_club_member(club_id));

/* ---------- 3. REALTIME ---------- */
-- Phòng đang mở nghe thay đổi của 3 bảng (storage.js: subscribeGameRoom). Realtime vẫn đi qua RLS ở trên.

DO $pub$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE '0074: không có publication supabase_realtime — bỏ qua bước bật realtime';
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['game_rooms', 'game_room_players', 'game_moves'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$pub$;

/* ---------- 4. RPC ---------- */

-- Bản ghi thành viên của người gọi trong CLB, hoặc lỗi.
CREATE OR REPLACE FUNCTION public.game_me(p_club uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v uuid;
BEGIN
  SELECT id INTO v FROM club_members WHERE club_id = p_club AND user_id = auth.uid() AND active LIMIT 1;
  IF v IS NULL THEN RAISE EXCEPTION 'games.err.notMember'; END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.game_me(uuid) FROM PUBLIC, anon, authenticated;

-- Khoá dòng phòng (chống hai người cùng vào ghế cuối / cùng bấm bắt đầu) + người gọi.
CREATE OR REPLACE FUNCTION public.game_lock(p_room uuid, OUT o_room game_rooms, OUT o_me uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT * INTO o_room FROM game_rooms WHERE id = p_room FOR UPDATE;
  IF o_room.id IS NULL THEN RAISE EXCEPTION 'games.err.notFound'; END IF;
  o_me := game_me(o_room.club_id);
END;
$$;
REVOKE ALL ON FUNCTION public.game_lock(uuid) FROM PUBLIC, anon, authenticated;

-- Tạo phòng, người tạo ngồi ghế 0. p_from = phòng vừa chơi xong ("Chơi lại"): gắn next_room để
-- người còn lại trong phòng cũ thấy nút vào ván mới. Trả id phòng mới.
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
    COALESCE((p_options ->> 'size')::int, 15) BETWEEN 5 AND 25
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

-- Vào ghế trống thấp nhất. Đã ngồi rồi thì thôi. p_max = số người tối đa của game (registry).
CREATE OR REPLACE FUNCTION public.game_join(p_room uuid, p_max int)
RETURNS smallint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_seat smallint;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  SELECT seat INTO v_seat FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL;
  IF v_seat IS NOT NULL THEN RETURN v_seat; END IF;
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;

  SELECT min(s)::smallint INTO v_seat FROM generate_series(0, LEAST(GREATEST(p_max, 2), 16) - 1) s
   WHERE NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND seat = s AND left_at IS NULL);
  IF v_seat IS NULL THEN RAISE EXCEPTION 'games.err.full'; END IF;

  INSERT INTO game_room_players (room_id, member_id, club_id, seat) VALUES (p_room, c.o_me, (c.o_room).club_id, v_seat)
  ON CONFLICT (room_id, member_id) DO UPDATE SET seat = EXCLUDED.seat, left_at = NULL, joined_at = now(), seen_at = now();
  RETURN v_seat;
END;
$$;

-- Rời phòng.
--   Đang chờ: rời ghế; chủ phòng rời thì chuyển cho người ngồi ghế thấp nhất, hết người thì 'abandoned'.
--   Đang chơi: coi như ĐẦU HÀNG. Còn đúng một người → người đó thắng; không còn ai → 'abandoned'.
CREATE OR REPLACE FUNCTION public.game_leave(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_left int;
  v_next uuid;
  v_seat smallint;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status IN ('finished', 'abandoned') THEN RETURN; END IF;
  UPDATE game_room_players SET left_at = now() WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO v_left FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;

  IF (c.o_room).status = 'waiting' THEN
    IF v_left = 0 THEN
      UPDATE game_rooms SET status = 'abandoned', ended_at = now() WHERE id = p_room;
    ELSIF (c.o_room).host_id = c.o_me THEN
      SELECT member_id INTO v_next FROM game_room_players WHERE room_id = p_room AND left_at IS NULL ORDER BY seat LIMIT 1;
      UPDATE game_rooms SET host_id = v_next WHERE id = p_room;
    END IF;
    RETURN;
  END IF;

  -- status = 'playing'
  IF v_left = 0 THEN
    UPDATE game_rooms SET status = 'abandoned', ended_at = now() WHERE id = p_room;
  ELSIF v_left = 1 THEN
    SELECT seat INTO v_seat FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
    UPDATE game_rooms SET status = 'finished', ended_at = now(),
      result = jsonb_build_object('winners', jsonb_build_array(v_seat), 'draw', false, 'forfeit', true)
     WHERE id = p_room;
  END IF;
END;
$$;

-- Chủ phòng bắt đầu ván. Đánh số lại ghế 0..n-1 theo thứ tự đang ngồi, sinh seed.
CREATE OR REPLACE FUNCTION public.game_start(p_room uuid, p_min int, p_max int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_n int;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).host_id <> c.o_me THEN RAISE EXCEPTION 'games.err.notHost'; END IF;
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;
  SELECT count(*) INTO v_n FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  IF v_n < GREATEST(p_min, 2) OR v_n > p_max THEN RAISE EXCEPTION 'games.err.badCount'; END IF;

  -- Hai bước để không đụng unique (room_id, seat) giữa chừng.
  UPDATE game_room_players SET seat = seat + 100 WHERE room_id = p_room AND left_at IS NULL;
  UPDATE game_room_players p SET seat = r.n
    FROM (SELECT member_id, (row_number() OVER (ORDER BY seat) - 1)::smallint AS n
            FROM game_room_players WHERE room_id = p_room AND left_at IS NULL) r
   WHERE p.room_id = p_room AND p.member_id = r.member_id;

  UPDATE game_rooms SET status = 'playing', started_at = now(), seed = gen_random_uuid()::text WHERE id = p_room;
END;
$$;

-- Ghi một nước. p_seq phải liền sau nước cuối, không thì máy đó đang thiếu log → nạp lại.
CREATE OR REPLACE FUNCTION public.game_move(p_room uuid, p_seq int, p_move jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room game_rooms;
  v_me   uuid;
  v_seat smallint;
  v_last int;
BEGIN
  -- Không khoá dòng phòng: PK (room_id, seq) đã chặn hai nước cùng seq.
  SELECT * INTO v_room FROM game_rooms WHERE id = p_room;
  IF v_room.id IS NULL THEN RAISE EXCEPTION 'games.err.notFound'; END IF;
  v_me := game_me(v_room.club_id);
  IF v_room.status <> 'playing' THEN RAISE EXCEPTION 'games.err.notPlaying'; END IF;
  SELECT seat INTO v_seat FROM game_room_players WHERE room_id = p_room AND member_id = v_me AND left_at IS NULL;
  IF v_seat IS NULL THEN RAISE EXCEPTION 'games.err.notSeated'; END IF;
  SELECT COALESCE(max(seq), 0) INTO v_last FROM game_moves WHERE room_id = p_room;
  IF p_seq <> v_last + 1 THEN RAISE EXCEPTION 'games.err.stale'; END IF;

  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES (p_room, p_seq, v_room.club_id, v_seat, p_move);
  UPDATE game_room_players SET seen_at = now() WHERE room_id = p_room AND member_id = v_me;
END;
$$;

-- Nhịp "tôi vẫn ở đây" của người ngồi ghế, client gửi mỗi games.pingSec giây khi đang mở phòng.
-- Không khoá phòng: chỉ đụng đúng dòng ghế của mình.
CREATE OR REPLACE FUNCTION public.game_ping(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE game_room_players p SET seen_at = now()
    FROM game_rooms r
   WHERE p.room_id = p_room AND r.id = p_room AND r.status IN ('waiting', 'playing') AND p.left_at IS NULL
     AND p.member_id = (SELECT id FROM club_members WHERE club_id = r.club_id AND user_id = auth.uid() AND active LIMIT 1);
END;
$$;

-- Đối thủ mất kết nối quá 120 giây (giờ SERVER, không tin đồng hồ máy khách) → người gọi đòi xử thắng.
-- Mọi người ngồi ghế đã quá hạn bị tính là rời ván; còn đúng một người → người đó thắng.
CREATE OR REPLACE FUNCTION public.game_claim(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_gone int;
  v_left int;
  v_seat smallint;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'playing' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL) THEN
    RAISE EXCEPTION 'games.err.notSeated';
  END IF;

  UPDATE game_room_players SET left_at = now()
   WHERE room_id = p_room AND left_at IS NULL AND member_id <> c.o_me
     AND seen_at < now() - interval '120 seconds';
  GET DIAGNOSTICS v_gone = ROW_COUNT;
  IF v_gone = 0 THEN RAISE EXCEPTION 'games.err.notIdle'; END IF;

  SELECT count(*) INTO v_left FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
  IF v_left = 1 THEN
    SELECT seat INTO v_seat FROM game_room_players WHERE room_id = p_room AND left_at IS NULL;
    UPDATE game_rooms SET status = 'finished', ended_at = now(),
      result = jsonb_build_object('winners', jsonb_build_array(v_seat), 'draw', false, 'forfeit', true, 'idle', true)
     WHERE id = p_room;
  END IF;
END;
$$;

-- Luật Caro chép lại ở SERVER để tự chấm kết quả. PHẢI khớp lib/games/caro.js từng chi tiết:
--   bàn size×size (mặc định 15), cần `win` quân liền (mặc định 5), X = ghế 0 đi trước, thay phiên;
--   nước sai (sai lượt, ngoài bàn, đè ô, ván đã xong) bị BỎ QUA như replay() ở client;
--   chặn hai đầu: đủ quân nhưng cả hai đầu là quân đối phương thì chưa thắng, mép bàn không tính là chặn.
-- Trả { winners: [seat], draw: false } · { winners: [], draw: true } · NULL khi ván chưa xong.
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
      IF v_len >= v_win AND NOT (v_blocked AND v_endA AND v_endB) THEN
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

-- Kết thúc ván. Chỉ một lần.
--   Caro: server tự chấm (game_caro_result), BỎ QUA p_result của client; chưa xong thì từ chối.
--   Game khác: tạm nhận kết quả client báo (chưa có bản chấm ở server).
CREATE OR REPLACE FUNCTION public.game_finish(p_room uuid, p_result jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_result jsonb := p_result;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'playing' THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL) THEN
    RAISE EXCEPTION 'games.err.notSeated';
  END IF;
  IF (c.o_room).game = 'caro' THEN
    v_result := game_caro_result(p_room);
    IF v_result IS NULL THEN RAISE EXCEPTION 'games.err.notOver'; END IF;
  ELSIF jsonb_typeof(p_result -> 'winners') IS DISTINCT FROM 'array' OR pg_column_size(p_result) > 2000 THEN
    RAISE EXCEPTION 'games.err.badResult';
  END IF;
  UPDATE game_rooms SET status = 'finished', ended_at = now(), result = v_result WHERE id = p_room;
END;
$$;

REVOKE ALL ON FUNCTION public.game_create(uuid, text, jsonb, boolean, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_join(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_leave(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_start(uuid, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_move(uuid, int, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_finish(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_ping(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_ping(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_create(uuid, text, jsonb, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_join(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_leave(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_start(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_move(uuid, int, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_finish(uuid, jsonb) TO authenticated;

COMMIT;
