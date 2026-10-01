-- 0065_bot_features.sql
-- BẬT / TẮT TỪNG HÀNH ĐỘNG CỦA BOT (Cài đặt → Chung → Bot CLB).
--
-- `clubs.bot_features` là một túi cờ: MẶC ĐỊNH TẮT — chỉ `true` mới bật, thiếu khoá = tắt (theo
-- quyết định chủ CLB). Chạy migration xong bot ĐỨNG IM ở mọi CLB, kể cả CLB đang có bot chạy, cho
-- tới khi admin vào Cài đặt bật từng hành động. Bật là chạy cho cả CLB: cờ nằm trên dòng `clubs`.
--   paused      true = tạm dừng TẤT CẢ hành động, đè lên mọi khoá bên dưới
--   challenge   tự gạ kèo đôi          → create_bot_challenge
--   bet         đặt cược vào kèo        → place_bot_prediction
--   remark      bình luận chuyện CLB    → post_bot_remark
--   reaction    nhận xét sau trận       → post_bot_reaction
--   arcade      sòng oẳn tù tì / sấp ngửa → play_arcade_round
--   taunt · encounter · leaderboard     chỉ có ở client (không ghi gì xuống DB) — xem `lib/bot.js:
--                                       BOT_FEATURES` và `lib/season.js` (ẩn bot khỏi BXH mùa)
--
-- VÌ SAO GÁC CẢ Ở SERVER: client đã tự không gọi khi cờ tắt, nhưng máy nào còn chạy bản JS cũ
-- (PWA chưa tải lại) vẫn gọi, và ai rành devtools gọi tay được `play_arcade_round`. Cổng ở đây làm
-- cho "tắt" nghĩa là tắt thật.
--
-- Năm hàm dưới đây CHÉP NGUYÊN VĂN từ 0064 (không sửa migration đã chạy — RULES §7). Thay đổi DUY
-- NHẤT ở mỗi hàm là dòng tìm bot, có đánh dấu `★ 0065`. Sửa các hàm này về sau thì sửa từ bản ở đây.
--
-- Ghi cờ: client update thẳng `clubs.bot_features`, RLS `clubs_update` (quyền `settings`) gác.
-- Cột KHÔNG đi đường đồng bộ chung (`dbmap.clubRow` không ghi nó) để chưa chạy migration này thì
-- phần cài đặt còn lại vẫn lưu được.

BEGIN;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS bot_features jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clubs.bot_features IS
  'Cờ bật/tắt từng hành động của bot. Chỉ true mới bật, thiếu khoá = tắt; paused = true tắt hết. Khoá: paused, challenge, bet, remark, reaction, arcade, taunt, encounter, leaderboard.';

-- Hành động `p_feature` của bot CLB này có đang bật không. CLB không tồn tại = tắt.
CREATE OR REPLACE FUNCTION public.bot_feature_on(p_club uuid, p_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT COALESCE((
    SELECT NOT COALESCE((bot_features->>'paused')::boolean, false)
       AND COALESCE((bot_features->>p_feature)::boolean, false)
      FROM clubs WHERE id = p_club
  ), false);
$fn$;

REVOKE EXECUTE ON FUNCTION public.bot_feature_on(uuid, text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- create_bot_challenge — chép từ 0064 mục 4.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_bot_challenge(
  p_team_a uuid[],
  p_team_b uuid[],
  p_reason text DEFAULT 'rank_neighbor'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_club    uuid;
  v_bot     uuid;
  v_code    text;
  v_id      uuid;
  v_all     uuid[];
  v_today   date;
  v_next    date;
  v_expires timestamptz;
  -- Nhịp TẠO kèo: tối đa một kèo mỗi 24h, tính từ lúc tạo (cổng 2).
  c_hours     constant integer := 24;
  -- Chỉ dựng kèo khi buổi tập kế tiếp còn tối đa ngần này ngày — kèo treo cả tuần thì nguội.
  c_lead_days constant integer := 2;
  -- ponytail: giờ Việt Nam viết cứng — DB chưa lưu múi giờ của CLB.
  c_tz        constant text := 'Asia/Ho_Chi_Minh';
BEGIN
  -- Đúng 2 người mỗi phe, 4 người khác nhau.
  IF p_team_a IS NULL OR p_team_b IS NULL
     OR cardinality(p_team_a) <> 2 OR cardinality(p_team_b) <> 2 THEN
    RETURN NULL;
  END IF;
  v_all := p_team_a || p_team_b;
  IF (SELECT count(DISTINCT x) FROM unnest(v_all) AS x WHERE x IS NOT NULL) <> 4 THEN
    RETURN NULL;
  END IF;

  SELECT club_id INTO v_club FROM club_members WHERE id = p_team_a[1];
  IF v_club IS NULL THEN RETURN NULL; END IF;

  -- Quyền gọi. Điều kiện `auth.uid() IS NOT NULL` là CỐ Ý chừa cửa cho lời gọi không có phiên
  -- đăng nhập (service_role / pg_cron, nếu sau này muốn bot thức đúng giờ thay vì ăn theo lượt
  -- mở app của người thật). Không phải lỗ hổng: `authenticated` vẫn buộc phải là người trong
  -- CLB, và role `anon` không hề được GRANT hàm này.
  IF auth.uid() IS NOT NULL AND NOT is_club_member(v_club) THEN
    RAISE EXCEPTION 'Bạn không phải thành viên của CLB này';
  END IF;

  -- Chống đua. Cả CLB mở app cùng lúc = nhiều lời gọi song song; `SELECT` rồi `INSERT` mà không
  -- khoá thì mọi lời gọi đều thấy "chưa có kèo nào" và cùng ghi. Khoá tự nhả cuối transaction.
  PERFORM pg_advisory_xact_lock(hashtext('bot_challenge:' || v_club::text));

  SELECT id INTO v_bot FROM club_members
   WHERE club_id = v_club AND is_bot AND active IS NOT FALSE
   LIMIT 1;
  -- Chưa bật cờ cho ai: tính năng TẮT, app chạy y như trước. Đây là trạng thái mặc định sau
  -- migration — bot chỉ sống khi bạn tự tay bật.
  IF v_bot IS NULL OR NOT bot_feature_on(v_club, 'challenge') THEN RETURN NULL; END IF; -- ★ 0065

  -- Cổng 1 — bot chỉ giữ MỘT kèo đang mở nhận tại một thời điểm.
  IF EXISTS (
    SELECT 1 FROM challenges
     WHERE created_by = v_bot AND status = 'pending' AND expires_at > now()
  ) THEN RETURN NULL; END IF;

  -- Cổng 2 — nhịp 24h tính từ lúc TẠO, không phải lúc kèo chết. Kèo bị từ chối sau 5 phút cũng
  -- không mở cửa cho kèo kế tiếp, không thì bot thành máy gạ lại mỗi lần bị từ chối.
  IF EXISTS (
    SELECT 1 FROM challenges
     WHERE created_by = v_bot AND created_at > now() - make_interval(hours => c_hours)
  ) THEN RETURN NULL; END IF;

  -- Cổng 3 — phải có buổi tập sắp tới (H3). Bản đầu cho hạn nhận cố định 24h, trong khi CLB chỉ
  -- đánh vài buổi mỗi tuần: kèo dựng giữa tuần chết trước khi tới sân, rồi 24h sau bot lại dựng
  -- kèo mới — mỗi ngày một push + một kèo chết. Hạn nhận giờ kéo tới HẾT NGÀY của buổi kế tiếp.
  v_today := (now() AT TIME ZONE c_tz)::date;
  SELECT min(date) INTO v_next FROM sessions
   WHERE club_id = v_club AND date >= v_today AND status IN ('draft', 'open');
  IF v_next IS NULL OR v_next > v_today + c_lead_days THEN RETURN NULL; END IF;
  v_expires := (v_next + 1)::timestamp AT TIME ZONE c_tz;

  -- Bốn đấu thủ: người thật, cùng CLB, đang hoạt động, và không phải một bot khác.
  IF (
    SELECT count(*) FROM club_members
     WHERE id = ANY(v_all) AND club_id = v_club AND active IS NOT FALSE AND NOT is_bot
  ) <> 4 THEN RETURN NULL; END IF;

  -- Không gạ người đang dính kèo khác: kèo chồng kèo thì cả hai cùng treo tới lúc hết hạn.
  -- Kèo 'pending' đã quá hạn mà chưa ai dọn thì không tính là đang dính.
  IF EXISTS (
    SELECT 1 FROM challenge_players cp
      JOIN challenges c ON c.id = cp.challenge_id
     WHERE cp.member_id = ANY(v_all)
       AND c.status IN ('pending', 'accepted', 'oncourt')
       AND NOT (c.status = 'pending' AND c.expires_at IS NOT NULL AND c.expires_at <= now())
  ) THEN RETURN NULL; END IF;

  -- Mã kèo: cùng khuôn `C-0125` và cùng sàn 100 với `lib/challenge.js: nextChallengeCode`.
  -- Lọc regex TRƯỚC rồi mới ép kiểu, để một dòng mã rác không làm nổ cả hàm.
  SELECT 'C-' || lpad(
           (COALESCE(MAX((substring(code from '^C-(\d+)$'))::integer), 100) + 1)::text, 4, '0')
    INTO v_code
    FROM challenges
   WHERE club_id = v_club AND code ~ '^C-\d+$';

  -- `accepted_players` để nguyên DEFAULT '{}': bot không phải đấu thủ nên không ký sẵn cho ai.
  -- Kèo cần đủ chữ ký của CẢ BỐN người mới thành — giống hệt quản trò dựng kèo hộ người khác.
  --
  -- `stake_text` để TRỐNG: kèo bot không có giao kèo gì, và ô đó là của người chơi tự ghi. Lời
  -- của bot dựng lại từ `bot_reason` lúc render.
  INSERT INTO challenges
    (code, club_id, created_by, status, best_of, rating_enabled, expires_at, bot_reason)
  VALUES
    (v_code, v_club, v_bot, 'pending', 3, true, v_expires,
     COALESCE(NULLIF(left(p_reason, 40), ''), 'rank_neighbor'))
  RETURNING id INTO v_id;

  INSERT INTO challenge_players (challenge_id, member_id, team)
  SELECT v_id, x, 'A' FROM unnest(p_team_a) AS x
  UNION ALL
  SELECT v_id, x, 'B' FROM unnest(p_team_b) AS x;

  -- Payload khớp ĐÚNG khuôn `appActions: createChallenge` phát ra, để `resolveNotificationPayload`
  -- và `resolveActivityPayload` đọc được mà không phải thêm nhánh nào.
  -- RULES §3.3: chỉ ID, không ghi tên — ghi tên cứng thì đổi tên thành viên là dòng cũ giữ tên chết.
  INSERT INTO notifications (club_id, member_id, type, payload, ref_type, ref_id)
  SELECT v_club, m, 'challenge_created',
         jsonb_build_object('chalId', v_id, 'code', v_code, 'createdBy', v_bot),
         'challenge', v_id
    FROM unnest(v_all) AS m;

  INSERT INTO activity_events (club_id, actor_id, type, payload, ref_type, ref_id)
  VALUES (v_club, v_bot, 'challenge_created',
          jsonb_build_object(
            'chalId', v_id, 'code', v_code, 'createdBy', v_bot,
            'challengerIds', to_jsonb(p_team_a),
            'opponentIds',   to_jsonb(p_team_b)),
          'challenge', v_id);

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.create_bot_challenge(uuid[], uuid[], text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_bot_challenge(uuid[], uuid[], text) TO authenticated;

-- ---------------------------------------------------------------------------
-- post_bot_remark — chép từ 0064 mục 5.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_bot_remark(
  p_kind    text,
  p_subject uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_club uuid;
  v_bot  uuid;
  v_id   uuid;
  -- Bot nói tối đa mỗi 12h. Dòng Hoạt động là của CLB, không phải tường nhà bot.
  c_quiet_hours constant integer := 12;
  -- Cùng một chuyện về cùng một người thì đừng nhắc lại trong vòng một tuần.
  c_dedupe_days constant integer := 7;
BEGIN
  -- Chỉ những chuyện có trong `bot.js: BOT_LINE_VARIANTS.remark` (M4). Hàm mở cho mọi thành viên,
  -- nên không whitelist là ai cũng bắt bot đăng được một mã tuỳ ý. `rank_drop` cố ý KHÔNG có:
  -- kênh công khai không bêu ai tụt Elo (M7).
  IF p_kind IS NULL OR p_subject IS NULL
     OR p_kind NOT IN ('rank_climb', 'streak', 'rivalry_h2h', 'best_duo', 'dominance_boss', 'top_race', 'bot_overtook') THEN
    RETURN NULL;
  END IF;

  SELECT club_id INTO v_club FROM club_members WHERE id = p_subject;
  IF v_club IS NULL THEN RETURN NULL; END IF;

  IF auth.uid() IS NOT NULL AND NOT is_club_member(v_club) THEN
    RAISE EXCEPTION 'Bạn không phải thành viên của CLB này';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('bot_remark:' || v_club::text));

  SELECT id INTO v_bot FROM club_members
   WHERE club_id = v_club AND is_bot AND active IS NOT FALSE
   LIMIT 1;
  IF v_bot IS NULL OR NOT bot_feature_on(v_club, 'remark') THEN RETURN NULL; END IF; -- ★ 0065

  -- Người được nhắc phải còn sinh hoạt, và bot không tự nói về chính mình.
  IF NOT EXISTS (
    SELECT 1 FROM club_members
     WHERE id = p_subject AND active IS NOT FALSE AND NOT is_bot
  ) THEN RETURN NULL; END IF;

  -- Nhịp im lặng. Tính cả lời nhận xét sau trận (mục 6) — bot nói gì cũng là bot nói.
  IF EXISTS (
    SELECT 1 FROM activity_events
     WHERE club_id = v_club AND type = 'bot_remark'
       AND created_at > now() - make_interval(hours => c_quiet_hours)
  ) THEN RETURN NULL; END IF;

  -- Chống nhắc đi nhắc lại cùng một chuyện.
  IF EXISTS (
    SELECT 1 FROM activity_events
     WHERE club_id = v_club AND type = 'bot_remark'
       AND payload->>'kind' = p_kind
       AND payload->>'subject' = p_subject::text
       AND created_at > now() - make_interval(days => c_dedupe_days)
  ) THEN RETURN NULL; END IF;

  INSERT INTO activity_events (club_id, actor_id, type, payload, ref_type, ref_id)
  VALUES (v_club, v_bot, 'bot_remark',
          jsonb_build_object('kind', p_kind, 'subject', p_subject),
          'member', p_subject)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.post_bot_remark(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.post_bot_remark(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- post_bot_reaction — chép từ 0064 mục 6.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_bot_reaction(
  p_kind         text,
  p_challenge_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_club uuid;
  v_bot  uuid;
  v_id   uuid;
  v_chal record;
BEGIN
  IF p_challenge_id IS NULL OR p_kind IS NULL
     OR p_kind NOT IN ('blowout', 'clutch', 'normal') THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_chal FROM challenges WHERE id = p_challenge_id;
  IF v_chal.id IS NULL THEN RETURN NULL; END IF;
  v_club := v_chal.club_id;

  IF auth.uid() IS NOT NULL AND NOT is_club_member(v_club) THEN
    RAISE EXCEPTION 'Bạn không phải thành viên của CLB này';
  END IF;

  -- Chống đua ghi trùng khi nhiều máy cùng báo xong trận.
  PERFORM pg_advisory_xact_lock(hashtext('bot_react:' || p_challenge_id::text));

  SELECT id INTO v_bot FROM club_members
   WHERE club_id = v_club AND is_bot AND active IS NOT FALSE
   LIMIT 1;
  IF v_bot IS NULL OR NOT bot_feature_on(v_club, 'reaction') THEN RETURN NULL; END IF; -- ★ 0065

  -- Bot chỉ bình phẩm kèo do chính nó dựng.
  IF v_chal.created_by IS DISTINCT FROM v_bot THEN RETURN NULL; END IF;

  IF auth.uid() IS NOT NULL
     AND NOT has_club_perm(v_club, 'assign')
     AND NOT EXISTS (
       SELECT 1 FROM challenge_players cp
         JOIN club_members m ON m.id = cp.member_id
        WHERE cp.challenge_id = p_challenge_id AND m.user_id = auth.uid()
     ) THEN
    RETURN NULL;
  END IF;

  -- Mỗi kèo đúng MỘT lời nhận xét, bất kể loại — đổi `p_kind` không đẻ thêm dòng.
  IF EXISTS (
    SELECT 1 FROM activity_events
     WHERE club_id = v_club AND type = 'bot_remark'
       AND ref_type = 'challenge' AND ref_id = p_challenge_id
  ) THEN RETURN NULL; END IF;

  INSERT INTO activity_events (club_id, actor_id, type, payload, ref_type, ref_id)
  VALUES (v_club, v_bot, 'bot_remark',
          jsonb_build_object('kind', p_kind, 'chalId', p_challenge_id, 'code', v_chal.code),
          'challenge', p_challenge_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.post_bot_reaction(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.post_bot_reaction(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- place_bot_prediction — chép từ 0064 mục 7.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_bot_prediction(
  p_challenge_id uuid,
  p_stake        integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_chal    record;
  v_bot     uuid;
  v_id      uuid;
  v_bot_sp  integer;
  v_stake   integer;
  v_team    text;
  v_ra      numeric;
  v_rb      numeric;
  v_missing integer;
  -- Trần một phiếu theo % số dư — CỐ Ý trùng `bot.js: BET_PCT_HARD_CAP`.
  c_hard_cap  constant numeric := 0.45;
  -- Cứ ngần này kèo thì một kèo bắt cửa dưới — CỐ Ý trùng `bot.js: UNDERDOG_ONE_IN`.
  c_underdog_one_in constant integer := 5;
BEGIN
  IF p_challenge_id IS NULL OR p_stake IS NULL OR p_stake < 1 THEN RETURN NULL; END IF;

  SELECT * INTO v_chal FROM challenges WHERE id = p_challenge_id;
  IF v_chal.id IS NULL THEN RETURN NULL; END IF;

  IF auth.uid() IS NOT NULL AND NOT is_club_member(v_chal.club_id) THEN
    RAISE EXCEPTION 'Bạn không phải thành viên của CLB này';
  END IF;

  SELECT id INTO v_bot FROM club_members
   WHERE club_id = v_chal.club_id AND is_bot AND active IS NOT FALSE
   LIMIT 1;
  IF v_bot IS NULL OR NOT bot_feature_on(v_chal.club_id, 'bet') THEN RETURN NULL; END IF; -- ★ 0065

  -- Chống đua tiêu SP của bot (cược kèo + arcade) trên toàn CLB. Khoá tự nhả cuối transaction.
  PERFORM pg_advisory_xact_lock(hashtext('bot_sp:' || v_chal.club_id::text));

  -- Cổng dự đoán của kèo.
  IF v_chal.predictions_enabled IS FALSE OR v_chal.predictions_locked IS TRUE THEN RETURN NULL; END IF;
  IF v_chal.status NOT IN ('pending', 'accepted') THEN RETURN NULL; END IF;
  -- Kèo còn 'pending' thì phải chưa quá hạn NHẬN. Kèo 'accepted' vẫn nhận cược tới lúc lên sân
  -- (cùng luật với 0047) — bốn người đã đồng ý, chỉ đang chờ sân.
  IF v_chal.status = 'pending'
     AND v_chal.expires_at IS NOT NULL AND v_chal.expires_at <= now() THEN
    RETURN NULL;
  END IF;

  -- Đã ghi hiệp nào là đóng cổng. SUY THẲNG TỪ TRẬN chứ không chỉ tin cờ `predictions_locked`,
  -- cùng lý do đã ghi trong `challenge.js: canMemberPredict` — cờ đó chỉ có đường bật.
  IF EXISTS (SELECT 1 FROM matches WHERE challenge_id = p_challenge_id) THEN RETURN NULL; END IF;

  -- Bot không được là đấu thủ của chính kèo nó cược.
  IF EXISTS (
    SELECT 1 FROM challenge_players
     WHERE challenge_id = p_challenge_id AND member_id = v_bot
  ) THEN RETURN NULL; END IF;

  -- Elo trung bình mỗi phe. Một đấu thủ chưa có dòng rating thì không đủ căn cứ chọn phe — bỏ kèo.
  SELECT count(*) FILTER (WHERE pr.member_id IS NULL),
         avg(pr.rating) FILTER (WHERE cp.team = 'A'),
         avg(pr.rating) FILTER (WHERE cp.team = 'B')
    INTO v_missing, v_ra, v_rb
    FROM challenge_players cp
    LEFT JOIN player_ratings pr
      ON pr.member_id = cp.member_id AND pr.club_id = v_chal.club_id
   WHERE cp.challenge_id = p_challenge_id;
  IF v_missing > 0 OR v_ra IS NULL OR v_rb IS NULL THEN RETURN NULL; END IF;

  v_team := CASE WHEN v_ra >= v_rb THEN 'A' ELSE 'B' END;
  -- `::bigint` trước `abs`: `abs(-2147483648)` trên int4 là tràn số.
  IF abs(hashtext('bot-bet-side:' || p_challenge_id::text)::bigint) % c_underdog_one_in = 0 THEN
    v_team := CASE v_team WHEN 'A' THEN 'B' ELSE 'A' END;
  END IF;

  v_bot_sp := member_season_sp(v_chal.club_id, v_bot, true);
  IF v_bot_sp < 1 THEN RETURN NULL; END IF;
  v_stake := LEAST(p_stake, GREATEST(1, floor(v_bot_sp * c_hard_cap)::integer), 100);

  INSERT INTO challenge_predictions
    (challenge_id, club_id, member_id, team, stake_points, payout_points, status, settled_at, updated_at)
  VALUES
    (p_challenge_id, v_chal.club_id, v_bot, v_team, v_stake, 0, 'pending', NULL, now())
  ON CONFLICT (challenge_id, member_id) DO NOTHING
  RETURNING id INTO v_id;

  -- NULL = bot đã có phiếu ở kèo này rồi. Chuyện thường ngày (client gọi lại mỗi lần nạp CLB),
  -- không phải lỗi. Cố ý KHÔNG cho đặt lại sau khi huỷ như `place_challenge_prediction`: bot
  -- không có nút huỷ, phiếu của nó chỉ bị huỷ khi kèo chết, mà kèo chết thì cược lại vô nghĩa.
  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.place_bot_prediction(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_bot_prediction(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- play_arcade_round — chép từ 0064 mục 8. Tắt arcade trả `no_bot` như khi CLB không có bot: màn
-- hình đã có sẵn câu cho mã đó, khỏi thêm mã mới.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.play_arcade_round(
  p_club   uuid,
  p_game   text,
  p_stake  integer,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_me        uuid;
  v_bot       uuid;
  v_opp       text;
  v_outcome   text;
  v_id        uuid;
  v_delta     integer;
  v_day_start timestamptz;
  v_feed      uuid;
  v_p         jsonb;
  c_daily_cap constant integer := 5;
  c_tz        constant text := 'Asia/Ho_Chi_Minh';
BEGIN
  IF p_club IS NULL THEN RETURN jsonb_build_object('error', 'invalid'); END IF;

  SELECT id INTO v_me FROM club_members
   WHERE club_id = p_club AND user_id = auth.uid() AND active IS NOT FALSE
   LIMIT 1;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Bạn không phải thành viên đang hoạt động của CLB này'; END IF;

  -- `IS NULL` đứng trước: `NULL NOT IN (...)` ra NULL chứ không ra true, ván lọt cổng rồi nổ ở NOT NULL.
  IF p_game IS NULL OR p_choice IS NULL
     OR p_game NOT IN ('rps', 'coin') OR p_stake IS NULL OR p_stake < 1 OR p_stake > 100
     OR (p_game = 'rps'  AND p_choice NOT IN ('rock', 'paper', 'scissors'))
     OR (p_game = 'coin' AND p_choice NOT IN ('heads', 'tails')) THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  SELECT id INTO v_bot FROM club_members
   WHERE club_id = p_club AND is_bot AND active IS NOT FALSE
   LIMIT 1;
  -- Bot không tự chơi với chính nó (khi chủ CLB đăng nhập bằng tài khoản bot).
  IF v_bot IS NULL OR v_me = v_bot OR NOT bot_feature_on(p_club, 'arcade') THEN -- ★ 0065
    RETURN jsonb_build_object('error', 'no_bot');
  END IF;

  -- Chống đua tiêu SP của bot (cược kèo + arcade) trên toàn CLB. Khoá tự nhả cuối transaction.
  PERFORM pg_advisory_xact_lock(hashtext('bot_sp:' || p_club::text));

  IF (SELECT count(*) FROM arcade_rounds
       WHERE member_id = v_me AND club_id = p_club
         AND created_at > now() - interval '1 day') >= c_daily_cap THEN
    RETURN jsonb_build_object('error', 'capped');
  END IF;

  IF member_season_sp(p_club, v_bot, true) < p_stake THEN
    RETURN jsonb_build_object('error', 'bot_broke');
  END IF;
  IF member_season_sp(p_club, v_me, false) < p_stake THEN
    RETURN jsonb_build_object('error', 'broke');
  END IF;

  -- Nước đi của bot. Dùng `random()` chứ KHÔNG dùng mẹo `('x'||uuid)::bit(32)::bigint % 3`:
  -- `bit(32)` đổi sang số nguyên là SỐ CÓ DẤU, nên một nửa số lần nó ra giá trị âm, `% 3` cũng
  -- âm, và `ARRAY[...][1 + (số âm)]` trả NULL — ván cược nổ ở ràng buộc NOT NULL, ngẫu nhiên
  -- khoảng một nửa số lần chơi. `floor(random() * n)` luôn nằm trong 0..n-1.
  --
  -- `random()` không phải nguồn mật mã, nhưng seed của nó nằm trong phiên Postgres mà client
  -- không với tới được. Với một ván oẳn tù tì trong CLB cầu lông thì thế là đủ.
  IF p_game = 'rps' THEN
    v_opp := (ARRAY['rock', 'paper', 'scissors'])[1 + floor(random() * 3)::int];
    v_outcome := CASE
      WHEN v_opp = p_choice THEN 'draw'
      WHEN (p_choice, v_opp) IN (('rock', 'scissors'), ('paper', 'rock'), ('scissors', 'paper')) THEN 'won'
      ELSE 'lost'
    END;
  ELSE
    v_opp := (ARRAY['heads', 'tails'])[1 + floor(random() * 2)::int];
    v_outcome := CASE WHEN v_opp = p_choice THEN 'won' ELSE 'lost' END;
  END IF;
  v_delta := CASE v_outcome WHEN 'won' THEN p_stake WHEN 'lost' THEN -p_stake ELSE 0 END;

  INSERT INTO arcade_rounds (club_id, member_id, opponent_id, game, stake, choice, opp_choice, outcome)
  VALUES (p_club, v_me, v_bot, p_game, p_stake, p_choice, v_opp, v_outcome)
  RETURNING id INTO v_id;

  -- Một dòng Hoạt động mỗi người mỗi ngày: có rồi thì cộng dồn và đẩy lên đầu, chưa có thì tạo.
  v_day_start := date_trunc('day', now() AT TIME ZONE c_tz) AT TIME ZONE c_tz;
  SELECT id, payload INTO v_feed, v_p FROM activity_events
   WHERE club_id = p_club AND type = 'arcade_played' AND actor_id = v_me
     AND created_at >= v_day_start
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_feed IS NULL THEN
    INSERT INTO activity_events (club_id, actor_id, type, payload, ref_type, ref_id)
    VALUES (p_club, v_me, 'arcade_played',
            jsonb_build_object(
              'memberId', v_me, 'opponentId', v_bot,
              'rounds', 1,
              'won',  (v_outcome = 'won')::int,
              'lost', (v_outcome = 'lost')::int,
              'draw', (v_outcome = 'draw')::int,
              'net',  v_delta),
            'arcade', v_id);
  ELSE
    UPDATE activity_events
       SET payload = v_p || jsonb_build_object(
             'rounds', COALESCE((v_p->>'rounds')::int, 0) + 1,
             'won',    COALESCE((v_p->>'won')::int, 0)  + (v_outcome = 'won')::int,
             'lost',   COALESCE((v_p->>'lost')::int, 0) + (v_outcome = 'lost')::int,
             'draw',   COALESCE((v_p->>'draw')::int, 0) + (v_outcome = 'draw')::int,
             'net',    COALESCE((v_p->>'net')::int, 0)  + v_delta),
           created_at = now(),
           ref_id = v_id
     WHERE id = v_feed;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id, 'outcome', v_outcome, 'oppChoice', v_opp, 'stake', p_stake, 'game', p_game);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.play_arcade_round(uuid, text, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.play_arcade_round(uuid, text, integer, text) TO authenticated;

COMMIT;
