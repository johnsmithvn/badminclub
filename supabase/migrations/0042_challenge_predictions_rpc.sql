-- 0042_challenge_predictions_rpc.sql
-- Sửa lỗi P0 của tính năng Dự đoán: bảng bị khoá RPC-only nhưng client lại ghi qua đồng bộ chung.
--
-- BỐI CẢNH. 0041 đã `REVOKE UPDATE, DELETE ... FROM authenticated` để ép mọi thay đổi đi qua RPC,
-- nhưng client vẫn để `challenge_predictions` trong `dbmap.TABLES`, và đường đồng bộ chung ghi
-- bằng `.upsert(rows, { onConflict: 'id' })` = `INSERT ... ON CONFLICT DO UPDATE`. Postgres đòi
-- quyền UPDATE cho câu đó NGAY LÚC LẬP KẾ HOẠCH, kể cả khi không có dòng nào xung đột — nên
-- MỌI lượt ghi, kể cả insert phiếu đầu tiên, đều trả 42501. Client xếp 42501 vào lỗi chí mạng
-- (`storage.js: isFatal`) nên nó nạp lại state từ DB: phiếu vừa đặt biến mất ngay sau toast.
--
-- Nặng hơn: `flush()` chạy op tuần tự theo thứ tự TABLES, mà `challenge_predictions` đứng TRƯỚC
-- `player_ratings`. Lưu set cuối của một kèo có người cược thì matches + challenges ghi xong,
-- tới predictions là ném lỗi, và player_ratings/club_calibration/notifications KHÔNG BAO GIỜ
-- chạy. Trận được lưu còn Elo thì không — im lặng.
--
-- HƯỚNG SỬA. Giữ nguyên ý đồ RPC-only của 0041 (quyết toán phải kiểm quyền ở server, không tin
-- client), bổ sung đúng những gì còn thiếu để client dùng được:
--   1. place_challenge_prediction — đặt phiếu, và xử lý luôn va chạm UNIQUE khi đặt lại sau huỷ.
--   2. settle_challenge_predictions — quyết toán LẠI được khi sửa tỷ số; nhánh hoàn phiếu mở cho
--      cả đấu thủ (huỷ kèo / từ chối / hết hạn không phải lúc nào cũng do admin bấm).
--   3. RLS đọc bó lại theo CLB.
--   4. Trần cược khớp UI (1..3).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Trần cược: DB đang cho 1..5 trong khi UI chỉ có 1/2/3. Siết về đúng luật đang chơi.
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_predictions
  DROP CONSTRAINT IF EXISTS challenge_predictions_stake_points_check;
ALTER TABLE public.challenge_predictions
  ADD CONSTRAINT challenge_predictions_stake_points_check
  CHECK (stake_points BETWEEN 1 AND 3);

-- ---------------------------------------------------------------------------
-- 2. RLS đọc: 0041 để USING (true) — mọi tài khoản đã đăng nhập đọc được phiếu của MỌI CLB.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "chal_pred_select" ON public.challenge_predictions;
CREATE POLICY "chal_pred_select" ON public.challenge_predictions
  FOR SELECT TO authenticated USING (is_club_member(club_id));

-- Insert policy của 0041 không kiểm club_id có khớp CLB của chính member đó không.
DROP POLICY IF EXISTS "chal_pred_insert" ON public.challenge_predictions;
CREATE POLICY "chal_pred_insert" ON public.challenge_predictions
  FOR INSERT TO authenticated WITH CHECK (
    member_id IN (
      SELECT id FROM public.club_members
      WHERE user_id = auth.uid() AND club_id = challenge_predictions.club_id
    )
    AND status = 'pending'
    AND payout_points = 0
  );

-- ---------------------------------------------------------------------------
-- 3. Đặt phiếu.
--
-- Phải là RPC chứ không phải INSERT thẳng vì uq_chal_member_prediction (challenge_id, member_id):
-- huỷ phiếu chỉ đổi status thành 'cancelled' và GIỮ NGUYÊN dòng, nên lần đặt lại mà INSERT là
-- đâm thẳng vào UNIQUE (23505). Client lại coi 23505 là lỗi chí mạng nên mất luôn thao tác.
-- Ở đây dùng ON CONFLICT DO UPDATE để đặt lại chính dòng cũ.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_challenge_prediction(
  p_challenge_id uuid,
  p_team text,
  p_stake integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_chal record;
  v_my_mem_id uuid;
  v_pred_id uuid;
BEGIN
  SELECT * INTO v_chal FROM challenges WHERE id = p_challenge_id;
  IF v_chal.id IS NULL THEN
    RAISE EXCEPTION 'Kèo không tồn tại';
  END IF;

  SELECT id INTO v_my_mem_id FROM club_members
   WHERE club_id = v_chal.club_id AND user_id = auth.uid() AND active IS NOT FALSE
   LIMIT 1;
  IF v_my_mem_id IS NULL THEN
    RAISE EXCEPTION 'Bạn không phải thành viên đang hoạt động của CLB này';
  END IF;

  IF p_team NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'Đội dự đoán không hợp lệ';
  END IF;
  IF p_stake IS NULL OR p_stake < 1 OR p_stake > 3 THEN
    RAISE EXCEPTION 'Mức cược chỉ nhận 1, 2 hoặc 3 SP';
  END IF;

  IF v_chal.predictions_enabled IS FALSE OR v_chal.predictions_locked IS TRUE THEN
    RAISE EXCEPTION 'Kèo này đã đóng cổng dự đoán';
  END IF;
  IF v_chal.status NOT IN ('pending', 'accepted') THEN
    RAISE EXCEPTION 'Kèo không còn nhận dự đoán';
  END IF;
  -- `expires_at` là hạn ĐỂ ĐỐI THỦ NHẬN KÈO, không phải hạn của trận. Chỉ chặn khi kèo còn
  -- 'pending' — kèo đã 'accepted' là bốn người đã đồng ý và đang chờ sân, vẫn nhận cược cho tới
  -- lúc lên sân. Kiểm theo mốc giờ vì không có tiến trình nào quét, cột status chỉ đổi khi có
  -- người bấm vào nó.
  IF v_chal.status = 'pending'
     AND v_chal.expires_at IS NOT NULL AND v_chal.expires_at <= now() THEN
    RAISE EXCEPTION 'Kèo đã quá hạn';
  END IF;

  -- Luật cứng: đấu thủ trong trận không được cược chính trận của mình.
  -- Xét theo `challenge_players` thôi, KHÔNG xét `created_by`: quản trò dựng kèo hộ bốn người
  -- khác thì không phải đấu thủ, và client (`canMemberPredict`) cũng chỉ chặn theo đội hình.
  -- Chặn thêm ở đây là server từ chối một thao tác mà UI vừa mời người ta bấm.
  IF EXISTS (
    SELECT 1 FROM challenge_players
     WHERE challenge_id = p_challenge_id AND member_id = v_my_mem_id
  ) THEN
    RAISE EXCEPTION 'Đấu thủ trong trận không được dự đoán trận của mình';
  END IF;

  INSERT INTO challenge_predictions AS cp
    (challenge_id, club_id, member_id, team, stake_points, payout_points, status, settled_at, updated_at)
  VALUES
    (p_challenge_id, v_chal.club_id, v_my_mem_id, p_team, p_stake, 0, 'pending', NULL, now())
  ON CONFLICT (challenge_id, member_id) DO UPDATE
    SET team = EXCLUDED.team,
        stake_points = EXCLUDED.stake_points,
        payout_points = 0,
        status = 'pending',
        settled_at = NULL,
        updated_at = now()
    -- Chỉ cho đặt lại khi phiếu cũ đã huỷ. Phiếu đang chờ hoặc đã quyết toán thì đứng yên —
    -- không thì đây thành cửa đổi kèo sau khi đã biết kết quả.
    WHERE cp.status = 'cancelled'
  RETURNING cp.id INTO v_pred_id;

  IF v_pred_id IS NULL THEN
    RAISE EXCEPTION 'Bạn đã có phiếu dự đoán cho kèo này';
  END IF;

  RETURN v_pred_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.place_challenge_prediction(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_challenge_prediction(uuid, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Quyết toán.
--
-- Khác 0041 ở hai chỗ:
--   a) Nhánh thắng/thua nhận cả phiếu ĐÃ quyết toán, để sửa tỷ số làm lật đội thắng thì phiếu
--      chạy lại theo kết quả mới. Bản cũ chỉ đụng status='pending' nên phiếu vĩnh viễn đứng
--      theo kết quả sai.
--   b) Nhánh HOÀN mở cho đấu thủ / người tạo kèo. Huỷ kèo, từ chối kèo và kèo hết hạn đều là
--      thao tác của người chơi chứ không phải admin — mà phiếu treo 'pending' thì SP của người
--      đặt bị giam vĩnh viễn.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_challenge_predictions(
  p_challenge_id uuid,
  p_winner_team text -- 'A', 'B', hoặc NULL (hoàn phiếu)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_chal record;
  v_my_mem_id uuid;
  v_can_assign boolean;
  v_is_player boolean;
  v_is_dead boolean;
BEGIN
  SELECT * INTO v_chal FROM challenges WHERE id = p_challenge_id;
  IF v_chal.id IS NULL THEN
    RAISE EXCEPTION 'Kèo không tồn tại';
  END IF;

  SELECT id INTO v_my_mem_id FROM club_members
   WHERE club_id = v_chal.club_id AND user_id = auth.uid()
   LIMIT 1;

  v_can_assign := has_club_perm(v_chal.club_id, 'assign');
  v_is_player := v_my_mem_id IS NOT NULL AND (
    v_chal.created_by = v_my_mem_id
    OR EXISTS (SELECT 1 FROM challenge_players
                WHERE challenge_id = p_challenge_id AND member_id = v_my_mem_id)
  );

  IF p_winner_team IS NOT NULL AND p_winner_team IN ('A', 'B') THEN
    IF NOT v_can_assign THEN
      RAISE EXCEPTION 'Bạn không có quyền quản lý trận đấu để quyết toán dự đoán';
    END IF;

    UPDATE public.challenge_predictions
    SET status = 'won',
        payout_points = stake_points * 2,
        settled_at = now(),
        updated_at = now()
    WHERE challenge_id = p_challenge_id
      AND status IN ('pending', 'won', 'lost')
      AND team = p_winner_team;

    UPDATE public.challenge_predictions
    SET status = 'lost',
        payout_points = 0,
        settled_at = now(),
        updated_at = now()
    WHERE challenge_id = p_challenge_id
      AND status IN ('pending', 'won', 'lost')
      AND team <> p_winner_team;
  ELSE
    -- Hoàn phiếu trên một kèo ĐÃ CHẾT là dọn dẹp máy móc, ai trong CLB chạm vào cũng được: kèo
    -- mở hết hạn thì người phát hiện ra thường là một khán giả bất kỳ bấm "nhận kèo", không
    -- phải đấu thủ cũng không phải admin.
    -- Kèo còn sống thì vẫn chỉ đấu thủ / ban quản trị, không thì đây thành nút xoá sạch cửa
    -- cược của một trận sắp đánh.
    v_is_dead := v_chal.status IN ('cancelled', 'declined', 'expired')
      OR (v_chal.status = 'pending' AND v_chal.expires_at IS NOT NULL AND v_chal.expires_at <= now())
      -- Kèo gắn vào buổi đã chốt sổ / bị huỷ thì trận sẽ không bao giờ được đánh. Đây là đường
      -- duy nhất giết được kèo 'accepted' bị bỏ rơi (xem `staleChallenges` phía client).
      OR EXISTS (
        SELECT 1 FROM sessions se
         WHERE se.id = v_chal.session_id AND se.status IN ('closed', 'cancelled')
      );

    IF NOT (v_can_assign OR v_is_player OR (v_is_dead AND v_my_mem_id IS NOT NULL)) THEN
      RAISE EXCEPTION 'Chỉ đấu thủ trong kèo hoặc ban quản trị mới được hoàn phiếu dự đoán';
    END IF;

    -- Chỉ hoàn phiếu ĐANG CHỜ. Phiếu đã ăn/thua rồi thì không lặng lẽ gỡ kết quả ra.
    UPDATE public.challenge_predictions
    SET status = 'refunded',
        payout_points = stake_points,
        settled_at = now(),
        updated_at = now()
    WHERE challenge_id = p_challenge_id AND status = 'pending';
  END IF;

  UPDATE public.challenges
  SET predictions_locked = true, updated_at = now()
  WHERE id = p_challenge_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.settle_challenge_predictions(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_challenge_predictions(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Đảo quyết toán.
--
-- `undoMatch` gỡ trận cuối của một kèo đã xong thì chuỗi quay về dang dở, nhưng phiếu vẫn đứng
-- ăn/thua theo kết quả vừa bị xoá — điểm mùa sai cho tới khi có người nhập lại tỷ số. Đưa phiếu
-- về 'pending' để nó chờ kết quả thật.
--
-- KHÔNG mở lại cổng cược (`predictions_locked` giữ nguyên): kèo đang đánh dở, cho đặt thêm lúc
-- này là cược khi đã biết một phần kết quả.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unsettle_challenge_predictions(p_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_club uuid;
BEGIN
  SELECT club_id INTO v_club FROM challenges WHERE id = p_challenge_id;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'Kèo không tồn tại';
  END IF;
  IF NOT has_club_perm(v_club, 'assign') THEN
    RAISE EXCEPTION 'Bạn không có quyền quản lý trận đấu để đảo quyết toán dự đoán';
  END IF;

  UPDATE public.challenge_predictions
  SET status = 'pending',
      payout_points = 0,
      settled_at = NULL,
      updated_at = now()
  WHERE challenge_id = p_challenge_id AND status IN ('won', 'lost');
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.unsettle_challenge_predictions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsettle_challenge_predictions(uuid) TO authenticated;

COMMIT;
