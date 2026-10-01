-- 0064_bot_member_and_challenge.sql
-- BOT CLB — một thành viên được đánh dấu `is_bot` tự dựng kèo ĐÔI (2 đấu 2) cho bốn người thật.
--
-- ============================ VÌ SAO PHẢI LÀ RPC ============================
--
-- Bot không ghi được kèo qua đường đồng bộ chung, và đó là CỐ Ý của 0052: `challenges_ins`
-- chỉ cho `created_by` là chính mình (hoặc admin có quyền `assign`), để không ai mạo danh
-- người khác gạ kèo. Luật đó đúng, KHÔNG nới.
--
-- Bot có thể có tài khoản thật, nhưng điều đó không giúp gì: `auth.uid()` là người ĐANG gõ,
-- mà không ai đăng nhập bằng bot trong trình duyệt của người khác. Nên cần một cánh cửa tự mở
-- khi thấy đúng lý do — chính là hàm này.
--
-- ============================ PHÂN VAI NÃO / TAY ============================
--
-- Hàm này KHÔNG chọn ai đấu với ai. Việc đó ở `src/lib/bot.js`, nơi dùng lại được
-- `getClubEloLeaderboard` / `getPlayerForm5` / `getRivalAnalysis` — chép chúng sang plpgsql là
-- tự nuôi bản sao thứ hai của toàn bộ logic xếp hạng.
--
-- Hàm này chỉ GÁC: ai được ghi, bao lâu một lần, và không để hai lời gọi song song đẻ ra hai
-- kèo. Nó KHÔNG cần tin client chọn "đúng" — client xấu lắm thì đổi được bot gạ ai, mà cái đó
-- vô hại. Thứ phải chặn là spam, và spam chặn bằng ràng buộc, không bằng lòng tin.
--
-- ==================== VÌ SAO KHÔNG GÁC BẰNG UNIQUE INDEX ====================
--
-- Bản nháp đầu định gác bằng `CREATE UNIQUE INDEX ... WHERE is_bot_challenge AND status='pending'`.
-- Hỏng hai lần:
--   1. Bỏ cột `is_bot_challenge` (kèo của bot tra ra bằng `created_by`) thì predicate phải JOIN
--      sang `club_members` — index predicate không đụng được bảng khác.
--   2. Luật "1 kèo / 24h" thì KHÔNG index nào diễn đạt nổi, vì `now()` không IMMUTABLE.
-- Advisory lock nuốt được cả hai mà không thêm cột nào. Muốn nhiều bot trong một CLB thì ghép
-- `bot_id` vào khoá — một dòng, không phải migrate index.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Cờ nhận diện bot. KHÔNG thêm cột nào lên `challenges`: kèo của bot tra ra bằng
--    `created_by` -> `club_members.is_bot`, không cần đánh dấu trùng ở hai nơi.
-- ---------------------------------------------------------------------------
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.club_members.is_bot IS
  'Thành viên này là NPC do code điều khiển. Cờ KHÔNG khoá gì cả — vẫn đăng nhập được, vẫn tính Elo, vẫn lên BXH như mọi người. Chọn / tắt bot: Cài đặt → Chung (RPC set_club_bot), mỗi CLB tối đa một bot.';

-- Lý do bot xếp bốn người này vào với nhau, dạng MÃ (`rank_neighbor` / `streak_hunt`), không phải
-- câu chữ. Câu nói dựng lại lúc render từ mã + id kèo làm hạt giống, nên mỗi kèo một câu khác mà
-- không phải lưu chữ nào xuống DB (RULES §3.1 + §3.3).
--
-- Bản nháp đầu nhét thẳng câu tiếng Việt vào `stake_text` cho khỏi thêm cột. Bỏ cách đó: lưu chữ
-- thì mất mã, mà mất mã thì không xoay vòng được câu, cũng không lọc ra được "các kèo bot dựng vì
-- săn streak" sau này.
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS bot_reason text;

COMMENT ON COLUMN public.challenges.bot_reason IS
  'Mã lý do bot dựng kèo này. NULL = kèo do người tạo. Câu chữ nằm ở i18n `bot.reason.<mã>.<n>`.';

-- ---------------------------------------------------------------------------
-- 2. ARCADE — bảng sổ sự kiện. Tạo TRƯỚC các hàm tính số dư ở mục 3 vì chúng đọc bảng này.
--
-- KHÔNG CÓ ĐỒNG TIỀN RIÊNG. Bảng này không phải một cái ví; nó là SỔ SỰ KIỆN mà `season.js`
-- chạy lại, đúng vai trò `challenge_predictions` đang giữ. Điểm mùa vẫn là số dẫn xuất.
--
-- MỘT DÒNG CHO CẢ HAI PHE. `member_id` là người chơi, `opponent_id` là bot, và `season.js` suy
-- ngược phe bot từ chính dòng đó (người +N thì bot −N). Tách hai dòng là mở đường cho hai phe
-- lệch nhau; một dòng thì tổng điểm BẮT BUỘC bằng không, không cần ai canh.
--
-- CHỈ NHỮNG TRÒ CÔNG BẰNG 1:1. Kéo búa bao (thắng/hoà/thua đều 1/3) và tung xu (1/2) trả 1 ăn 1
-- là đúng kỳ vọng. Trò tỷ lệ lệch (đoán số 1..6) cần hệ số trả thưởng riêng, chưa làm — thêm vào
-- mà quên hệ số là bot chảy máu điểm về phía người chơi.
--
-- KẾT QUẢ DO SERVER QUYẾT. Tính ở client thì mở devtools chơi lại tới khi thắng, và điểm mùa
-- thành rác trong một tối.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.arcade_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  game        text NOT NULL CHECK (game IN ('rps', 'coin')),
  stake       integer NOT NULL CHECK (stake BETWEEN 1 AND 100),
  choice      text NOT NULL,
  opp_choice  text NOT NULL,
  -- 'draw' = hoà, hoàn cược, không ai đổi điểm.
  outcome     text NOT NULL CHECK (outcome IN ('won', 'lost', 'draw')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arcade_club_time ON public.arcade_rounds(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arcade_member ON public.arcade_rounds(member_id);

ALTER TABLE public.arcade_rounds ENABLE ROW LEVEL SECURITY;

-- Đọc: người trong CLB. Ghi: KHÔNG ai, kể cả chủ CLB — chỉ RPC `play_arcade_round` (SECURITY
-- DEFINER) mới ghi được. Ván cược tự khai là ván cược tự thắng.
DROP POLICY IF EXISTS arcade_rounds_select ON public.arcade_rounds;
CREATE POLICY arcade_rounds_select ON public.arcade_rounds
  FOR SELECT TO authenticated USING (is_club_member(club_id));

REVOKE INSERT, UPDATE, DELETE ON public.arcade_rounds FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. SỐ DƯ ĐIỂM MÙA PHÍA SERVER (M3).
--
-- Bản đầu cộng dồn phiếu cược và ván Arcade từ TRƯỚC TỚI NAY, trong khi `season.js` chỉ tính
-- trong mùa đang chạy. Sang mùa mới, người (và bot) cháy điểm mùa trước thấy 100 SP trên màn
-- hình mà server vẫn chặn mọi ván.
--
-- Khung mùa đọc từ `clubs.seasons` (0055_add_club_seasons), cùng thứ tự ưu tiên với
-- `season.js: resolveSeason`: mùa có `active` → mùa đầu danh sách. CLB chưa cấu hình mùa nào thì
-- trả khung vô hạn = tính toàn thời gian như trước.
--
-- ponytail: `season.js` còn rơi về mùa mặc định trong `app.json` khi `clubs.seasons` rỗng — SQL
-- không đọc được file đó. Muốn khớp tuyệt đối thì CLB phải lưu mùa trong Cài đặt.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.club_season_bounds(p_club uuid)
RETURNS TABLE (start_at timestamptz, end_at timestamptz, start_points integer)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
  -- Mốc giờ giống hệt `season.js`: đầu ngày và cuối ngày theo UTC (`T00:00:00Z` / `T23:59:59Z`).
  -- `startPoints` rơi về 100 — CỐ Ý trùng `app.json → season.startPoints`.
  SELECT
    COALESCE((NULLIF(x.s->>'startDate', '') || 'T00:00:00Z')::timestamptz, '-infinity'::timestamptz),
    COALESCE((NULLIF(x.s->>'endDate', '') || 'T23:59:59Z')::timestamptz, 'infinity'::timestamptz),
    COALESCE((x.s->>'startPoints')::integer, 100)
  FROM (SELECT 1) AS one
  LEFT JOIN LATERAL (
    SELECT e.value AS s
      FROM clubs c,
           jsonb_array_elements(
             CASE WHEN jsonb_typeof(c.seasons) = 'array' THEN c.seasons ELSE '[]'::jsonb END
           ) WITH ORDINALITY AS e(value, ord)
     WHERE c.id = p_club
     -- COALESCE: `DESC` xếp NULL lên ĐẦU, mùa thiếu khoá `active` sẽ chen trước mùa đang chạy.
     ORDER BY COALESCE((e.value->>'active') = 'true', false) DESC, e.ord
     LIMIT 1
  ) AS x ON true;
$fn$;

REVOKE EXECUTE ON FUNCTION public.club_season_bounds(uuid) FROM PUBLIC;

-- Số SP còn dùng được của một người trong mùa đang chạy.
--
-- ponytail: KHÔNG tính điểm từ trận đấu (sàn 0 sau mỗi trận, thưởng chuỗi, hệ số kèo — xem đầu
-- 0047: server không dựng lại được). Nên với người thắng trận nhiều, server chặn CHẶT HƠN số dư
-- trên màn hình. Lệch về phía an toàn: không ai cược được quá số mình có. Với bot thì khớp đủ,
-- vì bot không ra sân.
CREATE OR REPLACE FUNCTION public.member_season_sp(p_club uuid, p_member uuid, p_is_bot boolean)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  b    record;
  v_sp integer;
BEGIN
  SELECT * INTO b FROM club_season_bounds(p_club);

  -- Điểm khởi đầu: bot luôn có; người thật phải ra sân ít nhất một trận trong mùa (khớp
  -- `season.js`: chưa đánh mà có điểm thì đứng trên người có đi tập mà thua).
  IF p_is_bot OR EXISTS (
    SELECT 1 FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      JOIN sessions s ON s.id = m.session_id
     WHERE s.club_id = p_club AND mp.player_id = p_member
       AND s.date BETWEEN (b.start_at AT TIME ZONE 'UTC')::date AND (b.end_at AT TIME ZONE 'UTC')::date
  ) THEN
    v_sp := b.start_points;
  ELSE
    v_sp := 0;
  END IF;

  -- Phiếu đã quyết toán trong mùa: ăn 1:1 theo `stake_points`, đúng như `season.js` cộng.
  v_sp := v_sp + COALESCE((
    SELECT SUM(CASE WHEN status = 'won' THEN stake_points ELSE -stake_points END)
      FROM challenge_predictions
     WHERE club_id = p_club AND member_id = p_member AND status IN ('won', 'lost')
       AND settled_at BETWEEN b.start_at AND b.end_at
  ), 0);

  -- Phiếu đang chờ ở kèo còn sống: điểm đang bị giam, trừ ra (khớp `pendingStakeOf`).
  v_sp := v_sp - COALESCE((
    SELECT SUM(p.stake_points)
      FROM challenge_predictions p
      JOIN challenges c ON c.id = p.challenge_id
     WHERE p.club_id = p_club AND p.member_id = p_member AND p.status = 'pending'
       AND c.status IN ('pending', 'accepted', 'oncourt')
       AND NOT (c.status = 'pending' AND c.expires_at IS NOT NULL AND c.expires_at <= now())
  ), 0);

  -- Arcade trong mùa, cả hai phe của cùng một dòng.
  v_sp := v_sp + COALESCE((
    SELECT SUM(CASE
      WHEN member_id = p_member   AND outcome = 'won'  THEN  stake
      WHEN member_id = p_member   AND outcome = 'lost' THEN -stake
      WHEN opponent_id = p_member AND outcome = 'won'  THEN -stake
      WHEN opponent_id = p_member AND outcome = 'lost' THEN  stake
      ELSE 0
    END)
      FROM arcade_rounds
     WHERE club_id = p_club AND (member_id = p_member OR opponent_id = p_member)
       AND created_at BETWEEN b.start_at AND b.end_at
  ), 0);

  RETURN GREATEST(v_sp, 0);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.member_season_sp(uuid, uuid, boolean) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 4. Dựng kèo ĐÔI dưới danh nghĩa bot.
--    Trả về id kèo vừa tạo, hoặc NULL khi một cổng nào đó đóng — KHÔNG ném lỗi, vì client gọi
--    hàm này ở mỗi lần nạp CLB và NULL là chuyện thường ngày, không phải sự cố.
--
--    LUÔN LÀ KÈO ĐÔI (2 đấu 2): CLB hiếm khi đánh đơn, kèo đơn của bot gần như không ai nhận.
-- ---------------------------------------------------------------------------
-- DROP trước: `CREATE OR REPLACE` KHÔNG đổi được TÊN hay KIỂU tham số của hàm đã tồn tại. Bản
-- nháp cũ nhận (uuid, uuid, text) cho kèo đơn — bỏ luôn để không còn cửa nào dựng kèo đơn.
DROP FUNCTION IF EXISTS public.create_bot_challenge(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.create_bot_challenge(uuid[], uuid[], text);

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
  IF v_bot IS NULL THEN RETURN NULL; END IF;

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
-- 5. Bot bình luận chuyện của CLB lên dòng Hoạt động.
--
-- VÌ SAO CŨNG PHẢI LÀ RPC: `activity_events_insert` (0038) bắt `actor_id` phải là chính người
-- đang gõ. Bot đứng tên actor thì client thường trượt — y hệt lý do của hàm tạo kèo.
--
-- PAYLOAD CHỈ CÓ `kind` + `subject`, KHÔNG có câu chữ và KHÔNG có cả số thứ tự câu: lúc render
-- lấy chính `id` của dòng làm hạt giống để chọn biến thể. Dòng nào cũng ra đúng một câu cố định
-- của nó, mà không phải lưu gì thêm — và thêm câu mới vào i18n là mọi dòng cũ tự có thêm lựa chọn.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.post_bot_remark(text, uuid);

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
  IF v_bot IS NULL THEN RETURN NULL; END IF;

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
-- 6. Bot nhận xét SAU TRẬN của kèo do chính nó dựng.
--
-- CHỈ SAU TRẬN (Q9). Bản đầu còn cho bot lên tiếng khi kèo bị từ chối / huỷ / hết hạn, và lấy
-- "người từ chối" là người đầu đội B — bot bêu SAI NGƯỜI trước cả CLB (H2), còn `p_kind` tự do
-- thì ai cũng spam được dòng Hoạt động không giới hạn (H1). Kèo không diễn ra giờ chỉ còn dòng
-- trung tính của hệ thống, bot im.
--
-- KHÔNG kiểm "đã có trận chưa": client gọi hàm ngay sau khi cập nhật màn hình, dòng trận có thể
-- chưa kịp xuống DB. Kiểm NGƯỜI GỌI thay cho việc đó: đấu thủ của kèo hoặc người có quyền xếp sân.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.post_bot_reaction(text, uuid);

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
  IF v_bot IS NULL THEN RETURN NULL; END IF;

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
-- 7. Bot đặt phiếu dự đoán.
--
-- Bản sao của `place_challenge_prediction` (0047) nhưng ghi dưới tên bot thay vì `auth.uid()`.
-- Phải chép chứ không gọi lại được: hàm kia xác định người đặt bằng phiên đăng nhập, mà không ai
-- đăng nhập bằng bot trong trình duyệt của người khác — đúng lý do của hàm tạo kèo.
--
-- PHE DO SERVER CHỌN (M4). Bản đầu nhận `p_team` từ client: ai biết gõ lệnh là bắt bot đặt cửa
-- chắc thua trước khi app kịp cho nó tự cược, lặp vài lần là bot hết điểm và tụt BXH. Giờ phe là
-- cửa có Elo trung bình cao hơn, và cứ khoảng 1/5 kèo (theo id kèo) bot liều bắt cửa dưới — giữ
-- đúng tính cách cũ. Người gọi chỉ còn chỉnh được MỨC cược, và mức đó bị kẹp ở 45% số dư.
--
-- LUẬT ĐẤU THỦ KHÔNG CƯỢC KÈO CỦA MÌNH: bot không bao giờ là đấu thủ (nó chỉ đứng tên người tạo),
-- nên nó cược được cả kèo do chính nó dựng. Vẫn kiểm lại ở dưới, vì luật này mà thủng thì phiếu
-- cược thành gian lận chứ không phải lỗi hiển thị.
--
-- Chống đua bằng chính `uq_chal_member_prediction (challenge_id, member_id)`: hai lời gọi song
-- song thì một cái thắng, cái kia rơi vào ON CONFLICT DO NOTHING và trả NULL.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.place_bot_prediction(uuid, text, integer);
DROP FUNCTION IF EXISTS public.place_bot_prediction(uuid, integer);

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
  IF v_bot IS NULL THEN RETURN NULL; END IF;

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
-- 8. ARCADE — chơi một ván với bot.
--
-- `p_club` bắt buộc (H5): bản đầu lấy CLB bằng `club_members … LIMIT 1` theo tài khoản, người ở
-- hai CLB chơi ở màn CLB này mà bị cộng trừ điểm ở CLB kia.
--
-- Khi từ chối thì trả `{ error: <mã> }` thay vì NULL (L4), để màn hình nói đúng vì sao:
--   no_bot · capped (đủ lượt 24h) · bot_broke (bot hết điểm) · broke (bạn hết điểm) · invalid.
--
-- DÒNG HOẠT ĐỘNG GỘP THEO NGÀY (M5): bản đầu mỗi ván một dòng, 30 người chơi đủ lượt là 150 dòng
-- một ngày đè hết tin thật. Giờ mỗi người một dòng mỗi ngày (giờ VN), cập nhật số ván tại chỗ.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_arcade_round(text, integer, text);
DROP FUNCTION IF EXISTS public.play_arcade_round(uuid, text, integer, text);

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
  IF v_bot IS NULL OR v_me = v_bot THEN RETURN jsonb_build_object('error', 'no_bot'); END IF;

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

-- ---------------------------------------------------------------------------
-- 9. CHỌN THÀNH VIÊN LÀM BOT (Cài đặt → Chung).
--
-- Cờ `is_bot` CỐ Ý không đi đường đồng bộ chung (`dbmap.toRows` không ghi cột này), nên đây là
-- cửa ghi duy nhất ngoài việc gõ SQL tay. Chủ CLB chọn được BẤT KỲ thành viên đang hoạt động nào
-- — kể cả tài khoản có đăng nhập; chọn ai là việc của chủ CLB.
--
-- MỘT CLB MỘT BOT: mọi RPC ở trên lấy bot bằng `… AND is_bot LIMIT 1`, hai bot là chọn ngẫu nhiên
-- mỗi lần gọi. Index unique dưới đây để chính DB chặn, không trông vào code nhớ tắt người cũ.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_members_one_bot
  ON public.club_members(club_id) WHERE is_bot;

DROP FUNCTION IF EXISTS public.set_club_bot(uuid, uuid);

CREATE OR REPLACE FUNCTION public.set_club_bot(
  p_club   uuid,
  p_member uuid   -- NULL = tắt bot
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF p_club IS NULL OR NOT has_club_perm(p_club, 'members') THEN
    RAISE EXCEPTION 'Chỉ chủ CLB mới chọn được bot';
  END IF;

  IF p_member IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM club_members WHERE id = p_member AND club_id = p_club AND active IS NOT FALSE
  ) THEN
    RAISE EXCEPTION 'Thành viên này không thuộc CLB hoặc đã nghỉ';
  END IF;

  -- Tắt người cũ TRƯỚC rồi mới bật người mới — ngược thứ tự là đụng index unique ở trên.
  UPDATE club_members SET is_bot = false
   WHERE club_id = p_club AND is_bot AND id IS DISTINCT FROM p_member;

  IF p_member IS NOT NULL THEN
    UPDATE club_members SET is_bot = true WHERE id = p_member AND NOT is_bot;
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.set_club_bot(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_club_bot(uuid, uuid) TO authenticated;

COMMIT;
