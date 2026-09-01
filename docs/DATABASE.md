# DATABASE.md

**Version:** v0.3.0 · **Updated:** 2026-08-31

Schema đầy đủ: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
Đặc tả gốc: handoff `03-data-model.md`. File này nói **luật bất di bất dịch** và **chỗ shape
localStorage khác shape Postgres** — để lúc nối Supabase không đoán.

---

## 1. Sáu luật không được vi phạm

1. **Đa CLB từ đầu.** Mọi bảng nghiệp vụ có `club_id` (trừ `users`). Không làm single-tenant rồi vá.
2. **Tiền là `bigint` VND, không lưu số đã làm tròn.** Làm tròn chỉ ở tầng hiển thị (`fmt`/`fmtK`).
   Ngoại lệ duy nhất được làm tròn khi lưu: `back_credits.unit_price` (đơn giá một buổi).
3. **`transactions` là sổ quỹ duy nhất, append-only.** Số dư = `SUM(in) − SUM(out)`. Sửa sai
   bằng dòng đối ứng, không UPDATE.
   > **Hiện trạng khác đích đến.** `lib/ledger.js: ledger()` đang **suy ra** sổ quỹ: quét lại
   > `monthly_dues` + `session_guests` + `court_bills` + `shuttle_purchases` + `back_credits` rồi
   > dựng bảng tại chỗ mỗi lần mở màn hình; `transactions` chỉ giữ dòng nhập tay
   > (`ref_type='manual'`). Đích đến là **ghi**: mỗi sự kiện tiền ở §3.1 viết ngay một dòng
   > `transactions` kèm `ref_type`+`ref_id`. Bỏ tick thì **XOÁ MỀM** (`deleted_at` + ai xoá),
   > **không** ghi dòng đảo chiều — chốt lại 2026-08-24: bỏ tick hầu hết là sửa nhầm chứ không
   > phải hoàn tiền, ghi đảo chiều thì sổ đầy cặp +250k/−250k của người bấm nhầm.
   > Lý do phải đổi: cách suy ra làm **số liệu tháng đã chốt tự nhảy** khi sửa cấu hình (đổi quỹ
   > nhóm từ 250k lên 280k là tháng 6, tháng 7 tính lại theo giá mới), không sửa được một dòng
   > sai, và không biết ai ghi lúc nào. Xem `TASKS.md` Phase 9 · Issue 2.
4. **Không xoá cứng.** Dùng `status` / `active` / `deleted_at` — dữ liệu dính tiền.
   > **GRANT và RLS là hai lớp khác nhau, thiếu lớp nào cũng chặn.** `GRANT` quyết định vai
   > `authenticated` có được đụng vào bảng không; `RLS` quyết định trong số đó thì thấy dòng nào.
   > RLS chặn thì trả **0 dòng**; thiếu GRANT thì báo **`permission denied for table X`**. Thấy
   > câu sau là biết thiếu GRANT chứ không phải policy sai — xem `0006_grants.sql`.
5. **Ngày buổi tập là `date`** (không `timestamptz`); **tháng là `char(7)`** dạng `2026-08`.
   Timezone Asia/Ho_Chi_Minh.
6. **Giá chốt tại thời điểm giao dịch.** `session_guests.price` lưu giá lúc đó, không join lại
   `guest_price_rules` về sau. Đổi bảng giá không được làm đổi số tiền buổi cũ.

---

## 2. Ba khái niệm KHÔNG được nhập một

| Bảng | Là gì | Ghi chú |
| --- | --- | --- |
| `users` | tài khoản đăng nhập, SĐT là danh tính | một người một tài khoản, dùng cho mọi CLB |
| `clubs` | một CLB, có mã 8 ký tự | quỹ mở đầu, cấu hình, 3 công tắc ghép tài khoản |
| `club_members` | bản ghi thành viên **trong một CLB** | `user_id` **có thể NULL** = chủ CLB tạo tay |

`user_id IS NULL` là **trạng thái bình thường**, không phải dữ liệu lỗi: người đó vẫn điểm danh,
vẫn tính quỹ, vẫn chia sân. Một `user` có thể là `club_member` ở nhiều CLB **với vai khác nhau**.

`UNIQUE (club_id, user_id)` bảo đảm một tài khoản chỉ gắn 1 bản ghi trong 1 CLB. Ghép user vào
bản ghi B khi đang ở bản ghi A → A tự bị bỏ ghép (`actions.js: linkMemberUser`).

**Bỏ ghép** = xoá `user_id`, **giữ nguyên** bản ghi và toàn bộ lịch sử điểm danh/tiền.

---

## 3. Nguồn của từng con số

Mọi con số tiền trong app thuộc **đúng một trong hai tầng**. Gộp hai tầng lại là đếm cùng một
số tiền hai lần — đây là hiểu nhầm tốn kém nhất của cả hệ thống.

| | Tầng A · Sổ quỹ | Tầng B · Giá thành buổi |
| --- | --- | --- |
| Là gì | tiền thật đã đổi tay, có chứng từ | phân bổ khoản đã trả ra từng buổi để phân tích |
| Ở đâu | `transactions` | không lưu — tính lại mỗi lần mở màn hình |
| Trả lời | CLB **còn** bao nhiêu | buổi này **tốn** bao nhiêu, thu đã đủ chưa |
| Ràng buộc | phải khớp số dư tài khoản ngân hàng | **không bao giờ** sinh dòng ở Tầng A |

```
Tầng B:  chi phí buổi = courtNet + shuttle_used × giá bình quân
         /người       = chi phí buổi ÷ (số có mặt + số khách)
         quỹ bù       = chi phí buổi − thu khách        ← KHÔNG trừ tiền bán sân,
                                                          courtNet đã loại sân bán rồi
```

Tiền sân ra khỏi quỹ khi chuyển cho chủ sân theo hoá đơn tháng; tiền cầu ra khỏi quỹ khi nhập
kho. Ghi thêm chi theo từng buổi là đếm hai lần.

| Con số hiển thị | Tính từ | Hàm |
| --- | --- | --- |
| Số dư quỹ | *(đích)* `transactions` · *(hiện)* suy ra từ bản ghi gốc — xem §1 luật 3 | `ledger.js: fundBalance` |
| Thu/chi tháng | `transactions` trong tháng, **trừ** "Số dư mang sang" | `ledger.js: monthFlow` |
| Tiền sân của buổi | `session_courts.cost` nếu đã chốt (0012); chưa chốt thì `courts.price_per_hour` × số giờ | `money.js: rowCost` → `courtNet` |
| Tiền cầu của buổi | `sessions.shuttle_used` × giá bình quân toàn kho | `money.js: shuttleCost` |
| Giá 1 quả cầu | `SUM(total_amount)/SUM(total_units)` các đợt có `total_amount > 0` | `money.js: shuttleUnit` |
| Định mức cầu | `group.quota × số sân còn chơi / số sân không thuê thêm`, sàn 6 | `money.js: quotaFor` |
| Ai phải đóng quỹ tháng | `group_memberships` của tháng đó, `state='fixed'` | `money.js: groupMembers` |
| Đơn giá 1 buổi (để đối chiếu) | `member_groups.unit_male/unit_female` nếu CLB tự đặt; không thì `monthly_dues.amount` **của chính người đó** ÷ số buổi nhóm trong tháng ≠ cancelled | `money.js: unitPrice` |
| Đối chiếu buổi | đơn giá × số buổi; ÂM khi vắng, DƯƠNG khi đi thêm. Dòng đã lưu thì đọc số đã lưu | `money.js: adjustRows` |
| Chi phí buổi · /người · quỹ bù | Tầng B, tính live từ giá **hiện tại** — sẽ đóng băng, xem §8 | `money.js: costRow` |
| Số trận từng người | `match_players` join `matches` theo `session_id` | `assign.js: matchStats` |

Giá bình quân **toàn kho**, không dùng `shuttle_types.price_per_tube`: các đợt mua khác giá
(320k rồi 330k/ống) nhưng cầu dùng lẫn nhau. `price_per_tube` chỉ để gợi nhập.

### 3.1 Sự kiện nào ghi sổ quỹ — bảng tra nhanh

> **Quy tắc một câu: tiền chỉ ghi khi có người thật sự đưa hoặc nhận tiền. Còn lại là tính toán.**

Mọi khoản thu đều đi qua trạng thái **chờ thu** trước — `phát sinh → công nợ → [user bấm] → giao
dịch`. Không khoản nào vào quỹ ngay lúc phát sinh, vì hứa đóng mà chưa đóng là chuyện thường
ngày của CLB.

| Sự kiện | Ghi sổ? | Chiều | Hạng mục (`CATS`) | Ngày |
| --- | --- | --- | --- | --- |
| Chốt danh sách tháng | không | | | sinh `monthly_dues` chờ thu |
| Tick thành viên đã đóng quỹ tháng | **có** | in | `dues` | `paid_at` |
| Add khách vào buổi | không | | | sinh công nợ, giá chốt tại buổi |
| Tick khách đã trả | **có** | in | `guest` | ngày buổi |
| Điểm danh Có mặt / Vắng | không | | | nuôi back tiền + giá thành |
| Chia sân, bấm giờ, ghi trận | không | | | |
| Nhập số cầu dùng của buổi | không | | | chỉ trừ tồn kho |
| **Chốt buổi** — tiền sân, tiền cầu | không | | | Tầng B |
| **Chốt buổi** — có sân bán được | **có** | in | `courtSold` | ngày buổi |
| **Chốt buổi** — có sân thuê thêm | **có** | out | `courtExtra` | ngày buổi · chỉ mode `month` |
| **Chốt buổi** — mode `session` | **có** | out | `court` | cả tiền sân buổi đó |
| Nhập đợt cầu mới | **có** | out | `shuttle` | ngày nhập |
| Nhập hoá đơn sân trọn tháng | **có** | out | `court` | `paid_on` |
| Kiểm kho cuối tháng | không | | | chỉ chỉnh `shuttle_used` |
| Tính ra khoản back | không | | | khoản phải trả |
| Tick đã trả back (đối chiếu, amount ÂM) | **có** | out | `back` | `paid_at`, mặc định ngày 28 |
| Tick đã thu người đi thêm (amount DƯƠNG) | **có** | in | `extra` | `paid_at`, mặc định ngày 28 |
| Chọn "trừ vào quỹ tháng sau" | không | | | cộng dấu vào `monthly_dues.amount` tháng sau — tiền không đổi tay lần nào |
| Đánh dấu "đi thêm" ở điểm danh | không | | | sinh khoản phải thu ở bảng đối chiếu |
| Ngưng hoạt động, chọn **trả lại tiền** | **có** | out | `back` | ngày bấm · dòng `ref_type='manual'` |
| Ngưng hoạt động, chọn **chỉ ngưng** | không | | | quỹ giữ lại phần buổi chưa đánh |
| Ghi thu / chi tay | **có** | in/out | `withdraw` · `other` · `back` · … | user chọn (xem `MANUAL_CATS`) |

Vì sao ngưng hoạt động lại ghi sổ bằng dòng **nhập tay** chứ không qua bảng đối chiếu:
`money.js: adjustRows` dựng danh sách từ `groupMembers`, mà `groupMembers` bỏ người
`active === false` — người vừa ngưng không còn sinh dòng đối chiếu nào để mà tick. Số tiền do
người dùng chốt (app chỉ gợi ý `đơn giá × số buổi còn lại`), nên nó là một quyết định chi thật,
đúng chỗ của `transactions`.

Hai chỗ dễ hiểu sai nhất:

- **Kho cầu.** Tiền ra ở chỗ **mua** (`shuttle_purchases` → chi ngay). Số lượng quản ở chỗ
  **dùng** (`sessions.shuttle_used` → chỉ trừ tồn kho). Tab Tiêu thụ và Tồn kho chỉ đếm quả.
- **Kiểm kho.** Không tạo giao dịch, kể cả khi hụt kho. Tiền cầu đã ra khỏi quỹ lúc mua; kiểm
  kho chỉ chia lại số tiền đã trả đó cho các buổi. Cầu mất, cho, hỏng cũng vậy. Ngược lại **bán**
  cầu cho CLB khác có thu tiền thật thì **có** ghi — một dòng thu tay hạng mục `other`.

---

## 4. Chỗ state client khác Postgres

State `db` của client dùng shape gọn của prototype. Bảng dưới là map ĐANG DÙNG — cài đặt thật ở
`src/contexts/dbmap.js`, có test khoá ở `src/__tests__/sync/dbmap.test.js`.

| Trong `db` (client) | Bảng Postgres | Khác biệt cần xử lý |
| --- | --- | --- |
| `attendance[sessionId][memberId] = true \| false \| 'extra'` | `attendances` (1 dòng/người) | → enum `present`/`absent`/`extra`; chưa điểm danh = **không có dòng**. `'extra'` = đi thêm, không cố định nhóm — vẫn là **có mặt** (`money.js: isPresent`) |
| `sessions[].courts[]` (array lồng) | `session_courts` (bảng riêng) | index của array **chính là** `court_index` — thứ tự quyết định slot id `c{ci}t{team}s{seat}` |
| `roster[month][groupId][memberId] = state` | `group_memberships` | 1 dòng/người/tháng/nhóm |
| `locked[month] = true` | `roster_locks` | |
| `adjustments[]` | `member_adjustments` | `key` = `month:groupId:memberId:kind`, dựng lại y hệt `money.js: adjustKey` |
| `lineups[sessionId][slot] = playerKey` | `session_lineups` | `playerKey` là member id **hoặc** guest id → cần `player_type` |
| `courtGroups[sessionId][playerKey] = courtIdx` | `session_court_groups` | như trên |
| `matches[].playerKeys[4]` | `matches` + `match_players` | 1 trận → 4 dòng, kèm `team` |
| `playing[sessionId][courtIdx] = timestamp` | *(không lưu DB)* | trạng thái đồng hồ; nếu cần nhiều người cùng thấy thì thêm `sessions.timer_started_at` |
| `manual[]` | `transactions` **có `ref_type = 'manual'`** | dòng do RPC sinh (`ref_type` khác) client không đụng tới |
| `guestPrices[]` | `guest_price_rules` | thêm `effective_from` |
| `club.linkModes.{code,invite,phone}` | `clubs.allow_code_join / allow_invite / allow_phone_suggest` | |
| `seq` (bộ đếm id `M1`, `B7`…) | *(đã bỏ)* | client sinh `crypto.randomUUID()`, trùng kiểu `uuid` nên ghi thẳng, khỏi bảng map id |
| `members[].groupIds` | `club_member_groups` | nhóm cố định **gốc**; khác `group_memberships` là danh sách chốt theo tháng |
| `groupMode[sessionId]` | `sessions.group_mode` | |
| `courtMin[sessionId][ci]` | `session_courts.default_minutes` | |
| `manual[].by` | `transactions.payer_name` | tên người ghi, chốt lúc ghi (người đó có thể rời CLB) |
| `courtBills[].payerId` · `purchases[].payerId` | `payer_member_id` | trỏ về bản ghi thành viên. Trường `payer` chỉ còn để ĐỌC dữ liệu cũ nhập tay — xem `money.js: payerName` |
| `club.levels` / `db.levels` | `clubs.levels text[]` | thứ tự mảng = thứ tự mạnh dần |
| `guestPrices[{level,nam,nu}]` | `guest_price_rules` | 1 dòng client → 2 dòng DB (nam + nữ); `effective_from` = `clubs.opening_date` |


**`playerKey` là chỗ dễ sai nhất:** ở client member và guest dùng chung một namespace key
(`M5`, `K3`). Trong DB phải luôn đi kèm `player_type` vì hai bảng id riêng.

---

## 5. Truy vấn hay dùng

```sql
-- Người tham gia buổi (để chia sân) — tôn trọng trình độ đang chờ áp dụng
SELECT cm.id, cm.name, COALESCE(cm.pending_level, cm.level) AS level, cm.gender
FROM attendances a JOIN club_members cm ON cm.id = a.member_id
WHERE a.session_id = $1 AND a.status = 'present';

-- Số trận / số phút từng người trong buổi
SELECT mp.player_type, mp.player_id, COUNT(*) AS n, SUM(m.minutes) AS minutes
FROM match_players mp JOIN matches m ON m.id = mp.match_id
WHERE m.session_id = $1 GROUP BY 1, 2;

-- Giá bình quân một quả cầu của CLB
SELECT SUM(total_amount)::numeric / NULLIF(SUM(total_units), 0)
FROM shuttle_purchases WHERE club_id = $1 AND total_amount > 0;

-- Số dư quỹ
SELECT SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END)
FROM transactions WHERE club_id = $1;
```

---

## 6. Chạy migration

**Chỉ còn MỘT file: `supabase/migrations/0001_init.sql`.** Gộp 12 file cũ ngày 2026-09-01 — xem
§6.1 bên dưới để biết vì sao và mất gì.

Lần đầu `supabase start` sẽ tự chạy hết `supabase/migrations/`. DB local đã dựng rồi thì áp bản mới:

```bash
npm run db:migrate
```

**Trên Supabase cloud** (project đang chạy thật) thì không có `db:migrate` — user mở **SQL editor**,
dán nguyên nội dung file vào và bấm Run.

> **Vì thế mọi migration PHẢI chạy lại được nhiều lần.** Dán tay thì lỡ chạy hai lần, hoặc chạy
> nửa chừng gặp lỗi rồi sửa và chạy lại cả file, là chuyện bình thường. Dùng
> `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP ... IF EXISTS`, và bọc phần
> thêm constraint trong `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...) ... $$`.
> Migration chỉ chạy được đúng một lần sẽ chặn ngay lần thứ hai bằng lỗi
> `column ... already exists` và không ai biết phần còn lại của file đã chạy chưa.

> **CẤM `supabase db reset`**, `DROP DATABASE`, `DROP SCHEMA ... CASCADE`, `TRUNCATE`,
> `DELETE FROM ... WHERE true` — xem `docs/RULES.md` §7.

**Từ đây trở đi, DB đã có dữ liệu thật thì thêm file mới (`0002_*.sql`), KHÔNG sửa `0001`.**
Gộp lại được lần này chỉ vì chưa có dữ liệu nào để mất. Lần sau thì không.

### 6.1 Gộp 12 file thành một — 2026-09-01

`0001_init.sql` là **hình cuối cùng** của schema, không phải lịch sử: những gì `0003` sửa của
`0001`, `0004` và `0006` vá của `0002` đã áp thẳng vào. Lịch sử nằm trong git.

**Cách kiểm chứng đã làm** (không phải nhìn bằng mắt): dựng hai Postgres 17 sạch trong container
dùng một lần — một cái chạy 12 file gốc theo thứ tự, một cái chạy file gộp — rồi so **920 dòng**
kê khai `cột · kiểu · nullable · default · enum · constraint · index · policy · RLS · grant`.
Khớp tuyệt đối. So thêm 14 hàm + trigger bằng md5 của `pg_get_functiondef`: **13/14 giống hệt**,
cái còn lại (`handle_new_user`) chỉ khác một dòng comment. Chạy lại file 3 lần: schema không đổi.

**Kết quả:** 38 bảng · 126 policy · 14 RPC · 1 trigger.

**Ba bài học đã nướng vào file, đừng làm lại:**

| Bẫy | Triệu chứng | Chốt chặn trong file |
| --- | --- | --- |
| Biến plpgsql trùng tên cột | `create_club` trả 400 `column reference "code" is ambiguous` → **không tạo được CLB nào**. Thân plpgsql chỉ là text lúc `CREATE` nên apply migration KHÔNG lộ lỗi, chỉ lộ khi có người bấm tạo CLB | `gen_club_code()` dùng biến `v_code` |
| Bật RLS mà quên `GRANT` | `permission denied for table clubs`, select bảng trả 403 trong khi RPC vẫn 200. Local không lộ (Supabase local có sẵn default privileges), chỉ lộ trên cloud | khối GRANT cuối file + `ALTER DEFAULT PRIVILEGES` |
| Enum cho trình độ | Postgres không cho xoá / đổi thứ tự giá trị enum, mà CLB cần cả hai | `clubs.levels text[]`, KHÔNG có type `skill_level` |
| Tài khoản mồ côi (có `auth.users`, không có `profiles`) | `create_club` trả `null value in column "name" of relation "club_members"` — **không tạo được CLB nào**. Xảy ra với mọi tài khoản đăng ký TRƯỚC khi schema được dựng (hoặc dựng lại), vì trigger chỉ chạy lúc INSERT `auth.users` | khối backfill sau trigger + guard `me.id IS NULL` trong `create_club` và `approve_join_request`, báo lỗi tiếng Việt |

Ba câu tự kiểm nằm ở cuối `0001_init.sql` — chạy sau khi apply, cả ba phải trả 0 dòng: bảng thiếu
GRANT · bảng chưa bật RLS · bảng bật RLS mà trống policy (bật rồi mà không có policy = khoá sạch,
không ai đọc được gì).

## 7. Việc còn lại trước khi chạy thật

- [x] RLS trên mọi bảng: user chỉ thấy CLB mình là `club_members`.
- [x] **Kiểm RLS bằng hai tài khoản khác CLB — ĐẠT 2026-09-01.** Chạy trên Postgres 17 sạch với
      schema gộp: tạo 2 tài khoản qua trigger `handle_new_user`, mỗi người một CLB, rồi đóng vai
      B (`SET ROLE authenticated` + `request.jwt.claim.sub`).
      **Đọc:** B thấy 1 CLB (của mình), 1 thành viên, **0** giao dịch / quỹ tháng / sân của A, và
      không đọc được cả `profiles` của A.
      **Ghi:** chèn giao dịch và thêm sân vào CLB A đều bị `new row violates row-level security
      policy`; `UPDATE` số dư, `DELETE` giao dịch, tự phong `owner` ở CLB A đều trả **0 dòng**.
      Dữ liệu CLB A nguyên vẹn sau mọi phép thử.
- [ ] Kiểm cờ quyền **server-side** theo `role_permissions` — hiện `has_club_perm` đã có, nhưng
      chưa rà từng bảng bằng test.
- [ ] Trigger ghi `audit_logs` cho mọi bảng dính tiền.
- [ ] Trigger/RPC sinh `transactions` khi chốt buổi, để không phụ thuộc client.
- [ ] Realtime channel theo `session_id` cho `session_lineups` + `matches`.

---

## 8. Thay đổi schema đang chờ — đã chốt hướng, chưa apply

Kết luận của đợt rà dòng tiền, mỗi mục một migration riêng, theo thứ tự ở `TASKS.md` Phase 9.
**Chỉ còn đúng mục 2 chưa làm** — và nó đang chờ user chốt mốc cutoff.

| # | Thay đổi | Vì sao |
| --- | --- | --- |
| — | **Đã apply:** mục 5 + 6 (`0005`) · mục 1 (`0007`) · mục 3 (`0009`) · mục 4 (`0011`, bản đã cắt) | |
| ~~5~~ | ✅ `sessions` thêm `cost_court` · `cost_shuttle_unit` · `cost_shuttle` · `cost_total` · `cost_guest_rev` · `cost_heads` · `cost_frozen_at` | Giá thành đang tính live từ giá **hiện tại**. Mua thêm một đợt cầu giá khác là mọi buổi quá khứ đổi số. Chốt buổi phải đóng băng. |
| ~~6~~ | ✅ `stock_checks` thêm `UNIQUE (club_id, month)` | Mỗi tháng chỉ một lần kiểm kho. |
| ~~1~~ | ✅ Bảng `member_adjustments` + `attend_state` thêm `'extra'` + enum `settle_mode('cash','offset_next_dues')` | Back tiền hiện chỉ chạy **một chiều**. Người cố định nhóm khác đi thêm một buổi không có chỗ thu — hiện phải nhét vào `session_guests` với giá khách, sai cả tiền lẫn báo cáo. |
| ~~3~~ | ✅ `monthly_dues` thêm `paid_amount bigint` (`0009`). Cột `paid` **GIỮ** làm bản sao suy ra `(paid_amount >= amount)`, không drop | `paid` boolean không ghi được "đóng trước 150k/250k": tick thì thừa 100k, không tick thì thiếu 150k. |
| ~~4~~ | ✅ Làm bằng **hai cột `repaid_at`** (`0011`), KHÔNG có bảng `member_payables` và KHÔNG `ALTER TYPE funded_by` — cắt 2026-08-24: khoản nợ chính là bản ghi mua cầu / hoá đơn đã có, chép sang bảng thứ hai là lưu một sự thật ở hai chỗ. Dọn dữ liệu đã làm ở `0008`. |
| 2 | `transactions` thành nguồn ghi thật (xem §1 luật 3) | Làm **sau cùng**: các mục 1/3/4 đổi chính tập sự kiện sinh tiền, viết tầng ghi trước là viết lại hai lần. |
| ~~T1~~ | ❌ **CẮT KHỎI PHẠM VI, user chốt 2026-08-24:** không tách ví / ngân hàng. Nguyên văn: *"cái này kệ nhé không phải issue, chỉ đang quan tâm tới lịch sử minh bạch dòng tiền thôi."* Đừng bàn lại. |

Ba cờ trạng thái của một con số giá thành sau khi có mục 5 + 6:

| `cost_frozen_at` | `shuttle_est` | Nghĩa |
| --- | --- | --- |
| NULL | — | buổi chưa chốt, đang tính live |
| có | true | đóng băng **tạm** — chờ kiểm kho |
| có | false | **số chốt**, không đổi nữa |
