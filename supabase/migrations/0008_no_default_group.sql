-- Migration 0008: bỏ nhóm cố định mặc định khi tạo CLB.
--
-- ⚠️ FILE NÀY ĐÃ BỊ 0011 THAY THẾ. Giờ nó chỉ còn làm một việc: dọn hàm cũ.
--
-- Bản đầu của 0008 định nghĩa lại `create_club` với BẢY tham số (bỏ đoạn INSERT member_groups).
-- Sau đó `0011_level_history.sql` định nghĩa lại `create_club` lần nữa với TÁM tham số
-- (thêm `p_levels text[]`), và bản 8 tham số đó cũng đã bỏ sẵn nhóm mặc định — tức là mục đích
-- ban đầu của 0008 nằm trọn trong 0011 rồi.
--
-- VÌ SAO KHÔNG XOÁ FILE MÀ ĐỂ LẠI LỆNH DROP: `CREATE OR REPLACE FUNCTION` chỉ thay hàm CÙNG
-- chữ ký. Bản 7 tham số và bản 8 tham số là HAI overload khác nhau, sống song song được. Nếu
-- 0008 bản cũ chạy SAU 0011 thì database có cả hai, và PostgREST không chọn nổi:
--
--     Could not choose the best candidate function between
--     public.create_club(p_name => text, ...) and public.create_club(p_name => text, ..., p_levels => text[])
--
-- → nút "Tạo CLB mới" nổ, mà lỗi thì không nói gì về nguyên nhân.
--
-- Lệnh dưới đây an toàn ở mọi thứ tự chạy: có bản 7 tham số thì dọn đi, không có thì không sao.
-- Client (`AuthContext: createClub`) gửi đủ 8 tham số nên luôn trỏ vào bản của 0011.

BEGIN;

DROP FUNCTION IF EXISTS public.create_club(text, bigint, date, int, text, text, text);

COMMIT;

NOTIFY pgrst, 'reload schema';

/* ---------- KIỂM LẠI SAU KHI CHẠY ----------
   Chỉ được còn ĐÚNG MỘT create_club, và nó phải có 8 tham số:

     SELECT oid::regprocedure FROM pg_proc WHERE proname = 'create_club';
     -- mong đợi: create_club(text,bigint,date,integer,text,text,text,text[])
*/
