-- migration_status.sql — XEM DB ĐÃ CHẠY TỚI MIGRATION NÀO (chỉ ĐỌC, không sửa gì, chạy bao nhiêu lần cũng được).
--
-- Dự án không có bảng ghi lại migration đã chạy (chạy tay qua SQL Editor), nên file này dò "dấu vết" mỗi migration để
-- lại trên DB: bảng / cột / hàm / trigger nó tạo ra, hoặc một đoạn code chỉ bản mới mới có.
-- CÁCH CHẠY: dán TOÀN BỘ vào Supabase SQL Editor → Run. Ra một bảng: da_chay = true là đã chạy, false là CHƯA.
-- Migration nào false → chạy file đó trong supabase/migrations/ (theo thứ tự số), rồi chạy lại file này.
-- Thêm migration mới → thêm một dòng vào cuối danh sách.

SELECT so, file, da_chay
FROM (VALUES
  ('0100', '0100_games_words_vi.sql',
     to_regclass('public.game_words_vi') IS NOT NULL
     AND pg_relation_size(to_regclass('public.game_words_vi')) > 500000),  -- 0099 tạo bảng rỗng, 0100 đổ ~vài chục nghìn từ
  ('0101', '0101_games_wallet.sql',        to_regclass('public.game_wallet') IS NOT NULL),
  ('0102', '0102_games_start_seats.sql',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_start' AND prosrc LIKE '%Dồn ghế%')),
  ('0103', '0103_games_board_range.sql',   EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_board_range')),
  ('0104', '0104_games_oanquan_rules.sql', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_oanquan_deal')),
  ('0105', '0105_games_lobby.sql',         EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_ready')),
  ('0106', '0106_games_tienlen_time.sql',  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_tienlen_fill')),
  ('0107', '0107_games_xo.sql',            EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_xo_result')),
  ('0108', '0108_games_oanquan_out.sql',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_oanquan_run' AND 'o_out' = ANY (proargnames))),
  ('0109', '0109_games_xo_time.sql',       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_xo_run')),
  ('0110', '0110_games_season_points.sql', to_regclass('public.game_season_points') IS NOT NULL),
  ('0111', '0111_games_one_room.sql',      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_players_one_room')),
  ('0112', '0112_games_masoi_night.sql',
     EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_masoi_run' AND prosrc LIKE '%m.at >= v_since + 45000%')),
  ('0113', '0113_games_xo_ultimate.sql',   EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'game_xo_ucell'))
) AS t(so, file, da_chay)
ORDER BY so;
