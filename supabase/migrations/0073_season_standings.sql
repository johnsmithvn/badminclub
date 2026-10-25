-- 0073_season_standings.sql — Chốt cứng bảng xếp hạng mùa đã đóng.
--
-- Vì sao: điểm mùa là số DẪN XUẤT, mở bảng mùa nào app cũng tính lại từ trận. Mùa đã đóng vì thế
-- vẫn trôi: "Tính lại Elo" / "Huỷ trận" / "Sửa tỉ số" ghi đè Elo lưu trong MỌI trận (Q3 lệch tới
-- −19/người, 2026-10-16), đổi trình độ kiểu "ghi nhầm" chấm lại cả lịch sử, sửa code công thức cũng
-- đổi theo, và người đã nghỉ CLB biến mất khỏi bảng mùa cũ.
--
-- Cách làm: lúc chốt, app tính bảng một lần rồi ghi vào `season_standings` — mỗi người một dòng,
-- `data` giữ nguyên dòng bảng xếp hạng (kèm sổ điểm từng trận, Elo lúc chốt). Mùa đã chốt đọc từ
-- đây, không tính lại nữa. Mùa đang chạy vẫn tính trực tiếp như cũ.
--   - Chỉ ghi qua RPC `season_freeze`: chèn bảng chốt VÀ ghi `clubs.seasons` (mùa mang `frozenAt`)
--     trong CÙNG giao dịch — không bao giờ có mùa đánh dấu đã chốt mà thiếu bảng, hay ngược lại.
--   - Chốt một lần: mùa đã có bảng thì RPC từ chối. Không ai sửa / xoá được qua API.
--   - Quyền: cờ `settings`, đúng quyền đang ghi `clubs` (policy clubs_update).
--   - Bộ ghi lịch sử (0070) chép bảng này: lỡ xoá tay trong SQL Editor vẫn còn bản sao.
--
-- Không đổi Elo / điểm mùa. CHỈ THÊM MỚI, chạy lại được.
-- Kiểm tra sau khi chạy: supabase/manual/0073_season_standings_check.sql (tự huỷ).

BEGIN;

CREATE TABLE IF NOT EXISTS public.season_standings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  -- id của mùa trong `clubs.seasons` (jsonb, không có bảng riêng nên không khoá ngoại được).
  season_id  text NOT NULL,
  -- Không khoá ngoại: bảng chốt là ảnh lịch sử, người nghỉ / bị xoá vẫn phải còn trong mùa cũ.
  member_id  uuid NOT NULL,
  rank       integer NOT NULL CHECK (rank >= 1),
  points     integer NOT NULL,
  -- Nguyên dòng bảng xếp hạng lúc chốt (season.js: freezeStandingRow). rank / points tách cột để
  -- tra SQL được ("ai vô địch mấy mùa"), app đọc `data`.
  data       jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  frozen_at  timestamptz NOT NULL DEFAULT now(),
  frozen_by  uuid DEFAULT auth.uid(),
  UNIQUE (club_id, season_id, member_id)
);

ALTER TABLE public.season_standings ENABLE ROW LEVEL SECURITY;

-- Supabase mặc định cấp ALL cho anon/authenticated trên bảng mới → thu hồi, chỉ cho đọc.
REVOKE ALL ON public.season_standings FROM anon, authenticated;
GRANT SELECT ON public.season_standings TO authenticated;

DROP POLICY IF EXISTS season_standings_read ON public.season_standings;
CREATE POLICY season_standings_read ON public.season_standings
  FOR SELECT TO authenticated
  USING (is_club_member(club_id));

/**
 * Chốt bảng một mùa.
 *   p_rows    : mảng dòng bảng xếp hạng (mỗi dòng có id = member id, rank, totalSeasonPoints).
 *   p_seasons : toàn bộ `clubs.seasons` mới — mùa p_season_id phải đã đóng và mang `frozenAt`.
 * Mã lỗi RAISE là key i18n `season.err.*`, client dịch bằng t(e.message).
 */
CREATE OR REPLACE FUNCTION public.season_freeze(p_club uuid, p_season_id text, p_rows jsonb, p_seasons jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT has_club_perm(p_club, 'settings') THEN
    RAISE EXCEPTION 'season.err.noPerm';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'season.err.emptyStandings';
  END IF;
  IF jsonb_typeof(p_seasons) IS DISTINCT FROM 'array' OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_seasons) s
     WHERE COALESCE(s ->> 'id', s ->> 'code') = p_season_id
       AND COALESCE((s ->> 'active')::boolean, false) = false
       AND s ->> 'frozenAt' IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'season.err.notClosed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) r
     WHERE NOT EXISTS (SELECT 1 FROM club_members cm WHERE cm.id = (r ->> 'id')::uuid AND cm.club_id = p_club)
  ) THEN
    RAISE EXCEPTION 'season.err.foreignMember';
  END IF;

  -- Khoá dòng CLB: hai máy bấm chốt cùng lúc thì máy sau chờ, rồi thấy mùa đã chốt.
  PERFORM 1 FROM clubs WHERE id = p_club FOR UPDATE;
  IF EXISTS (SELECT 1 FROM season_standings WHERE club_id = p_club AND season_id = p_season_id) THEN
    RAISE EXCEPTION 'season.err.alreadyFrozen';
  END IF;

  INSERT INTO season_standings (club_id, season_id, member_id, rank, points, data)
  SELECT p_club, p_season_id, (r ->> 'id')::uuid, (r ->> 'rank')::int, (r ->> 'totalSeasonPoints')::int, r
    FROM jsonb_array_elements(p_rows) r;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE clubs SET seasons = p_seasons WHERE id = p_club;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.season_freeze(uuid, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.season_freeze(uuid, text, jsonb, jsonb) TO authenticated;

-- Bộ ghi lịch sử 0070.
DO $$
BEGIN
  IF to_regprocedure('public.audit_row()') IS NULL THEN
    RAISE NOTICE 'audit: chưa chạy 0070, bỏ qua bộ ghi lịch sử';
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS audit_season_standings ON public.season_standings;
  CREATE TRIGGER audit_season_standings AFTER INSERT OR UPDATE ON public.season_standings
    FOR EACH ROW EXECUTE FUNCTION public.audit_row('*', '');
  DROP TRIGGER IF EXISTS audit_season_standings_del ON public.season_standings;
  CREATE TRIGGER audit_season_standings_del BEFORE DELETE ON public.season_standings
    FOR EACH ROW EXECUTE FUNCTION public.audit_row('*', '');
END $$;

COMMIT;
