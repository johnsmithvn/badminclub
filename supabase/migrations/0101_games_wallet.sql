-- 0101_games_wallet.sql — Ví xu chuẩn: mang xu vào bàn, ví không bao giờ âm, sổ giao dịch đầy đủ (docs/GAMES.md §4b).
-- Chủ dự án duyệt 2026-11-10. Chạy SAU 0093 (dùng game_stake / bảng game_coins / 4 trigger của 0093) và 0096 (Bầu cua).
-- KHÔNG dính tiền thật / Elo / điểm mùa / sổ quỹ.
--
-- THAY cách trả xu của 0093 (0093 trả hết ván, có thể làm ví âm):
--   - Ví: bảng game_wallet, balance CHECK ≥ 0. Lần đầu đụng tới ví → mở ví = 1000 + sổ cũ game_coins (0093), âm thì về 0.
--   - Sổ: bảng game_coin_tx — mỗi lần cộng / trừ một dòng (open · buyin · cashout · refund · legacy · relief) kèm số dư sau.
--     Một người một phòng mỗi loại một dòng (unique) → không trả trùng.
--   - Mang xu vào bàn: ngồi phòng có cược → ghế có `buyin` (mặc định mức thấp nhất; game_buyin đổi được lúc phòng chờ).
--       game điểm (game_points): 10 / 20 / 50 × mức cược (mức cược = giá 1 điểm) · game thắng / thua: đúng mức cược.
--     Bấm Bắt đầu → trừ buyin khỏi ví từng người (thiếu → games.err.noCoinsSeat, cả lệnh huỷ).
--   - Hết ván (finished) → game_coin_split chia: không ai mất quá số mang vào; người thắng đòi nhiều hơn số thu được thì
--     chia theo tỷ lệ. Trả về ví: buyin + net (cashout). Ván bỏ (abandoned) → trả lại nguyên buyin (refund).
--     Game điểm kết thúc vì bỏ cuộc (không có scores) → người bỏ mất cả số mang vào (bỏ ngang không rẻ hơn chơi tiếp).
--   - Phòng cược bắt đầu TRƯỚC 0101 (chưa trừ buyin) hết ván → trả kiểu cũ thẳng vào ví (legacy), thua tối đa số đang có.
--   - Cứu trợ: ví < 100 và không còn xu nằm trên bàn đang chơi → mỗi ngày (giờ VN) nạp lại cho đủ 100 (relief) — lúc vào
--     sảnh (game_my_wallet), ngồi ghế, đổi buyin.
--   - Bầu cua: phòng cược thì mỗi ván tổng đặt ≤ xu mang vào ÷ giá điểm + điểm đã ăn thua (games.err.noChips).
--     game_baucua_run chép nguyên 0096, chỉ thêm các khối đánh dấu "0101" (coins.test.js so hai bản).
-- Không chép lại RPC phòng nào: 3 trigger của 0093 giữ tên, chỉ thay thân hàm; trigger chặn mức cược (stake_guard) giữ nguyên.
-- Chạy lại được: CREATE … IF NOT EXISTS · ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE · DROP … IF EXISTS.
-- Kiểm tay: supabase/manual/0101_games_wallet_check.sql. File kiểm 0093 phải chạy TRƯỚC 0101 (sau 0101 nó sai là đúng).

BEGIN;

/* ---------- 1. Bảng ---------- */

ALTER TABLE public.game_room_players ADD COLUMN IF NOT EXISTS buyin int CHECK (buyin IS NULL OR buyin > 0);

CREATE TABLE IF NOT EXISTS public.game_wallet (
  member_id  uuid PRIMARY KEY REFERENCES public.club_members(id) ON DELETE CASCADE,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  balance    int NOT NULL CHECK (balance >= 0),
  relief_on  date,                                   -- ngày (giờ VN) nhận cứu trợ gần nhất
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_wallet_club_idx ON public.game_wallet (club_id);

CREATE TABLE IF NOT EXISTS public.game_coin_tx (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  room_id    uuid REFERENCES public.game_rooms(id) ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('open', 'buyin', 'cashout', 'refund', 'legacy', 'relief')),
  delta      int NOT NULL,
  balance    int NOT NULL CHECK (balance >= 0),      -- số dư ví ngay sau dòng này
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_coin_tx_member_idx ON public.game_coin_tx (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_coin_tx_club_idx ON public.game_coin_tx (club_id);
CREATE UNIQUE INDEX IF NOT EXISTS game_coin_tx_once_uq ON public.game_coin_tx (room_id, member_id, kind) WHERE room_id IS NOT NULL;

ALTER TABLE public.game_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_coin_tx ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_wallet FROM anon, authenticated;
REVOKE ALL ON public.game_coin_tx FROM anon, authenticated;
GRANT SELECT ON public.game_wallet TO authenticated;
GRANT SELECT ON public.game_coin_tx TO authenticated;
DROP POLICY IF EXISTS game_wallet_read ON public.game_wallet;
CREATE POLICY game_wallet_read ON public.game_wallet FOR SELECT TO authenticated USING (is_club_member(club_id));
DROP POLICY IF EXISTS game_coin_tx_read ON public.game_coin_tx;
CREATE POLICY game_coin_tx_read ON public.game_coin_tx FOR SELECT TO authenticated USING (is_club_member(club_id));

/* ---------- 2. Luật thuần (khớp lib/games/registry.js — coins.test.js gác) ---------- */

-- Game điểm: xu = điểm × mức cược. Khớp BOARD_POINTS.
CREATE OR REPLACE FUNCTION public.game_points(p_game text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_game IN ('phom', 'tienlen', 'bacay', 'baucua', 'xidach')
$$;

-- Các mức mang vào bàn (mức đầu = mặc định). Khớp buyinsOf.
CREATE OR REPLACE FUNCTION public.game_buyins(p_game text, p_stake int)
RETURNS int[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_stake IS NULL OR p_stake <= 0 THEN '{}'::int[]
              WHEN game_points(p_game) THEN ARRAY[10 * p_stake, 20 * p_stake, 50 * p_stake]
              ELSE ARRAY[p_stake] END
$$;

-- Chia xu khi ván xong → net từng ghế (cùng thứ tự p_seats / p_caps). Khớp splitOf — đọc chú thích ở đó.
CREATE OR REPLACE FUNCTION public.game_coin_split(p_game text, p_stake int, p_result jsonb, p_seats int[], p_caps int[])
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n      int := coalesce(cardinality(p_seats), 0);
  v_out  int[];
  v_raw  bigint[];
  v_loss bigint[];
  v_win  boolean[];
  v_pot  bigint := 0;
  v_want bigint := 0;
  v_w    int := 0;
  i      int;
BEGIN
  v_out := array_fill(0, ARRAY[n]);
  IF n = 0 OR p_stake IS NULL OR p_stake <= 0 OR p_result IS NULL THEN RETURN v_out; END IF;

  IF game_points(p_game) AND jsonb_typeof(p_result -> 'scores') = 'object' THEN
    v_raw := array_fill(0::bigint, ARRAY[n]);
    v_loss := array_fill(0::bigint, ARRAY[n]);
    FOR i IN 1..n LOOP
      IF jsonb_typeof(p_result -> 'scores' -> (p_seats[i]::text)) = 'number' THEN
        v_raw[i] := round((p_result -> 'scores' ->> (p_seats[i]::text))::numeric)::bigint * p_stake;
      END IF;
      IF v_raw[i] < 0 THEN
        v_loss[i] := LEAST(-v_raw[i], p_caps[i]::bigint);
        v_pot := v_pot + v_loss[i];
      ELSE
        v_want := v_want + v_raw[i];
      END IF;
    END LOOP;
    FOR i IN 1..n LOOP
      v_out[i] := (CASE WHEN v_raw[i] > 0 THEN CASE WHEN v_want <= v_pot THEN v_raw[i] ELSE (v_raw[i] * v_pot) / v_want END
                        ELSE 0 END - v_loss[i])::int;
    END LOOP;
    RETURN v_out;
  END IF;

  IF p_result -> 'draw' = 'true'::jsonb THEN RETURN v_out; END IF;
  v_win := array_fill(false, ARRAY[n]);
  FOR i IN 1..n LOOP
    v_win[i] := EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_result -> 'winners') = 'array'
                                                                THEN p_result -> 'winners' ELSE '[]'::jsonb END) e
                         WHERE e = to_jsonb(p_seats[i]));
    IF v_win[i] THEN v_w := v_w + 1; ELSE v_pot := v_pot + p_caps[i]; END IF;
  END LOOP;
  IF v_w = 0 OR v_w = n THEN RETURN array_fill(0, ARRAY[n]); END IF;
  FOR i IN 1..n LOOP
    v_out[i] := CASE WHEN v_win[i] THEN (v_pot / v_w)::int ELSE -p_caps[i] END;
  END LOOP;
  RETURN v_out;
END;
$$;

/* ---------- 3. Ví ---------- */

-- Mở ví (lần đầu) + khoá dòng ví tới hết giao dịch. p_relief: được nạp cứu trợ nếu đủ điều kiện (KHÔNG dùng lúc trả xu
-- hết ván — trả xong ví tự lên, nạp trước là cho không).
CREATE OR REPLACE FUNCTION public.game_wallet_open(p_member uuid, p_relief boolean)
RETURNS public.game_wallet
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w       game_wallet;
  v_club  uuid;
  v_open  int;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  SELECT * INTO w FROM game_wallet WHERE member_id = p_member FOR UPDATE;
  IF NOT FOUND THEN
    SELECT club_id INTO v_club FROM club_members WHERE id = p_member;
    IF v_club IS NULL THEN RAISE EXCEPTION 'games.err.notMember'; END IF;
    v_open := GREATEST(0, 1000 + coalesce((SELECT sum(delta) FROM game_coins WHERE member_id = p_member), 0))::int;
    INSERT INTO game_wallet (member_id, club_id, balance) VALUES (p_member, v_club, v_open)
    ON CONFLICT (member_id) DO NOTHING;
    IF FOUND THEN
      INSERT INTO game_coin_tx (club_id, member_id, room_id, kind, delta, balance) VALUES (v_club, p_member, NULL, 'open', v_open, v_open);
    END IF;
    SELECT * INTO w FROM game_wallet WHERE member_id = p_member FOR UPDATE;
  END IF;

  IF p_relief AND w.balance < 100 AND (w.relief_on IS NULL OR w.relief_on < v_today)
     AND NOT EXISTS (SELECT 1 FROM game_coin_tx b JOIN game_rooms r ON r.id = b.room_id
                      WHERE b.member_id = p_member AND b.kind = 'buyin' AND r.status = 'playing') THEN
    INSERT INTO game_coin_tx (club_id, member_id, room_id, kind, delta, balance)
    VALUES (w.club_id, p_member, NULL, 'relief', 100 - w.balance, 100);
    UPDATE game_wallet SET balance = 100, relief_on = v_today, updated_at = now() WHERE member_id = p_member;
    w.balance := 100;
    w.relief_on := v_today;
  END IF;
  RETURN w;
END;
$$;

-- Cộng / trừ ví + ghi sổ. Không đủ → games.err.noCoins (CHECK balance ≥ 0 là chốt chặn cuối).
CREATE OR REPLACE FUNCTION public.game_wallet_add(p_member uuid, p_room uuid, p_kind text, p_delta int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w game_wallet;
BEGIN
  w := game_wallet_open(p_member, false);
  IF w.balance + p_delta < 0 THEN RAISE EXCEPTION 'games.err.noCoins'; END IF;
  UPDATE game_wallet SET balance = balance + p_delta, updated_at = now() WHERE member_id = p_member;
  INSERT INTO game_coin_tx (club_id, member_id, room_id, kind, delta, balance)
  VALUES (w.club_id, p_member, p_room, p_kind, p_delta, w.balance + p_delta);
  RETURN w.balance + p_delta;
END;
$$;

-- Hết ván → trả xu (một lần: đã có dòng cashout / refund / legacy của phòng thì thôi).
CREATE OR REPLACE FUNCTION public.game_wallet_settle(p_room uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       game_rooms;
  v_stake int;
  v_pts   boolean;
  v_mem   uuid[];
  v_seats int[];
  v_caps  int[];
  v_esc   boolean[];
  v_nets  int[];
  p       record;
  w       game_wallet;
  i       int;
BEGIN
  SELECT * INTO r FROM game_rooms WHERE id = p_room;
  v_stake := game_stake(r.options);
  IF r.id IS NULL OR v_stake = 0 OR r.started_at IS NULL OR r.status NOT IN ('finished', 'abandoned') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM game_coin_tx WHERE room_id = p_room AND kind IN ('cashout', 'refund', 'legacy')) THEN RETURN; END IF;
  v_pts := game_points(r.game) AND jsonb_typeof(r.result -> 'scores') = 'object';

  -- Người của ván như game_board (0091): còn ngồi hoặc rời SAU khi ván bắt đầu. Khoá ví theo member_id (chống deadlock).
  FOR p IN
    SELECT gp.member_id, gp.seat::int AS seat,
           (SELECT -t.delta FROM game_coin_tx t WHERE t.room_id = p_room AND t.member_id = gp.member_id AND t.kind = 'buyin') AS paid
      FROM game_room_players gp
     WHERE gp.room_id = p_room AND (gp.left_at IS NULL OR gp.left_at >= r.started_at)
     ORDER BY gp.member_id
  LOOP
    v_mem := v_mem || p.member_id;
    v_seats := v_seats || p.seat;
    v_esc := v_esc || (p.paid IS NOT NULL);
    IF p.paid IS NOT NULL THEN
      v_caps := v_caps || p.paid;
    ELSE
      -- Phòng bắt đầu trước 0101: không có xu trên bàn → thua tối đa số đang có trong ví (ván thắng / thua: tối đa mức cược).
      w := game_wallet_open(p.member_id, false);
      v_caps := v_caps || CASE WHEN v_pts THEN w.balance ELSE LEAST(w.balance, v_stake) END;
    END IF;
  END LOOP;
  IF v_mem IS NULL THEN RETURN; END IF;

  IF r.status = 'finished' THEN
    v_nets := game_coin_split(r.game, v_stake, r.result, v_seats, v_caps);
  ELSE
    v_nets := array_fill(0, ARRAY[cardinality(v_mem)]);
  END IF;
  FOR i IN 1..cardinality(v_mem) LOOP
    IF v_esc[i] THEN
      PERFORM game_wallet_add(v_mem[i], p_room, CASE WHEN r.status = 'finished' THEN 'cashout' ELSE 'refund' END, v_caps[i] + v_nets[i]);
    ELSE
      PERFORM game_wallet_add(v_mem[i], p_room, 'legacy', v_nets[i]);
    END IF;
  END LOOP;
END;
$$;

/* ---------- 4. Trigger của 0093: giữ tên, thay thân ---------- */

-- Ngồi ghế phòng có cược (tạo phòng, vào, vào lại): ví phải đủ mức mang vào thấp nhất; ghế nhận buyin (giữ mức đã chọn
-- nếu còn hợp lệ và ví còn đủ, không thì mức thấp nhất). Phòng không cược: buyin = NULL.
CREATE OR REPLACE FUNCTION public.game_players_coin_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r     game_rooms;
  v_ins int[];
  w     game_wallet;
BEGIN
  IF NEW.left_at IS NULL AND (TG_OP = 'INSERT' OR OLD.left_at IS NOT NULL) THEN
    SELECT * INTO r FROM game_rooms WHERE id = NEW.room_id;
    v_ins := game_buyins(r.game, game_stake(r.options));
    IF cardinality(v_ins) > 0 THEN
      w := game_wallet_open(NEW.member_id, true);
      IF w.balance < v_ins[1] THEN RAISE EXCEPTION 'games.err.noCoins'; END IF;
      NEW.buyin := CASE WHEN NEW.buyin = ANY (v_ins) AND NEW.buyin <= w.balance THEN NEW.buyin ELSE v_ins[1] END;
    ELSE
      NEW.buyin := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Bắt đầu ván phòng có cược: trừ buyin khỏi ví từng người đang ngồi (theo member_id — chống deadlock). Thiếu → huỷ cả lệnh.
CREATE OR REPLACE FUNCTION public.game_rooms_start_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stake int := game_stake(NEW.options);
  v_ins   int[];
  v_b     int;
  p       record;
  w       game_wallet;
BEGIN
  IF OLD.status = 'waiting' AND NEW.status = 'playing' AND v_stake > 0 THEN
    v_ins := game_buyins(NEW.game, v_stake);
    FOR p IN SELECT member_id, buyin FROM game_room_players WHERE room_id = NEW.id AND left_at IS NULL ORDER BY member_id LOOP
      v_b := CASE WHEN p.buyin = ANY (v_ins) THEN p.buyin ELSE v_ins[1] END;
      w := game_wallet_open(p.member_id, false);
      IF w.balance < v_b THEN RAISE EXCEPTION 'games.err.noCoinsSeat'; END IF;
      PERFORM game_wallet_add(p.member_id, NEW.id, 'buyin', -v_b);
      UPDATE game_room_players SET buyin = v_b WHERE room_id = NEW.id AND member_id = p.member_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Ván đang chơi → xong / bỏ: trả xu.
CREATE OR REPLACE FUNCTION public.game_rooms_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'playing' AND NEW.status IN ('finished', 'abandoned') THEN
    PERFORM game_wallet_settle(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

/* ---------- 5. RPC cho máy khách ---------- */

-- Ví của tôi (mở ví + cứu trợ nếu đủ điều kiện) → số dư.
CREATE OR REPLACE FUNCTION public.game_my_wallet(p_club uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w game_wallet;
BEGIN
  w := game_wallet_open(game_me(p_club), true);
  RETURN w.balance;
END;
$$;

-- Đổi số xu mang vào bàn — chỉ lúc phòng chờ, chỉ ghế của mình, đúng một trong các mức, ví đủ.
CREATE OR REPLACE FUNCTION public.game_buyin(p_room uuid, p_amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  w game_wallet;
BEGIN
  SELECT * INTO c FROM game_lock(p_room);
  IF (c.o_room).status <> 'waiting' THEN RAISE EXCEPTION 'games.err.notWaiting'; END IF;
  IF NOT EXISTS (SELECT 1 FROM game_room_players WHERE room_id = p_room AND member_id = c.o_me AND left_at IS NULL) THEN
    RAISE EXCEPTION 'games.err.notSeated';
  END IF;
  IF p_amount IS NULL OR NOT (p_amount = ANY (game_buyins((c.o_room).game, game_stake((c.o_room).options)))) THEN
    RAISE EXCEPTION 'games.err.badOptions';
  END IF;
  w := game_wallet_open(c.o_me, true);
  IF w.balance < p_amount THEN RAISE EXCEPTION 'games.err.noCoins'; END IF;
  UPDATE game_room_players SET buyin = p_amount WHERE room_id = p_room AND member_id = c.o_me;
END;
$$;

-- Ví cả CLB (tab Ví xu): số dư + số ván cược đã trả xu (được / mất theo tổng sổ của phòng). Thay bản 0093, cùng cột.
CREATE OR REPLACE FUNCTION public.game_wallets(p_club uuid)
RETURNS TABLE (member_id uuid, balance int, played int, won int, lost int)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT w.member_id, w.balance,
         count(x.room_id)::int, count(x.room_id) FILTER (WHERE x.net > 0)::int, count(x.room_id) FILTER (WHERE x.net < 0)::int
    FROM game_wallet w
    LEFT JOIN (
      SELECT t.member_id, t.room_id, sum(t.delta) AS net
        FROM game_coin_tx t
       WHERE t.club_id = p_club AND t.room_id IS NOT NULL
       GROUP BY t.member_id, t.room_id
      HAVING bool_or(t.kind IN ('cashout', 'refund', 'legacy'))
    ) x ON x.member_id = w.member_id
   WHERE w.club_id = p_club
   GROUP BY w.member_id, w.balance
$$;

/* ---------- 6. Bầu cua: chặn đặt quá số điểm còn trên bàn ---------- */

-- Chép nguyên 0096, chỉ thêm các khối "0101 ↓ … 0101 ↑".
CREATE OR REPLACE FUNCTION public.game_baucua_run(p_room uuid, p_seat int, p_move jsonb, OUT o_err text, OUT o_result jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opt     jsonb;
  v_time    bigint;
  v_laps    int;
  v_started boolean := false;
  v_over    boolean := false;
  v_n       int := 0;
  v_out     boolean[];
  v_ready   boolean[];
  v_bets    int[];
  v_scores  int[];
  v_round   int := 0;
  v_rounds  int;
  v_banker  int;
  v_since   bigint;
  v_err     text;
  v_act     text;
  v_bet     int[];
  v_dice    int[];
  v_won     int;
  v_best    int;
  m         record;
  d         jsonb;
  i         int;
  k         int;
  y         int;
  -- 0101 ↓
  v_stake   int;
  v_budget  int;
  -- 0101 ↑
BEGIN
  SELECT options INTO v_opt FROM game_rooms WHERE id = p_room;
  v_time := 1000 * CASE WHEN jsonb_typeof(v_opt -> 'time') = 'number'
                        THEN CASE WHEN (v_opt ->> 'time')::numeric IN (15, 20, 30) THEN (v_opt ->> 'time')::numeric::int ELSE 20 END
                        ELSE 20 END;
  v_laps := CASE WHEN jsonb_typeof(v_opt -> 'laps') = 'number'
                 THEN CASE WHEN (v_opt ->> 'laps')::numeric IN (1, 2, 3) THEN (v_opt ->> 'laps')::numeric::int ELSE 1 END
                 ELSE 1 END;
  -- 0101 ↓
  v_stake := game_stake(v_opt);
  -- 0101 ↑

  FOR m IN
    SELECT x.seat, x.move, x.at, x.cand FROM (
      SELECT seq, seat::int AS seat, move, floor(extract(epoch FROM created_at) * 1000)::bigint AS at, false AS cand
        FROM game_moves WHERE room_id = p_room
      UNION ALL
      SELECT 2147483647, p_seat, p_move, floor(extract(epoch FROM now()) * 1000)::bigint, true WHERE p_move IS NOT NULL
    ) x ORDER BY x.seq
  LOOP
    v_err := NULL;
    v_act := NULL;

    /* ----- validate (như JS; nước đang xin ghi khắt hơn: out / deal chỉ server ghi, mở bát phải đúng giờ) ----- */
    IF jsonb_typeof(m.move -> 'deal') = 'object' THEN
      v_act := 'deal';
      IF v_started OR m.cand OR m.seat <> 0 OR game_baucua_int(m.move #> '{deal,n}') NOT BETWEEN 2 AND 10
         OR game_baucua_int(m.move #> '{deal,n}') IS NULL THEN
        v_err := 'games.err.badMove';
      END IF;
    ELSIF NOT v_started THEN
      v_err := 'games.err.badMove';
    ELSIF v_over THEN
      v_err := 'games.err.over';
    ELSIF m.seat IS NULL OR m.seat < 0 OR m.seat >= v_n OR v_out[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSIF m.move -> 'out' = 'true'::jsonb THEN
      v_act := 'out';
      IF m.cand THEN v_err := 'games.err.badMove'; END IF;
    ELSIF m.move -> 'roll' = 'true'::jsonb THEN
      v_act := 'roll';
      IF m.cand THEN
        IF EXISTS (SELECT 1 FROM generate_series(0, v_n - 1) g WHERE NOT v_out[g + 1] AND g <> v_banker AND NOT v_ready[g + 1])
           AND m.at < v_since + v_time THEN
          v_err := 'games.err.notYet';
        END IF;
      ELSE
        v_dice := ARRAY(SELECT game_baucua_int(e) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.move -> 'dice') = 'array' THEN m.move -> 'dice' ELSE '[]' END) e);
        IF cardinality(v_dice) <> 3 OR EXISTS (SELECT 1 FROM unnest(v_dice) x WHERE x IS NULL OR x > 5) THEN v_err := 'games.err.badMove'; END IF;
      END IF;
    ELSIF m.seat = v_banker OR v_ready[m.seat + 1] THEN
      v_err := 'games.err.badMove';
    ELSE
      v_act := 'bet';
      v_bet := ARRAY(SELECT game_baucua_int(e) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.move -> 'bet') = 'array' THEN m.move -> 'bet' ELSE '[]' END) e);
      IF cardinality(v_bet) <> 6 OR EXISTS (SELECT 1 FROM unnest(v_bet) x WHERE x IS NULL OR x > 10)
         OR (SELECT sum(x) FROM unnest(v_bet) x) > 10 THEN
        v_err := 'games.err.badMove';
      END IF;
      -- 0101 ↓ phòng có cược: tổng đặt ≤ số điểm còn trên bàn (xu mang vào ÷ giá 1 điểm, làm tròn xuống, + điểm đã ăn
      --        thua — budgetOf ở lib/games/baucua.js). Chỉ kiểm nước đang xin ghi; ghế chưa có buyin (phòng trước 0101) thì thôi.
      IF v_err IS NULL AND m.cand AND v_stake > 0 THEN
        SELECT floor(buyin::numeric / v_stake)::int INTO v_budget
          FROM game_room_players WHERE room_id = p_room AND seat = m.seat AND left_at IS NULL;
        IF v_budget IS NOT NULL AND (SELECT sum(x) FROM unnest(v_bet) x) > v_budget + v_scores[m.seat + 1] THEN
          v_err := 'games.err.noChips';
        END IF;
      END IF;
      -- 0101 ↑
    END IF;

    IF m.cand THEN o_err := v_err; EXIT; END IF;
    IF v_err IS NOT NULL THEN CONTINUE; END IF;

    /* ----- apply ----- */
    IF v_act = 'deal' THEN
      v_n := game_baucua_int(m.move #> '{deal,n}');
      v_started := true;
      v_out := array_fill(false, ARRAY[v_n]);
      v_ready := array_fill(false, ARRAY[v_n]);
      v_bets := array_fill(0, ARRAY[v_n * 6]);
      v_scores := array_fill(0, ARRAY[v_n]);
      v_rounds := v_laps * v_n;
      v_banker := 0;
      v_since := m.at;
      CONTINUE;
    ELSIF v_act = 'bet' THEN
      -- Đặt = chốt luôn.
      FOR k IN 0..5 LOOP v_bets[m.seat * 6 + k + 1] := v_bet[k + 1]; END LOOP;
      v_ready[m.seat + 1] := true;
      CONTINUE;
    ELSIF v_act = 'out' THEN
      v_out[m.seat + 1] := true;
      FOR k IN 0..5 LOOP v_bets[m.seat * 6 + k + 1] := 0; END LOOP;
      IF m.seat <> v_banker THEN
        v_ready[m.seat + 1] := true;
        CONTINUE;
      END IF;
      -- Cái rời: ván bỏ, sang ván mới (bên dưới).
      v_bets := array_fill(0, ARRAY[v_n * 6]);
    ELSE
      -- Mở bát: con ra k hột → được k lần số điểm đặt, không ra → mất số điểm đặt. Cái trả / ăn hết.
      FOR i IN 0..v_n - 1 LOOP
        v_won := 0;
        FOR k IN 0..5 LOOP
          y := (SELECT count(*) FROM unnest(v_dice) x WHERE x = k);
          v_won := v_won + CASE WHEN y > 0 THEN v_bets[i * 6 + k + 1] * y ELSE -v_bets[i * 6 + k + 1] END;
        END LOOP;
        v_scores[i + 1] := v_scores[i + 1] + v_won;
        v_scores[v_banker + 1] := v_scores[v_banker + 1] - v_won;
      END LOOP;
    END IF;

    -- nextRound() của JS.
    v_round := v_round + 1;
    IF v_round >= v_rounds OR (SELECT count(*) FROM unnest(v_out) o WHERE NOT o) < 2 THEN
      v_over := true;
      v_banker := NULL;
      CONTINUE;
    END IF;
    FOR k IN 1..v_n LOOP
      y := (v_banker + k) % v_n;
      IF NOT v_out[y + 1] THEN v_banker := y; EXIT; END IF;
    END LOOP;
    v_bets := array_fill(0, ARRAY[v_n * 6]);
    v_ready := array_fill(false, ARRAY[v_n]);
    v_since := m.at;
  END LOOP;

  IF NOT v_over THEN RETURN; END IF;
  SELECT max(v_scores[g + 1]) INTO v_best FROM generate_series(0, v_n - 1) g WHERE NOT v_out[g + 1];
  IF v_best IS NULL THEN
    SELECT max(x) INTO v_best FROM unnest(v_scores) x;
    o_result := jsonb_build_object('winners', (SELECT jsonb_agg(g ORDER BY g) FROM generate_series(0, v_n - 1) g WHERE v_scores[g + 1] = v_best));
  ELSE
    o_result := jsonb_build_object('winners', (SELECT jsonb_agg(g ORDER BY g) FROM generate_series(0, v_n - 1) g WHERE NOT v_out[g + 1] AND v_scores[g + 1] = v_best));
  END IF;
  o_result := o_result || jsonb_build_object('draw', false,
    'scores', (SELECT jsonb_object_agg(g::text, v_scores[g + 1]) FROM generate_series(0, v_n - 1) g));
END;
$$;

/* ---------- 7. Quyền ---------- */

REVOKE ALL ON FUNCTION public.game_points(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_buyins(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_coin_split(text, int, jsonb, int[], int[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_wallet_open(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_wallet_add(uuid, uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_wallet_settle(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_baucua_run(uuid, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_my_wallet(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_buyin(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.game_wallets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_my_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_buyin(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.game_wallets(uuid) TO authenticated;

COMMIT;
