-- 0075_games_results_check.sql — kiểm tra migration 0075 TRÊN DB THẬT, không để lại dữ liệu.
--
-- CÁCH CHẠY: áp 0074 rồi 0075, rồi dán TOÀN BỘ file này vào Supabase SQL Editor → Run.
--
-- ĐỌC KẾT QUẢ — script LUÔN kết thúc bằng lỗi, đó là cố ý (giống 0074_games_check.sql):
--   ✅ "0075 CHECK OK — ..."  → mọi bước đạt. Lỗi này để Postgres HUỶ mọi thay đổi thử.
--   ❌ "SAI Ở BƯỚC ..."       → dừng ở bước đó, dán nguyên thông báo cho người viết migration.
--   ❌ lỗi khác               → cũng dán nguyên văn.
--
-- Cần: một CLB có HAI thành viên đã ghép tài khoản.
--
-- Ván mẫu (hằng v_fixtures: Ô ăn quan, v_cg: Cờ gánh) do luật JS lib/games/oanquan.js / coganh.js sinh ra, kèm nước rác (sai lượt, ô bên kia,
-- ô quan, chiều sai, ô lẻ, ô dạng chuỗi, null, đi sau khi hết ván, số viết dạng 5.0). oanquan.test.js / coganh.test.js đọc lại
-- ĐÚNG khối này và chấm bằng JS → JS và SQL phải ra cùng kết quả. Đổi luật thì sinh lại cả khối,
-- ĐỪNG sửa tay từng ván cho khớp.

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
  v_fixtures CONSTANT jsonb := $fx$
[
{"note":"ghế 0 thắng · hết quan · có rải lại · có nước rác","result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"cell":4.0,"dir":1.0}},{"seat":1,"move":{"cell":"10","dir":1}},{"seat":1,"move":{"cell":7,"dir":1}},{"seat":0,"move":{"cell":"5","dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":null},{"seat":1,"move":{"cell":9,"dir":-1}},{"seat":1,"move":{"cell":10,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":null},{"seat":1,"move":{"cell":9,"dir":1}},{"seat":0,"move":{"cell":3.5,"dir":-1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":{"cell":1,"dir":1}}]},
{"note":"ghế 1 thắng · hết dân mà thiếu 5 điểm rải lại · có nước rác","result":{"winners":[1],"draw":false},"moves":[{"seat":0,"move":{"cell":5,"dir":1}},{"seat":1,"move":null},{"seat":1,"move":{"cell":7,"dir":1}},{"seat":0,"move":{"cell":0,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":0,"move":{"cell":4,"dir":1}},{"seat":1,"move":{"cell":9,"dir":-1}},{"seat":1,"move":{"cell":10,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":{"cell":9,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}}]},
{"note":"hoà · có nước rác","result":{"winners":[],"draw":true},"moves":[{"seat":0,"move":{"cell":2,"dir":1}},{"seat":1,"move":{"cell":8.5,"dir":-1}},{"seat":1,"move":{"cell":7,"dir":1}},{"seat":1,"move":{"cell":9,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":{"cell":7,"dir":0}},{"seat":1,"move":{"cell":11,"dir":1}},{"seat":0,"move":null},{"seat":0,"move":{"cell":4,"dir":1}},{"seat":1,"move":{"cell":11.5,"dir":-1}},{"seat":1,"move":{"cell":10,"dir":1}},{"seat":0,"move":{"cell":0,"dir":1}},{"seat":0,"move":{"cell":4,"dir":1}},{"seat":1,"move":{"cell":1,"dir":1}}]},
{"note":"chưa xong ván","result":null,"moves":[{"seat":0,"move":{"cell":2}},{"seat":0,"move":{"cell":4,"dir":1}},{"seat":0,"move":{"cell":4,"dir":1}},{"seat":1,"move":{"cell":7,"dir":1}},{"seat":0,"move":{"cell":0,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":0,"move":{"cell":5,"dir":1}},{"seat":1,"move":{"cell":9,"dir":1}},{"seat":0,"move":{"cell":0,"dir":1}},{"seat":0,"move":{"cell":2,"dir":1}},{"seat":1,"move":{"cell":0,"dir":1}},{"seat":1,"move":{"cell":8,"dir":1}},{"seat":1,"move":{"cell":8,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":{"cell":7,"dir":2}},{"seat":1,"move":{"cell":11,"dir":1}},{"seat":1,"move":{"cell":8,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":null},{"seat":1,"move":{"cell":7,"dir":1}},{"seat":0,"move":null},{"seat":0,"move":{"cell":3,"dir":1}},{"seat":1,"move":null},{"seat":1,"move":{"cell":9,"dir":1}},{"seat":0,"move":null},{"seat":0,"move":{"cell":4,"dir":1}},{"seat":1,"move":{"cell":"7","dir":1}},{"seat":1,"move":{"cell":11,"dir":1}},{"seat":0,"move":{"cell":0,"dir":1}},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":{"cell":"9","dir":1}},{"seat":1,"move":{"cell":8,"dir":1}},{"seat":0,"move":{"cell":5.5,"dir":-1}},{"seat":0,"move":{"cell":5,"dir":1}},{"seat":1,"move":{"cell":"11","dir":1}},{"seat":1,"move":{"cell":11,"dir":1}},{"seat":0,"move":[1,1]},{"seat":0,"move":{"cell":1,"dir":1}},{"seat":1,"move":{"cell":0,"dir":1}}]}
]
$fx$;
  v_cg CONSTANT jsonb := $cg$
[
{"note":"ghế 1 thắng · hết quân · có nước rác","result":{"winners":[1],"draw":false},"moves":[{"seat":0,"move":{"from":19.0,"to":18.0}},{"seat":1,"move":{"from":0,"to":7}},{"seat":1,"move":{"from":9,"to":8}},{"seat":0,"move":{"from":10,"to":16}},{"seat":0,"move":{"from":15,"to":17}},{"seat":1,"move":{"from":5,"to":10}},{"seat":1,"move":{"from":0,"to":11}},{"seat":0,"move":{"from":18,"to":12}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":14,"to":18}},{"seat":0,"move":{"from":"15","to":12}},{"seat":0,"move":{"from":16,"to":17}},{"seat":0,"move":{"from":20,"to":16}},{"seat":1,"move":{"from":10,"to":16}},{"seat":0,"move":{"cell":1,"dir":1}}]},
{"note":"ghế 0 thắng · hết quân · có nước bắt buộc gánh · có nước rác","result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"from":10,"to":11}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":2,"to":8}},{"seat":0,"move":{"from":"11","to":12}},{"seat":0,"move":{"from":22,"to":16}},{"seat":1,"move":{"from":1,"to":17}},{"seat":1,"move":{"from":0,"to":6}},{"seat":0,"move":{"from":24,"to":0}},{"seat":0,"move":{"from":16,"to":22}},{"seat":1,"move":{"from":9,"to":18}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":20,"to":16}},{"seat":0,"move":{"from":11,"to":1}},{"seat":1,"move":{"from":6,"to":7}},{"seat":0,"move":{"from":11,"to":6}},{"seat":1,"move":{"from":"2","to":12}},{"seat":1,"move":{"from":8,"to":13}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":7,"to":8}},{"seat":1,"move":{"cell":1,"dir":1}}]},
{"note":"im 40 nước · đếm quân: ghế 0 thắng · có nước rác","result":{"winners":[0],"draw":false},"moves":[{"seat":0,"move":{"from":24,"to":12}},{"seat":0,"move":{"from":22,"to":16}},{"seat":1,"move":{"from":3,"to":18}},{"seat":1,"move":{"from":9,"to":8}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":23,"to":18}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":0,"to":6}},{"seat":0,"move":{"from":21,"to":0}},{"seat":0,"move":{"from":16,"to":12}},{"seat":0,"move":{"from":10,"to":9}},{"seat":1,"move":{"from":6,"to":7}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":10,"to":6}},{"seat":1,"move":{"from":2,"to":23}},{"seat":1,"move":{"from":8,"to":9}},{"seat":1,"move":{"from":3,"to":17}},{"seat":0,"move":{"from":7,"to":8}},{"seat":1,"move":{"from":1.5,"to":12}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":{"from":2}},{"seat":0,"move":{"from":2,"to":7}},{"seat":0,"move":{"from":8,"to":13}},{"seat":1,"move":{"from":0,"to":1}},{"seat":0,"move":{"from":20,"to":2}},{"seat":0,"move":{"from":15,"to":16}},{"seat":0,"move":{"from":9,"to":2}},{"seat":1,"move":{"from":1,"to":2}},{"seat":1,"move":{"from":2,"to":15}},{"seat":0,"move":{"from":20,"to":15}},{"seat":0,"move":{"from":18,"to":13}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":3}},{"seat":0,"move":{"from":18,"to":22}},{"seat":0,"move":{"from":6,"to":18}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":{"from":14,"to":23}},{"seat":0,"move":{"from":14,"to":18}},{"seat":0,"move":{"from":22,"to":11}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":"3","to":12}},{"seat":0,"move":{"from":16,"to":11}},{"seat":0,"move":{"from":21,"to":20}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":{"from":"3","to":12}},{"seat":0,"move":{"from":15,"to":20}},{"seat":0,"move":{"from":8,"to":13}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":"3","to":12}},{"seat":0,"move":{"from":22,"to":23}},{"seat":0,"move":{"from":20,"to":14}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":23,"to":22}},{"seat":0,"move":{"from":8,"to":16}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":3}},{"seat":0,"move":{"from":18,"to":17}},{"seat":0,"move":{"from":9,"to":15}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":24,"to":23}},{"seat":0,"move":{"from":20,"to":0}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":"3","to":12}},{"seat":0,"move":{"from":3,"to":2}},{"seat":0,"move":{"from":9,"to":15}},{"seat":1,"move":{"from":1,"to":0}},{"seat":1,"move":{"from":0,"to":18}},{"seat":0,"move":{"from":2,"to":3}},{"seat":0,"move":{"from":20,"to":13}},{"seat":1,"move":{"from":0,"to":1}},{"seat":0,"move":{"from":21,"to":14}},{"seat":0,"move":{"from":3,"to":2}},{"seat":0,"move":{"from":21,"to":10}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":{"from":2}},{"seat":0,"move":{"from":20,"to":15}},{"seat":0,"move":{"from":8,"to":18}},{"seat":1,"move":{"from":0,"to":1}},{"seat":0,"move":{"from":"2","to":12}},{"seat":0,"move":{"from":22,"to":18}},{"seat":1,"move":{"from":19,"to":22}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":{"from":2}},{"seat":0,"move":{"from":15,"to":16}},{"seat":0,"move":{"from":7,"to":13}},{"seat":1,"move":{"from":0,"to":1}},{"seat":0,"move":{"from":"2","to":12}},{"seat":0,"move":{"from":8,"to":14}},{"seat":0,"move":{"from":16,"to":22}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":4,"to":8}},{"seat":0,"move":{"from":14,"to":22}},{"seat":1,"move":{"from":0,"to":1}},{"seat":0,"move":{"from":"2","to":12}},{"seat":0,"move":{"from":21,"to":20}},{"seat":1,"move":{"from":1,"to":0}}]},
{"note":"im 40 nước · đếm quân: ghế 1 thắng · có nước rác","result":{"winners":[1],"draw":false},"moves":[{"seat":0,"move":{"from":22,"to":16}},{"seat":0,"move":{"from":10,"to":8}},{"seat":1,"move":{"from":2,"to":6}},{"seat":0,"move":{"from":24,"to":17}},{"seat":0,"move":{"from":23,"to":18}},{"seat":0,"move":{"from":10,"to":8}},{"seat":1,"move":{"from":1,"to":2}},{"seat":1,"move":{"from":0,"to":11}},{"seat":0,"move":{"from":18,"to":12}},{"seat":1,"move":{"from":3,"to":8}},{"seat":1,"move":{"from":14,"to":18}},{"seat":0,"move":{"from":15,"to":23}},{"seat":0,"move":{"from":16,"to":11}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":12,"to":16}},{"seat":1,"move":{"from":9,"to":13}},{"seat":0,"move":{"from":19,"to":14}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":2,"to":7}},{"seat":1,"move":{"from":20,"to":8}},{"seat":0,"move":{"from":14,"to":19}},{"seat":0,"move":{"from":19,"to":1}},{"seat":1,"move":{"from":0,"to":1}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":19,"to":14}},{"seat":1,"move":{"from":1,"to":8}},{"seat":1,"move":{"from":24,"to":23}},{"seat":1,"move":{"from":11,"to":8}},{"seat":0,"move":{"from":14,"to":19}},{"seat":1,"move":{"from":1}},{"seat":1,"move":{"from":3,"to":8}},{"seat":0,"move":{"from":"19","to":12}},{"seat":0,"move":{"from":19,"to":24}},{"seat":1,"move":{"from":5,"to":3}},{"seat":1,"move":{"from":23,"to":22}},{"seat":1,"move":{"from":16,"to":13}},{"seat":0,"move":{"from":24,"to":23}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":4,"to":3}},{"seat":0,"move":{"from":23,"to":0}},{"seat":0,"move":{"from":23,"to":24}},{"seat":1,"move":{"from":18,"to":12}},{"seat":1,"move":{"from":6,"to":18}},{"seat":0,"move":{"from":24,"to":19}},{"seat":1,"move":{"from":22,"to":4}},{"seat":1,"move":{"from":22,"to":18}},{"seat":0,"move":{"from":"19","to":12}},{"seat":0,"move":{"from":19,"to":24}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":3,"to":4}},{"seat":1,"move":{"from":9,"to":0}},{"seat":0,"move":{"from":24,"to":23}},{"seat":1,"move":{"from":"1","to":12}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":{"from":23.5,"to":12}},{"seat":0,"move":{"from":23,"to":24}},{"seat":0,"move":{"from":24,"to":22}},{"seat":1,"move":{"from":4,"to":3}},{"seat":1,"move":{"from":18,"to":0}},{"seat":0,"move":{"from":24,"to":23}},{"seat":1,"move":{"from":2}},{"seat":1,"move":{"from":12,"to":17}},{"seat":0,"move":{"from":23}},{"seat":0,"move":{"from":23,"to":24}},{"seat":0,"move":{"from":24,"to":1}},{"seat":1,"move":{"from":17,"to":12}},{"seat":1,"move":{"from":15,"to":22}},{"seat":0,"move":{"from":24,"to":23}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":12,"to":17}},{"seat":0,"move":{"from":23,"to":14}},{"seat":0,"move":{"from":23,"to":24}},{"seat":0,"move":{"from":24,"to":13}},{"seat":1,"move":{"from":8,"to":12}},{"seat":1,"move":{"from":6,"to":4}},{"seat":0,"move":{"from":24,"to":23}},{"seat":0,"move":{"from":23,"to":1}},{"seat":1,"move":{"from":12,"to":13}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":23,"to":24}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":13,"to":14}},{"seat":1,"move":{"from":10,"to":19}},{"seat":0,"move":{"from":24,"to":23}},{"seat":1,"move":{"from":2}},{"seat":1,"move":{"from":18,"to":24}},{"seat":0,"move":{"from":23}},{"seat":0,"move":{"from":23,"to":22}},{"seat":1,"move":{"from":7,"to":13}},{"seat":1,"move":{"from":6,"to":0}},{"seat":1,"move":{"from":3,"to":6}},{"seat":0,"move":{"from":22,"to":23}},{"seat":1,"move":{"from":0}},{"seat":1,"move":{"from":2,"to":6}},{"seat":0,"move":{"from":23,"to":22}}]},
{"note":"im 40 nước · đếm quân: hoà · có nước rác","result":{"winners":[],"draw":true},"moves":[{"seat":0,"move":{"from":19,"to":18}},{"seat":0,"move":{"from":10,"to":12}},{"seat":1,"move":{"from":0,"to":6}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":18,"to":17}},{"seat":0,"move":{"from":10,"to":0}},{"seat":1,"move":{"from":5,"to":0}},{"seat":0,"move":{"from":"10","to":12}},{"seat":0,"move":{"from":24,"to":19}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":6,"to":5}},{"seat":0,"move":{"from":"10","to":12}},{"seat":0,"move":{"from":23,"to":24}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":0,"to":6}},{"seat":0,"move":{"from":17,"to":11}},{"seat":0,"move":{"from":17,"to":16}},{"seat":1,"move":{"from":14,"to":0}},{"seat":1,"move":{"from":14,"to":8}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":22,"to":23}},{"seat":1,"move":{"from":3,"to":0}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":{"from":21,"to":17}},{"seat":0,"move":{"from":19,"to":18}},{"seat":0,"move":{"from":10,"to":1}},{"seat":1,"move":{"from":6,"to":11}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":21,"to":22}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":5,"to":6}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":18,"to":14}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":6,"to":7}},{"seat":0,"move":{"from":"10","to":12}},{"seat":0,"move":{"from":14,"to":18}},{"seat":1,"move":{"from":"0","to":12}},{"seat":1,"move":{"from":0,"to":5}},{"seat":0,"move":{"from":"10","to":12}},{"seat":0,"move":{"from":18,"to":17}},{"seat":0,"move":{"from":10,"to":14}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":20,"to":21}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":21,"to":20}},{"seat":1,"move":{"from":2}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":15,"to":14}},{"seat":0,"move":{"from":23,"to":18}},{"seat":1,"move":{"from":"1","to":12}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":{"from":10,"to":14}},{"seat":0,"move":{"from":18,"to":14}},{"seat":1,"move":{"from":"2","to":12}},{"seat":1,"move":{"from":2,"to":1}},{"seat":0,"move":{"from":24,"to":18}},{"seat":1,"move":{"from":"1","to":12}},{"seat":1,"move":{"from":1,"to":2}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":18,"to":19}},{"seat":1,"move":{"from":"2","to":12}},{"seat":1,"move":{"from":11,"to":12}},{"seat":0,"move":{"from":20,"to":13}},{"seat":0,"move":{"from":22,"to":23}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":7,"to":6}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":14,"to":18}},{"seat":1,"move":[1,2]},{"seat":1,"move":{"from":12,"to":11}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":17,"to":22}},{"seat":0,"move":{"from":10,"to":7}},{"seat":1,"move":{"from":6,"to":12}},{"seat":0,"move":{"from":10,"to":6}}]},
{"note":"chưa xong ván","result":null,"moves":[{"seat":0,"move":{"from":24,"to":6}},{"seat":0,"move":{"from":19,"to":18}},{"seat":1,"move":{"from":0}},{"seat":1,"move":{"from":9,"to":8}},{"seat":0,"move":{"from":10}},{"seat":0,"move":{"from":10,"to":6}},{"seat":1,"move":{"from":14,"to":11}},{"seat":1,"move":{"from":8,"to":7}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":18,"to":17}},{"seat":1,"move":{"from":4,"to":12}},{"seat":1,"move":{"from":5,"to":10}},{"seat":0,"move":[1,2]},{"seat":0,"move":{"from":6,"to":5}},{"seat":1,"move":{"from":1,"to":8}},{"seat":1,"move":{"from":4,"to":9}},{"seat":0,"move":{"from":"0","to":12}},{"seat":0,"move":{"from":0,"to":6}},{"seat":0,"move":{"from":23,"to":8}},{"seat":1,"move":{"from":7,"to":8}},{"seat":0,"move":{"from":"5","to":12}},{"seat":0,"move":{"from":17,"to":18}},{"seat":0,"move":{"from":10,"to":19}},{"seat":1,"move":{"from":1,"to":0}},{"seat":0,"move":{"from":5,"to":1}},{"seat":0,"move":{"from":6,"to":1}},{"seat":0,"move":{"from":0,"to":4}},{"seat":1,"move":{"from":3,"to":4}},{"seat":1,"move":{"from":4,"to":11}},{"seat":0,"move":{"from":18,"to":19}},{"seat":0,"move":{"from":0,"to":13}},{"seat":1,"move":{"from":8,"to":13}},{"seat":0,"move":{"from":0}},{"seat":0,"move":{"from":2,"to":7}},{"seat":0,"move":{"from":21,"to":3}},{"seat":1,"move":{"from":4,"to":3}},{"seat":0,"move":{"from":"0","to":12}},{"seat":0,"move":{"from":10,"to":11}},{"seat":0,"move":{"from":11,"to":6}},{"seat":1,"move":{"from":14,"to":8}}]}
]
$cg$;
BEGIN
  /* ---------- 1. Có hàm chấm, client không gọi thẳng được ---------- */
  IF to_regprocedure('public.game_oanquan_result(uuid)') IS NULL OR to_regprocedure('public.game_coganh_result(uuid)') IS NULL THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: chưa có game_oanquan_result / game_coganh_result — đã chạy 0075 chưa?';
  END IF;
  IF has_function_privilege('authenticated', 'public.game_oanquan_result(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.game_oanquan_result(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.game_coganh_result(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.game_coganh_result(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: client gọi thẳng được hàm chấm';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.game_finish(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 1: thay game_finish xong mất quyền EXECUTE của authenticated';
  END IF;

  /* ---------- 2. Tìm hai thành viên cùng CLB ---------- */
  SELECT a.club_id, a.user_id, b.user_id INTO v_club, v_u1, v_u2
    FROM club_members a JOIN club_members b ON b.club_id = a.club_id AND b.id <> a.id
   WHERE a.active AND b.active AND a.user_id IS NOT NULL AND b.user_id IS NOT NULL AND a.user_id <> b.user_id
   LIMIT 1;
  IF v_club IS NULL THEN RAISE EXCEPTION 'SAI Ở BƯỚC 2: cần một CLB có hai thành viên đã ghép tài khoản'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);

  /* ---------- 3. Từng ván mẫu: SQL chấm ra đúng như JS ---------- */
  FOR v_fx IN SELECT value FROM jsonb_array_elements(v_fixtures) LOOP
    v_n := v_n + 1;
    v_room := game_create(v_club, 'oanquan', '{}'::jsonb, false);
    INSERT INTO game_moves (room_id, seq, club_id, seat, move)
    SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move'
      FROM jsonb_array_elements(v_fx -> 'moves') WITH ORDINALITY AS e(value, ord);
    v_got := game_oanquan_result(v_room);
    v_want := NULLIF(v_fx -> 'result', 'null'::jsonb);
    IF v_got IS DISTINCT FROM v_want THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 3: ván mẫu % (%) — SQL chấm %, JS chấm %', v_n, v_fx ->> 'note', v_got, v_want;
    END IF;
  END LOOP;

  /* ---------- 3b. Từng ván mẫu Cờ gánh: SQL chấm ra đúng như JS ---------- */
  FOR v_fx IN SELECT value FROM jsonb_array_elements(v_cg) LOOP
    v_n := v_n + 1;
    v_room := game_create(v_club, 'coganh', '{}'::jsonb, false);
    INSERT INTO game_moves (room_id, seq, club_id, seat, move)
    SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move'
      FROM jsonb_array_elements(v_fx -> 'moves') WITH ORDINALITY AS e(value, ord);
    v_got := game_coganh_result(v_room);
    v_want := NULLIF(v_fx -> 'result', 'null'::jsonb);
    IF v_got IS DISTINCT FROM v_want THEN
      RAISE EXCEPTION 'SAI Ở BƯỚC 3b: ván mẫu Cờ gánh (%) — SQL chấm %, JS chấm %', v_fx ->> 'note', v_got, v_want;
    END IF;
  END LOOP;

  /* ---------- 4. game_finish: Ô ăn quan do server chấm, kết quả client bịa bị bỏ qua ---------- */
  v_room := game_create(v_club, 'oanquan', '{}'::jsonb, false);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);

  BEGIN
    PERFORM game_finish(v_room, '{"winners":[0],"draw":false}'::jsonb);
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: chưa đi nước nào mà kết thúc được ván';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.notOver' THEN RAISE; END IF;
  END;

  v_fx := v_fixtures -> 1;                       -- ván mẫu thứ hai: ghế 1 thắng
  INSERT INTO game_moves (room_id, seq, club_id, seat, move)
  SELECT v_room, e.ord, v_club, (e.value ->> 'seat')::smallint, e.value -> 'move'
    FROM jsonb_array_elements(v_fx -> 'moves') WITH ORDINALITY AS e(value, ord);
  PERFORM game_finish(v_room, '{"winners":[0],"draw":false}'::jsonb);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.status <> 'finished' OR r.result IS DISTINCT FROM v_fx -> 'result' THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 4: phải lưu kết quả server chấm %, nhận % / %', v_fx -> 'result', r.status, r.result;
  END IF;

  /* ---------- 5. Caro vẫn do server chấm sau khi thay game_finish ---------- */
  v_room := game_create(v_club, 'caro', '{}'::jsonb, false);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);
  -- X (ghế 0) đi hàng 7 cột 7..11, O (ghế 1) đi hàng 0.
  INSERT INTO game_moves (room_id, seq, club_id, seat, move) VALUES
    (v_room, 1, v_club, 0, '{"i":112}'), (v_room, 2, v_club, 1, '{"i":0}'),
    (v_room, 3, v_club, 0, '{"i":113}'), (v_room, 4, v_club, 1, '{"i":1}'),
    (v_room, 5, v_club, 0, '{"i":114}'), (v_room, 6, v_club, 1, '{"i":2}'),
    (v_room, 7, v_club, 0, '{"i":115}'), (v_room, 8, v_club, 1, '{"i":3}'),
    (v_room, 9, v_club, 0, '{"i":116}');
  PERFORM game_finish(v_room, '{"winners":[1],"draw":false}'::jsonb);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.result IS DISTINCT FROM '{"winners":[0],"draw":false}'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 5: Caro phải do server chấm X thắng, nhận %', r.result;
  END IF;

  /* ---------- 6. Game chưa có bản chấm vẫn nhận kết quả client (và vẫn chặn kết quả rác) ---------- */
  v_room := game_create(v_club, 'zz_check', '{}'::jsonb, false);
  PERFORM set_config('request.jwt.claim.sub', v_u2::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  PERFORM game_join(v_room, 2);
  PERFORM set_config('request.jwt.claim.sub', v_u1::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  PERFORM game_start(v_room, 2, 2);
  BEGIN
    PERFORM game_finish(v_room, '{"winners":"x"}'::jsonb);
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: nhận kết quả không có mảng winners';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF v_err <> 'games.err.badResult' THEN RAISE; END IF;
  END;
  PERFORM game_finish(v_room, '{"winners":[1],"draw":false}'::jsonb);
  SELECT * INTO r FROM game_rooms WHERE id = v_room;
  IF r.result IS DISTINCT FROM '{"winners":[1],"draw":false}'::jsonb THEN
    RAISE EXCEPTION 'SAI Ở BƯỚC 6: game chưa có bản chấm phải lưu kết quả client, nhận %', r.result;
  END IF;

  RAISE EXCEPTION '0075 CHECK OK — % ván mẫu Ô ăn quan + Cờ gánh SQL chấm khớp JS · game_finish tự chấm Ô ăn quan + Caro · game khác vẫn nhận kết quả client', v_n;
END;
$check$;
