-- 0044_undo_wrong_challenge_expiry.sql
-- Gỡ lại các kèo bị đánh dấu 'expired' NHẦM bởi đợt quét `sweepStaleChallenges` bản đầu.
--
-- BẢN ĐẦU SAI Ở ĐÂU. Nó gộp hai nguyên nhân khác hẳn nhau vào một cách xử:
--   · kèo quá giờ NHẬN (chưa ai nhận, hết hạn)        → 'expired' là ĐÚNG
--   · kèo đã nhận nhưng BUỔI của nó chốt sổ / bị huỷ  → bị đánh 'expired' là SAI
--
-- Buổi chết không giết kèo — kèo chỉ mất chỗ đánh. Quản trò chốt sổ buổi tối là kèo bốn người
-- đã nhận mà chưa kịp đánh bị giết luôn, và card hiện "Hết hạn" trong khi kèo chưa hề quá giờ.
-- Bản sửa tách làm hai nhánh: hết hạn thì đánh dấu 'expired', mồ côi buổi thì GỠ khỏi buổi và
-- giữ nguyên kèo ở hàng chờ tự do.
--
-- DẤU VẾT ĐỂ NHẬN DIỆN. Nhánh sai đặt `status = 'expired'` mà VẪN GIỮ `session_id` trỏ vào một
-- buổi đã chốt/huỷ. Kèo hết hạn thật thì chưa ai nhận (`accepted_players` chưa đủ) và hầu như
-- không gắn vào buổi đã chốt. Hai điều kiện dưới đây bắt đúng dấu vết đó.
--
-- Phiếu dự đoán đã hoàn (`refunded`, net 0) thì GIỮ NGUYÊN — trận đó đã không diễn ra thật, hoàn
-- là đúng, không có gì để dựng lại.

BEGIN;

UPDATE public.challenges c
SET status = 'accepted',
    session_id = NULL,
    -- Chưa đánh hiệp nào thì mở lại cổng cược: kèo sẽ được xếp sang buổi khác.
    predictions_locked = EXISTS (
      SELECT 1 FROM public.matches m WHERE m.challenge_id = c.id
    ),
    updated_at = now()
WHERE c.status = 'expired'
  -- Còn gắn vào một buổi đã chốt sổ / bị huỷ: đúng dấu vết của nhánh sai.
  AND EXISTS (
    SELECT 1 FROM public.sessions se
    WHERE se.id = c.session_id AND se.status IN ('closed', 'cancelled')
  )
  -- Và kèo đã đủ người nhận — kèo hết hạn THẬT thì không bao giờ đủ, vì hạn chỉ áp lúc 'pending'.
  AND cardinality(c.accepted_players) >= (
    SELECT COUNT(*) FROM public.challenge_players cp WHERE cp.challenge_id = c.id
  )
  AND cardinality(c.accepted_players) > 0;

COMMIT;
