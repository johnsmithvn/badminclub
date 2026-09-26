# Module Giải đấu — Thiết kế hệ thống & Kế hoạch triển khai

**Phiên bản:** v2.1 · **Cập nhật:** 2026-09-25 · **Trạng thái:** ĐÃ DUYỆT — sẵn sàng Phase 0.
v2.1: bỏ swap RPC (đổi chỗ = reset rồi sinh lại), `edit` không đổi người thắng, RPC kiểm điểm tối thiểu, 1 link/cặp giai đoạn, bỏ canvas_x/y, dời chemistry/seeded/suggestSwap sang Phase 5.
v2.0 thay toàn bộ v1.1: giữ các quyết định v1.1 đã đúng (RPC, nạp riêng, tiền tượng trưng, không Elo,
10 sửa lỗi schema), bổ sung mô hình thể thức tự do, đường ghi dữ liệu, RPC đầy đủ, luật theo vòng từ quy chế mùa 1.

Nguồn:
- Design handoff: `Downloads/Thiết kế giao diện hệ thống đấu/design_handoff_tournament/` (README + 3 màn + DRAFT SQL)
- Quy chế giải mùa 1: `Downloads/QC Masters PK Badminton 2026.docx`
- Code thật đã đọc: `storage.js`, `dbmap.js` (`diff`), `AppContext.jsx`, `ledger.js`, `rating.js`, `routes/index.js`,
  `Sidebar.jsx`, `permissions.json`, migrations `0001`, `0007`, `0021`

Nhãn theo RULES §1: **[V]** đã kiểm trong code · **[A]** giả định · **[P]** đề xuất mới.

---

## 0. Quyết định đã chốt

| # | Quyết định | Hệ quả |
|---|---|---|
| D1 | Trận giải **không** tính Elo, **không** tính điểm mùa | Không ghi `matches`, không đụng `rating.js`/`season.js`/backtest. Không cần `matches.session_id DROP NOT NULL`. |
| D2 | Tiền **tượng trưng**: cờ đã đóng phí + dự trù chi + giải thưởng, **chỉ để xem** | Không ghi `transactions`, không sửa `ledger()`. Nối sổ quỹ = phase sau, design lại. |
| D3 | ~~Hoãn khách ngoài CLB~~ → **Phase 6: bảng riêng `tournament_guests`** (0059), chỉ khi giải "Mở rộng" | Không đụng bảng `guests`. Trong `tournament_registrations`, `player_type='guest'` ⇒ `player_id` → `tournament_guests.id` (enum giữ nguyên, trigger kiểm cùng CLB). |
| D8 | Canvas kéo thả **có làm** (Phase 6) — trong màn Sơ đồ, chỉ nội dung chưa có lịch, màn rộng | Luật sơ đồ chạy được: `canvas.js#graphIssue` (1 nguồn seq 1; nguồn vòng bảng → các nhánh loại, mỗi hạng một nhánh). Sửa trên canvas ⇒ mẫu `custom` |
| D9 | Thông báo "sắp tới lượt": **chỉ chuông trong app**, không push | Trigger `tournament_notify_match` (0059): pending→ready, hoặc trận chưa đánh được xếp sân |
| D10 | Làm gọn đăng ký: trạng thái giải **tự đi theo lịch**; "Tạo lịch" tự chốt đội hình; giải miễn phí ẩn phí; checklist chỉ việc chặn giải chạy | `syncStatus` trong `tournamentActions.js`; chỉ còn nút Huỷ giải |
| D4 | Thể thức **tự do** theo mô hình giai đoạn (§2) | Schema đủ cho mọi thể thức ngay từ 0057; code làm dần theo phase. |
| D5 | Ghi nhánh đấu qua **RPC nguyên tử**; dữ liệu giải **nạp riêng**, không qua `diff()` | §4.1 |
| D6 | Supabase free → **poll** khi trang đang mở, không realtime | §4.4 |
| D7 | Quyền ghi = cờ `sessions`; mọi thành viên CLB được xem | Chủ CLB + Thủ quỹ ghi được [V `permissions.json`] |

---

## 1. Mô hình nghiệp vụ

```
Giải (tournament)
 ├─ Thí sinh (registration)  — 1 người / giải, phí chốt theo giới tính lúc đăng ký
 ├─ Giải thưởng, Dự trù chi   — chỉ để xem (D2)
 └─ Nội dung (event): Đôi nam · Đôi nữ · Đôi nam nữ · Đơn…
     ├─ Đăng ký nội dung (entry) — ai thi nội dung nào
     ├─ Đội (team) — 1 hoặc 2 người; có số bốc thăm, hạt giống, ghim
     └─ Giai đoạn (stage) ── liên kết (link: hạng nào đi đâu) ──▶ Giai đoạn…
          ├─ Bảng (group) — chỉ vòng tròn
          └─ Trận (match) — chép luật điểm vào từng trận
```

**Nguyên tắc cốt lõi:** *thể thức = đồ thị giai đoạn*. Không có bảng hay code riêng cho từng "loại giải".
Mọi thể thức là tổ hợp của 2 loại giai đoạn + liên kết:

| Mẫu (template) | Đồ thị giai đoạn |
|---|---|
| `ko` Loại trực tiếp | `S1 knockout` |
| `rr` Vòng tròn | `S1 round_robin (1 bảng)` |
| `rr_ko` Bảng → Loại | `S1 round_robin (G bảng)` ─[hạng 1..k]→ `S2 knockout` |
| `rr_ko_plate` Bảng → Nhánh chính + phụ | `S1` ─[1,2]→ `S2 knockout "Nhánh chính"` · `S1` ─[3]→ `S3 knockout "Nhánh phụ"` |
| (canvas, phase sau) | bất kỳ đồ thị không có vòng lặp |

Canvas tự do trong design chỉ là **một giao diện khác đọc/ghi cùng các bảng này** → làm sau không mất gì.

### 1.1 Luật điểm

`rule = { sets: 1|3|5, points: int, winBy2: bool, cap: int }`

```
setWinner(a,b) → 'A' | 'B' | null (chưa xong) | 'invalid'
  điểm âm, không nguyên, > cap, hoặc a = b ≥ points      → invalid   (30-30, 31-29)
  W = bên cao hơn, L = bên thấp hơn; set KẾT THÚC HỢP LỆ khi W đúng bằng "điểm dừng":
    không winBy2:  dừng = points                          (1×30: 30-29 ✓)
    winBy2:        L ≤ points-2 → dừng = points           (21-19 ✓, 21-5 ✓)
                   L <  cap-1   → dừng = L+2              (22-20 ✓, 29-27 ✓)
                   L =  cap-1   → dừng = cap              (30-29 ✓)
  W = dừng → W thắng · W < dừng → null (đang đánh) · W > dừng → invalid (25-10, 24-21: lẽ ra đã dừng)
matchWinner(sets): bên thắng trước ceil(sets/2) set
```
Phải phân biệt `null` (bảng điểm đánh tiếp) với `invalid` (nhập tay sai) — viết theo kiểu "a ≥ cap → A" thì
30-30 ra A và 25-10 ra A, đều sai.

Giai đoạn có `match_rule` (mặc định) + `rule_overrides` theo **loại vòng**
(`final`, `third`, `sf`, `qf`, `r16`, `r32`, `group`). Khi sinh trận, luật **được chép vào trận**
(`tournament_matches.rule`) → sửa luật giữa chừng không làm trận đã đánh bị hiểu lại.

Quy chế mùa 1, dựng bằng mô hình này:

| Nội dung | `match_rule` | `rule_overrides` |
|---|---|---|
| Đôi nam, Đôi nữ | `{1, 30, false, 30}` "chạm 30" | `final`, `third`: `{3, 15, false, 15}` |
| Đôi nam nữ | `{1, 21, true, 30}` "cách 2, 29-29 ai 30 thắng" | `final`, `third`: `{3, 15, false, 15}` |

Bán kết theo quy chế là "vòng loại" → dùng `match_rule`. Muốn bán kết 3 sec thì thêm override `sf`.

### 1.2 Vòng đời trạng thái

```
tournament: draft → registration → running → finished      (+ cancelled từ bất kỳ đâu)
event:      draft → pairing → drawn ─────→ running → finished
                     (ghép cặp)  (khoá đội)  (đã sinh trận)
stage:      pending → running → done
                     (đã sinh trận) (vòng tròn: đã "Chốt giai đoạn")
match:      pending → ready → live → done | walkover | retired
            bye (tự động, không ai đánh)
```

- `drawn`: đội hình khoá. Mở lại được **chỉ khi** chưa giai đoạn nào `running`.
- Sinh trận (`running`) chỉ khi event đã `drawn`. Xoá trận để sinh lại chỉ khi **chưa trận nào có kết quả** (trừ `bye`).
- Giai đoạn vòng tròn `done` ⇒ khoá sửa/hoàn tác mọi trận trong đó (giai đoạn sau đã dùng thứ hạng).

---

## 2. Schema — migration `0057_tournaments.sql` [P]

Quy ước repo [V]: `club_id` mọi bảng · tiền `bigint` · enum là `text + CHECK` lưu **key** · RLS **và** GRANT.
**Khác DRAFT:** mọi bảng con mang thêm `tournament_id` → nạp cả giải bằng các truy vấn song song
`.eq('tournament_id', id)` trong 1 lượt, không phải nạp bậc thang theo `event_id`.

### 2.1 Bảng

**`tournaments`** — `id, club_id, name, starts_on date, start_time time, end_time time, venue text,
court_labels text[] DEFAULT '{}', scope CHECK('club_only','open') DEFAULT 'club_only',
status CHECK('draft','registration','running','finished','cancelled') DEFAULT 'draft',
fee_male bigint DEFAULT 0, fee_female bigint DEFAULT 0, rules jsonb DEFAULT '[]', created_by → club_members,
created_at, updated_at, deleted_at`
- Bỏ so với DRAFT: `rating_enabled`, `season_id` (D1).

**`tournament_events`** — `id, club_id, tournament_id, kind CHECK('md','wd','xd','ms','ws','open_doubles','open_singles'),
team_size CHECK(1,2), gender_rule CHECK('male','female','mixed','any'),
status CHECK('draft','pairing','drawn','running','finished') DEFAULT 'draft', template_key text, note text, sort_order int`
- Bỏ `slots` (số đội = đếm `tournament_teams`).

**`tournament_stages`** — `id, club_id, tournament_id, event_id, seq int, type CHECK('knockout','round_robin'),
title text, status CHECK('pending','running','done') DEFAULT 'pending',
config jsonb DEFAULT '{}', match_rule jsonb NOT NULL, rule_overrides jsonb DEFAULT '{}',
UNIQUE(event_id, seq)`
- `config` knockout: `{ thirdPlace: bool, seeding: 'seed'|'slot'|'random' }`
- `config` vòng tròn: `{ groups: int, legs: 1|2, seeding: 'snake'|'random' }`
- `swiss` **không** vào CHECK — chưa có thuật toán; thêm sau bằng migration nhỏ khi có.
- Toạ độ canvas (`canvas_x/y`) **không** có trong 0057 — Phase 6 thêm bằng 1 dòng `ADD COLUMN`.

**`tournament_stage_links`** — `id, club_id, tournament_id, from_stage_id, to_stage_id, ranks int[] NOT NULL,
UNIQUE(from_stage_id, to_stage_id), CHECK(from_stage_id <> to_stage_id)`
- **Đúng 1 link / cặp giai đoạn** (đã chốt). `ranks` gộp nhiều hạng (`{1,2}`). *Cách xếp* các hạng đó vào
  giai đoạn đích (chéo A1–B2…) là `config.seeding` của giai đoạn đích, không phải link thứ hai.
- Chỉ dùng từ Phase 4 (MVP một giai đoạn không có link).

**`tournament_registrations`** — `id, club_id, tournament_id, player_type player_kind, player_id uuid,
gender gender (snapshot), level text (snapshot), rating_snapshot numeric, fee bigint (chốt lúc đăng ký),
paid bool DEFAULT false, paid_at timestamptz, status CHECK('registered','withdrawn'),
UNIQUE(tournament_id, player_type, player_id)`
- MVP chỉ ghi `player_type='member'` (D3) — ràng ở app, không ở DB, để mở khách không cần migration.

**`tournament_event_entries`** — `club_id, tournament_id, event_id, registration_id, PK(event_id, registration_id)`

**`tournament_teams`** — `id, club_id, tournament_id, event_id, seed int, draw_no int, pinned bool, name text,
status CHECK('active','withdrawn'), UNIQUE(id, event_id)`

**`tournament_team_players`** — `club_id, tournament_id, team_id, event_id, registration_id,
PK(team_id, registration_id), UNIQUE(event_id, registration_id),
FK(team_id, event_id) → tournament_teams(id, event_id) ON DELETE CASCADE,
FK(event_id, registration_id) → tournament_event_entries(event_id, registration_id)`
- FK thứ hai = người chỉ vào đội của nội dung mà họ **đã đăng ký**.
- Trigger `[P]`: chặn **INSERT, UPDATE, DELETE** khi `event.status` không thuộc (`draft`,`pairing`) — khoá đội hình ở
  tầng DB. Lấy `event_id` từ `COALESCE(NEW.event_id, OLD.event_id)` (lúc DELETE thì `NEW` là NULL). Xoá một đội
  (`tournament_teams`) sẽ cascade xuống bảng này nên cũng bị chặn theo — đúng ý.

**`tournament_groups`** — `id, club_id, tournament_id, stage_id, label text, seq int, UNIQUE(stage_id, label)`

**`tournament_group_teams`** — `club_id, tournament_id, group_id, team_id, seed_in_group int,
final_rank int NULL, PK(group_id, team_id)`
- `final_rank` ghi lúc "Chốt giai đoạn" (BTC đã xử lý hoà) → giai đoạn sau đọc từ đây, không tính lại.

**`tournament_matches`**

| cột | kiểu | ghi chú |
|---|---|---|
| id, club_id, tournament_id, event_id, stage_id | uuid | |
| group_id | uuid NULL | trận vòng tròn |
| round, slot | int | knockout: vòng 0 = vòng đầu; vòng tròn: lượt |
| round_kind | text CHECK(`r32`,`r16`,`qf`,`sf`,`final`,`third`,`group`) | hiển thị "TK1/BK/CK" tính từ đây bằng i18n — **không** lưu chữ `code` như DRAFT (RULES §3.3) |
| team_a_id, team_b_id | uuid NULL | FK kép `(team_x_id, event_id)` → teams(id, event_id); NULL = chưa xác định |
| source_a, source_b | jsonb | `{kind:'seed',n}` · `{kind:'draw',n}` (số bốc thăm) · `{kind:'rank',stage,group,rank}` · `{kind:'winner',match}` · `{kind:'loser',match}` · `{kind:'bye'}` |
| next_match_id, next_side | uuid, CHECK('A','B') | đội thắng đi đâu |
| loser_next_match_id, loser_next_side | uuid, CHECK('A','B') | thua bán kết → tranh 3-4 |
| rule | jsonb NOT NULL | chép từ giai đoạn lúc sinh (§1.1) |
| status | CHECK(`pending`,`ready`,`live`,`done`,`walkover`,`retired`,`bye`) | |
| sets | jsonb DEFAULT '[]' | `[[21,18],[19,21],[15,12]]` — cùng shape `playedSets` [V `appActions.js:3404`] |
| winner | CHECK('A','B') NULL | cùng quy ước `matches.winner_team` |
| result_note | text | lý do walkover/retired — bắt buộc khi 2 trạng thái đó |
| seq_no | int | thứ tự thi đấu toàn giải (hàng chờ sân); BTC sửa tay được |
| court_label | text | sân đang/sẽ đánh |
| started_at, finished_at, updated_at | timestamptz | |
| updated_by | uuid → club_members | |

- `UNIQUE INDEX (stage_id, COALESCE(group_id, '00000000-…'::uuid), round, slot)` — NULL group vẫn bị ràng.
- Index: `(tournament_id)`, `(next_match_id)`, `(loser_next_match_id)`.

**`tournament_match_edits`** — `id, club_id, tournament_id, match_id, action CHECK('commit','edit','undo','walkover','retire'),
old_sets, new_sets, old_winner, new_winner, reason text, edited_by, edited_at`
- `reason` bắt buộc với `edit`, `undo`, `walkover`, `retire` (CHECK theo `action`).

**`tournament_prizes`** — `id, club_id, tournament_id, event_id NULL, rank int, label text, description text, cash bigint`
- `event_id NULL` = áp cho mọi nội dung (mùa 1). Không `UNIQUE(rank)` — cho phép đồng hạng / nhiều Khuyến khích.

**`tournament_budget_lines`** — `id, club_id, tournament_id, label text, amount bigint, sort_order int`
- "Trích quỹ CLB" **không** là một dòng: nó = thu − chi, tính ra (§3.8).

### 2.2 Phân quyền (RLS)

| Bảng | SELECT | INSERT/UPDATE/DELETE trực tiếp |
|---|---|---|
| mọi bảng giải | `is_club_member(club_id)` | — |
| tournaments, events, stages, links, registrations, entries, teams, team_players, groups, group_teams, prizes, budget_lines | ✓ | `has_club_perm(club_id,'sessions')` |
| **tournament_matches, tournament_match_edits** | ✓ | **không có policy** → chỉ RPC ghi được |

`GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` cho nhóm 1; `GRANT SELECT` cho nhóm 2.

### 2.3 RPC (đều `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated` — khuôn `0007_delete_club.sql` [V])

Chung cho mọi hàm:
- Tự tra người sửa: `club_members WHERE user_id = auth.uid() AND club_id = <club của dòng>` — **không** nhận `p_edited_by` từ client.
- Kiểm `has_club_perm(club,'sessions')`, không đạt → `RAISE EXCEPTION` với mã lỗi key (client dịch bằng i18n).
- Khoá dòng: đọc trận (không khoá) để biết `next_match_id`/`loser_next_match_id`, rồi khoá **cả tập**
  `{trận, next, loser_next}` trong **một** câu `SELECT … WHERE id IN (…) ORDER BY id FOR UPDATE`, sau đó kiểm lại
  con trỏ chưa đổi. "Theo chiều cây" là chưa đủ: CK và 3-4 cùng tầng, 2 bán kết chốt cùng lúc mà khoá 2 dòng
  này theo thứ tự khác nhau là deadlock. `reset_stage`/`generate_stage` khoá mọi trận của giai đoạn, cũng `ORDER BY id`.
  Postgres vẫn tự gỡ deadlock (lỗi `40P01`) → client báo "thử lại", không hỏng dữ liệu.
- Mỗi thay đổi kết quả ghi 1 dòng `tournament_match_edits`, đặt `updated_at = now()`.

| RPC | Làm gì | Từ chối khi |
|---|---|---|
| `tournament_generate_stage(p_stage uuid, p_groups jsonb, p_matches jsonb)` | **Chỉ tạo mới.** **Không tự dựng nhánh** — cấu trúc do `bracket.js` dựng (có test); RPC chỉ **kiểm + ghi nguyên tử**: insert bảng, đội vào bảng, toàn bộ trận (UUID client sinh sẵn); ô `bye` đã được `bracket.js` đánh dấu (`status='bye'`, `sets=[]`, `winner` = bên có đội) và đội được miễn đã điền sẵn vào trận kế tiếp trong payload — RPC không tự đẩy; stage → `running`, event → `running` | stage ≠ `pending`; đội không thuộc event; con trỏ trỏ ra ngoài giai đoạn; con trỏ tạo vòng; trận `bye` sai hình (không đúng 1 bên có đội, `winner` không trỏ bên đó, hoặc trận kế tiếp chưa có đội được miễn) |
| `tournament_reset_stage(p_stage, p_reason)` | Xoá mọi trận/bảng của giai đoạn, stage → `pending` (vd. muốn ghép cặp lại). **Đổi chỗ đội vòng đầu** = xem trước và đổi trên máy trước khi sinh; đã sinh rồi thì `reset` → `generate` lại (2 lần gọi; hỏng giữa chừng thì giai đoạn nằm ở `pending` rỗng — vô hại, bấm sinh lại) | có trận mang kết quả (≠ `bye`); **giai đoạn sau đã được sinh trận** (≠ `pending`, kể cả nhánh rỗng) — MVP chặn, không cascade |
| `tournament_start_match(p_match, p_court)` | `ready → live`, ghi sân, `started_at` | không `ready` |
| `tournament_commit_match(p_match, p_sets, p_winner, p_status, p_note)` | `p_status ∈ done/walkover/retired`; ghi kết quả; đẩy thắng → `next`, thua → `loser_next`; trận đích đủ 2 đội → `ready` | trận thiếu đội; đã có kết quả (phải dùng `edit`); walkover/retired thiếu `p_note`; stage `done` |
| `tournament_edit_match(p_match, p_sets, p_reason)` | Sửa **điểm** trận đã xong, **người thắng giữ nguyên**. Muốn đổi người thắng = `undo` rồi `commit` (cùng một bộ kiểm downstream, không viết nhánh thứ hai) | điểm mới ra người thắng khác; stage `done` |
| `tournament_undo_match(p_match, p_reason)` | Gỡ kết quả, gỡ đội ở **cả** `next` và `loser_next`, trận đích → `pending`, trận này → `ready` | trận đích nào đã `live`/có kết quả; là `bye`; stage `done` |
| `tournament_schedule_match(p_match, p_seq_no, p_court)` | BTC chỉnh thứ tự/sân ("BTC có quyền điều chỉnh lịch") | trận đã có kết quả |
| `tournament_close_stage(p_stage, p_ranks jsonb)` — **Phase 4, migration riêng** | Vòng tròn: ghi `final_rank` từng đội (client tính + BTC xử hoà), stage → `done` | còn trận chưa có kết quả; thứ hạng thiếu/trùng |

**Kiểm luật điểm ở đâu:** `lib/scoring.js` là bản chính (có test), chạy trước khi gọi RPC. RPC kiểm **tối
thiểu** theo `rule` chép trong trận — hàm SQL nội bộ `tournament_valid_sets(sets, rule, winner)` ~25 dòng, được
**hai RPC `commit` và `edit`** gọi chung (dùng chung *trong Postgres*, không phải chung với JS):
- `status='done'`: 1 ≤ số set ≤ `rule.sets`; **mỗi** set ra `'A'`/`'B'` theo `setWinner` §1.1 (không `null`,
  không `invalid`); không còn set nào sau khi đã đủ `ceil(sets/2)`; `winner` = bên đủ số set thắng.
- `walkover`: `sets = []`. `retired`: chỉ kiểm cấu trúc (set dở dang là hợp lệ) + `p_note` bắt buộc.

JS (`scoring.js`) và SQL là **hai bản cài đặt riêng** của cùng luật. Thứ dùng chung là **bộ ca kiểm**, không phải
code: `scoring.test.js` và `supabase/manual/0057_tournament_check.sql` phải cùng qua một danh sách ca — lệch nhau là lộ:

| Luật | Hợp lệ (thắng) | Chưa xong | Sai |
|---|---|---|---|
| 1×21 cách 2 trần 30 | 21-19 · 21-5 · 22-20 · 29-27 · 30-29 · 30-28 | 21-20 · 29-29 · 20-0 | 30-30 · 31-29 · 24-21 · 25-10 · -1-21 |
| 1×30 chạm | 30-29 · 30-0 | 29-29 | 30-30 · 31-5 |
| 3×15 chạm | [[15,10],[15,12]] · [[15,10],[8,15],[15,14]] | [[15,10]] (mới 1-0) | [[15,10],[15,12],[15,3]] (thừa set) · 15-15 · 16-3 · *winner ≠ bên thắng 2 set (ca kiểm riêng cho SQL)* |

---

## 3. Logic thuần — `src/lib/tournament/` [P]

Tách thư mục con vì một file sẽ vượt 1.500 dòng. Import `#lib/tournament/scoring.js` (alias `#lib/*` có sẵn).
Mọi số nghiệp vụ lấy từ `app.json → tournament` (§5).

| File | Hàm chính | Ghi chú |
|---|---|---|
| `scoring.js` | `setWinner`, `matchWinner`, `validateSets(sets, rule) → errorKey\|null`, `scoreFlags(state, rule) → {deuce, setPoint:{A,B}, matchPoint:{A,B}}`, `ruleFor(stage, roundKind)` | |
| `bracket.js` | `bracketOrder(size)` `[1]→[1,2]→[1,4,2,3]→[1,8,4,5,2,7,3,6]`; `buildKnockout({stage, entrants, newId}) → matches[]`; `roundKindOf(round, totalRounds)` | Bye luôn ở vị trí hạt giống > n của `bracketOrder` (cả khi bốc thăm) → không bao giờ bye–bye; `slot`: số bốc thăm rải tuần tự vào các vị trí còn lại (đủ 2ⁿ đội = 1–2, 3–4…). Tranh 3-4 chỉ khi ≥ 4 đội. Trả trận camelCase, không mang `clubId/tournamentId/eventId` — RPC lấy từ giai đoạn |
| `roundRobin.js` | `snakeGroups(teams, G)`; `buildRoundRobin({stage, groups, newId})` (thuật toán vòng tròn "circle" → mỗi lượt không ai đánh 2 trận) | |
| `standings.js` | `groupStandings(group, matches, cfg) → rows[] + ties[]` | §3.1 |
| `links.js` | `entrantsFromLinks(links, groupTeams) → entrants[]` | Hạng 1 các bảng lấy seed 1..G, hạng 2 lấy G+1..2G xoay G/2 → đội cùng bảng rơi 2 nửa nhánh (README §5.4) |
| `advance.js` | `applyCommit`, `applyUndo`, `canUndo`, `applyEdit` (**chỉ sửa điểm, người thắng giữ nguyên** — điểm mới ra người thắng khác thì trả lỗi; không có nhánh thay đội ở trận sau) trên mảng trận trong bộ nhớ | **Đặc tả chạy được** của RPC §2.3: plpgsql viết theo đúng file này |
| `pairing.js` | MVP (Phase 2): `eligible(event, reg)`, `autoPair(regs, mode, pinned)` mode `balanced`/`random`, `balanceSpread(teams)` | Phase 5: mode `seeded`, `chemistry` (dùng `calcPairImpact` [V `rating.js:975`], không đếm lại), `suggestSwap` |
| `format.js` | MVP: `TEMPLATES`, `buildStages(template, params) → {stages, links}` (chỉ mẫu `ko`) | Phase 4: mẫu vòng bảng · Phase 5: `recommend()` theo README §5.7, nhãn "ước tính" |
| `schedule.js` | `assignSeqNo(matchesOfAllEvents)` — xếp xen kẽ nội dung, trận chờ đội sau trận nguồn | Không phải bộ xếp sân tối ưu; BTC sửa tay |
| `finance.js` | `tournamentMoney(t, regs, prizes, budget) → {expected, collected, outstanding, prizeTotal, budgetTotal, balance}` | Chỉ để xem (D2) |

### 3.1 Xếp hạng vòng tròn [P, cần bạn xác nhận]

Theo thông lệ BWF [A — kiểm lại văn bản gốc]:
1. Số trận thắng.
2. Bằng nhau **2 đội** → đối đầu trực tiếp.
3. Bằng nhau **≥ 3 đội** → hiệu số set (chỉ trong nhóm hoà) → hiệu số điểm → nếu còn đúng 2 đội thì đối đầu.
4. Vẫn hoà → trả vào `ties[]`, **BTC quyết** ở bước "Chốt giai đoạn" (bốc thăm/tay). Không tự phân xử.

Walkover trong vòng tròn tính như thắng với tỉ số `cfg.walkoverSet` mỗi set (mặc định `rule.points`–0).
Retired: giữ set đã đánh, các set còn lại tính như walkover.

---

## 4. Kiến trúc client [P]

### 4.1 Luồng ghi — không đi qua `diff()`

Lý do [V]: `save(db)` so ảnh chụp lúc `load()` rồi **upsert nguyên dòng** (`dbmap.js:743`), và dòng
biến mất khỏi `db` bị `delIds` **xoá thật** (`dbmap.js:738`). Dữ liệu nạp riêng mà để `diff()` đụng vào
thì rời trang = xoá cả giải.

| Thao tác | Đường ghi |
|---|---|
| Tạo/sửa giải, nội dung, giải thưởng, dự trù | `storage.tournamentWrite(table, 'upsert'\|'delete', rows)` — ghi theo `id`, từng dòng |
| Đăng ký, tích đóng phí, ghép cặp, ghim, đổi thể thức | như trên (ít tranh chấp: 1 BTC thao tác) |
| Sinh/xoá trận, đổi chỗ vòng đầu (= sinh lại), chốt/sửa/hoàn tác, walkover, xếp lịch, chốt giai đoạn | `storage.tournamentRpc(name, args)` |

Mọi action: gọi mạng → chờ xong → nạp lại giải (`loadTournament`). **Không lạc quan (optimistic)**: dữ liệu
nhỏ (< 200 dòng), đúng quan trọng hơn nhanh 200 ms.

### 4.2 State

- `AppContext.jsx`: thêm state **riêng** `tour` (`{ id, data, loadedAt }`) cạnh `db`. **Không** đưa vào `db`
  → `save(db)` không bao giờ thấy. `reload()` CLB không xoá `tour`.
- `useApp()` trả thêm `tour`; `makeActions` nhận thêm `setTour`, `tourRef`.
- `db` chung vẫn dùng để đọc: thành viên, trình độ, `playerRatings`, trận CLB (cho chemistry).
- Tên VĐV: **không** join trong query. Đội → `team_players.registration_id` → `registration.player_id` → `playerName(db, id)`
  [V `money.js:84`] — dùng lại helper có sẵn (sau này có khách cũng tự chạy vì `playerOf` đã xử lý khách).
  Gói trong selector `teamPlayers(tour, db, teamId)` ở `lib/tournament/`, không map rải rác trong JSX.
  Giới tính/trình độ đọc từ **snapshot** trong `registration`, không từ `db.members` (VĐV đổi trình độ sau khi
  đăng ký không làm đổi cân bằng đã ghép).

### 4.3 File

| Tầng | File |
|---|---|
| Migration | `supabase/migrations/0057_tournaments.sql` |
| Kiểm tay SQL | `supabase/manual/0057_tournament_check.sql` — dán vào Supabase SQL Editor SAU khi áp 0057. Một khối `DO`, kết thúc bằng lỗi cố ý `0057 CHECK OK …` để huỷ mọi dữ liệu thử (không có DB local). Payload sinh nhánh nhúng từ `bracket.js` |
| Mạng | `src/contexts/storage.js` — `loadTournaments`, `loadTournament`, `loadTournamentMatches`, `tournamentWrite`, `tournamentRpc` |
| Map | `src/contexts/dbmap.js` — `toTour(raw)`, `tourRows(table, list)`; **không** thêm vào `TABLES` |
| Action | `src/contexts/tournamentActions.js` — trải vào `makeActions` (`a.tourCreate`, `a.tourCommitMatch`…) — **[cần duyệt]** tách file vì `appActions.js` đã 4.551 dòng; vẫn là một namespace `a.*` |
| State | `src/contexts/AppContext.jsx` — state `tour` |
| Logic | `src/lib/tournament/*.js` (§3) |
| Route | `src/routes/index.js` — key `tournaments` `/giai-dau`, `tournament` `/giai-dau/:id`, `tournamentBracket` `/giai-dau/:id/nhanh/:eventId`, `tournamentFlow` `/giai-dau/:id/so-do`; `pathOf(key, id, sub)`; `keyOfPath` dùng `startsWith('/giai-dau/')` |
| Nav | `Sidebar.jsx` nhóm `ops` dưới `leaderboard` (repo **không có** nhóm "Thi đấu" [V]); icon `medal` (`trophy` đã dùng); sheet "Thêm" mobile |
| Trang | `src/pages/Tournaments.jsx`, `TournamentHub.jsx`, `TournamentBracket.jsx` (`TournamentFlow.jsx` phase sau) |
| Component | `src/components/tournament/` — `TournamentNav`, `InfoTab`, `PlayersTab`, `PairingTab`, `FormatTab`, `BracketTree`, `GroupTable`, `ScoreboardModal`, `MatchResultDialog` |
| Config / chữ | `app.json → tournament`, `vi.json → tournament.*` |

### 4.4 Cập nhật "live" trên gói free

- Trang nhánh/hub khi giải `running`: `loadTournamentMatches(id)` mỗi `cfg.tournament.pollMs` (15 s).
- Dừng poll khi `document.hidden`; chạy lại ngay khi quay lại tab.
- Nạp lại **toàn bộ trận của giải** (≤ ~100 dòng, vài chục KB) thay vì truy vấn chênh lệch — đơn giản, bắt
  được cả trận bị xoá khi `reset_stage`. Ước tính 1 máy × 4 giờ ≈ vài MB: không đáng kể so với hạn mức.

### 4.5 Bảng ghi điểm

- Điểm từng quả chỉ nằm ở máy trọng tài; lưu `localStorage['tourScore:'+matchId]` sau mỗi quả (khoá máy/F5
  không mất). Bọc try/catch.
- Mở bảng điểm → `tournament_start_match` (người khác thấy "đang đánh"). Xác nhận → `commit_match` **thành công**
  → `removeItem('tourScore:'+matchId)`. Lỗi thì giữ bản nháp.
- Mỗi lần nạp giải: xoá bản nháp của trận không còn `ready`/`live` (máy khác đã chốt, hoặc giai đoạn bị reset) —
  không thì mở lại bảng điểm sẽ hiện điểm cũ của trận đã xong.
- Poll **không** đè state bảng điểm đang mở.
- Phím `A`/`L`/`Z` là phụ; nút chạm ≥ 48 px là chính (trọng tài dùng điện thoại).
- Thanh "đổi sân" + cờ `SET POINT`/`MATCH POINT`/`DEUCE` từ `scoreFlags`.

---

## 5. Config `app.json → tournament` [P]

```json
"tournament": {
  "pollMs": 15000,
  "rulePresets": {
    "r1x15":  { "sets": 1, "points": 15, "winBy2": false, "cap": 15 },
    "r1x21":  { "sets": 1, "points": 21, "winBy2": true,  "cap": 30 },
    "r1x30":  { "sets": 1, "points": 30, "winBy2": false, "cap": 30 },
    "r3x15":  { "sets": 3, "points": 15, "winBy2": false, "cap": 15 },
    "r3x21":  { "sets": 3, "points": 21, "winBy2": true,  "cap": 30 }
  },
  "balance": { "okMax": 30, "warnMax": 70, "swapMinGain": 6 },
  "groupBalanceOk": 15,
  "standings": { "order": ["wins", "h2h2", "setDiff", "pointDiff", "h2hRemaining"] },
  "recommender": { "qualifyMin": 17, "finalMin": 28, "restMin": 3 }
}
```

`balance.*` là số của mock trên thang 400–620 **[A]** → phải chỉnh theo thang Elo thật sau khi có dữ liệu.

---

## 6. Giao diện (so với design)

| Màn design | Làm | Bỏ / đổi |
|---|---|---|
| Hub — Tổng quan | tiến độ trận, trận đang đánh, hàng chờ theo `seq_no` | "dự kiến kết thúc" ghi rõ *ước tính* |
| Hub — Thông tin & giải thưởng | form giải, sân, phí, quy định chung, giải thưởng, dự trù, thẻ tiền (§3 `finance.js`) | không có nút ghi sổ quỹ (D2) |
| Hub — Thí sinh | chọn thành viên, chip nội dung, tích đã đóng | **ẩn** thêm khách ngoài (D3) |
| Hub — Ghép cặp | ghép tay, ghim, tự động `balanced`/`random`, chỉ số cân (chỉ tô màu, không chặn), "Chốt đội hình" | fake hash; `seeded`/`chemistry`/gợi ý đổi → Phase 5 |
| Hub — Thể thức | chọn mẫu §1 + thông số + luật từng vòng, "Tạo lịch thi đấu" (→ `generate_stage`) | gợi ý thể thức ở Phase 5 |
| Nhánh đấu trực tiếp | cây nhánh, đường nối, nhập nhanh 1 set, bảng điểm, hoàn tác (bị chặn đúng luật), walkover/retired có lý do, đổi chỗ vòng đầu | **nút Quay, Tự chạy** (random winner); **bấm tên đội = thắng** |
| Sơ đồ tự do | Phase 6: xem dạng khối (pipeline) trước, canvas sau | |

UI theo `DESIGN.md`; đọc lại trước khi làm Phase 1.

### 6.2 Hiệu ứng nhánh đấu (Phase 3) — lấy nguyên từ handoff `Nhánh đấu trực tiếp.dc.html`

- **Đội thắng bay lên ô vòng sau** sau khi xác nhận kết quả (FLIP bằng Web Animations API): ô đích dịch từ vị trí
  ô cũ về chỗ, `scale 1.04 → 1.06 → 1`, bóng teal; rồi nền ô loé teal ~0,9 s mờ dần. Đội thua bán kết bay xuống 3-4.
- **Vô địch**: bay vào ô "Vô địch", loé vàng (`--podium-gold`), nảy `scale 1 → 1.07 → 1`.
- **Đường nối** sáng dần (`transition: border-color .4s`) khi nhánh có đội đi tiếp.
- **Mở nhánh lần đầu**: thẻ trận hiện dần theo vòng (`translateY 14px → 0`, trễ `vòng × 140ms + slot × 45ms`).
- Easing `cubic-bezier(.2,.8,.2,1)` (DESIGN §6). `prefers-reduced-motion` → bỏ hết hiệu ứng, chỉ đổi dữ liệu.
- Cặp "bay từ ô nào → tới ô nào" là **hàm thuần** `flightsOf(trướcKhiChốt, sauKhiChốt)` trong `lib/tournament/`, có test;
  component chỉ đọc kết quả để chạy animation. Máy khác nhận kết quả qua poll cũng thấy bay (so hai lần poll).

### 6.1 Bám thiết kế handoff (đã đối chiếu 2026-09-25)

**Handoff = TDMS ở dark mode.** Hầu hết hex trong `Giải đấu · desktop v2.dc.html` trùng đúng token của
`src/styles/tokens/dark.css`. Viết bằng token → dark mode giống hệt thiết kế, light mode tự đúng. **Cấm chép hex.**

| Hex trong handoff | Token |
|---|---|
| `#080F1C` | `--surface-nav` |
| `#141D2E` · `#1A2437` · `#0F1626` | `--surface-card` · `--surface-raised` · `--surface-inset` |
| `#22304A` · `#2E3E5C` · `#1D2A42` | `--border-subtle` · `--border-default` · `--border-nav` |
| `#E9EFF7` · `#A8B7CB` · `#8494AA` · `#6F809A` | `--text-primary` · `--text-secondary` · `--text-muted` · `--text-disabled` |
| `#00B2A9` + chữ `#04302C` | `--teal-500` / `--action-accent-*` |
| `#5FD9A2` · `#5FDBD3` · `#F0B75C` · `#F07F72` | `--status-delivered-fg` · `--status-transit-fg` · `--status-delayed-fg` · `--status-incident-fg` |
| `#8FC2FF` · `#F4A5C8` (nam / nữ) | `--gender-nam-fg` · `--gender-nu-fg` (+ `-bg`) |

Chữ: tên giải và số lớn ở hero → `--font-display` (Barlow). Ngày, giờ, tiền, số lượng, rating → `--font-mono`.

**Bố cục Hub** (`/giai-dau/:id`), từ trên xuống:
1. **Hero** — pill trạng thái + dòng phụ; tên giải (display); dòng meta mono `Thứ 7, 26/09 · <địa điểm> · <n> sân ·
   07:30–12:00 · <phạm vi>`; cụm số hero bên phải (VĐV · nội dung · …).
2. **Hàng thẻ nội dung** — mỗi thẻ: mã (ĐN/ĐNN…), tên, trạng thái, thể thức, thanh tiến độ; cuối hàng nút
   `+ Nội dung`. Chọn thẻ = đổi nội dung đang xem. **Thêm/sửa nội dung ở đây, không phải trong tab Thông tin.**
3. **Stepper tab** — nút có ô số (`TQ`, `i`, `1`, `2`, `3`), nhãn và dòng phụ trạng thái:
   Tổng quan · Thông tin & giải thưởng · ① Thí sinh · ② Thể thức · ③ Ghép cặp. **Không có tab "Nhánh đấu"** —
   nhánh là trang riêng, vào qua thanh module (GiaiDauNav: Tổng quan & đăng ký → Sơ đồ → Nhánh đấu).
4. Nội dung tab.

**Phase 1 làm gì / ẩn gì** (không để nút chết):
- Làm: hero · hàng nội dung · stepper chỉ gồm các tab đã có (Tổng quan, Thông tin, Thí sinh) · 3 tab đó.
- Ẩn tới khi có tính năng: thanh module GiaiDauNav (Phase 3) · nút hero "Link đăng ký", "Màn hình trình chiếu",
  "Nhập tỷ số" · dải sân LIVE, bảng xếp hạng bảng, nhánh thu nhỏ trong Tổng quan · cột "Nguồn" và
  "+ Thêm người ngoài" ở Thí sinh (D3).
- **Tổng quan** giai đoạn chưa chạy = khối **"Trước khi bắt đầu"** của handoff (`ovDraft`): checklist việc còn thiếu
  (có nội dung · có thí sinh · đã thu đủ phí…), mỗi dòng một nút đi tới tab tương ứng.
- **Thông tin & giải thưởng** theo đúng thứ tự handoff: Thời gian & địa điểm · Lệ phí (nam/nữ, kèm số người
  "tính theo VĐV đã đăng ký") · Tổng thu · Dự trù chi (`+ Thêm khoản chi`) · Tiền thưởng (tự tính từ cơ cấu giải)
  · Tổng chi · Cơ cấu giải thưởng (`/đội`) · Quy định chung. Số dư = thu − chi, nhãn "Trích quỹ CLB" / "Thiếu, cần bù".
- **Thí sinh**: bảng Tên · Giới · Rating · Nội dung đăng ký (chip bật/tắt). Chip khoá khi nội dung đã `drawn`
  (DB cũng chặn — trigger `eventLocked`), hiện lý do.

**Mobile (≤ 768px, `useMobile(768)`)** — handoff chỉ có desktop 1320px: hero xếp dọc, hàng nội dung và stepper
cuộn ngang, bảng Thí sinh thành danh sách thẻ, chạm ≥ 48px. Thêm "Giải đấu" vào sheet "Thêm".

---

## 7. Kế hoạch theo phase

**MVP = Phase 0–3** — đủ chạy lại nguyên giải mùa 1. Schema đã phủ cả vòng bảng nên Phase 4 chỉ thêm code.

**Tiến độ (2026-09-25):** Phase 0–3 đã code xong, có test logic + render test giao diện (`src/__tests__/tournament/`).
0057 đã chạy thử trên Postgres 15 tạm (14/14 bước) — CHƯA áp lên production. User kiểm tay toàn bộ khi xong mọi phase.

| Phase | Nội dung | Xong khi |
|---|---|---|
| **0 — Nền** ✅ | 0057 (§2, RPC trừ `close_stage`) + file kiểm tay SQL · `storage`/`dbmap`/state `tour` · `lib/tournament/`: `scoring`, `bracket`, `advance`, `finance` + test · ~~`format`~~ dời Phase 2 (chưa có ai dùng; test nghiệm thu tự dựng giai đoạn) | `npm test` xanh **và** script SQL chạy qua trọn chuỗi `generate → commit → advance → undo` (+ hoàn tác bị chặn, walkover, điểm sai luật bị RPC từ chối). **Chưa qua thì không bắt đầu Phase 1** — đây là phần rủi ro logic cao nhất |
| **1 — Hub** ✅ | route + nav · danh sách giải · tab Thông tin (giải thưởng, dự trù, thẻ tiền) · tab Thí sinh | Tạo được giải mùa 1, thẻ tiền ra đúng số §8 |
| **2 — Đội & thể thức** ✅ | `pairing.js` + tab Ghép cặp · `format.js` (mẫu `ko`) + tab Thể thức (luật theo vòng) · `schedule.js` · nút Tạo lịch | 3 nội dung có đội, sinh đủ 24 trận |
| **3 — Nhánh đấu** ✅ | trang nhánh · bảng điểm · chốt/sửa/hoàn tác/walkover/đổi chỗ/xếp lịch · poll | Đánh hết 24 trận trên 2 máy cùng lúc không mất đội |
| **4 — Vòng bảng** ✅ | `roundRobin`, `standings`, `links` · mẫu `rr`, `rr_ko`, `rr_ko_plate` · "Chốt giai đoạn" (BTC đảo đội hoà bằng ↑) · trang nhánh chuyển giai đoạn · migration `0058` | Test §3.1 đủ ca hoà 2/3 đội. **0058 chưa áp production** — áp rồi chạy `supabase/manual/0058_tournament_round_robin_check.sql` |
| **5 — Gợi ý & ghép nâng cao** ✅ | `recommend.js` (cả giải, README §5.7; BTC chỉ chọn ưu tiên — số đội/sân/giờ/luật đọc từ giải) + `RecommendDialog` áp dụng 1 lần · ghép `seeded`/`chemistry` (dùng lại `calcPairImpact`) · `suggestSwap` + nút "Đổi ngay" | Với số liệu mùa 1 trả về `ko` là phương án vừa giờ (`recommend.test.js`) |
| 6a — Sơ đồ ✅ | `/giai-dau/:id/so-do` chỉ xem: mọi nội dung một màn, khối đội → giai đoạn → (hạng đi đâu) → người thắng; bấm khối mở đúng giai đoạn ở trang nhánh (`?stage=`) · thanh module 3 bước · `flow.js` + test | — |
| **6 — Hoàn tất** ✅ | canvas kéo thả (`FlowCanvas`, `canvas.js`) · khách ngoài (`tournament_guests`) · chuông sắp tới lượt · làm gọn đăng ký (D10) · migration `0059` | `npm test` xanh. **0058, 0059 chưa áp production** — áp rồi chạy `supabase/manual/0058_…`, `0059_tournament_check.sql` |
| Không làm | nối sổ quỹ — **giữ tượng trưng** (D2, chốt lại ở Phase 6) | — |
| **6b — Canvas bám handoff** ✅ | Trình dựng toàn màn: thanh số liệu (khối · trận · giờ ước tính) + Tạo nhanh + Công bố & chạy nhánh · khay khối kéo vào · khay cặp chưa xếp (kéo cặp vào/ra bảng) · khối bảng hiện đội, khối loại hiện nhánh thu nhỏ (dựng bằng chính `buildKnockout`) · kéo chấm để nối · phóng to/thu nhỏ/căn khung · Kiểm tra sơ đồ đủ mọi cảnh báo · trang nhánh có thanh "Thiết lập nhánh" chỉ đọc | Thụy Sĩ và nút Quay/tự chạy vẫn không làm (không thuật toán / ghi kết quả bịa) |
| **6c — Rà soát đủ handoff** ✅ | Thí sinh: lọc Tất cả/Khách, cột Nguồn, SĐT khách, báo khách khi giải nội bộ, nút sang Ghép cặp · thẻ nội dung: khách + x/y cặp đủ · Tổng quan: nhánh thu nhỏ · Ghép cặp: nhận xét từng cặp, So với TB · Thể thức: mẫu CLB (migration `0060`), Sửa trên sơ đồ tự do, luật tự chỉnh (`RuleField`), Mỗi đội đá ít nhất · Gợi ý: chọn phương án khác + nhãn + luật gợi ý · Canvas: kéo nền / cuộn phóng, chọn đường nối, Đưa hết về khay, Cặp mỗi bảng, Độ cân các bảng, lượt miễn, hộp Tạo nhanh, "vừa lưu" · Nhánh: thiết lập sửa được + "Xong · tạo lại nhánh", kéo đổi chỗ vòng đầu, câu kết trận, Hạng 3 | **0058, 0059, 0060 chưa áp production** |

Mỗi phase là một lần duyệt riêng (>5 file). Không tự `npm run build`; user build và bấm thử theo checklist.

---

## 8. Test [P]

Đặt tại `src/__tests__/tournament/`, `node:assert/strict`, **mutation-test** sau khi viết (RULES §5).

| File | Khoá luật |
|---|---|
| `scoring.test.js` | toàn bộ bảng ca §2.3 (thắng / chưa xong / sai, gồm 30-30 và 24-21); cờ deuce/set/match point |
| `bracket.test.js` | 4/8/16/32 đội; 5–7 đội: bye vào hạt giống đầu, không có cặp bye–bye; `slot` giữ thứ tự bốc thăm; con trỏ thua bán kết → 3-4; `roundKind` + luật chép đúng (bán kết dùng luật vòng loại) |
| `advance.test.js` | chốt đẩy đúng ô; hoàn tác gỡ cả CK lẫn 3-4; hoàn tác trận `walkover` và `retired` cũng gỡ downstream + xoá `result_note`; chặn hoàn tác khi trận đích đã `live`/xong; sửa điểm giữ người thắng ✓; sửa điểm làm đổi người thắng → bị từ chối (không có ca "edit đổi winner"); đổi winner = undo + commit ✓; bye tự đi; `reset` bị chặn khi đã có kết quả |
| `pairing.test.js` | giới tính theo nội dung; chỉ ghép người đã đăng ký nội dung; ghim không bị đụng; đơn = 1 người/đội |
| `finance.test.js` | tổng dự kiến / đã thu / còn thiếu; người `withdrawn` |
| `masters_pk_2026.test.js` | **Nghiệm thu**: dựng lại giải mùa 1 (3 nội dung × 8 đội, luật như quy chế) → 24 trận, 6 trận dùng luật 3×15; giải thưởng 1.350.000đ = 450k × 3; tổng chi 3.875.000đ |
| Phase 4: `standings.test.js`, `links.test.js` | hoà 2 đội xét đối đầu trước; hoà 3 đội; hoà không phân xử → `ties`; A1–B2 khác nửa nhánh |
| `sync/tournament_map.test.js` | map 2 chiều; bảng giải **không** có trong `TABLES` (chặn tái phạm §4.1) |

Code chạm Supabase (RPC, RLS) kiểm tay bằng `supabase/manual/0057_tournament_check.sql`.

---

## 9. Cần duyệt

1. ~~Toàn bộ v2 để bắt đầu Phase 0~~ — **đã duyệt 2026-09-25** (kèm các điều chỉnh v2.1 bên dưới).
2. ~~`tournamentActions.js` tách riêng~~ — **đã duyệt**.
3. ~~Thứ tự xếp hạng vòng bảng §3.1~~ — **đã duyệt: BWF cố định** (không theo thứ tự tuỳ chỉnh của handoff). Hoà không tách được → BTC đảo bằng ↑ trước khi chốt.
4. ~~Số đội mùa 1~~ — thực tế 10 nam 8 nữ; mùa 1 đã xong nên giữ nguyên test nghiệm thu. Yêu cầu: thể thức **linh hoạt** cho mùa sau (số đội lẻ, bảng lệch nhau 1 đội). Tab Thể thức cho chọn 1–4 bảng, 1–3 đội đi tiếp/bảng, nhánh phụ lấy hạng kế tiếp / 2 hạng kế tiếp / mọi đội còn lại; khoá bằng `flex_formats.test.js`.

## 10. Rủi ro còn lại

- `schedule.js` là xếp thứ tự đơn giản, không tối ưu đường găng; BTC chỉnh tay.
- Poll 15 s: người xem trễ tối đa 15 s — đủ cho giải CLB.
- `rating_snapshot` chụp lúc đăng ký: Elo đổi sau đó không làm đổi cân bằng đã ghép (cố ý).
