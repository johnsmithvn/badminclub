-- 0032 — Gỡ giá trị 'registered' khỏi enum attend_state.
--
-- Nó có từ 0001 nhưng CHƯA BAO GIỜ được dùng: `dbmap.js` chỉ đọc/ghi present · absent · extra
-- (và từ 0031 thêm noshow). Để lại là bẫy cho người sau — cái tên gợi ý "đã đăng ký đi" nên rất
-- dễ bị dùng nhầm, mà client đọc nó sẽ ra "vắng" một cách âm thầm.
--
-- Postgres KHÔNG có `ALTER TYPE ... DROP VALUE`, nên phải dựng lại kiểu. An toàn vì:
--   · chỉ đúng một cột phụ thuộc (attendances.status) — không policy, function hay default nào
--   · chặn trước: còn dòng nào dùng 'registered' là RAISE, cả migration rollback, không đổi gì
--   · chạy trong một transaction: hỏng giữa chừng thì về nguyên trạng

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM attendances WHERE status::text = 'registered';
  IF n > 0 THEN
    RAISE EXCEPTION 'Còn % dòng attendances đang dùng ''registered''. Dừng lại, chưa đổi gì. Hãy sửa các dòng đó trước.', n;
  END IF;
END $$;

ALTER TABLE attendances ALTER COLUMN status TYPE text;
DROP TYPE attend_state;
CREATE TYPE attend_state AS ENUM ('present', 'absent', 'extra', 'noshow');
ALTER TABLE attendances ALTER COLUMN status TYPE attend_state USING status::attend_state;
