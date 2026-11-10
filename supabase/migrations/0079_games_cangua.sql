-- 0079_games_cangua.sql — Cờ cá ngựa: server đổ xúc xắc (docs/GAMES.md §5.2, §12).
--
-- CHẠY SAU 0078 (cần game_move bản 0078 — bản đó gọi game_<id>_fill nếu có).
-- CHỈ THÊM HÀM, không đổi bảng / dữ liệu. Chạy lại được (CREATE OR REPLACE).
--
-- Máy khách gửi { roll: true }, hàm này ghi kèm số 1..6 bằng random() của server — không ai biết trước, kể cả người
-- đổ. Đổ sai lượt / đổ hai lần vẫn vào log nhưng mọi máy bỏ qua khi dựng lại (như §5.1), nên không "đổ lại cho đẹp" được.
-- { out } chỉ server ghi (game_leave / game_claim) — client gửi là từ chối.
-- ponytail: chưa có game_cangua_result — game_finish tin kết quả client như Giai đoạn 1 trước 0075. Thêm khi cần
-- chống gian lận kết quả (dựng lại log bằng plpgsql như 0075).

CREATE OR REPLACE FUNCTION public.game_cangua_fill(p_room uuid, p_seat integer, p_move jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(p_move) <> 'object' OR p_move ? 'out' THEN RAISE EXCEPTION 'games.err.badMove'; END IF;
  IF p_move -> 'roll' = 'true'::jsonb THEN
    RETURN jsonb_build_object('roll', true, 'dice', 1 + floor(random() * 6)::int);
  END IF;
  RETURN p_move - 'dice';
END;
$$;

REVOKE ALL ON FUNCTION public.game_cangua_fill(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
