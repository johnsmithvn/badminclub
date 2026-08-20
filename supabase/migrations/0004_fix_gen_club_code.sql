/* =====================================================================
   0004_fix_gen_club_code.sql — Sửa lỗi CHẶN TẠO CLB

   Triệu chứng: bấm "Tạo CLB mới" → RPC create_club trả 400
                `column reference "code" is ambiguous`.
   Không tạo được CLB nào = không dùng được app.

   Nguyên nhân: gen_club_code() khai biến plpgsql tên `code`, trùng tên cột `clubs.code`.
   Trong câu

       EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE clubs.code = code);

   vế PHẢI viết trần `code`, mà bảng `clubs` trong câu đó cũng có cột `code` → plpgsql chạy
   mặc định `variable_conflict = error` nên nó từ chối đoán, ném lỗi ngay lúc CHẠY. Định nghĩa
   hàm vẫn tạo được bình thường (thân plpgsql chỉ là text lúc CREATE) nên lỗi không lộ ra khi
   apply migration — chỉ lộ khi có người bấm tạo CLB.

   Sửa: đổi tên biến thành `v_code`, không còn chỗ nào trùng tên cột. Không dùng pragma
   `#variable_conflict use_variable` vì nó chỉ giấu bẫy đi, lần sau thêm biến khác lại dính.

   Đây là hàm duy nhất trong 0002/0003 có biến trùng tên cột — đã rà lại has_club_perm,
   create_club, join_club_by_code, approve_join_request, reject_join_request, handle_new_user.
   ===================================================================== */

CREATE OR REPLACE FUNCTION public.gen_club_code()
RETURNS char(8)
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';  -- bỏ 0/O/1/I cho khỏi đọc nhầm
  v_code   text;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE clubs.code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;
