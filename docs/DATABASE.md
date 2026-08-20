# DATABASE.md

**Version:** v0.2.0 · **Updated:** 2026-08-20

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
   > `transactions` kèm `ref_type`+`ref_id`. Bỏ tick thì ghi dòng đảo chiều, không xoá cứng.
   > Lý do phải đổi: cách suy ra làm **số liệu tháng đã chốt tự nhảy** khi sửa cấu hình (đổi quỹ
   > nhóm từ 250k lên 280k là tháng 6, tháng 7 tính lại theo giá mới), không sửa được một dòng
   > sai, và không biết ai ghi lúc nào. Xem `TASKS.md` Phase 9 · Issue 2.
4. **Không xoá cứng.** Dùng `status` / `active` / `deleted_at` — dữ liệu dính tiền.
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
| Tiền sân của buổi | `session_courts` × `courts.price_per_hour` × số giờ | `money.js: courtNet` |
| Tiền cầu của buổi | `sessions.shuttle_used` × giá bình quân toàn kho | `money.js: shuttleCost` |
| Giá 1 quả cầu | `SUM(total_amount)/SUM(total_units)` các đợt có `total_amount > 0` | `money.js: shuttleUnit` |
| Định mức cầu | `group.quota × số sân còn chơi / số sân không thuê thêm`, sàn 6 | `money.js: quotaFor` |
| Ai phải đóng quỹ tháng | `group_memberships` của tháng đó, `state='fixed'` | `money.js: groupMembers` |
| Đơn giá 1 buổi (để back) | `fee / số buổi nhóm trong tháng ≠ cancelled` | `money.js: unitPrice` |
| Back tiền | đơn giá × số buổi `closed` bị đánh Vắng | `money.js: backRows` |
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
| Tick đã trả back | **có** | out | `back` | mặc định ngày 28 |
| Ghi thu / chi tay | **có** | in/out | `withdraw` · `other` | user chọn |

Hai chỗ dễ hiểu sai nhất:

- **Kho cầu.** Tiền ra ở chỗ **mua** (`shuttle_purchases` → chi ngay). Số lượng quản ở chỗ
  **dùng** (`sessions.shuttle_used` → chỉ trừ tồn kho). Tab Tiêu thụ và Tồn kho chỉ đếm quả.
- **Kiểm kho.** Không tạo giao dịch, kể cả khi hụt kho. Tiền cầu đã ra khỏi quỹ lúc mua; kiểm
  kho chỉ chia lại số tiền đã trả đó cho các buổi. Cầu mất, cho, hỏng cũng vậy. Ngược lại **bán**
  cầu cho CLB khác có thu tiền thật thì **có** ghi — một dòng thu tay hạng mục `other`.

---

## 4. Chỗ state client khác Postgres

State `db` của client dùng shape gọn của prototype. Bảng dưới là map ĐANG DÙNG — cài đặt thật ở
`src/contexts/dbmap.js`, có test khoá ở `src/__tests__/dbmap.test.js`.

| Trong `db` (client) | Bảng Postgres | Khác biệt cần xử lý |
| --- | --- | --- |
| `attendance[sessionId][memberId] = true/false` | `attendances` (1 dòng/người) | bool → enum `present`/`absent`; chưa điểm danh = **không có dòng** |
| `sessions[].courts[]` (array lồng) | `session_courts` (bảng riêng) | index của array **chính là** `court_index` — thứ tự quyết định slot id `c{ci}t{team}s{seat}` |
| `roster[month][groupId][memberId] = state` | `group_memberships` | 1 dòng/người/tháng/nhóm |
| `locked[month] = true` | `roster_locks` | |
| `backPaid['2026-08:G1:M5'] = true` | `back_credits` | key gộp `month:groupId:memberId` → 3 cột |
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
| `club.levels` / `db.levels` | `clubs.levels text[]` | thứ tự mảng = thứ tự mạnh dần |
| `guestPrices[{level,nam,nu}]` | `guest_price_rules` | 1 dòng client → 2 dòng DB (nam + nữ); `effective_from` = `clubs.opening_date` |
| `backPaid['month:gid:mid']` | `back_credits` | chỉ ghi cờ `paid`; số buổi/đơn giá/số tiền tính lại từ buổi + quỹ tháng |

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

Lần đầu `supabase start` sẽ tự chạy hết `supabase/migrations/`. DB đã dựng rồi thì áp bản mới:

```bash
npm run db:migrate
```

> **CẤM `supabase db reset`**, `DROP DATABASE`, `DROP SCHEMA ... CASCADE`, `TRUNCATE`,
> `DELETE FROM ... WHERE true` — xem `docs/RULES.md` §7. Cập nhật schema bằng file migration mới
> (`000N_*.sql`), không sửa file cũ đã chạy.

| File | Nội dung |
| --- | --- |
| `0001_init.sql` | 30 bảng + enum + index |
| `0002_auth_rls.sql` | trigger tạo profile, RPC đăng nhập/tạo CLB/duyệt vào CLB, RLS toàn bộ |
| `0003_levels_and_client_sync.sql` | trình độ theo từng CLB (bỏ enum `skill_level`), `club_member_groups`, `sessions.group_mode`, `session_courts.default_minutes`, `transactions.payer_name`, RPC `club_pending_requests` |

## 7. Việc còn lại trước khi chạy thật

- [x] RLS trên mọi bảng: user chỉ thấy CLB mình là `club_members`.
- [ ] Kiểm RLS bằng hai tài khoản khác CLB (chưa thử bằng tay).
- [ ] Kiểm cờ quyền **server-side** theo `role_permissions` — hiện `has_club_perm` đã có, nhưng
      chưa rà từng bảng bằng test.
- [ ] Trigger ghi `audit_logs` cho mọi bảng dính tiền.
- [ ] Trigger/RPC sinh `transactions` khi chốt buổi, để không phụ thuộc client.
- [ ] Realtime channel theo `session_id` cho `session_lineups` + `matches`.

---

## 8. Thay đổi schema đang chờ — đã chốt hướng, chưa apply

Bảy thay đổi dưới đây là kết luận của đợt rà dòng tiền. Mỗi mục là một migration riêng, làm theo
thứ tự ở `TASKS.md` Phase 9. **Chưa cái nào được apply** — cột nào chưa có thì code chưa được đọc.

| # | Thay đổi | Vì sao |
| --- | --- | --- |
| 5 | `sessions` thêm `cost_court` · `cost_shuttle_unit` · `cost_shuttle` · `cost_total` · `cost_guest_rev` · `cost_heads` · `cost_frozen_at` | Giá thành đang tính live từ giá **hiện tại**. Mua thêm một đợt cầu giá khác là mọi buổi quá khứ đổi số. Chốt buổi phải đóng băng. |
| 6 | `stock_checks` thêm `UNIQUE (club_id, month)` | Mỗi tháng chỉ một lần kiểm kho. |
| 1 | Bảng `member_adjustments` + `attend_state` thêm `'extra'` + enum `settle_mode('cash','offset_next_dues')` | Back tiền hiện chỉ chạy **một chiều**. Người cố định nhóm khác đi thêm một buổi không có chỗ thu — hiện phải nhét vào `session_guests` với giá khách, sai cả tiền lẫn báo cáo. |
| 3 | `monthly_dues` thêm `paid_amount bigint`, bỏ `paid` | `paid` boolean không ghi được "đóng trước 150k/250k": tick thì thừa 100k, không tick thì thiếu 150k. |
| 4 | `funded_by` → enum `fund_source('fund','member_advance')` + bảng `member_payables` | Thành viên ứng tiền mua cầu bị ghi chi ngay → quỹ giảm trong khi tiền chưa ra, và không ai nhớ phải trả người ứng. **Dọn dữ liệu trước:** `dbmap` đang ghi tên người trả (chuỗi tự do) vào chính cột `funded_by` — phải chuyển sang `payer_member_id` rồi mới `ALTER TYPE`. |
| 2 | `transactions` thành nguồn ghi thật (xem §1 luật 3) | Làm **sau cùng**: các mục 1/3/4 đổi chính tập sự kiện sinh tiền, viết tầng ghi trước là viết lại hai lần. |
| T1 | Enum `wallet_kind` + bảng `wallets` + `transactions.wallet_id` | Sổ quỹ coi quỹ là một túi duy nhất. Thực tế tiền nằm ở tài khoản NH, túi thủ quỹ, túi quản trò thu tại sân chưa chuyển, tiền thành viên ứng chưa hoàn. Vì thiếu khái niệm này nên vai `host` bị chặn khỏi mục tiền và không ai tick "khách đã trả". |

Ba cờ trạng thái của một con số giá thành sau khi có mục 5 + 6:

| `cost_frozen_at` | `shuttle_est` | Nghĩa |
| --- | --- | --- |
| NULL | — | buổi chưa chốt, đang tính live |
| có | true | đóng băng **tạm** — chờ kiểm kho |
| có | false | **số chốt**, không đổi nữa |
