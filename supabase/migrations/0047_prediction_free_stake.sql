-- 0047_prediction_free_stake.sql
-- Mở mức cược kèo từ ba nấc cố định (1/2/3 SP) sang NHẬP TỰ DO.
--
-- Trước migration này mức cược bị chốt ở hai chỗ, cả hai đều phía server, nên sửa mỗi giao diện
-- là bấm gửi ăn lỗi từ DB:
--   1. CHECK `stake_points BETWEEN 1 AND 3`   (0042)
--   2. Guard trong `place_challenge_prediction` (0042)
--
-- ⚠️ VÌ SAO VẪN CÒN TRẦN 100 CHỨ KHÔNG BỎ HẲN
--
-- Server KHÔNG tính được số SP khả dụng của người đặt: điểm mùa là số DẪN XUẤT, không lưu DB —
-- nó cần chạy lại toàn bộ lịch sử trận qua `season.js` mới ra. RPC không làm nổi việc đó.
-- Nghĩa là trần cứng này là lá chắn DUY NHẤT phía server; bỏ hẳn thì ai gọi thẳng RPC cũng cược
-- được một tỷ SP và bảng xếp hạng thành rác.
--
-- Việc chặn theo SP thật vẫn nằm ở client (`availableSeasonPoints` trong `lib/challenge.js`).
-- Phân vai: client chặn theo số dư thật, server chặn trần tuyệt đối chống lạm dụng.
--
-- Số 100 CỐ Ý trùng với `app.json → challenge.maxStakePoints`. SQL không đọc được JSON nên đây là
-- chỗ trùng lặp không tránh khỏi — đổi một bên thì phải đổi bên kia.

ALTER TABLE public.challenge_predictions
  DROP CONSTRAINT IF EXISTS challenge_predictions_stake_points_check;

ALTER TABLE public.challenge_predictions
  ADD CONSTRAINT challenge_predictions_stake_points_check
  CHECK (stake_points BETWEEN 1 AND 100);

-- ---------------------------------------------------------------------------
-- Đặt lại RPC: chỉ đổi đúng khối kiểm mức cược, mọi luật khác giữ nguyên từ 0042.
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

  -- ĐỔI Ở ĐÂY: nhập tự do trong khoảng 1..100 thay vì đúng ba nấc 1/2/3.
  IF p_stake IS NULL OR p_stake < 1 THEN
    RAISE EXCEPTION 'Mức cược phải từ 1 SP trở lên';
  END IF;
  IF p_stake > 100 THEN
    RAISE EXCEPTION 'Mức cược tối đa là 100 SP';
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
