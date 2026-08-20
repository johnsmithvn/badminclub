/* =====================================================================
   0006_grants.sql — Sửa lỗi CHẶN NẠP DỮ LIỆU CLB

   Triệu chứng: tạo CLB xong, vào app thì báo
                `Không nạp được dữ liệu CLB: permission denied for table clubs`
                và các select bảng trả HTTP 403, trong khi RPC (`club_pending_requests`)
                vẫn trả 200 bình thường.

   Nguyên nhân: 0002 chỉ `ENABLE ROW LEVEL SECURITY` + tạo policy, và `GRANT EXECUTE` cho đúng
   hai function `resolve_login` / `username_available`. KHÔNG có `GRANT` nào trên bảng.

   Hai lớp này khác nhau, thiếu lớp nào cũng chặn:

     GRANT  → vai `authenticated` có được ĐỤNG vào bảng không.  Thiếu → "permission denied
              for table X", không đọc được dòng nào, kể cả dòng của chính mình.
     RLS    → trong số dòng đụng được thì thấy DÒNG NÀO.        Thiếu → thấy hết mọi CLB.

   RLS chặn thì trả về 0 dòng, KHÔNG báo "permission denied" — nên thông báo lỗi này là dấu
   hiệu chắc chắn của thiếu GRANT chứ không phải policy viết sai.

   Vì sao chạy local không lộ: Supabase local có sẵn default privileges cho schema `public`,
   bảng tạo ra là tự có grant. Trên cloud, DDL dán qua SQL editor không chắc rơi vào đúng bộ
   default privileges đó, nên phải grant tường minh.

   AN TOÀN:
   - Cả 37 bảng đều ĐÃ bật RLS (đã rà lại 0001 + 0003 so với 0002). Cấp quyền bảng cho
     `authenticated` KHÔNG làm lộ dữ liệu CLB khác — policy `is_club_member` / `has_club_perm`
     vẫn lọc từng dòng như cũ. Đây đúng là mô hình Supabase: GRANT mở cửa, RLS soát vé.
   - `anon` KHÔNG được cấp quyền bảng nào. Chưa đăng nhập thì không đọc được gì; đăng nhập và
     đăng ký đi qua RPC `SECURITY DEFINER` đã cấp EXECUTE riêng ở 0002.
   - DELETE có cấp, vì lớp đồng bộ (`contexts/dbmap.js: diff`) sinh thao tác xoá dòng khi user
     bỏ một sân khỏi buổi, bỏ một người khỏi danh sách… Policy vẫn gác theo quyền của vai.
   - CHẠY LẠI ĐƯỢC nhiều lần: GRANT là thao tác cộng dồn, chạy hai lần không đổi gì thêm.
   ===================================================================== */

/* ---------- 1. Mở schema ---------- */

GRANT USAGE ON SCHEMA public TO anon, authenticated;

/* ---------- 2. Bảng: chỉ cho vai đã đăng nhập ---------- */

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO authenticated;

/* ---------- 3. Bảng thêm về sau cũng tự có quyền ---------- */

/* Không có dòng này thì mỗi migration sau lại phải nhớ GRANT tay, quên một lần là lại
   "permission denied" đúng kiểu vừa rồi. */

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

/* ---------- Kiểm lại sau khi chạy ----------
   Câu dưới phải trả về 0 dòng. Dòng nào hiện ra là bảng đó vẫn chưa có quyền:

     SELECT c.relname
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND NOT has_table_privilege('authenticated', c.oid, 'SELECT');
                                                                              */
