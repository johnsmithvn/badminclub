# DATABASE.md

**Version:** v0.4.0 · **Updated:** 2026-09-02

Schema đầy đủ: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) kèm các migration bổ sung `0002..0016`.
Đặc tả gốc: handoff `03-data-model.md`. File này nói **luật bất di bất dịch** và **chỗ shape
localStorage khác shape Postgres** — để lúc nối Supabase không đoán.

---

## 1. Sáu luật không được vi phạm

1. **Đa CLB từ đầu.** Mọi bảng nghiệp vụ có `club_id` (trừ `profiles`). Không làm single-tenant rồi vá.
2. **Tiền là `bigint` VND, không lưu số đã làm tròn.** Làm tròn chỉ ở tầng hiển thị (`fmt`/`fmtK`).
   Ngoại lệ duy nhất được làm tròn khi lưu: đơn giá một buổi tính trung bình.
3. **`transactions` là sổ quỹ duy nhất, append-only.** Số dư = `SUM(in) − SUM(out)`. Sửa sai
   bằng dòng đối ứng, không UPDATE.
   > **Hiện trạng:** `lib/ledger.js: ledger()` dựng sổ quỹ từ các bản ghi giao dịch và các dòng nghiệp vụ
   > đã chốt; `transactions` lưu dòng tiền thực tế và các khoản nhập tay (`ref_type='manual'`).
4. **Không xoá cứng.** Dùng `status` / `active` / `deleted_at` — dữ liệu dính tiền.
   > **GRANT và RLS là hai lớp khác nhau, thiếu lớp nào cũng chặn.** `GRANT` quyết định vai
   > `authenticated` có được đụng vào bảng không; `RLS` quyết định trong số đó thì thấy dòng nào.
   > RLS chặn thì trả **0 dòng**; thiếu GRANT thì báo **`permission denied for table X`**.
5. **Ngày buổi tập là `date`** (không `timestamptz`); **tháng là `char(7)`** dạng `2026-08`.
   Timezone Asia/Ho_Chi_Minh.
6. **Giá chốt tại thời điểm giao dịch.** `session_guests.price` lưu giá lúc đó, không join lại
   `guest_price_rules` về sau. Đổi bảng giá không được làm đổi số tiền buổi cũ.

---

## 2. Ba khái niệm KHÔNG được nhập một

| Bảng | Là gì | Ghi chú |
| --- | --- | --- |
| `profiles` | hồ sơ **tài khoản**, gắn 1-1 với `auth.users` | một người một tài khoản, dùng cho mọi CLB |
| `clubs` | một CLB, có mã 8 ký tự | quỹ mở đầu, cấu hình, 3 công tắc ghép tài khoản |
| `club_members` | hồ sơ **trong một CLB** | `user_id` **có thể NULL** = chủ CLB tạo tay |

`user_id IS NULL` là **trạng thái bình thường**, không phải dữ liệu lỗi: người đó vẫn điểm danh,
vẫn tính quỹ, vẫn chia sân. Một tài khoản có thể là `club_member` ở nhiều CLB **với vai khác nhau**.

### Hai hồ sơ, hai vòng đời — đừng gộp làm một

`profiles` và `club_members` có mấy cột tương ứng nhưng **không phải một cái là khung nhìn của
cái kia**. `club_members` là **bản sao tại thời điểm ghi**. Cặp cột tương ứng:

| `profiles` (tài khoản) | `club_members` (trong CLB) | Ghi chú |
| --- | --- | --- |
| `nick` | `name` | **TÊN HIỂN THỊ** — nằm trên mọi bảng điểm danh, dòng tiền, báo cáo. NOT NULL |
| `name` | `full_name` | tên đầy đủ, không bắt buộc, chỉ để đối chiếu — hiện nhỏ bên dưới |
| `phone` | `phone` | bên `profiles` là UNIQUE và đăng nhập được; bên CLB chỉ là liên lạc |
| `email` | `email` | bên `profiles` là **danh tính đăng nhập** (UNIQUE, khớp `auth.users`); bên CLB chỉ là liên lạc, không bắt buộc, không UNIQUE |
| `gender` · `level` | `gender` · `level` | `level` bên CLB phải thuộc `clubs.levels` của CLB đó |
| — | `role` | **chỉ** của CLB (`owner`, `treasurer`, `member`), hồ sơ tài khoản không bao giờ đụng tới |

**Trình độ theo tháng.** `club_members.level` là bậc GỐC; mỗi lần duyệt đổi "từ tháng sau" ghi
thêm một dòng vào `member_levels (member_id, from_month, level)`. `money.js: levelOf(m, month)`
lấy mốc lớn nhất còn `<= month`, không có mốc nào thì dùng `level`. Cột `pending_level` /
`pending_level_from` **không còn dùng** từ 0011 (đã backfill sang bảng mới, giữ lại cho dữ liệu cũ).

- Ghép tài khoản chỉ gắn `user_id` + `linked_at`. Mặc định **không** copy trường nào.
- Muốn lấy sang thì chủ CLB **tick từng trường trong 6 trường** ở màn duyệt → `approve_join_request(p_request, p_member_id, p_fields)` (`name`, `fullName`, `phone`, `email`, `gender`, `level`). `role` không bao giờ nằm trong `p_fields`; `level` chỉ ghi khi thuộc `clubs.levels` của CLB đó.
- Sau khi ghép, hai bên sống độc lập: đổi tên trong hồ sơ tài khoản **không** đổi tên trong CLB, và ngược lại. Bỏ ghép hay rời CLB thì bản ghi CLB **giữ nguyên** mọi giá trị.

**Ai sửa được gì:**

| Cái gì | Ai | Cơ chế |
| --- | --- | --- |
| hồ sơ tài khoản (trừ `email`, `username`) | chính chủ, ở `/tai-khoan` | policy `profiles_update_self` |
| `club_members.name` + `full_name` của chính mình | chính chủ, ở `/ca-nhan` | policy `cm_update_self_name` + trigger `cm_guard_self_update` (0010) chặn mọi cột khác |
| mọi cột còn lại của `club_members` | vai có cờ `members` | policy `cm_update` |
| `level` · `phone` của chính mình | xin → chủ CLB duyệt | `member_changes` |

0009 gỡ policy `cm_update_self` cũ vì nó **không giới hạn cột** — thành viên thường tự đặt
`role = 'owner'` được bằng một lệnh PostgREST. Bản thay thế ở 0010 chỉ mở đúng hai cột tên, và
trigger so bằng `to_jsonb(NEW) - 'name' - 'full_name'` nên cột mới thêm sau này tự động bị chặn.

`UNIQUE (club_id, user_id)` bảo đảm một tài khoản chỉ gắn 1 bản ghi trong 1 CLB. Ghép user vào
bản ghi B khi đang ở bản ghi A → A tự bị bỏ ghép (`appActions.js: linkMemberUser`,
`approve_join_request`).

**Bỏ ghép** = xoá `user_id`, **giữ nguyên** bản ghi và toàn bộ lịch sử điểm danh/tiền.

---

## 3. Nguồn của từng con số

Mọi con số tiền trong app thuộc **đúng một trong hai tầng**. Gộp hai tầng lại là đếm cùng một
số tiền hai lần.

Chỉ còn MỘT tầng: **Sổ quỹ** — tiền thật đã đổi tay, có chứng từ, lưu ở `transactions`, phải
khớp số dư tài khoản ngân hàng.

> **Tầng B (giá thành từng buổi) đã bị gỡ bỏ.** Cùng với module Kho cầu: không còn định mức,
> đếm ống, kiểm kho, giá bình quân, hay card "Giá thành buổi này". Tiền cầu giờ ghi tay ở Sổ quỹ
> qua hạng mục `shuttle` như mọi khoản chi khác.

Tiền sân ra khỏi quỹ khi chuyển cho chủ sân theo hoá đơn tháng. Ghi thêm chi theo từng buổi là
đếm hai lần.

| Con số hiển thị | Tính từ | Hàm |
| --- | --- | --- |
| Số dư quỹ | `transactions` / bản ghi sổ quỹ | `ledger.js: fundBalance` |
| Thu/chi tháng | `transactions` trong tháng, **trừ** "Số dư mang sang" | `ledger.js: monthFlow` |
| Tiền sân của buổi | `session_courts.cost` nếu đã chốt; chưa chốt thì `courts.price_per_hour` × số giờ | `money.js: rowCost` → `courtNet` |
| Ai phải đóng quỹ tháng | `group_memberships` của tháng đó, `state='fixed'` | `money.js: groupMembers` |
| Đơn giá 1 buổi (để đối chiếu) | `member_groups.unit_male/unit_female` nếu CLB tự đặt; không thì `monthly_dues.amount` **của chính người đó** ÷ số buổi nhóm trong tháng ≠ cancelled | `money.js: unitPrice` |
| Đối chiếu buổi | đơn giá × số buổi; ÂM khi vắng, DƯƠNG khi đi thêm | `money.js: adjustRows` |
| Số trận từng người | `match_players` join `matches` theo `session_id` | `assign.js: matchStats` |

### 3.1 Sự kiện nào ghi sổ quỹ — bảng tra nhanh

> **Quy tắc một câu: tiền chỉ ghi khi có người thật sự đưa hoặc nhận tiền. Còn lại là tính toán.**

| Sự kiện | Ghi sổ? | Chiều | Hạng mục (`CATS`) | Ngày |
| --- | --- | --- | --- | --- |
| Chốt danh sách tháng | không | | | sinh `monthly_dues` chờ thu |
| Tick thành viên đã đóng quỹ tháng | **có** | in | `dues` | `paid_at` |
| Add khách vào buổi | không | | | sinh công nợ, giá chốt tại buổi |
| Tick khách đã trả | **có** | in | `guest` | ngày buổi |
| Điểm danh Có mặt / Vắng | không | | | nuôi back tiền |
| Chia sân, bấm giờ, ghi trận | không | | | |
| **Chốt buổi** — tiền sân | không | | | đóng băng `session_courts.cost`, không sinh dòng |
| **Chốt buổi** — có sân bán được | **có** | in | `courtSold` | ngày buổi |
| **Chốt buổi** — có sân thuê thêm | **có** | out | `courtExtra` | ngày buổi · chỉ mode `month` |
| **Chốt buổi** — mode `session` | **có** | out | `court` | cả tiền sân buổi đó |
| Ghi tay khoản mua cầu ở Sổ quỹ | **có** | out | `shuttle` | ngày ghi |
| Nhập hoá đơn sân trọn tháng | **có** | out | `court` | `paid_on` |
| Tick đã trả back (đối chiếu, amount ÂM) | **có** | out | `back` | `paid_at`, mặc định ngày 28 |
| Tick đã thu người đi thêm (amount DƯƠNG) | **có** | in | `extra` | `paid_at`, mặc định ngày 28 |
| Chọn "trừ vào quỹ tháng sau" | không | | | cộng dấu vào `monthly_dues.amount` tháng sau |
| Đánh dấu "đi thêm" ở điểm danh | không | | | sinh khoản phải thu ở bảng đối chiếu |
| Ngưng hoạt động, chọn **trả lại tiền** | **có** | out | `back` | ngày bấm · dòng `ref_type='manual'` |
| Ngưng hoạt động, chọn **chỉ ngưng** | không | | | quỹ giữ lại phần buổi chưa đánh |
| Ghi thu / chi tay | **có** | in/out | `withdraw` · `other` · `back` · … | user chọn (xem `MANUAL_CATS`) |

---

## 4. Chỗ state client khác Postgres

State `db` của client dùng shape gọn của prototype. Cài đặt tại `src/contexts/dbmap.js`, test khoá tại `src/__tests__/sync/dbmap.test.js`.

| Trong `db` (client) | Bảng Postgres | Khác biệt cần xử lý |
| --- | --- | --- |
| `attendance[sessionId][memberId] = true \| false \| 'extra'` | `attendances` (1 dòng/người) | → enum `present`/`absent`/`extra`; chưa điểm danh = **không có dòng**. `'extra'` = đi thêm (`money.js: isPresent`) |
| `sessions[].courts[]` (array lồng) | `session_courts` (bảng riêng) | index của array **chính là** `court_index` — thứ tự quyết định slot id `c{ci}t{team}s{seat}` |
| `roster[month][groupId][memberId] = state` | `group_memberships` | 1 dòng/người/tháng/nhóm |
| `locked[month] = true` | `roster_locks` | |
| `adjustments[]` | `member_adjustments` | `key` = `month:groupId:memberId:kind`, thay cho `back_credits` cũ |
| `members[].fullName` | `club_members.full_name` | Tên đầy đủ trong sổ CLB (0010) |
| `members[].email` | `club_members.email` | Email liên lạc trong sổ CLB (0010) |
| `courts[].mapUrl` | `courts.map_url` | Link Google Maps / Bản đồ vị trí sân (0011) |
| `members[].note` | `club_members.note` | Ghi chú thành viên (0005) |
| `lineups[sessionId][slot] = playerKey` | `session_lineups` | `playerKey` là member id **hoặc** guest id → cần `player_type` |
| `courtGroups[sessionId][playerKey] = courtIdx` | `session_court_groups` | như trên |
| `matches[].playerKeys[4]` | `matches` + `match_players` | 1 trận → 4 dòng, kèm `team` |
| `playing[sessionId][courtIdx] = timestamp` | *(không lưu DB)* | trạng thái đồng hồ |
| `manual[]` | `transactions` **có `ref_type = 'manual'`** | dòng do RPC sinh (`ref_type` khác) client không đụng tới |
| `guestPrices[]` | `guest_price_rules` | thêm `effective_from` |
| `club.linkModes.{code,invite,phone}` | `clubs.allow_code_join / allow_invite / allow_phone_suggest` | |
| `members[].groupIds` | `club_member_groups` | nhóm cố định **gốc**; khác `group_memberships` là danh sách chốt theo tháng |
| `groupMode[sessionId]` | `sessions.group_mode` | |
| `courtMin[sessionId][ci]` | `session_courts.default_minutes` | |
| `manual[].by` | `transactions.payer_name` | tên người ghi |
| `courtBills[].payerId` · `purchases[].payerId` | `payer_member_id` | trỏ về bản ghi thành viên |
| `club.levels` / `db.levels` | `clubs.levels text[]` | thứ tự mảng = thứ tự mạnh dần |
| `guestPrices[{level,nam,nu}]` | `guest_price_rules` | 1 dòng client → 2 dòng DB (nam + nữ); `effective_from` = `clubs.opening_date` |
| `club.avatarUrl` | `clubs.avatar_url` | URL ảnh đại diện / logo CLB (0015) |
| `club.bankQrUrl` | `clubs.bank_qr_url` | URL ảnh QR nhận tiền quỹ CLB (0015) |
| `club.bankAccounts` | `clubs.bank_accounts jsonb` | Danh sách tài khoản ngân hàng CLB (0015) |
| `members[].avatarUrl` | `club_members.avatar_url` | Ảnh đại diện thành viên (0015) |
| `members[].qrUrl` | `club_members.qr_url` | Ảnh QR nhận tiền hoàn (0015) |
| `members[].bankHolder` · `bankNo` · `bankName` | `club_members.bank_holder` · `bank_no` · `bank_name` | Thông tin ngân hàng thành viên (0015) |
| `club.debtBanner` | `clubs.debt_banner` | Kiểu banner nhắc nợ (0019). Danh sách giá trị lặp lại ở `Settings.jsx: DEBT_BANNERS` — đổi một bên là DB trả 23514 |
| `dues[].claimedAt` · `adjustments[].claimedAt` · `sessionGuests[].claimedAt` | cột `claimed_at` của ba bảng | Khác null = thành viên đã khai đã chuyển tiền, chờ duyệt (0018). Duyệt = bật `paid` và GIỮ `claimed_at`; từ chối = đặt lại NULL |
| `members[].bankAccounts` | `club_members.bank_accounts jsonb` | Danh sách tài khoản ngân hàng thành viên (0015) |
| `challenges[]` | `challenges` + `challenge_players` | Kèo đấu: mã kèo, đội A/B, thể thức, trạng thái, sân chỉ định, hạn nhận (0021) |
| `matches[]` | `matches` + `match_players` | Trận đấu: tỷ số từng set, đội thắng, nguồn (session / challenge), delta Elo (0021) |
| `playerRatings` | `player_ratings` | Điểm Elo, độ tin cậy (R1-R5), số trận thắng/thua của từng thành viên (0021) |
| `matchEdits[]` | `match_edits` | Lịch sử audit log sửa điểm trận: lý do sửa, tỷ số cũ/mới, người sửa (0021) |
| `clubCalibration[]` | `club_calibration` | Hệ số hiệu chỉnh chéo giới tính học từ dữ liệu thực tế CLB (0021) |

---

## 5. Danh sách Migration (`supabase/migrations/`)

| File | Nội dung |
| --- | --- |
| `0001_init.sql` | Schema nền đầy đủ: profiles, clubs, members, sessions, money, RLS policies và core RPCs. |
| `0002_default_group_and_multigroup.sql` | Hỗ trợ cấu hình `multi_group` và chuẩn hóa nhóm thành viên. |
| `0003_session_charge_member.sql` | Ghi nhận trừ nợ buổi tập trực tiếp cho thành viên. |
| `0004_fix_member_delete_policy.sql` | Vá chính sách bảo vệ khi xóa thành viên. |
| `0005_add_member_note.sql` | Thêm cột `note` vào `club_members`. |
| `0006_simplify_roles.sql` | Tinh gọn 3 vai trò người dùng (`owner`, `treasurer`, `member`). |
| `0007_delete_club.sql` | Hỗ trợ tính năng xoá CLB an toàn kèm dọn dẹp các ràng buộc liên quan. |
| `0008_no_default_group.sql` | **Chỉ còn một lệnh dọn**: `DROP` bản `create_club` 7 tham số. Mục đích gốc (bỏ sinh nhóm mặc định) đã nằm trong `create_club` của 0011; để lại bản 7 tham số là có hai overload và PostgREST không chọn nổi hàm nào. |
| `0009_profile_merge.sql` | Tách biệt hồ sơ tài khoản và hồ sơ CLB, duyệt ghép có chọn lọc trường, thêm `monthly_dues.paid_amount`. |
| `0010_member_email.sql` | Bổ sung `email` & `full_name` cho `club_members`, policy `cm_update_self_name` + trigger guard cho thành viên tự đổi tên, đăng ký bằng email tự sinh username. |
| `0011_level_history.sql` | Bảng `member_levels` lưu lịch sử mốc trình độ nhiều lần đổi, `create_club` nhận thang trình độ `p_levels`, dọn RPC chết. |
| `0012_court_map_url.sql` | Thêm cột `map_url` cho bảng `courts` lưu link Google Maps / bản đồ vị trí sân. |
| `0013_find_member_candidate.sql` | RPC `find_member_candidate(club, email)`: tra MỘT tài khoản theo email CHÍNH XÁC để ghép vào bản ghi thành viên. Chỉ trả `id` + tên hiển thị, gác `has_club_perm(club,'members')`. Cố ý không tìm gần đúng — bản `search_users_for_club` cũ (0006, đã xoá ở 0011) cho `ILIKE '%q%'` và query rỗng trả 50 profile đầu của toàn app. |
| `0014_guest_notes_and_levels.sql` | Thêm cột `note` cho bảng `guests`, chuẩn hoá 10 bậc trình độ mặc định của CLB (`Y`, `Y+`, `TBY-`, `TBY`, `TBY+`, `TB-`, `TB`, `TB+`, `TBK`, `Khá`). |
| `0015_avatar_and_bank_info.sql` | Avatar + thông tin ngân hàng / QR cho `clubs`, `profiles`, `club_members`. Cập nhật `approve_join_request` nhận thêm trường `avatarUrl`, `qrUrl`, `bankHolder`, `bankNo`, `bankName`, `bankAccounts` khi ghép tài khoản. |
| `0016_storage_bucket.sql` | Tạo public bucket `club-assets` (Supabase Storage, 2MB/file, image only). RLS: public read, authenticated upload + update. |
| `0017_storage_owner_policy.sql` | Siết quyền ghi bucket `club-assets`: UPDATE/DELETE chỉ cho `owner = auth.uid()` thay vì mọi tài khoản đã đăng nhập. Client bỏ `upsert`. |
| `0018_payment_claims.sql` | Thành viên tự khai đã chuyển tiền: cột `claimed_at` cho `monthly_dues` · `member_adjustments` · `session_guests`, kèm RPC `claim_payments`. **Không có bảng mới** — ba bảng đã tự giữ cờ `paid` của mình. |
| `0019_debt_banner_style.sql` | `clubs.debt_banner` (`slim` · `alert` · `bar` · `off`) — kiểu banner nhắc công nợ hiện cho THÀNH VIÊN ở Trang chủ. Cài đặt của CLB, áp cho mọi thành viên. Cả ba kiểu mở cùng một popup chi tiết. |
| `0021_challenge_and_rating.sql` | Hệ thống Kèo đấu (`challenges`, `challenge_players`), Kết quả trận (`matches`, `match_players`), Xếp hạng Elo (`player_ratings`), Audit log sửa điểm (`match_edits`), Hiệu chỉnh chéo giới (`club_calibration`) và RLS policies. |

---

## 6. Việc còn lại trước khi chạy thật

- [x] RLS trên mọi bảng: user chỉ thấy CLB mình là `club_members`.
- [x] **Kiểm RLS bằng hai tài khoản khác CLB — ĐẠT 2026-09-01.**
- [ ] Kiểm cờ quyền **server-side** theo `role_permissions` — hiện `has_club_perm` đã có.
- [ ] Trigger ghi `audit_logs` cho mọi bảng dính tiền.
- [ ] Trigger/RPC sinh `transactions` khi chốt buổi, để không phụ thuộc client.
- [ ] Realtime channel theo `session_id` cho `session_lineups` + `matches`.
