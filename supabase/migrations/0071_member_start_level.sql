-- 0071_member_start_level.sql — Đổi trình độ KHÔNG viết lại quá khứ.
--
-- Vì sao: Elo xuất phát lấy theo trình độ HIỆN TẠI. Nâng một người TBY- → TBY thì lần "Tính lại"
-- kế tiếp coi họ là TBY ngay từ trận đầu, chấm lại mọi trận cũ — điểm mùa của cả những người
-- từng đánh cùng / gặp họ đổi theo, không ai hiểu vì sao (2026-10-16, top 1 đổi điểm).
--
-- Cách làm: cột `start_level` = trình độ dùng làm Elo xuất phát.
--   - NULL (mặc định, mọi người hiện có) → dùng `level` như trước. KHÔNG đổi Elo / điểm mùa nào.
--   - Đổi trình vì TIẾN BỘ khi đã đánh trận → app ghi trình cũ vào đây; Elo tự lên theo kết quả.
--   - Đổi vì GHI NHẦM từ đầu → app để NULL và tính lại ngay (xem appActions `saveMember`).
-- Thành viên thường không tự sửa được cột này: guard 0053 chỉ thả các cột trang trí hồ sơ.
--
-- Kèm: bộ ghi lịch sử (0070) chép thêm cột này cho bảng thành viên — tua ngược mới ra đúng Elo.
--
-- CHỈ THÊM MỚI, chạy lại được. Chạy TRƯỚC khi deploy bản app dùng cột này.
-- Kiểm tra sau khi chạy: supabase/manual/0071_member_start_level_check.sql (tự huỷ).

BEGIN;

ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS start_level text;

COMMENT ON COLUMN public.club_members.start_level IS
  'Trình độ dùng làm Elo xuất phát khi đã đổi trình vì tiến bộ. NULL = dùng level.';

DO $$
BEGIN
  IF to_regprocedure('public.audit_row()') IS NULL THEN
    RAISE NOTICE 'audit: chưa chạy 0070, bỏ qua bộ ghi lịch sử';
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS audit_club_members ON public.club_members;
  CREATE TRIGGER audit_club_members AFTER INSERT OR UPDATE ON public.club_members
    FOR EACH ROW EXECUTE FUNCTION public.audit_row('id,club_id,name,level,start_level,gender,active', '');
  DROP TRIGGER IF EXISTS audit_club_members_del ON public.club_members;
  CREATE TRIGGER audit_club_members_del BEFORE DELETE ON public.club_members
    FOR EACH ROW EXECUTE FUNCTION public.audit_row('id,club_id,name,level,start_level,gender,active', '');
END $$;

COMMIT;
