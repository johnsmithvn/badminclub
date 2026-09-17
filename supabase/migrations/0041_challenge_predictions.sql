-- 0041_challenge_predictions.sql
-- Tính năng Dự Đoán Trận Đấu Bằng Điểm Mùa (Match Predictions & Season Points)

-- 1. Bảng lưu trữ dự đoán kèo đấu
CREATE TABLE IF NOT EXISTS public.challenge_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  team text NOT NULL CHECK (team IN ('A', 'B')),
  stake_points integer NOT NULL CHECK (stake_points BETWEEN 1 AND 5),
  payout_points integer NOT NULL DEFAULT 0 CHECK (payout_points >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'refunded', 'cancelled')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_chal_member_prediction UNIQUE (challenge_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_chal_pred_challenge ON public.challenge_predictions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_chal_pred_member ON public.challenge_predictions(member_id);
CREATE INDEX IF NOT EXISTS idx_chal_pred_club ON public.challenge_predictions(club_id);

-- 2. Cờ kiểm soát cổng dự đoán trên bảng challenges
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS predictions_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS predictions_locked boolean NOT NULL DEFAULT false;

-- 3. RLS Policies
ALTER TABLE public.challenge_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chal_pred_select" ON public.challenge_predictions;
CREATE POLICY "chal_pred_select" ON public.challenge_predictions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "chal_pred_insert" ON public.challenge_predictions;
CREATE POLICY "chal_pred_insert" ON public.challenge_predictions
  FOR INSERT TO authenticated WITH CHECK (
    member_id IN (SELECT id FROM public.club_members WHERE user_id = auth.uid())
    AND status = 'pending'
    AND payout_points = 0
  );

-- Thu hồi quyền UPDATE & DELETE trực tiếp từ authenticated (mọi thay đổi phải qua RPC)
REVOKE UPDATE, DELETE ON public.challenge_predictions FROM authenticated;

-- 4. RPC Hủy Dự Đoán An Toàn: Thành viên tự hủy trước khi trận lên sân
CREATE OR REPLACE FUNCTION public.cancel_challenge_prediction(p_prediction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pred record;
  v_locked boolean;
  v_my_mem_id uuid;
BEGIN
  SELECT * INTO v_pred FROM challenge_predictions WHERE id = p_prediction_id;
  IF v_pred.id IS NULL THEN
    RAISE EXCEPTION 'Phiếu dự đoán không tồn tại';
  END IF;

  SELECT predictions_locked INTO v_locked FROM challenges WHERE id = v_pred.challenge_id;
  IF v_locked IS TRUE THEN
    RAISE EXCEPTION 'Trận đấu đã khóa cổng dự đoán, không thể hủy';
  END IF;

  SELECT id INTO v_my_mem_id FROM club_members
   WHERE club_id = v_pred.club_id AND user_id = auth.uid() AND active IS NOT FALSE
   LIMIT 1;

  IF v_my_mem_id IS NULL OR v_my_mem_id != v_pred.member_id THEN
    RAISE EXCEPTION 'Chỉ người đặt mới có quyền hủy phiếu dự đoán này';
  END IF;

  IF v_pred.status != 'pending' THEN
    RAISE EXCEPTION 'Phiếu dự đoán không ở trạng thái chờ';
  END IF;

  -- Chuyển sang cancelled, hoàn lại điểm (payout = stake, net = 0)
  UPDATE challenge_predictions
  SET status = 'cancelled',
      payout_points = stake_points,
      settled_at = now(),
      updated_at = now()
  WHERE id = p_prediction_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_challenge_prediction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_challenge_prediction(uuid) TO authenticated;

-- 5. RPC Quyết Toán An Toàn: Kiểm tra quyền can_assign (Owner/Treasurer/Admin)
CREATE OR REPLACE FUNCTION public.settle_challenge_predictions(
  p_challenge_id uuid,
  p_winner_team text -- 'A', 'B', hoặc NULL (nếu hủy/refund)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_club uuid;
BEGIN
  SELECT club_id INTO v_club FROM challenges WHERE id = p_challenge_id;
  IF v_club IS NULL THEN
    RAISE EXCEPTION 'Kèo không tồn tại';
  END IF;

  -- BẢO VỆ AN TOÀN: Chỉ Admin/Owner có quyền assign mới được quyền settle
  IF NOT has_club_perm(v_club, 'assign') THEN
    RAISE EXCEPTION 'Bạn không có quyền quản lý trận đấu để quyết toán dự đoán';
  END IF;

  IF p_winner_team IS NOT NULL AND p_winner_team IN ('A', 'B') THEN
    -- Đội thắng -> status='won', payout = stake * 2
    UPDATE public.challenge_predictions
    SET status = 'won',
        payout_points = stake_points * 2,
        settled_at = now(),
        updated_at = now()
    WHERE challenge_id = p_challenge_id AND status = 'pending' AND team = p_winner_team;

    -- Đội thua -> status='lost', payout = 0
    UPDATE public.challenge_predictions
    SET status = 'lost',
        payout_points = 0,
        settled_at = now(),
        updated_at = now()
    WHERE challenge_id = p_challenge_id AND status = 'pending' AND team != p_winner_team;
  ELSE
    -- Hủy trận / Không có winner -> status='refunded', payout = stake
    UPDATE public.challenge_predictions
    SET status = 'refunded',
        payout_points = stake_points,
        settled_at = now(),
        updated_at = now()
    WHERE challenge_id = p_challenge_id AND status = 'pending';
  END IF;

  -- Đóng cổng dự đoán của kèo
  UPDATE public.challenges
  SET predictions_locked = true,
      updated_at = now()
  WHERE id = p_challenge_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_challenge_predictions(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_challenge_predictions(uuid, text) TO authenticated;
