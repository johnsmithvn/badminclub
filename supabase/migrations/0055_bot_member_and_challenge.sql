-- 0055_bot_member_and_challenge.sql
-- BOT CLB — một thành viên được đánh dấu `is_bot` tự dựng kèo cho HAI NGƯỜI THẬT.
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
  'Thành viên này là NPC do code điều khiển. Cờ KHÔNG khoá gì cả — vẫn đăng nhập được, vẫn tính Elo, vẫn lên BXH như mọi người. Tắt bot: UPDATE ... SET is_bot = false, không cần deploy.';

-- Lý do bot xếp hai người này vào với nhau, dạng MÃ (`rank_neighbor` / `streak_hunt`), không phải
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
-- 2. Dựng kèo dưới danh nghĩa bot.
--    Trả về id kèo vừa tạo, hoặc NULL khi một cổng nào đó đóng — KHÔNG ném lỗi, vì client gọi
--    hàm này ở mỗi lần nạp CLB và NULL là chuyện thường ngày, không phải sự cố.
-- ---------------------------------------------------------------------------
-- DROP trước: `CREATE OR REPLACE` KHÔNG đổi được TÊN tham số của hàm đã tồn tại (Postgres báo
-- "cannot change name of input parameter"). Bản nháp của hàm này từng nhận `p_stake_text`, nên
-- chạy đè lên một DB đã có bản cũ sẽ nổ. Cùng chữ ký nên không có quyền nào bị mất thêm.
DROP FUNCTION IF EXISTS public.create_bot_challenge(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.create_bot_challenge(
  p_a uuid,
  p_b uuid,
  p_reason text DEFAULT 'rank_neighbor'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_club uuid;
  v_bot  uuid;
  v_code text;
  v_id   uuid;
  -- Hạn NHẬN kèo của bot: 24h, KHÁC kèo người (7 ngày). Cố ý bằng đúng nhịp ở cổng 2 — nhờ vậy
  -- client chỉ cần nhìn `expiresAt` là suy ra được cả hai luật. Xem `bot.js: botGateOpen`.
  c_hours constant integer := 24;
BEGIN
  IF p_a IS NULL OR p_b IS NULL OR p_a = p_b THEN
    RETURN NULL;
  END IF;

  SELECT club_id INTO v_club FROM club_members WHERE id = p_a;
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

  -- Hai đấu thủ: người thật, cùng CLB, đang hoạt động, và không phải một bot khác.
  IF NOT EXISTS (
    SELECT 1 FROM club_members
     WHERE id = p_a AND club_id = v_club AND active IS NOT FALSE AND NOT is_bot
  ) OR NOT EXISTS (
    SELECT 1 FROM club_members
     WHERE id = p_b AND club_id = v_club AND active IS NOT FALSE AND NOT is_bot
  ) THEN RETURN NULL; END IF;

  -- Không gạ người đang dính kèo khác: kèo chồng kèo thì cả hai cùng treo tới lúc hết hạn.
  IF EXISTS (
    SELECT 1 FROM challenge_players cp
      JOIN challenges c ON c.id = cp.challenge_id
     WHERE cp.member_id IN (p_a, p_b)
       AND c.status IN ('pending', 'accepted', 'oncourt')
  ) THEN RETURN NULL; END IF;

  -- Mã kèo: cùng khuôn `C-0125` và cùng sàn 100 với `lib/challenge.js: nextChallengeCode`.
  -- Lọc regex TRƯỚC rồi mới ép kiểu, để một dòng mã rác không làm nổ cả hàm.
  SELECT 'C-' || lpad(
           (COALESCE(MAX((substring(code from '^C-(\d+)$'))::integer), 100) + 1)::text, 4, '0')
    INTO v_code
    FROM challenges
   WHERE club_id = v_club AND code ~ '^C-\d+$';

  -- `accepted_players` để nguyên DEFAULT '{}': bot không phải đấu thủ nên không ký sẵn cho ai.
  -- Kèo cần đủ chữ ký của CẢ HAI người mới thành — giống hệt quản trò dựng kèo hộ người khác.
  --
  -- `stake_text` để TRỐNG: kèo bot không có giao kèo gì, và ô đó là của người chơi tự ghi. Lời
  -- của bot dựng lại từ `bot_reason` lúc render.
  INSERT INTO challenges
    (code, club_id, created_by, status, best_of, rating_enabled, expires_at, bot_reason)
  VALUES
    (v_code, v_club, v_bot, 'pending', 3, true,
     now() + make_interval(hours => c_hours),
     COALESCE(NULLIF(left(p_reason, 40), ''), 'rank_neighbor'))
  RETURNING id INTO v_id;

  INSERT INTO challenge_players (challenge_id, member_id, team)
  VALUES (v_id, p_a, 'A'), (v_id, p_b, 'B');

  -- Payload khớp ĐÚNG khuôn `appActions: createChallenge` phát ra, để `resolveNotificationPayload`
  -- và `resolveActivityPayload` đọc được mà không phải thêm nhánh nào.
  -- RULES §3.3: chỉ ID, không ghi tên — ghi tên cứng thì đổi tên thành viên là dòng cũ giữ tên chết.
  INSERT INTO notifications (club_id, member_id, type, payload, ref_type, ref_id)
  SELECT v_club, m, 'challenge_created',
         jsonb_build_object('chalId', v_id, 'code', v_code, 'createdBy', v_bot),
         'challenge', v_id
    FROM unnest(ARRAY[p_a, p_b]) AS m;

  INSERT INTO activity_events (club_id, actor_id, type, payload, ref_type, ref_id)
  VALUES (v_club, v_bot, 'challenge_created',
          jsonb_build_object(
            'chalId', v_id, 'code', v_code, 'createdBy', v_bot,
            'challengerIds', jsonb_build_array(p_a),
            'opponentIds',   jsonb_build_array(p_b)),
          'challenge', v_id);

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.create_bot_challenge(uuid, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_bot_challenge(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bot bình luận chuyện của CLB lên dòng Hoạt động.
--
-- VÌ SAO CŨNG PHẢI LÀ RPC: `activity_events_insert` (0038) bắt `actor_id` phải là chính người
-- đang gõ. Bot đứng tên actor thì client thường trượt — y hệt lý do của hàm tạo kèo.
--
-- PAYLOAD CHỈ CÓ `kind` + `subject`, KHÔNG có câu chữ và KHÔNG có cả số thứ tự câu: lúc render
-- lấy chính `id` của dòng làm hạt giống để chọn biến thể. Dòng nào cũng ra đúng một câu cố định
-- của nó, mà không phải lưu gì thêm — và thêm câu mới vào i18n là mọi dòng cũ tự có thêm lựa chọn.
-- ---------------------------------------------------------------------------
-- Cùng lý do với hàm trên: migration này còn được bồi thêm ở các phase sau, mà đổi tên tham số
-- trên hàm đã tồn tại thì `CREATE OR REPLACE` từ chối. DROP trước cho chạy lại bao nhiêu lần cũng được.
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
  IF p_kind IS NULL OR p_subject IS NULL THEN RETURN NULL; END IF;

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

  -- Nhịp im lặng.
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
          jsonb_build_object('kind', left(p_kind, 40), 'subject', p_subject),
          'member', p_subject)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.post_bot_remark(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.post_bot_remark(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3b. Bot phản ứng theo sự kiện vòng đời kèo (Từ chối, Huỷ, Hết hạn).
--     Ghi thẳng vào activity_events dưới dạng bot_remark, không dính rate-limit 12h
--     của ambient remarks, nhưng chống spam cùng loại cho cùng một kèo.
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
  v_subject uuid;
  v_decliner uuid;
BEGIN
  IF p_kind IS NULL OR p_challenge_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_chal FROM challenges WHERE id = p_challenge_id;
  IF v_chal.id IS NULL THEN RETURN NULL; END IF;
  v_club := v_chal.club_id;

  IF auth.uid() IS NOT NULL AND NOT is_club_member(v_club) THEN
    RAISE EXCEPTION 'Bạn không phải thành viên của CLB này';
  END IF;

  -- Chống đua ghi trùng phản ứng khi nhiều client cùng gửi lifecycle event
  PERFORM pg_advisory_xact_lock(hashtext('bot_react:' || p_challenge_id::text));

  SELECT id INTO v_bot FROM club_members
   WHERE club_id = v_club AND is_bot AND active IS NOT FALSE
   LIMIT 1;
  IF v_bot IS NULL THEN RETURN NULL; END IF;

  -- Chống ghi trùng phản ứng cùng loại cho cùng một kèo
  IF EXISTS (
    SELECT 1 FROM activity_events
     WHERE club_id = v_club AND type = 'bot_remark'
       AND payload->>'kind' = p_kind
       AND ref_type = 'challenge'
       AND ref_id = p_challenge_id
  ) THEN RETURN NULL; END IF;

  -- Người bị khịa / đối tượng chính:
  -- Nếu kèo bị từ chối: người ở Đội B hoặc người bấm từ chối
  SELECT member_id INTO v_decliner
    FROM challenge_players
   WHERE challenge_id = p_challenge_id AND team = 'B'
   LIMIT 1;

  v_subject := COALESCE(v_decliner, v_chal.created_by);

  INSERT INTO activity_events (club_id, actor_id, type, payload, ref_type, ref_id)
  VALUES (v_club, v_bot, 'bot_remark',
          jsonb_build_object(
            'kind', left(p_kind, 40),
            'subject', v_subject,
            'declinerId', v_decliner,
            'chalId', p_challenge_id,
            'code', v_chal.code
          ),
          'challenge', p_challenge_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.post_bot_reaction(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.post_bot_reaction(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Bot đặt phiếu dự đoán.
--
-- Bản sao của `place_challenge_prediction` (0047) nhưng ghi dưới tên bot thay vì `auth.uid()`.
-- Phải chép chứ không gọi lại được: hàm kia xác định người đặt bằng phiên đăng nhập, mà không ai
-- đăng nhập bằng bot trong trình duyệt của người khác — đúng lý do của hàm tạo kèo.
--
-- LUẬT ĐẤU THỦ KHÔNG CƯỢC KÈO CỦA MÌNH: bot không bao giờ là đấu thủ (nó chỉ đứng tên người tạo),
-- nên nó cược được cả kèo do chính nó dựng. Vẫn kiểm lại ở dưới, vì luật này mà thủng thì phiếu
-- cược thành gian lận chứ không phải lỗi hiển thị.
--
-- KHÔNG KIỂM SỐ DƯ SP: server không dựng lại được điểm mùa (số dẫn xuất — xem đầu 0047). Phân vai
-- giữ nguyên như với người thật: client chặn theo số dư thật (`availableSeasonPoints`), server
-- chặn trần tuyệt đối 1..100 chống lạm dụng. Con số 100 CỐ Ý trùng `app.json → challenge.maxStakePoints`.
--
-- Chống đua bằng chính `uq_chal_member_prediction (challenge_id, member_id)`: hai lời gọi song
-- song thì một cái thắng, cái kia rơi vào ON CONFLICT DO NOTHING và trả NULL. Không cần advisory
-- lock ở đây vì ràng buộc đã đúng hình dạng của luật "mỗi người một phiếu mỗi kèo".
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.place_bot_prediction(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.place_bot_prediction(
  p_challenge_id uuid,
  p_team         text,
  p_stake        integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_chal record;
  v_bot  uuid;
  v_id   uuid;
  v_bot_sp integer;
BEGIN
  IF p_team NOT IN ('A', 'B') THEN RETURN NULL; END IF;
  IF p_stake IS NULL OR p_stake < 1 OR p_stake > 100 THEN RETURN NULL; END IF;

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

  -- Kiểm tra số SP khả dụng của bot: 100 khởi đầu + net cược + net arcade - cược đang chờ
  SELECT 100
    + COALESCE(SUM(CASE
        WHEN status = 'won' THEN payout_points - stake_points
        WHEN status = 'lost' THEN -stake_points
        ELSE 0
      END), 0)
    - COALESCE(SUM(CASE WHEN status = 'pending' THEN stake_points ELSE 0 END), 0)
  INTO v_bot_sp
  FROM challenge_predictions
  WHERE member_id = v_bot AND club_id = v_chal.club_id;

  v_bot_sp := v_bot_sp + COALESCE((
    SELECT SUM(CASE
      WHEN outcome = 'won' THEN -stake
      WHEN outcome = 'lost' THEN stake
      ELSE 0
    END)
    FROM arcade_rounds
    WHERE opponent_id = v_bot AND club_id = v_chal.club_id
  ), 0);

  IF v_bot_sp < p_stake THEN RETURN NULL; END IF;

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

  INSERT INTO challenge_predictions
    (challenge_id, club_id, member_id, team, stake_points, payout_points, status, settled_at, updated_at)
  VALUES
    (p_challenge_id, v_chal.club_id, v_bot, p_team, p_stake, 0, 'pending', NULL, now())
  ON CONFLICT (challenge_id, member_id) DO NOTHING
  RETURNING id INTO v_id;

  -- NULL = bot đã có phiếu ở kèo này rồi. Chuyện thường ngày (client gọi lại mỗi lần nạp CLB),
  -- không phải lỗi. Cố ý KHÔNG cho đặt lại sau khi huỷ như `place_challenge_prediction`: bot
  -- không có nút huỷ, phiếu của nó chỉ bị huỷ khi kèo chết, mà kèo chết thì cược lại vô nghĩa.
  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.place_bot_prediction(uuid, text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.place_bot_prediction(uuid, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. ARCADE — ván cược tay đôi với bot, thanh toán bằng ĐIỂM MÙA.
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

-- Đọc: người trong CLB. Ghi: KHÔNG ai, kể cả chủ CLB — chỉ RPC dưới đây (SECURITY DEFINER) mới
-- ghi được. Ván cược tự khai là ván cược tự thắng.
DROP POLICY IF EXISTS arcade_rounds_select ON public.arcade_rounds;
CREATE POLICY arcade_rounds_select ON public.arcade_rounds
  FOR SELECT TO authenticated USING (is_club_member(club_id));

REVOKE INSERT, UPDATE, DELETE ON public.arcade_rounds FROM authenticated;

DROP FUNCTION IF EXISTS public.play_arcade_round(text, integer, text);

CREATE OR REPLACE FUNCTION public.play_arcade_round(
  p_game   text,
  p_stake  integer,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_me      uuid;
  v_club    uuid;
  v_bot     uuid;
  v_opp     text;
  v_outcome text;
  v_id      uuid;
  v_bot_sp  integer;
  v_user_sp integer;
  c_daily_cap constant integer := 5;
BEGIN
  IF p_game NOT IN ('rps', 'coin') THEN RETURN NULL; END IF;
  IF p_stake IS NULL OR p_stake < 1 OR p_stake > 100 THEN RETURN NULL; END IF;

  SELECT id, club_id INTO v_me, v_club FROM club_members
   WHERE user_id = auth.uid() AND active IS NOT FALSE
   LIMIT 1;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Bạn không phải thành viên đang hoạt động của CLB nào'; END IF;

  SELECT id INTO v_bot FROM club_members
   WHERE club_id = v_club AND is_bot AND active IS NOT FALSE
   LIMIT 1;
  IF v_bot IS NULL THEN RETURN NULL; END IF;
  -- Bot không tự chơi với chính nó (khi chủ CLB đăng nhập bằng tài khoản bot).
  IF v_me = v_bot THEN RETURN NULL; END IF;

  -- Chống đua tiêu SP của bot (cược kèo + arcade) trên toàn CLB. Khoá tự nhả cuối transaction.
  PERFORM pg_advisory_xact_lock(hashtext('bot_sp:' || v_club::text));

  -- 1. Kiểm tra số SP khả dụng của bot: 100 khởi đầu + net cược + net arcade - cược đang chờ
  SELECT 100
    + COALESCE(SUM(CASE
        WHEN status = 'won' THEN payout_points - stake_points
        WHEN status = 'lost' THEN -stake_points
        ELSE 0
      END), 0)
    - COALESCE(SUM(CASE WHEN status = 'pending' THEN stake_points ELSE 0 END), 0)
  INTO v_bot_sp
  FROM challenge_predictions
  WHERE member_id = v_bot AND club_id = v_club;

  v_bot_sp := v_bot_sp + COALESCE((
    SELECT SUM(CASE
      WHEN outcome = 'won' THEN -stake
      WHEN outcome = 'lost' THEN stake
      ELSE 0
    END)
    FROM arcade_rounds
    WHERE opponent_id = v_bot AND club_id = v_club
  ), 0);

  IF v_bot_sp < p_stake THEN RETURN NULL; END IF;

  -- 2. Kiểm tra số SP khả dụng của user:
  -- Khớp đúng logic season.js: user có >= 1 trận trong mùa mới mở khoá 100 SP, ngược lại = 0 SP.
  IF EXISTS (
    SELECT 1 FROM match_players mp
      JOIN matches m ON m.id = mp.match_id
      JOIN sessions s ON s.id = m.session_id
     WHERE s.club_id = v_club AND mp.player_id = v_me
  ) THEN
    SELECT 100
      + COALESCE(SUM(CASE
          WHEN status = 'won' THEN payout_points - stake_points
          WHEN status = 'lost' THEN -stake_points
          ELSE 0
        END), 0)
      - COALESCE(SUM(CASE WHEN status = 'pending' THEN stake_points ELSE 0 END), 0)
    INTO v_user_sp
    FROM challenge_predictions
    WHERE member_id = v_me AND club_id = v_club;

    v_user_sp := v_user_sp + COALESCE((
      SELECT SUM(CASE
        WHEN outcome = 'won' THEN stake
        WHEN outcome = 'lost' THEN -stake
        ELSE 0
      END)
      FROM arcade_rounds
      WHERE member_id = v_me AND club_id = v_club
    ), 0);
  ELSE
    v_user_sp := 0;
  END IF;

  IF v_user_sp < p_stake THEN RETURN NULL; END IF;

  IF (SELECT count(*) FROM arcade_rounds
       WHERE member_id = v_me AND created_at > now() - interval '1 day') >= c_daily_cap THEN
    RETURN NULL;
  END IF;

  -- Nước đi của bot. Dùng `random()` chứ KHÔNG dùng mẹo `('x'||uuid)::bit(32)::bigint % 3`:
  -- `bit(32)` đổi sang số nguyên là SỐ CÓ DẤU, nên một nửa số lần nó ra giá trị âm, `% 3` cũng
  -- âm, và `ARRAY[...][1 + (số âm)]` trả NULL — ván cược nổ ở ràng buộc NOT NULL, ngẫu nhiên
  -- khoảng một nửa số lần chơi. `floor(random() * n)` luôn nằm trong 0..n-1.
  --
  -- `random()` không phải nguồn mật mã, nhưng seed của nó nằm trong phiên Postgres mà client
  -- không với tới được. Với một ván oẳn tù tì trong CLB cầu lông thì thế là đủ.
  IF p_game = 'rps' THEN
    IF p_choice NOT IN ('rock', 'paper', 'scissors') THEN RETURN NULL; END IF;
    v_opp := (ARRAY['rock', 'paper', 'scissors'])[1 + floor(random() * 3)::int];
    v_outcome := CASE
      WHEN v_opp = p_choice THEN 'draw'
      WHEN (p_choice, v_opp) IN (('rock', 'scissors'), ('paper', 'rock'), ('scissors', 'paper')) THEN 'won'
      ELSE 'lost'
    END;
  ELSE
    IF p_choice NOT IN ('heads', 'tails') THEN RETURN NULL; END IF;
    v_opp := (ARRAY['heads', 'tails'])[1 + floor(random() * 2)::int];
    v_outcome := CASE WHEN v_opp = p_choice THEN 'won' ELSE 'lost' END;
  END IF;

  INSERT INTO arcade_rounds (club_id, member_id, opponent_id, game, stake, choice, opp_choice, outcome)
  VALUES (v_club, v_me, v_bot, p_game, p_stake, p_choice, v_opp, v_outcome)
  RETURNING id INTO v_id;

  INSERT INTO activity_events (club_id, actor_id, type, payload, ref_type, ref_id)
  VALUES (v_club, v_me, 'arcade_played',
          jsonb_build_object(
            'memberId', v_me,
            'opponentId', v_bot,
            'game', p_game,
            'stake', p_stake,
            'outcome', v_outcome,
            'choice', p_choice,
            'oppChoice', v_opp
          ),
          'arcade', v_id);

  RETURN jsonb_build_object(
    'id', v_id, 'outcome', v_outcome, 'oppChoice', v_opp, 'stake', p_stake, 'game', p_game);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.play_arcade_round(text, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.play_arcade_round(text, integer, text) TO authenticated;

COMMIT;
