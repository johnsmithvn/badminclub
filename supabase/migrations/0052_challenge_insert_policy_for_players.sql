-- 0052_challenge_insert_policy_for_players.sql
-- SỬA LỖI: thành viên thường bấm "Nhận kèo" bị chặn với
--   new row violates row-level security policy for table "challenges"
--
-- ================================ NGUYÊN NHÂN ================================
--
-- Lớp sync ghi bảng `challenges` bằng UPSERT, không phải UPDATE:
--   `dbmap.js` khai `{ table: 'challenges', mode: 'id' }`
--   -> `storage.js` gọi `supabase.upsert(rows, { onConflict: 'id' })`
--   -> Postgres chạy `INSERT ... ON CONFLICT (id) DO UPDATE`
--
-- Với câu đó Postgres áp CẢ HAI policy: `WITH CHECK` của INSERT cho dòng đề xuất, rồi mới tới
-- policy UPDATE khi trúng conflict. Nên dù thao tác thực chất là sửa một dòng đã có, nó vẫn phải
-- lọt qua `challenges_ins`.
--
-- `challenges_ins` (0022) chỉ cho hai cửa: có quyền `assign` (admin), hoặc `created_by` là chính
-- mình. Thành viên thường nhận kèo do NGƯỜI KHÁC tạo thì trượt cả hai.
--
-- 0037 đã nới `challenges_upd` (thêm `is_club_member`) và `challenge_players_ins` cho đúng việc
-- này, nhưng BỎ SÓT `challenges_ins` — nên nửa đường sync vẫn bị chặn. Đây là chỗ vá nốt.
--
-- ================================ PHẠM VI NỚI ================================
--
-- CỐ Ý không dùng `is_club_member(club_id)` rộng như `challenges_upd`: thế thì thành viên bất kỳ
-- insert được một kèo mới với `created_by` là người khác, tức mạo danh người khác gạ kèo.
--
-- Nhánh thêm vào chỉ đúng khi kèo ĐÃ TỒN TẠI và người bấm là đấu thủ trong kèo đó. Lúc INSERT
-- thật (kèo mới) thì `challenge_players` chưa có dòng nào cho id đó — `dbmap.TABLES` ghi
-- `challenges` TRƯỚC `challenge_players` — nên nhánh này false và luật tạo kèo giữ nguyên độ chặt.

DROP POLICY IF EXISTS challenges_ins ON public.challenges;

CREATE POLICY challenges_ins ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (
    has_club_perm(club_id, 'assign')
    OR created_by IN (
      SELECT id FROM public.club_members
      WHERE user_id = auth.uid() AND club_id = challenges.club_id
    )
    -- Upsert lên kèo đã có: người bấm phải là đấu thủ trong chính kèo đó.
    OR EXISTS (
      SELECT 1
      FROM public.challenge_players cp
      JOIN public.club_members cm ON cm.id = cp.member_id
      WHERE cp.challenge_id = challenges.id
        AND cm.user_id = auth.uid()
        AND cm.active IS NOT FALSE
    )
  );

COMMENT ON POLICY challenges_ins ON public.challenges IS
  'Tạo kèo: admin hoặc tự tạo cho mình. Nhánh challenge_players chỉ phục vụ UPSERT lên kèo đã tồn tại (nhận kèo, đổi thể thức, giao kèo) — lúc tạo mới nó luôn false.';
