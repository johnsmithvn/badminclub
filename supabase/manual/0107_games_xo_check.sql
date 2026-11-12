-- 0107_games_xo_check.sql — kiểm tra migration 0107 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0107 rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý (giống 0089_games_covay_check.sql):
--   ✅ "0107 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản.
--
-- Ván mẫu (hằng v_xo) do luật JS lib/games/xo.js sinh ra, đủ 3 chế độ, kèm nước rác (sai lượt, ngoài bàn, ô có quân,
-- i dạng chuỗi / số lẻ, nhấc quân đối phương, đặt quân khi phải di quân, đi sau khi hết ván, số viết dạng 5.0) và ván
-- hoà vì hết lượt. xo.test.js đọc lại ĐÚNG khối này và chấm bằng JS → JS và SQL phải ra cùng kết quả. Đổi luật thì sinh
-- lại cả khối (node src/__tests__/games/fixtures.mjs), ĐỪNG sửa tay từng ván.

DO $check$
DECLARE
  v_club  uuid;
  v_u1    uuid;
  v_u2    uuid;
  v_room  uuid;
  v_fx    jsonb;
  v_got   jsonb;
  v_want  jsonb;
  v_n     int := 0;
  v_err   text;
  r       game_rooms;
  v_xo CONSTANT jsonb := $xo$
[
{"note":"cổ điển · X thắng","result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"i":2.0}},{"seat":1,"move":{"i":2}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"from":0,"to":1}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"i":1,"from":null}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":5}},{"seat":1,"move":{"i":1}}]},
{"note":"cổ điển · O thắng","result":{"winners":[1],"draw":false},"moves":[{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":0,"from":null}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":-1}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"i":"2"}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":4}}]},
{"note":"cổ điển · hoà","result":{"winners":[],"draw":true},"moves":[{"seat":0,"move":{"i":3}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":2.5}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{}},{"seat":1,"move":{"i":6}},{"seat":0,"move":null},{"seat":0,"move":{"i":4}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"from":0,"to":2}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":5,"from":null}},{"seat":1,"move":{"i":5}},{"seat":1,"move":{"i":7}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"cell":1,"dir":1}}]},
{"note":"cổ điển · chưa xong ván","result":null,"moves":[{"seat":0,"move":{"i":"0"}},{"seat":0,"move":{"i":2}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":"3"}}]},
{"note":"3 quân di chuyển · O thắng","options":{"mode":"move"},"result":{"winners":[1],"draw":false},"moves":[{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":7}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"from":0,"to":1}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"i":1,"from":null}},{"seat":1,"move":{"i":1}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"from":7,"to":4}}]},
{"note":"3 quân di chuyển · X thắng","options":{"mode":"move"},"result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":2}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"from":0,"to":1}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"i":1,"from":null}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":5}},{"seat":1,"move":{"i":1}}]},
{"note":"3 quân di chuyển · hoà","options":{"mode":"move"},"result":{"winners":[],"draw":true},"moves":[{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":0}},{"seat":1,"move":null},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":5}},{"seat":1,"move":{"from":0,"to":2}},{"seat":1,"move":{"i":7}},{"seat":0,"move":{"i":2,"from":null}},{"seat":0,"move":{"i":8}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"from":5,"to":3}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"from":1,"to":6}},{"seat":0,"move":{"i":"1"}},{"seat":0,"move":{"from":0,"to":1}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"from":2,"to":5}},{"seat":0,"move":{}},{"seat":0,"move":{"from":8,"to":0}},{"seat":1,"move":null},{"seat":1,"move":{"from":7,"to":8}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"from":0,"to":2}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"from":6,"to":7}},{"seat":0,"move":{"from":3,"to":1}},{"seat":0,"move":{"from":2,"to":0}},{"seat":1,"move":{"from":5,"to":2,"i":2}},{"seat":1,"move":{"from":5,"to":2}},{"seat":0,"move":{"from":2,"to":4}},{"seat":0,"move":{"from":3,"to":5}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"from":7,"to":6}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"from":1,"to":3}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"from":2,"to":4}},{"seat":0,"move":{"i":"1"}},{"seat":0,"move":{"from":5,"to":1}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"from":6,"to":7}},{"seat":0,"move":{}},{"seat":0,"move":{"from":3,"to":5}},{"seat":1,"move":null},{"seat":1,"move":{"from":8,"to":6}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"from":0,"to":8}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"from":4,"to":3}},{"seat":0,"move":{"from":1,"to":5}},{"seat":0,"move":{"from":5,"to":0}},{"seat":1,"move":{"from":7,"to":2,"i":2}},{"seat":1,"move":{"from":6,"to":5}},{"seat":0,"move":{"from":3,"to":2}},{"seat":0,"move":{"from":8,"to":4}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"from":3,"to":8}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"from":1,"to":2}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"from":7,"to":6}},{"seat":0,"move":{"i":"1"}},{"seat":0,"move":{"from":2,"to":7}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"from":5,"to":1}},{"seat":0,"move":{}},{"seat":0,"move":{"from":0,"to":5}},{"seat":1,"move":null},{"seat":1,"move":{"from":8,"to":2}},{"seat":0,"move":{"i":1}},{"seat":0,"move":{"from":7,"to":0}},{"seat":1,"move":{"i":3}},{"seat":1,"move":{"from":1,"to":7}},{"seat":0,"move":{"from":4,"to":5}},{"seat":0,"move":{"from":0,"to":8}},{"seat":1,"move":{"from":6,"to":0,"i":0}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":1,"to":0}},{"seat":0,"move":{"from":5,"to":2}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"from":1,"to":3}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"from":2,"to":1}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"from":3,"to":5}},{"seat":0,"move":{"i":"0"}},{"seat":0,"move":{"from":8,"to":3}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"from":6,"to":8}},{"seat":0,"move":{}},{"seat":0,"move":{"from":4,"to":0}},{"seat":1,"move":null},{"seat":1,"move":{"from":7,"to":6}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"from":1,"to":4}},{"seat":1,"move":{"i":1}},{"seat":1,"move":{"from":5,"to":2}},{"seat":0,"move":{"from":3,"to":0}},{"seat":0,"move":{"from":4,"to":1}},{"seat":1,"move":{"from":8,"to":4,"i":4}},{"seat":1,"move":{"from":8,"to":5}},{"seat":0,"move":{"from":2,"to":4}},{"seat":0,"move":{"from":0,"to":4}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"from":5,"to":8}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"from":4,"to":0}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"from":8,"to":7}},{"seat":0,"move":{"i":"4"}},{"seat":0,"move":{"from":1,"to":8}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"from":7,"to":1}},{"seat":0,"move":{}},{"seat":0,"move":{"from":8,"to":5}},{"seat":1,"move":null},{"seat":1,"move":{"from":1,"to":7}},{"seat":0,"move":{"from":3,"to":1}}]},
{"note":"3 quân di chuyển · chưa xong ván","options":{"mode":"move"},"result":null,"moves":[{"seat":0,"move":{"i":5}},{"seat":1,"move":null},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"from":0,"to":1}},{"seat":1,"move":{"i":7}},{"seat":0,"move":{"i":1,"from":null}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":1}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"from":5,"to":4}},{"seat":1,"move":{"i":5}},{"seat":1,"move":{"from":1,"to":5}},{"seat":0,"move":{"from":2,"to":3}},{"seat":0,"move":{"from":2,"to":1}},{"seat":1,"move":{"from":0,"to":2,"i":2}},{"seat":1,"move":{"from":0,"to":8}},{"seat":0,"move":{"from":5,"to":0}},{"seat":0,"move":{"from":3,"to":6}}]},
{"note":"quân cũ biến mất · X thắng","options":{"mode":"vanish"},"result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":-1}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"i":"1"}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":5}},{"seat":1,"move":{"i":1}}]},
{"note":"quân cũ biến mất · O thắng","options":{"mode":"vanish"},"result":{"winners":[1],"draw":false},"moves":[{"seat":0,"move":{"i":7}},{"seat":1,"move":null},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"from":0,"to":1}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":2,"from":null}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":4}}]},
{"note":"quân cũ biến mất · chưa xong ván","options":{"mode":"vanish"},"result":null,"moves":[{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":-1}}]},
{"note":"move · hết lượt thì hoà · có nước rác","options":{"mode":"move"},"result":{"winners":[],"draw":true},"moves":[{"seat":0,"move":{"i":7}},{"seat":1,"move":{}},{"seat":1,"move":{"i":0}},{"seat":0,"move":null},{"seat":0,"move":{"i":1}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"from":0,"to":2}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"i":2,"from":null}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":2}},{"seat":0,"move":{"from":7,"to":8}},{"seat":1,"move":{"from":0,"to":4}},{"seat":1,"move":{"from":0,"to":5}},{"seat":0,"move":{"from":1,"to":0,"i":0}},{"seat":0,"move":{"from":1,"to":7}},{"seat":1,"move":{"from":3,"to":0}},{"seat":1,"move":{"from":4,"to":0}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"from":3,"to":4}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"from":6,"to":1}},{"seat":0,"move":{"i":-1}},{"seat":0,"move":{"from":8,"to":2}},{"seat":1,"move":{"i":"3"}},{"seat":1,"move":{"from":1,"to":8}},{"seat":0,"move":{"i":2.5}},{"seat":0,"move":{"from":7,"to":3}},{"seat":1,"move":{}},{"seat":1,"move":{"from":5,"to":1}},{"seat":0,"move":null},{"seat":0,"move":{"from":3,"to":7}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"from":0,"to":6}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"from":7,"to":0}},{"seat":1,"move":{"from":8,"to":1}},{"seat":1,"move":{"from":8,"to":3}},{"seat":0,"move":{"from":4,"to":5,"i":5}},{"seat":0,"move":{"from":4,"to":5}},{"seat":1,"move":{"from":0,"to":4}},{"seat":1,"move":{"from":3,"to":8}},{"seat":1,"move":{"i":3}},{"seat":0,"move":{"from":0,"to":4}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":{"i":-1}},{"seat":0,"move":{"from":2,"to":1}},{"seat":1,"move":{"i":"2"}},{"seat":1,"move":{"from":6,"to":2}},{"seat":0,"move":{"i":2.5}},{"seat":0,"move":{"from":4,"to":7}},{"seat":1,"move":{}},{"seat":1,"move":{"from":8,"to":3}},{"seat":0,"move":null},{"seat":0,"move":{"from":5,"to":6}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"from":3,"to":8}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"from":1,"to":3}},{"seat":1,"move":{"from":0,"to":2}},{"seat":1,"move":{"from":8,"to":4}},{"seat":0,"move":{"from":7,"to":1,"i":1}},{"seat":0,"move":{"from":7,"to":1}},{"seat":1,"move":{"from":1,"to":5}},{"seat":1,"move":{"from":0,"to":5}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"from":6,"to":0}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"from":5,"to":8}},{"seat":0,"move":{"i":-1}},{"seat":0,"move":{"from":3,"to":5}},{"seat":1,"move":{"i":"3"}},{"seat":1,"move":{"from":2,"to":3}},{"seat":0,"move":{"i":2.5}},{"seat":0,"move":{"from":1,"to":2}},{"seat":1,"move":{}},{"seat":1,"move":{"from":8,"to":1}},{"seat":0,"move":null},{"seat":0,"move":{"from":0,"to":6}},{"seat":1,"move":{"i":1}},{"seat":1,"move":{"from":4,"to":0}},{"seat":0,"move":{"i":4}},{"seat":0,"move":{"from":2,"to":4}},{"seat":1,"move":{"from":3,"to":1}},{"seat":1,"move":{"from":3,"to":7}},{"seat":0,"move":{"from":5,"to":2,"i":2}},{"seat":0,"move":{"from":6,"to":8}},{"seat":1,"move":{"from":4,"to":2}},{"seat":1,"move":{"from":1,"to":2}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"from":5,"to":1}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"from":2,"to":3}},{"seat":0,"move":{"i":-1}},{"seat":0,"move":{"from":4,"to":5}},{"seat":1,"move":{"i":"2"}},{"seat":1,"move":{"from":0,"to":2}},{"seat":0,"move":{"i":2.5}},{"seat":0,"move":{"from":8,"to":0}},{"seat":1,"move":{}},{"seat":1,"move":{"from":7,"to":8}},{"seat":0,"move":null},{"seat":0,"move":{"from":5,"to":6}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"from":3,"to":4}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"from":1,"to":5}},{"seat":1,"move":{"from":2,"to":8}},{"seat":1,"move":{"from":4,"to":3}},{"seat":0,"move":{"from":0,"to":1,"i":1}},{"seat":0,"move":{"from":5,"to":7}},{"seat":1,"move":{"from":0,"to":1}},{"seat":1,"move":{"from":2,"to":1}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"from":0,"to":2}},{"seat":1,"move":{"i":9}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":{"from":6,"to":1}}]},
{"note":"vanish · hết lượt thì hoà · có nước rác","options":{"mode":"vanish"},"result":{"winners":[],"draw":true},"moves":[{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{}},{"seat":0,"move":{"i":1}},{"seat":1,"move":null},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"from":0,"to":2}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":2,"from":null}},{"seat":0,"move":{"i":8}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":5}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":"0"}},{"seat":0,"move":{"i":4}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{}},{"seat":0,"move":{"i":3}},{"seat":1,"move":null},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":1}},{"seat":1,"move":{"from":0,"to":5}},{"seat":1,"move":{"i":5}},{"seat":0,"move":{"i":2,"from":null}},{"seat":0,"move":{"i":2}},{"seat":0,"move":{"i":4}},{"seat":1,"move":{"i":8}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":4}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":3}},{"seat":0,"move":{"i":"0"}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":7}},{"seat":0,"move":{}},{"seat":0,"move":{"i":5}},{"seat":1,"move":null},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"from":0,"to":2}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":3,"from":null}},{"seat":0,"move":{"i":3}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":"1"}},{"seat":0,"move":{"i":6}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{}},{"seat":0,"move":{"i":2}},{"seat":1,"move":null},{"seat":1,"move":{"i":8}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"from":0,"to":4}},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":0,"from":null}},{"seat":0,"move":{"i":0}},{"seat":0,"move":{"i":5}},{"seat":1,"move":{"i":5}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":1}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":"6"}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":3}},{"seat":0,"move":{}},{"seat":0,"move":{"i":6}},{"seat":1,"move":null},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":1}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"from":0,"to":1}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":2,"from":null}},{"seat":0,"move":{"i":2}},{"seat":0,"move":{"i":5}},{"seat":1,"move":{"i":5}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":"3"}},{"seat":0,"move":{"i":3}},{"seat":1,"move":{"i":2.5}},{"seat":1,"move":{"i":8}},{"seat":0,"move":{}},{"seat":0,"move":{"i":1}},{"seat":1,"move":null},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":1}},{"seat":0,"move":{"i":0}},{"seat":1,"move":{"from":0,"to":2}},{"seat":1,"move":{"i":5}},{"seat":0,"move":{"i":2,"from":null}},{"seat":0,"move":{"i":6}},{"seat":0,"move":{"i":2}},{"seat":1,"move":{"i":2}},{"seat":0,"move":{"i":9}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{"i":-1}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":3}}]},
{"note":"chế độ lạ → cổ điển · X thắng","options":{"mode":"loco"},"result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"i":0}},{"seat":1,"move":{"i":"1"}},{"seat":1,"move":{"i":1}},{"seat":0,"move":{"i":2.5}},{"seat":0,"move":{"i":7}},{"seat":1,"move":{}},{"seat":1,"move":{"i":2}},{"seat":0,"move":null},{"seat":0,"move":{"i":8}},{"seat":1,"move":{"i":0}},{"seat":1,"move":{"i":3}},{"seat":0,"move":{"from":0,"to":4}},{"seat":0,"move":{"i":5}},{"seat":1,"move":{"i":4,"from":null}},{"seat":1,"move":{"i":4}},{"seat":1,"move":{"i":6}},{"seat":0,"move":{"i":6}},{"seat":1,"move":{"cell":1,"dir":1}}]}
]
$xo$;
BEGIN
  /* ---------- 1. Có hàm chấm, client không gọi thẳng được ---------- */
  IF to_regprocedure('public.game_xo_result(uuid)') IS NULL OR to_regprocedure('public.game_xo_cell(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có game_xo_result / game_xo_cell — đã chạy 0107 chưa?';
  END IF;
  IF has_function_privilege('authenticated', 'public.game_xo_result(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.game_xo_result(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_xo_cell(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_caro_result(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client gọi thẳng được hàm chấm';
  END IF;

  /* ---------- 2. Không còn phòng Caro 3 × 3 (đã chuyển sang Cờ X-O) ---------- */
  IF EXISTS (SELECT 1 FROM game_rooms WHERE game = 'caro' AND options ->> 'size' = '3') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 2: còn phòng Caro 3 × 3 chưa chuyển sang Cờ X-O';
  END IF;

  /* ---------- 3. Tìm hai thành viên cùng CLB ---------- */
  SELECT a.club_id, a.user_id, b.user_id INTO v_club, v_u1, v_u2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 3: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);

  /* ---------- 4. Từng ván mẫu Cờ X-O: SQL chấm ra đúng như JS ---------- */
  FOR v_fx IN SELECT value FROM jsonb_array_elements(v_xo) LOOP
    v_n := v_n + 1;
    v_room := game_create(v_club, 'xo', COALESCE((v_fx ->> 'options')::jsonb, '{}'::jsonb), false);
    INSERT INTO game_moves (room_id, seq, club_id, seat, move)
    SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move'
      FROM jsonb_array_elements(v_fx -> 'moves') WITH ORDINALITY AS e(value, ord);
    v_got := game_xo_result(v_room);
    v_want := NULLIF(v_fx -> 'result', 'null'::jsonb);
    IF v_got IS DISTINCT FROM v_want THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 4: ván mẫu % (%) — SQL chấm %, JS chấm %', v_n, v_fx ->> 'note', v_got, v_want;
    END IF;
  END LOOP;
  IF v_n = 0 THEN RAISE EXCEPTION 'SAI Ở BƯỚC 4: khối ván mẫu rỗng — chạy node src/__tests__/games/fixtures.mjs'; END IF;

  /* ---------- 5. game_finish tự tìm ra bản chấm Cờ X-O, bỏ qua kết quả client bịa ---------- */
  v_room := game_create(v_club, 'xo', '{}'::jsonb, false);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);

  BEGIN
    PERFORM game_finish(v_room, '{"winners":[0],"draw":false}'::jsonb);
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: chưa đi nước nào mà kết thúc được ván';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notOver' THEN RAISE; END IF;
  END;

  SELECT value INTO v_fx FROM jsonb_array_elements(v_xo) WHERE value -> 'result' <> 'null'::jsonb AND NOT value ? 'options' LIMIT 1;
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move'
    FROM jsonb_array_elements(v_fx -> 'moves') WITH ORDINALITY AS e(value, ord);
  PERFORM game_finish(v_room, '{"winners":[0,1],"draw":false}'::jsonb);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'finished' OR r.result IS DISTINCT FROM v_fx -> 'result' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: phải lưu kết quả server chấm %, nhận % / %', v_fx -> 'result', r.status, r.result;
  END IF;

  /* ---------- 6. Caro: đúng 5 quân · bàn 30 × 30 ---------- */
  -- X hàng 7 (bàn 15 × 15, i = 105 + cột) cột 0, 1, 2, 4, 5 rồi lấp cột 3 → 6 quân liền; O rải hàng 0.
  v_fx := '[{"seat":0,"move":{"i":105}},{"seat":1,"move":{"i":0}},{"seat":0,"move":{"i":106}},{"seat":1,"move":{"i":2}},
            {"seat":0,"move":{"i":107}},{"seat":1,"move":{"i":4}},{"seat":0,"move":{"i":109}},{"seat":1,"move":{"i":6}},
            {"seat":0,"move":{"i":110}},{"seat":1,"move":{"i":8}},{"seat":0,"move":{"i":108}}]';
  v_room := game_create(v_club, 'caro', '{"size":15,"win":5,"exact":true}'::jsonb, false);
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move' FROM jsonb_array_elements(v_fx) WITH ORDINALITY AS e(value, ord);
  IF game_caro_result(v_room) IS NOT NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: luật đúng 5 quân — 6 quân liền không được tính thắng, nhận %', game_caro_result(v_room);
  END IF;
  v_room := game_create(v_club, 'caro', '{"size":15,"win":5}'::jsonb, false);
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move' FROM jsonb_array_elements(v_fx) WITH ORDINALITY AS e(value, ord);
  IF game_caro_result(v_room) IS DISTINCT FROM '{"winners":[0],"draw":false}'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: tắt luật đúng 5 quân thì 6 quân liền phải thắng, nhận %', game_caro_result(v_room);
  END IF;

  PERFORM game_create(v_club, 'caro', '{"size":30,"win":5}'::jsonb, false);
  BEGIN
    PERFORM game_create(v_club, 'caro', '{"size":31,"win":5}'::jsonb, false);
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: tạo được Caro 31 × 31';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badOptions' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION '0107 CHECK OK — % ván mẫu Cờ X-O SQL chấm khớp JS · game_finish tự chấm X-O · Caro đúng 5 quân + bàn 30', v_n;
END;
$check$;
