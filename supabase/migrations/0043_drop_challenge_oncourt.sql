-- 0043_drop_challenge_oncourt.sql
-- Bỏ trạng thái 'oncourt' khỏi máy trạng thái của Kèo.
--
-- VÌ SAO. 'oncourt' là DỮ LIỆU SUY RA ĐƯỢC nhưng lại đem lưu thành status. Việc 4 người có đang
-- đứng trên sân hay không đã nằm sẵn ở `session_lineups`; lưu thêm một bản sao ở
-- `challenges.status` tạo ra hai nguồn sự thật, và chúng lệch nhau ngay:
--
--   · Nhấc người khỏi sân chỉ đụng lineup — `status` kẹt lại 'oncourt' vĩnh viễn. Trên màn Sàn
--     kèo, kèo ở trạng thái đó không còn NÚT NÀO, cổng cược khoá vĩnh viễn, và phiếu dự đoán
--     không bao giờ tới lượt được quyết toán.
--   · Ý nghĩa còn ngược: kèo BO3 đã đánh 2/3 hiệp thì `status` là 'accepted', còn kèo CHƯA đánh
--     hiệp nào mà có người bấm nút thì lại là 'oncourt'.
--
-- THAY BẰNG. "Đang đánh" suy từ SỐ HIỆP ĐÃ GHI: có ít nhất một hiệp và chuỗi chưa xong
-- (`getChallengeSeriesProgress`). Cổng cược đóng ngay khi ghi hiệp đầu — trước đây việc này do
-- nút "Đưa lên sân trống" làm, mà nút đó đã bỏ. Muốn cho kèo lên sân thì vào màn Chia sân kéo
-- như mọi trận khác.
--
-- Giữ 'oncourt' trong ràng buộc CHECK: client cũ chưa nạp lại vẫn có thể ghi giá trị đó lên,
-- siết CHECK bây giờ là làm hỏng phiên của họ. Đây chỉ là dọn dữ liệu.

BEGIN;

-- Kèo đang kẹt 'oncourt': chưa có hiệp nào được ghi thì trả về hàng chờ.
UPDATE public.challenges
SET status = 'accepted', updated_at = now()
WHERE status = 'oncourt'
  AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.challenge_id = challenges.id);

-- Kèo 'oncourt' mà đã có hiệp được ghi: chuỗi hoặc đang dở (về 'accepted'), hoặc đã xong nhưng
-- `status` không kịp cập nhật (về 'played'). Số hiệp cần thắng = ceil(best_of / 2).
UPDATE public.challenges c
SET status = CASE
      WHEN GREATEST(w.wins_a, w.wins_b) >= CEIL(c.best_of::numeric / 2) THEN 'played'
      ELSE 'accepted'
    END,
    updated_at = now()
FROM (
  SELECT m.challenge_id,
         COUNT(*) FILTER (WHERE m.winner_team = 'A') AS wins_a,
         COUNT(*) FILTER (WHERE m.winner_team = 'B') AS wins_b
  FROM public.matches m
  WHERE m.challenge_id IS NOT NULL
  GROUP BY m.challenge_id
) w
WHERE c.id = w.challenge_id AND c.status = 'oncourt';

-- Đã ghi hiệp nào thì cổng cược phải đóng — luật mới nằm ở `saveMatchScore`, nhưng dữ liệu cũ
-- chưa đi qua đường đó nên vá một lần ở đây.
UPDATE public.challenges c
SET predictions_locked = true, updated_at = now()
WHERE c.predictions_locked IS NOT TRUE
  AND EXISTS (SELECT 1 FROM public.matches m WHERE m.challenge_id = c.id);

COMMIT;
