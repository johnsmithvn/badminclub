-- 0050_grant_service_role.sql
-- Cấp quyền tối thiểu cho vai `service_role` để Edge Function `push-send` đọc được dữ liệu.
--
-- VÌ SAO CẦN: 0001_init.sql dòng 1253 chỉ cấp USAGE trên schema `public` cho `anon` và
-- `authenticated`. Toàn bộ app chạy bằng `authenticated` nên thiếu sót này nằm im từ đầu —
-- `push-send` là thứ ĐẦU TIÊN trong dự án dùng tới `service_role`, và nó nhận nguyên văn:
--
--     code 42501 — permission denied for schema public
--
-- Lỗi đó KHÔNG phải khoá sai. Khoá đúng, nhưng vai mà khoá đó ánh xạ tới không được phép
-- bước vào schema. Đọc log Edge Function thấy "permission denied for schema" thì tìm ở đây,
-- đừng đi đổi khoá.
--
-- CẤP TỐI THIỂU, không cấp cả schema: `service_role` bỏ qua RLS theo thiết kế, nên mỗi bảng
-- mở ra cho nó là một bảng không còn lớp soát vé nào. Thêm Edge Function mới cần bảng khác
-- thì thêm đúng dòng cho bảng đó, đừng mở rộng thành GRANT ALL.
--
-- `push-send` đụng đúng hai bảng:
--   club_members       SELECT  — xác minh người gửi thuộc CLB, lọc member_ids theo CLB
--   push_subscriptions SELECT  — lấy endpoint của người nhận
--                      DELETE  — dọn subscription chết khi push service trả 404/410

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON public.club_members TO service_role;
GRANT SELECT, DELETE ON public.push_subscriptions TO service_role;

COMMIT;

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------
   Cả ba câu dưới phải trả về `true`:

     SELECT has_schema_privilege('service_role', 'public', 'USAGE');
     SELECT has_table_privilege('service_role', 'public.club_members', 'SELECT');
     SELECT has_table_privilege('service_role', 'public.push_subscriptions', 'DELETE');
*/
