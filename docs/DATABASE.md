# DATABASE.md

**Version:** v0.1.0 · **Updated:** 2026-08-19

Schema đầy đủ: [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
Đặc tả gốc: handoff `03-data-model.md`. File này nói **luật bất di bất dịch** và **chỗ shape
localStorage khác shape Postgres** — để lúc nối Supabase không đoán.

---

## 1. Sáu luật không được vi phạm

1. **Đa CLB từ đầu.** Mọi bảng nghiệp vụ có `club_id` (trừ `users`). Không làm single-tenant rồi vá.
2. **Tiền là `bigint` VND, không lưu số đã làm tròn.** Làm tròn chỉ ở tầng hiển thị (`fmt`/`fmtK`).
   Ngoại lệ duy nhất được làm tròn khi lưu: `back_credits.unit_price` (đơn giá một buổi).
3. **`transactions` là sổ quỹ duy nhất, append-only.** Số dư = `SUM(in) − SUM(out)`. Không tính
   lại số dư từ nhiều nguồn khi hiển thị. Sửa sai bằng dòng đối ứng, không UPDATE.
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

| Con số hiển thị | Tính từ | Hàm |
| --- | --- | --- |
| Số dư quỹ | `transactions` | `ledger.js: fundBalance` |
| Thu/chi tháng | `transactions` trong tháng, **trừ** "Số dư mang sang" | `ledger.js: monthFlow` |
| Tiền sân của buổi | `session_courts` × `courts.price_per_hour` × số giờ | `money.js: courtNet` |
| Tiền cầu của buổi | `sessions.shuttle_used` × giá bình quân toàn kho | `money.js: shuttleCost` |
| Giá 1 quả cầu | `SUM(total_amount)/SUM(total_units)` các đợt có `total_amount > 0` | `money.js: shuttleUnit` |
| Định mức cầu | `group.quota × số sân còn chơi / số sân không thuê thêm`, sàn 6 | `money.js: quotaFor` |
| Ai phải đóng quỹ tháng | `group_memberships` của tháng đó, `state='fixed'` | `money.js: groupMembers` |
| Đơn giá 1 buổi (để back) | `fee / số buổi nhóm trong tháng ≠ cancelled` | `money.js: unitPrice` |
| Back tiền | đơn giá × số buổi `closed` bị đánh Vắng | `money.js: backRows` |
| Số trận từng người | `match_players` join `matches` theo `session_id` | `assign.js: matchStats` |

Giá bình quân **toàn kho**, không dùng `shuttle_types.price_per_tube`: các đợt mua khác giá
(320k rồi 330k/ống) nhưng cầu dùng lẫn nhau. `price_per_tube` chỉ để gợi nhập.

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
